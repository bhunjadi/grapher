import sift from 'sift';
import dot from 'dot-object';

export default function createSearchFilters(object, linker, metaFilters) {
    const fieldStorage = linker.linkStorageField;

    const strategy = linker.strategy;
    if (!linker.isVirtual()) {
        switch (strategy) {
            case 'one': return createOne(object, linker);
            case 'one-meta': return createOneMeta(object, fieldStorage, metaFilters);
            case 'many': return createMany(object, linker);
            case 'many-meta': return createManyMeta(object, fieldStorage, metaFilters);
            default:
                throw new Meteor.Error(`Invalid linking strategy: ${strategy}`)
        }
    } else {
        switch (strategy) {
            case 'one': return createOneVirtual(object, linker);
            case 'one-meta': return createOneMetaVirtual(object, fieldStorage, metaFilters);
            case 'many': return createManyVirtual(object, linker);
            case 'many-meta': return createManyMetaVirtual(object, fieldStorage, metaFilters);
            default:
                throw new Meteor.Error(`Invalid linking strategy: ${strategy}`)
        }
    }
}

function getForeignField(config) {
    return config.foreignField || '_id';
}

export function createOne(object, linker) {
    return {
        [getForeignField(linker.linkConfig)]: dot.pick(linker.linkStorageField, object)
    };
}

export function createOneVirtual(object, linker) {
    return {
        [linker.linkStorageField]: object[getForeignField(linker.linkConfig.relatedLinker.linkConfig)]
    };
}

export function createOneMeta(object, fieldStorage, metaFilters) {
    const value = object[fieldStorage];

    if (metaFilters) {
        if (!sift(metaFilters)(value)) {
            return {_id: undefined};
        }
    }

    return {
        _id: value ? value._id : value
    };
}

export function createOneMetaVirtual(object, fieldStorage, metaFilters) {
    let filters = {};
    if (metaFilters) {
        _.each(metaFilters, (value, key) => {
            filters[fieldStorage + '.' + key] = value;
        })
    }

    filters[fieldStorage + '._id'] = object._id;

    return filters;
}

export function createMany(object, linker) {
    const foreignField = getForeignField(linker.linkConfig);
    const [root, ...nested] = linker.linkStorageField.split('.');
    if (nested.length > 0) {
        const arr = object[root];
        const ids = arr ? _.uniq(_.union(arr.map(obj => _.isObject(obj) ? dot.pick(nested.join('.'), obj) : []))) : [];

        return {
            [foreignField]: {$in: ids}
        };
    }
    const value = object[linker.linkStorageField];
    return {
        [foreignField]: {
            $in: _.isArray(value) ? value : (value ? [value] : []),
        }
    };
}

export function createManyVirtual(object, linker) {
    const foreignField = getForeignField(linker.linkConfig.relatedLinker.linkConfig);
    return {
        [linker.linkStorageField]: object[foreignField]
    };
}

export function createManyMeta(object, fieldStorage, metaFilters) {
    let value = object[fieldStorage];

    if (metaFilters) {
        value = sift(metaFilters, value)
    }

    return {
        _id: {
            $in: _.pluck(value, '_id') || []
        }
    };
}

export function createManyMetaVirtual(object, fieldStorage, metaFilters) {
    let filters = {};
    if (metaFilters) {
        _.each(metaFilters, (value, key) => {
            filters[key] = value;
        })
    }

    filters._id = object._id;

    return {
        [fieldStorage]: {$elemMatch: filters}
    };
}