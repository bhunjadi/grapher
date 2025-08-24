// 1. Clone children with meta relationships
// 2. Apply $metadata to children
// 3. Removes link storage (if not specified)
// 4. Stores oneResult links as a single object instead of array
import applyReducers from '../reducers/lib/applyReducers';
import cleanReducerLeftovers from '../reducers/lib/cleanReducerLeftovers';
import "mingo/init/system";
import { Query } from 'mingo';
import { Aggregator } from 'mingo/aggregator';
import dot from 'dot-object';
import {Minimongo} from 'meteor/minimongo';
import CollectionNode from '../nodes/collectionNode';
import { isObject, isUndefined, isEmpty, omit } from '../../utils.js';

export default async (node, params) => {
    snapBackCaches(node);
    storeOneResults(node, node.results);

    await applyReducers(node, params);

    for (const collectionNode of node.collectionNodes) {
        cloneMetaChildren(collectionNode, node.results)
    }

    for (const collectionNode of node.collectionNodes) {
        assembleMetadata(collectionNode, node.results)
    }

    cleanReducerLeftovers(node, node.results);

    removeLinkStorages(node, node.results);

    applyPostFilters(node);
    applyPostOptions(node);
    applyPostFilter(node, params);
}

export function applyPostFilters(node) {
    const postFilters = node.props.$postFilters;
    if (postFilters) {
        // Define the order of pipeline stages (MongoDB requires certain ordering)
        const stageOrder = [
            '$match', '$lookup', '$unwind', '$group', 
            '$project', '$sort', '$skip', '$limit'
        ];
        
        // Check if we have any aggregation operations
        const hasAggregationStages = stageOrder.some(stage => postFilters[stage]);
        
        if (hasAggregationStages) {
            // Handle aggregation operations
            const pipeline = [];
            
            // Add stages in the correct order if they exist in postFilters
            stageOrder.forEach(stage => {
                if (postFilters[stage]) {
                    pipeline.push({ [stage]: postFilters[stage] });
                }
            });
            
            // Apply the aggregation pipeline
            const aggregator = new Aggregator(pipeline);
            node.results = aggregator.run(node.results);
        } else {
            // Use the existing filtering approach for non-aggregation filters
            node.results = node.results.filter(item => new Query(postFilters).test(item));
        }
    }
}

export function applyPostOptions(node) {
    const options = node.props.$postOptions;
    if (options) {
        if (options.sort) {
            const sorter = new Minimongo.Sorter(options.sort);
            node.results.sort(sorter.getComparator());
        }
        if (options.limit || options.skip) {
            const start = options.skip || 0;
            const end = options.limit ? options.limit + start : node.results.length;
            node.results = node.results.slice(start, end);
        }
    }
}


/**
 * Optionally applies a post filtering option
 */
function applyPostFilter(node, params) {
    if (node.props.$postFilter) {
        const filter = node.props.$postFilter;

        if (Array.isArray(filter)) {
            filter.forEach(f => {
                node.results = f(node.results, params);
            })
        } else {
            node.results = filter(node.results, params);
        }
    }
}

/**
 *
 * Helper function which transforms results into the array.
 * Results are an object for 'one' links.
 *
 * @param results
 * @return array
 */
export function getResultsArray(results) {
    if (Array.isArray(results)) {
        return results;
    }
    else if (isUndefined(results)) {
        return [];
    }
    return [results];
}

export function removeLinkStorages(node, sameLevelResults) {
    if (!sameLevelResults) {
        return;
    }

    sameLevelResults = getResultsArray(sameLevelResults);

    for (const collectionNode of node.collectionNodes) {
        const removeStorageField = collectionNode.shouldCleanStorage;
        for (const result of sameLevelResults) {
            if (removeStorageField) {
                const isSingle = collectionNode.linker.isSingle();
                const [root, ...nested] = collectionNode.linkStorageField.split('.');

                const removeFromResult = (result, removeEmptyRoot = false) => {
                    if (isSingle) {
                        dot.pick(collectionNode.linkStorageField, result, true);
                        if (removeEmptyRoot && nested.length > 0 && isEmpty(result[root])) {
                            delete result[root];
                        }
                    }
                    else {
                        if (nested.length > 0) {
                            const arr = result[root] || [];
                            if (Array.isArray(arr)) {
                                arr.forEach(obj => dot.pick(nested.join('.'), obj, true));
                                if (removeEmptyRoot && nested.length > 0 && arr.every(obj => isEmpty(obj))) {
                                    delete result[root];
                                }
                            }
                        }
                        else {
                            delete result[collectionNode.linkStorageField];
                        }
                    }
                };

                if (collectionNode.isVirtual) {
                    const childResults = getResultsArray(result[collectionNode.linkName]);
                    for (const childResult of childResults) {
                        removeFromResult(childResult);
                    }
                } else {
                    removeFromResult(result);
                }
            }

            removeLinkStorages(collectionNode, result[collectionNode.linkName]);
        }
    }
}

function removeArrayFromObject(result, linkName) {
    const linkData = dot.pick(linkName, result);
    if (linkData && Array.isArray(linkData)) {
        dot.remove(linkName, result);
        dot.str(linkName, linkData?.at(0), result);
    }
}

function removeArrayForOneResult(result, linkName) {
    const [root, ...rest] = linkName.split('.');

    const rootValue = result[root];
    if (rest.length > 0 && Array.isArray(rootValue)) {
        rootValue.forEach(value => {
            removeArrayFromObject(value, rest.join('.'));
        });
    }
    else {
        removeArrayFromObject(result, linkName);
    }
}

export function storeOneResults(node, sameLevelResults) {
    if (!sameLevelResults || !Array.isArray(sameLevelResults)) {
        return;
    }

    node.collectionNodes.forEach(collectionNode => {
        for (const result of sameLevelResults) {
            // The reason we are doing this is that if the requested link does not exist
            // It will fail when we try to get undefined[something] below
            if (!result) {
                return;
            }

            const [root, ...rest] = collectionNode.linkName.split('.');
            if (rest.length === 0) {
                storeOneResults(collectionNode, result[root]);
            }
            else {
                const rootValue = result[root];
                if (Array.isArray(rootValue)) {
                    rootValue.forEach(value => {
                        storeOneResults(collectionNode, dot.pick(rest.join('.'), value));
                    });
                }
                else if (isObject(rootValue)) {
                    storeOneResults(collectionNode, dot.pick(rest.join('.'), rootValue));
                }
            }
        }

        if (collectionNode.isOneResult) {
            for (const result of sameLevelResults) removeArrayForOneResult(result, collectionNode.linkName);
        }
    })
}

function cloneMetaChildren(node, parentResults) {
    if (!parentResults) {
        return;
    }

    const linkName = node.linkName;
    const isMeta = node.isMeta;

    // parentResults might be an object (for type==one links)
    parentResults = getResultsArray(parentResults);

    parentResults.forEach(parentResult => {
        if (isMeta && parentResult[linkName]) {
            if (node.isOneResult) {
                parentResult[linkName] = Object.assign({}, parentResult[linkName]);
            }
            else {
                parentResult[linkName] = parentResult[linkName].map(object => {
                    return Object.assign({}, object);
                });
            }
        }

        node.collectionNodes.forEach(collectionNode => {
            cloneMetaChildren(collectionNode, parentResult[linkName]);
        });
    });
}

export function assembleMetadata(node, parentResults) {
    parentResults = getResultsArray(parentResults);

    // assembling metadata is depth first
    node.collectionNodes.forEach(collectionNode => {
        for (const result of parentResults) {
            assembleMetadata(collectionNode, result[node.linkName])
        }
    });

    if (node.isMeta) {
        if (node.isVirtual) {
            for (const parentResult of parentResults) {
                const childResult = parentResult[node.linkName];

                if (node.isOneResult) {
                    if (isObject(childResult)) {
                        const storage = childResult[node.linkStorageField];
                        storeMetadata(childResult, parentResult, storage, true);
                    }
                } else {
                    const childArray = Array.isArray(childResult) ? childResult : [];
                    for (const element of childArray) {
                        const storage = element[node.linkStorageField];
                        storeMetadata(element, parentResult, storage, true);
                    }
                }
            }
        } else {
            for (const parentResult of parentResults) {
                const childResult = parentResult[node.linkName];
                const storage = parentResult[node.linkStorageField];

                if (node.isOneResult) {
                    if (childResult) {
                        storeMetadata(childResult, parentResult, storage, false);
                    }
                } else {
                    const childArray = Array.isArray(childResult) ? childResult : [];
                    for (const element of childArray) {
                        storeMetadata(element, parentResult, storage, false);
                    }
                }
            }
        }
    }
}

function storeMetadata(element, parentElement, storage, isVirtual) {
    if (isVirtual) {
        let $metadata;
        if (Array.isArray(storage)) {
            $metadata = storage.find(storageItem => storageItem._id == parentElement._id);
        } else {
            $metadata = storage;
        }

        element.$metadata = omit($metadata, '_id')
    } else {
        let $metadata;
        if (Array.isArray(storage)) {
            $metadata = storage.find(storageItem => storageItem._id == element._id);
        } else {
            $metadata = storage;
        }

        element.$metadata = omit($metadata, '_id');
    }
}

function snapBackCaches(node) {
    node.collectionNodes.forEach(collectionNode => {
        snapBackCaches(collectionNode);
    });

    if (!isEmpty(node.snapCaches)) {
        // process stuff
        for (const [cacheField, linkName] of Object.entries(node.snapCaches || {})) {
            const isSingle = (node.snapCachesSingles || []).includes(cacheField);
            const linker = node.collection.getLinker(linkName);
            // we do this because for one direct and one meta direct, id is not stored
            const shoudStoreLinkStorage = !linker.isMany() && !linker.isVirtual();

            node.results.forEach(result => {
                const cached = result[cacheField];
                if (cached) {
                    if (shoudStoreLinkStorage) {
                        Object.assign(cached, {
                            _id: linker.isMeta()
                                ? result[linker.linkStorageField]._id
                                : result[linker.linkStorageField]
                        });
                    }

                    if (isSingle && Array.isArray(cached)) {
                        result[linkName] = cached?.at(0);
                    } else {
                        result[linkName] = cached;
                    }

                    delete result[cacheField];
                } else {
                    // Materialize empty containers when cache missing
                    result[linkName] = isSingle ? {} : [];
                }
            })
        }
    }
}
