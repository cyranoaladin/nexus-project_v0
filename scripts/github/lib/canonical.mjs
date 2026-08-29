import { createHash } from 'node:crypto';

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortValue(value[key]);
        return acc;
      }, {});
  }
  return value;
}

export function canonicalize(value) {
  return `${JSON.stringify(sortValue(value))}\n`;
}

export function digest(value) {
  const canonical = canonicalize(value);
  return {
    canonical,
    sha256: createHash('sha256').update(canonical, 'utf8').digest('hex'),
  };
}
