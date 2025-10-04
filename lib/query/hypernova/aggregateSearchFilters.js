import { Query } from 'mingo';
import dot from 'dot-object';
import { isObject, flatten, uniq, union, pluck } from '../lib/../../utils.js';

function getIdsFromObject(object, field) {
    const parts = field.split('.');
    if (parts.length === 1) {
        const value = dot.pick(field, object);
        return Array.isArray(value) ? value : [value];
    }

    const rootValue = object[parts[0]];
    if (Array.isArray(rootValue)) {
        return rootValue.map(item => dot.pick(parts.slice(1).join('.'), item));
    }
    else if (isObject(rootValue)) {
        return [dot.pick(parts.slice(1).join('.'), rootValue)];
    }
    return [];
}

function extractIdsFromArray(array, field) {
    return flatten((array || []).map(obj => isObject(obj) ? getIdsFromObject(obj, field) : [])).filter(v => !!v);
}

/**
 * Its purpose is to create filters to get the related data in one request.
 */
export default class AggregateFilters {
    constructor(collectionNode, metaFilters) {
        this.collectionNode = collectionNode;
        this.linker = collectionNode.linker;
        this.metaFilters = metaFilters;
        this.isVirtual = this.linker.isVirtual();

        this.linkStorageField = this.linker.linkStorageField;
    }

    get parentObjects() {
        return this.collectionNode.parent.results;
    }

    get foreignIdentityField() {
        return this.linker.foreignIdentityField;
    }

    create() {
        switch (this.linker.strategy) {
            case 'one':
                return this.createOne();
            case 'one-meta':
                return this.createOneMeta();
            case 'many':
                return this.createMany();
            case 'many-meta':
                return this.createManyMeta();
            default:
                throw new Meteor.Error(`Invalid linker type: ${this.linker.type}`);
        }
    }

    createOne() {
        if (!this.isVirtual) {
            return {
                [this.foreignIdentityField]: {
                    $in: uniq(extractIdsFromArray(this.parentObjects, this.linkStorageField))
                }
            };
        } else {
            return {
                [this.linkStorageField]: {
                    $in: uniq(
                        pluck(this.parentObjects, '_id')
                    )
                }
            };
        }
    }

    createOneMeta() {
        if (!this.isVirtual) {
            let eligibleObjects = this.parentObjects;

            if (this.metaFilters) {
                eligibleObjects = (this.parentObjects || []).filter(object => {
                    return new Query(this.metaFilters).test(object[this.linkStorageField]);
                });
            }

            const storages = pluck(eligibleObjects, this.linkStorageField);
            let ids = [];
            for (const storage of storages) {
                if (storage) {
                    ids.push(storage._id);
                }
            }

            return {
                _id: {$in: uniq(ids)}
            };
        } else {
            let filters = {};
            if (this.metaFilters) {
                for (const [key, value] of Object.entries(this.metaFilters)) {
                    filters[this.linkStorageField + '.' + key] = value;
                }
            }

            filters[this.linkStorageField + '._id'] = {
                $in: uniq(
                    pluck(this.parentObjects, '_id')
                )
            };

            return filters;
        }
    }

    createMany() {
        if (!this.isVirtual) {
            const [root, ...nested] = this.linkStorageField.split('.');
            const arrayOfIds = union(...extractIdsFromArray(this.parentObjects, root));
            return {
                [this.foreignIdentityField]: {
                    $in: uniq(nested.length > 0 ? extractIdsFromArray(arrayOfIds, nested.join('.')) : arrayOfIds)
                }
            };
        } else {
            const arrayOfIds = pluck(this.parentObjects, this.foreignIdentityField);
            return {
                [this.linkStorageField]: {
                    $in: uniq(
                        union(...arrayOfIds)
                    )
                }
            };
        }
    }

    createManyMeta() {
        if (!this.isVirtual) {
            let ids = [];

            for (const parentObject of this.parentObjects || []) {
                if (parentObject[this.linkStorageField]) {
                    if (this.metaFilters) {
                        const isValid = obj => new Query(this.metaFilters).test(obj);
                        for (const storageItem of parentObject[this.linkStorageField]) {
                            if (isValid(storageItem)) ids.push(storageItem._id);
                        }
                    } else {
                        for (const storageItem of parentObject[this.linkStorageField]) ids.push(storageItem._id);
                    }
                }
            }

            return {
                _id: {$in: uniq(ids)}
            };
        } else {
            let filters = {};
            if (this.metaFilters) {
                for (const [key, value] of Object.entries(this.metaFilters)) {
                    filters[key] = value;
                }
            }

            filters._id = {
                $in: uniq(
                    pluck(this.parentObjects, '_id')
                )
            };

            return {
                [this.linkStorageField]: {
                    $elemMatch: filters
                }
            };
        }
    }
}