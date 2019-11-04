import { _ } from 'meteor/underscore';
import { isFieldInProjection } from '../lib/fieldInProjection';

export default function (childCollectionNode, filters, options, userId) {
    let containsDottedFields = false;
    const linker = childCollectionNode.linker;
    const linkStorageField = linker.linkStorageField;
    const collection = childCollectionNode.collection;

    let pipeline = [];

    if (collection.firewall) {
        collection.firewall(filters, options, userId);
    }

    filters = cleanUndefinedLeafs(filters);

    pipeline.push({$match: filters});

    if (options.sort && _.keys(options.sort).length > 0) {
        pipeline.push({$sort: options.sort})
    }

    const groupingField = linkStorageField + (linker.isMeta() ? '._id' : '');
    const dataProjection = {};
    _.each(options.fields, (value, field) => {
        dataProjection[field] = 1;
    });

    if (!isFieldInProjection(dataProjection, linkStorageField, true)) {
        dataProjection[linkStorageField] = 1;
    }

    pipeline.push({
        $project: {
            ...dataProjection,
        },
    });

    pipeline.push({
        $group: {
            _id: "$" + groupingField,
            data: {
                $push: '$$ROOT',
            }
        }
    });

    if (options.limit || options.skip) {
        let $slice = ["$data"];
        if (options.skip) $slice.push(options.skip);
        if (options.limit) $slice.push(options.limit);

        pipeline.push({
            $project: {
                _id: 1,
                data: {$slice}
            }
        })
    }

    function cleanUndefinedLeafs(tree) {
        const a = Object.assign({}, tree);
        _.each(a, (value, key) => {
            if (value === undefined) {
                delete a[key];
            }

            if (!_.isArray(value) && _.isObject(value)) {
                a[key] = cleanUndefinedLeafs(value);
            }
        })

        return a;
    }

    return {pipeline, containsDottedFields};
}