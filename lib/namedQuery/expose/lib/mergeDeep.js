import { isFunction, isObject } from "../../../utils";

/**
 * Deep merge two objects.
 * @param target
 * @param source
 */
export default function mergeDeep(target, source) {
  if (target !== null && isObject(target) && !Array.isArray(target) && source !== null && isObject(source) && !Array.isArray(source)) {
    Object.entries(source).forEach(([key, value]) => {
      if (isFunction(value)) {
        target[key] = value;
      } else if (value !== null && isObject(value) && !Array.isArray(value)) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key], value);
      } else {
        Object.assign(target, { [key]: value });
      }
    });
  }
  return target;
}