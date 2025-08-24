import createSearchFilters from '../../links/lib/createSearchFilters';
import cleanObjectForMetaFilters from './lib/cleanObjectForMetaFilters';
import { Query } from 'mingo';
import dot from 'dot-object';
import { isUndefined, isObject, flatten, union, pluck, groupBy } from '../../utils.js';

/**
 *
 * getIdsForMany
 *
 * Possible options:
 *
 * A. array of ids directly inside the parentResult
 * {
 *  projectIds: [...],
 * }
 *
 * B. array of ids in nested document
 * {
 *   nested: {
 *     projectIds: [...],
 *   }
 * }
 *
 * Case for link with foreignIdentityField on projectId. This is still 'many' link because mapping could be one to many.
 * {
 *   nested: {
 *     projectId: 1.
 *   },
 * }
 *
 * C. array of ids in nested array
 * {
 *    nestedArray: [{
 *      projectIds: [...],
 *    }, {
 *      projectIds: [...],
 *    }]
 * }
 *
 * Case with foreign identity field.
 * {
 *    nestedArray: [{
 *      projectId: 1,
 *    }, {
 *      projectId: 2,
 *    }]
 * }
 */
function getIdsForMany(parentResult, fieldStorage) {
  // support dotted fields
  const [root, ...nested] = fieldStorage.split('.');
  const value = dot.pick(root, parentResult);

  if (isUndefined(value) || value === null) {
    return [];
  }

  // Option A.
  if (nested.length === 0) {
    return Array.isArray(value) ? value : [value];
  }

  // Option C.
  if (Array.isArray(value)) {
    return flatten(value.map((v) => getIdsFromObject(v, nested.join('.'))));
  }

  // Option B
  if (isObject(value)) {
    return getIdsFromObject(value, nested.join('.'));
  }

  return [];
}

function getIdsFromObject(object, path) {
  const pickedValue = dot.pick(path, object);
  return Array.isArray(pickedValue)
    ? pickedValue
    : (pickedValue === undefined || pickedValue === null)
    ? []
    : [pickedValue];
}

export function assembleMany(
  parentResult,
  { childCollectionNode, linker, limit, skip, resultsByKeyId },
) {
  const fieldStorage = linker.linkStorageField;

  const [root, ...rest] = fieldStorage.split('.');
  const rootValue = parentResult[root];
  if (!rootValue) {
    return;
  }

  const [, ...nestedLinkPath] = childCollectionNode.linkName.split('.');
  if (nestedLinkPath.length > 0 && Array.isArray(rootValue)) {
    rootValue.forEach((result) => {
      const results = flatten(
        union(
          ...getIdsForMany(result, rest.join('.')).map(
            (id) => resultsByKeyId[id],
          ),
        ),
      );
      const data = filterAssembledData(results, { limit, skip });
      dot.set(nestedLinkPath.join('.'), data, result);
    });
    return;
  }

  const results = union(
    ...getIdsForMany(parentResult, fieldStorage).map(
      (id) => resultsByKeyId[id],
    ),
  );
  const data = filterAssembledData(results, { limit, skip });
  dot.str(childCollectionNode.linkName, data, parentResult);
}

export function assembleManyMeta(
  parentResult,
  { childCollectionNode, linker, skip, limit, resultsByKeyId },
) {
  const fieldStorage = linker.linkStorageField;

  const _ids = pluck(parentResult[fieldStorage], '_id');
  let data = [];
  _ids.forEach((_id) => {
    data.push(resultsByKeyId[_id]?.at(0));
  });

  parentResult[childCollectionNode.linkName] = filterAssembledData(data, {
    limit,
    skip,
  });
}

export function assembleOneMeta(
  parentResult,
  { childCollectionNode, linker, limit, skip, resultsByKeyId },
) {
  const fieldStorage = linker.linkStorageField;

  if (!parentResult[fieldStorage]) {
    return;
  }

  const _id = parentResult[fieldStorage]._id;
  parentResult[childCollectionNode.linkName] = filterAssembledData(
    resultsByKeyId[_id],
    { limit, skip },
  );
}

export function assembleOne(
  parentResult,
  { childCollectionNode, linker, limit, skip, resultsByKeyId },
) {
  const fieldStorage = linker.linkStorageField;

  const [root, ...rest] = fieldStorage.split('.');
  const rootValue = parentResult[root];
  if (!rootValue) {
    return;
  }

  // todo: using linker.linkName should be correct here since it should be the same as childCollectionNode.linkName
  const path = childCollectionNode.linkName.split('.');

  if (Array.isArray(rootValue)) {
    rootValue.forEach((result) => {
      const value = dot.pick(rest.join('.'), result);
      const data = filterAssembledData(resultsByKeyId[value], { limit, skip });
      dot.set(path.slice(1).join('.'), data, result);
      // result[path.slice(1).join('.')] = data;
    });
    return;
  }

  const value = dot.pick(fieldStorage, parentResult);
  if (!value) {
    return;
  }

  const data = filterAssembledData(resultsByKeyId[value], { limit, skip });
  dot.str(childCollectionNode.linkName, data, parentResult);
}

export default (childCollectionNode, { limit, skip, metaFilters }) => {
  if (childCollectionNode.results.length === 0) {
    return;
  }

  const parent = childCollectionNode.parent;
  const linker = childCollectionNode.linker;

  const strategy = linker.strategy;
  const isMeta = linker.isMeta();
  const fieldStorage = linker.linkStorageField;

  // cleaning the parent results from a child
  // this may be the wrong approach but it works for now
  if (isMeta && metaFilters) {
    const metaFiltersTest = obj => new Query(metaFilters).test(obj);
    for (const parentResult of parent.results) {
      cleanObjectForMetaFilters(parentResult, fieldStorage, metaFiltersTest);
    }
  }

  const resultsByKeyId = groupBy(
    childCollectionNode.results,
    linker.foreignIdentityField,
  );

  if (childCollectionNode.linkName !== linker.linkName) {
    throw new Error(
      `error: ${childCollectionNode.linkName} ${linker.linkName}`,
    );
  }

  if (strategy === 'one') {
    parent.results.forEach((parentResult) => {
      return assembleOne(parentResult, {
        childCollectionNode,
        linker,
        limit,
        skip,
        resultsByKeyId,
      });
    });
  }

  if (strategy === 'many') {
    parent.results.forEach((parentResult) => {
      return assembleMany(parentResult, {
        childCollectionNode,
        linker,
        skip,
        limit,
        resultsByKeyId,
      });
    });
  }

  if (strategy === 'one-meta') {
    parent.results.forEach((parentResult) => {
      return assembleOneMeta(parentResult, {
        linker,
        childCollectionNode,
        limit,
        skip,
        resultsByKeyId,
      });
    });
  }

  if (strategy === 'many-meta') {
    parent.results.forEach((parentResult) => {
      return assembleManyMeta(parentResult, {
        childCollectionNode,
        linker,
        limit,
        skip,
        resultsByKeyId,
      });
    });
  }
};

function filterAssembledData(data, { limit, skip }) {
  if (Array.isArray(data)) {
    data = data.filter(Boolean);
    if (limit || skip) {
      const start = skip || 0;
      const end = limit ? start + limit : undefined;
      return data.slice(start, end);
    }
  }

  return data;
}
