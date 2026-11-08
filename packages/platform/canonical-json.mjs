// nc-c14n-v1 canonical metadata serialization and content hashing.
// This module is deliberately dependency-free: it only accepts the value
// shapes permitted by the approved contract and never evaluates input.
import { createHash } from 'node:crypto';

export const CANONICALIZATION = 'nc-c14n-v1';

export class CanonicalValueError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CanonicalValueError';
    this.code = 'INVALID_CANONICAL_VALUE';
  }
}

function canon(value, seen) {
  if (value === null) throw new CanonicalValueError('null is not a canonical value');
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new CanonicalValueError('only safe integers are allowed');
    }
    return String(value);
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new CanonicalValueError('cyclic value');
    seen.add(value);
    const parts = [];
    for (let index = 0; index < value.length; index += 1) {
      if (!(index in value)) throw new CanonicalValueError('sparse arrays are not allowed');
      parts.push(canon(value[index], seen));
    }
    seen.delete(value);
    return `[${parts.join(',')}]`;
  }
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new CanonicalValueError('only plain objects are allowed');
    }
    if (seen.has(value)) throw new CanonicalValueError('cyclic value');
    seen.add(value);
    const keys = Object.keys(value);
    for (const key of keys) {
      if (!/^[\x20-\x7e]+$/.test(key)) throw new CanonicalValueError('object keys must be printable ASCII');
      if (value[key] === undefined) throw new CanonicalValueError('undefined properties are not allowed');
    }
    const body = keys.sort().map((key) => `${JSON.stringify(key)}:${canon(value[key], seen)}`).join(',');
    seen.delete(value);
    return `{${body}}`;
  }
  throw new CanonicalValueError(`unsupported canonical type: ${typeof value}`);
}

export function canonicalJson(value) {
  return canon(value, new Set());
}

export function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}
