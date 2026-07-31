const { createHash } = require('node:crypto');

const PROTOCOL_VERSION = 1;

function jsonRoundTrip(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, canonicalize(value[key])])
    );
  }
  return Object.is(value, -0) ? 0 : value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(jsonRoundTrip(value)));
}

function stableId(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex').slice(0, 16);
}

function escapePointer(part) {
  return String(part).replaceAll('~', '~0').replaceAll('/', '~1');
}

function firstDifference(left, right, path = '') {
  if (Object.is(left, right)) return null;
  if (typeof left !== typeof right || left === null || right === null) {
    return { path: path || '/', left, right };
  }
  if (typeof left !== 'object') return { path: path || '/', left, right };
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return { path: path || '/', left, right };
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index++) {
      if (index >= left.length || index >= right.length) {
        return { path: `${path}/${index}`, left: left[index], right: right[index] };
      }
      const difference = firstDifference(left[index], right[index], `${path}/${index}`);
      if (difference) return difference;
    }
    return null;
  }
  if (typeof left === 'object') {
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(left, key) ||
          !Object.prototype.hasOwnProperty.call(right, key)) {
        return { path: `${path}/${escapePointer(key)}`, left: left[key], right: right[key] };
      }
      const difference = firstDifference(
        left[key], right[key], `${path}/${escapePointer(key)}`
      );
      if (difference) return difference;
    }
  }
  return null;
}

function signedSeed(text) {
  let hash = 0x811c9dc5;
  for (const character of text) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
}

module.exports = {
  PROTOCOL_VERSION,
  canonicalize,
  canonicalJson,
  firstDifference,
  jsonRoundTrip,
  signedSeed,
  stableId
};
