import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';

const SECRET_KEY_PATTERN = /(token|secret|password|authorization|credential)$/i;
const KEY_ALLOWLIST = new Set(['secretNames', 'secret_names', 'names']);
const CREDENTIAL_VALUE_PATTERN =
  /^(Bearer\s|Basic\s|ghp_|gho_|ghs_|github_pat_|ghu_)/;

export function redactValue(value) {
  if (typeof value === 'string' && CREDENTIAL_VALUE_PATTERN.test(value)) {
    return '[REDACTED-CREDENTIAL-VALUE]';
  }
  return value;
}

export function redactDeep(input) {
  if (Array.isArray(input)) {
    return input.map((entry) => redactDeep(entry));
  }
  if (input && typeof input === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(input)) {
      if (SECRET_KEY_PATTERN.test(key) && !KEY_ALLOWLIST.has(key)) {
        out[key] = '[REDACTED-KEY]';
        continue;
      }
      out[key] = redactDeep(redactValue(value));
    }
    return out;
  }
  return redactValue(input);
}

export function assertNoSymlink(path) {
  if (existsSync(path)) {
    const stats = lstatSync(path);
    if (stats.isSymbolicLink()) {
      throw new Error(`SNAPSHOT_SYMLINK_REFUSED: ${path}`);
    }
  }
}

export function writeSnapshotFile(path, data) {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  assertNoSymlink(dir);
  chmodSync(dir, 0o700);
  assertNoSymlink(path);

  const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}`;
  assertNoSymlink(tmpPath);
  writeFileSync(tmpPath, data, { mode: 0o600 });
  chmodSync(tmpPath, 0o600);
  renameSync(tmpPath, path);
  chmodSync(path, 0o600);
  return path;
}

export function writeRedactedSnapshot(path, value) {
  const redacted = redactDeep(value);
  return writeSnapshotFile(path, `${JSON.stringify(redacted, null, 2)}\n`);
}
