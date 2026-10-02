import { execFileSync } from 'node:child_process';
import { mkdtemp, lstat, realpath, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { downloadVerified } from './download.mjs';

const SHA256 = /^[0-9a-f]{64}$/;
const RUNTIME_DIR = 'llama-b10977';

export function validateRuntimeArchiveEntries(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2 * 1024 * 1024) {
    throw new Error('RUNTIME_ARCHIVE_INVALID');
  }
  const entries = raw.trimEnd().split('\n');
  if (!entries.includes(`${RUNTIME_DIR}/llama-cli`) || entries.some((entry) =>
    !entry.startsWith(`${RUNTIME_DIR}/`) || entry.startsWith('/') ||
    entry.includes('\\') || entry.includes('\0') ||
    entry.split('/').some((part) => part === '..' || part === '.') ||
    entry.includes('\r'))) throw new Error('RUNTIME_ARCHIVE_INVALID');
  return true;
}

export async function prepareQualifiedRuntime({ candidate, runtime, runnerTemp,
  download = downloadVerified, exec = execFileSync } = {}) {
  if (!candidate || !runtime || typeof runnerTemp !== 'string' ||
      !runnerTemp.startsWith('/') || !SHA256.test(candidate.sha256 ?? '') ||
      !SHA256.test(runtime.archiveSha256 ?? '') ||
      !Number.isSafeInteger(candidate.sizeBytes) || candidate.sizeBytes < 1 ||
      !Number.isSafeInteger(runtime.sizeBytes) || runtime.sizeBytes < 1 ||
      typeof download !== 'function' || typeof exec !== 'function') {
    throw new Error('MODEL_RUNTIME_CONFIG_INVALID');
  }
  const root = await mkdtemp(join(resolve(runnerTemp), 'nexus-review-gate-'));
  const archivePath = join(root, 'runtime.tar.gz');
  const modelPath = join(root, 'model.gguf');
  try {
    await download({ url: runtime.archiveUrl, sha256: runtime.archiveSha256,
      sizeBytes: runtime.sizeBytes, destination: archivePath });
    await download({ url: candidate.url, sha256: candidate.sha256,
      sizeBytes: candidate.sizeBytes, destination: modelPath });
    const entries = exec('tar', ['-tzf', archivePath], {
      encoding: 'utf8', maxBuffer: 2 * 1024 * 1024, timeout: 30_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    validateRuntimeArchiveEntries(entries);
    exec('tar', ['-xzf', archivePath, '-C', root], {
      timeout: 60_000, stdio: 'ignore',
    });
    const binaryPath = join(root, RUNTIME_DIR, 'llama-cli');
    const stat = await lstat(binaryPath);
    const actual = await realpath(binaryPath);
    if (!stat.isFile() || !actual.startsWith(`${root}${sep}`) ||
        (stat.mode & 0o111) === 0) throw new Error('RUNTIME_BINARY_INVALID');
    return { root, binaryPath, modelPath };
  } catch {
    await rm(root, { recursive: true, force: true });
    throw new Error('MODEL_RUNTIME_UNAVAILABLE');
  }
}

export async function cleanupQualifiedRuntime(root, runnerTemp) {
  const parent = resolve(runnerTemp ?? '');
  if (typeof root !== 'string' || !root.startsWith(`${parent}${sep}nexus-review-gate-`) ||
      root.includes('..')) throw new Error('MODEL_RUNTIME_CLEANUP_SCOPE_INVALID');
  await rm(root, { recursive: true, force: false });
}
