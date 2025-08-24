/**
 * Deep merge two objects.
 * @param target
 * @param source
 */
export default function mergeDeep(target, source) {
    if (target !== null && typeof target === 'object' && !Array.isArray(target) && source !== null && typeof source === 'object' && !Array.isArray(source)) {
        Object.entries(source).forEach(([key, value]) => {
            if (typeof source[key] === 'function') {
                target[key] = source[key];
            } else if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                mergeDeep(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        });
    }

    return target;
}