import {
  accessSync,
  constants,
  lstatSync,
  realpathSync,
  type Stats,
} from 'node:fs';
import { lstat, realpath } from 'node:fs/promises';
import {
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
  win32,
} from 'node:path';

export type StorageCapability = 'read-only' | 'read-write';

export interface NpcStorageReadyOptions {
  capability: StorageCapability;
  releaseRoot?: string;
  env?: NodeJS.ProcessEnv;
}

function isPathAtOrBelow(parent: string, candidate: string): boolean {
  const relativePath = relative(parent, candidate);
  if (relativePath === '') {
    return true;
  }

  const [firstSegment] = relativePath.split(sep);
  return !isAbsolute(relativePath) && firstSegment !== '..';
}

function hasDirectoryMode(
  stats: Stats,
  capability: StorageCapability,
): boolean {
  const readable = (stats.mode & 0o444) !== 0;
  const traversable = (stats.mode & 0o111) !== 0;
  const writable = (stats.mode & 0o222) !== 0;

  return (
    readable &&
    traversable &&
    (capability === 'read-only' || writable)
  );
}

function storagePermissionMask(capability: StorageCapability): number {
  const readAndTraverse = constants.R_OK | constants.X_OK;
  return capability === 'read-write'
    ? readAndTraverse | constants.W_OK
    : readAndTraverse;
}

export function resolveNpcStorageRoot(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configuredRoot = env.NPC_STORAGE_ROOT?.trim();

  if (!configuredRoot) {
    throw new Error('NPC_STORAGE_ROOT is required');
  }

  if (!isAbsolute(configuredRoot)) {
    throw new Error('NPC_STORAGE_ROOT must be an absolute POSIX path');
  }

  return resolve(configuredRoot);
}

export function assertNpcStorageReady({
  capability,
  releaseRoot = resolve(),
  env = process.env,
}: NpcStorageReadyOptions): string {
  if (capability !== 'read-only' && capability !== 'read-write') {
    throw new Error('Unsupported NPC storage capability');
  }

  const configuredRoot = resolveNpcStorageRoot(env);
  let rootStats: Stats;

  try {
    rootStats = lstatSync(configuredRoot);
  } catch {
    throw new Error('NPC storage root does not exist');
  }

  if (rootStats.isSymbolicLink()) {
    throw new Error('NPC storage root must not be a symbolic link');
  }

  if (!rootStats.isDirectory()) {
    throw new Error('NPC storage root must be a directory');
  }

  let canonicalRoot: string;
  let canonicalReleaseRoot: string;
  try {
    canonicalRoot = realpathSync(configuredRoot);
    canonicalReleaseRoot = realpathSync(resolve(releaseRoot));
  } catch {
    throw new Error('NPC storage root or release root cannot be resolved');
  }

  if (isPathAtOrBelow(canonicalReleaseRoot, canonicalRoot)) {
    throw new Error('NPC storage root must be outside the active release');
  }

  if (!hasDirectoryMode(rootStats, capability)) {
    throw new Error(
      `NPC storage root lacks ${capability} directory permissions`,
    );
  }

  try {
    accessSync(canonicalRoot, storagePermissionMask(capability));
  } catch {
    throw new Error(
      `NPC storage root is not usable with ${capability} capability`,
    );
  }

  return canonicalRoot;
}

function storagePathSegments(relativePath: string): string[] {
  if (
    !relativePath ||
    isAbsolute(relativePath) ||
    win32.isAbsolute(relativePath) ||
    relativePath.includes('\0')
  ) {
    throw new Error('NPC storage path must be a non-empty relative path');
  }

  const segments = relativePath.split(/[\\/]/);
  if (
    segments.some(
      (segment) => segment === '' || segment === '.' || segment === '..',
    )
  ) {
    throw new Error('NPC storage path contains traversal components');
  }

  return segments;
}

function isMissingPath(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

export async function resolveNpcStoragePath(
  relativePath: string,
): Promise<string> {
  const root = assertNpcStorageReady({ capability: 'read-only' });
  const segments = storagePathSegments(relativePath);
  const targetPath = join(root, ...segments);

  if (!isPathAtOrBelow(root, targetPath) || targetPath === root) {
    throw new Error('NPC storage path escapes the canonical root');
  }

  let currentPath = root;
  for (const segment of segments) {
    currentPath = join(currentPath, segment);

    try {
      const stats = await lstat(currentPath);
      if (stats.isSymbolicLink()) {
        throw new Error('NPC storage path contains a symbolic link');
      }

      const canonicalCurrentPath = await realpath(currentPath);
      if (!isPathAtOrBelow(root, canonicalCurrentPath)) {
        throw new Error('NPC storage path escapes the canonical root');
      }
    } catch (error) {
      if (isMissingPath(error)) {
        break;
      }
      throw error;
    }
  }

  return targetPath;
}
