export default function (node, maxDepth) {
    if (maxDepth === undefined) {
        return node;
    }

    const depth = getDepth(node);

    if (depth > maxDepth) {
        throw new Meteor.Error('too-deep', 'Your graph request is too deep and it is not allowed.')
    }

    return node;
}

export function getDepth(node) {
    if (node.collectionNodes.length === 0) {
        return 1;
    }

    return 1 + Math.max(...node.collectionNodes.map(getDepth));
}