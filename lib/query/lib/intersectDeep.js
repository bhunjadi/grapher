import {_} from 'meteor/underscore';
import {specialFields} from './createGraph';

const EXTENDED_SPECIAL_FIELDS = [...specialFields, '$filter', '$paginate'];

function isClientValueValid(value) {
    if (_.isObject(value) && !_.isArray(value)) {
        return _.values(value).every(nestedValue => isClientValueValid(nestedValue));
    }
    else if (value === 1) {
        return true;
    }
    return false;
}

/**
 *
 * Recursive function which intersects the fields of the body objects.
 *
 * @param {object} allowed allowed body object - intersection can only be a subset of it
 * @param {object} client client body - can shrink main body, but not expand
 */
function intersectFields(allowed, client, options = {}) {
    const {allowSpecialFields = false} = options;
    const intersection = {};
    _.pairs(client).forEach(([field, clientValue]) => {
        if (_.contains(EXTENDED_SPECIAL_FIELDS, field)) {
            if (allowSpecialFields) {
                intersection[field] = clientValue;
            }
            return;
        }

        const serverValue = allowed[field];
        if (serverValue === 1) { // server allows everything
            if (isClientValueValid(clientValue)) {
                intersection[field] = clientValue;
            }
        }
        else if (_.isObject(serverValue)) {
            if (_.isObject(clientValue) && !_.isArray(clientValue)) {
                intersection[field] = intersectFields(serverValue, clientValue, options);
            }
            else if (clientValue === 1) {
                // if client wants everything, serverValue is more restrictive here
                intersection[field] = serverValue;
            }
        }
    });

    // Add back special fields to the new body
    return Object.assign(
        intersection,
        _.pick(allowed, ...EXTENDED_SPECIAL_FIELDS),
        // If special fields are allowed, override server fields with client fields
        allowSpecialFields ? _.pick(intersection, ...EXTENDED_SPECIAL_FIELDS) : {},
    );
}

/**
 * Given a named query that has a specific body, you can query its subbody
 * This performs an intersection of the bodies allowed in each
 *
 * @param allowedBody
 * @param clientBody
 */
export default function (allowedBody, clientBody, options) {
    return intersectFields(allowedBody, clientBody, options);
}
