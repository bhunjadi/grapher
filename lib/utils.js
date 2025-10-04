/**
 * Native JavaScript utilities to replace underscore methods
 */

// Type note: This is a JS file; avoid TS types to keep linters happy.

export function isObject(value) {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}

export function isFunction(value) {
  return typeof value === 'function';
}

export function isUndefined(value) {
  return value === undefined;
}

export function isEmpty(value) {
  if (value == null) return true;
  if (Array.isArray(value) || typeof value === 'string') return value.length === 0;
  if (isObject(value)) return Object.keys(value).length === 0;
  return false;
}
export function omit(obj, ...keysToOmit) {
  const result = { ...obj };
  keysToOmit.forEach((key) => delete result[key]);
  return result;
}

export function pick(obj, ...keysToPick) {
  const result = {};
  for (const key of keysToPick) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) result[key] = obj[key];
  }
  return result;
}

export function flatten(array) {
  if (!Array.isArray(array)) return array;
  const result = [];
  for (const item of array) {
    if (Array.isArray(item)) result.push(...item);
    else result.push(item);
  }
  return result;
}

export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(obj);
    } catch (e) {}
  }
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (e) {
    return Array.isArray(obj) ? [...obj] : { ...obj };
  }
}

export function clone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  return Array.isArray(obj) ? [...obj] : { ...obj };
}

export function pluck(array, key) {
  return (array || []).map((item) => item?.[key]);
}

export function uniq(array) {
  return Array.from(new Set(array || []));
}

export function union(...arrays) {
  return Array.from(new Set((arrays || []).flat()));
}

export function difference(array, other) {
  const otherSet = new Set(other || []);
  return (array || []).filter((item) => !otherSet.has(item));
}

export function range(start, stop, step = 1) {
  // Support range(n) shorthand
  if (stop === undefined) {
    stop = start;
    start = 0;
  }
  const result = [];
  if (step === 0) return result;
  if (step > 0) {
    for (let i = start; i < stop; i += step) result.push(i);
  } else {
    for (let i = start; i > stop; i += step) result.push(i);
  }
  return result;
}

export function random(min, max) {
  if (max === undefined) {
    max = min;
    min = 0;
  }
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function sample(array, n) {
  const arr = [...(array || [])];
  if (n === undefined) {
    return arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined;
  }
  // Fisher-Yates shuffle partial
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

export function groupBy(array, iteratee) {
  const result = {};
  if (!Array.isArray(array)) return result;
  const getter = typeof iteratee === 'function' ? iteratee : (item) => item?.[iteratee];
  for (const item of array) {
    const key = getter(item);
    const bucketKey = String(key);
    if (!result[bucketKey]) result[bucketKey] = [];
    result[bucketKey].push(item);
  }
  return result;
}

export function has(obj, key) {
  return obj != null && Object.prototype.hasOwnProperty.call(obj, key);
}

export function isFiniteNumber(value) {
  return Number.isFinite(value);
}
