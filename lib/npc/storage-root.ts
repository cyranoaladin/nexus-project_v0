import { randomBytes, createHash } from 'node:crypto';
import {
  accessSync,
  constants,
  lstatSync,
  realpathSync,
  type Stats,
} from 'node:fs';
import {
  link,
  lstat,
  mkdir,
  open,
  realpath,
  rm,
  unlink,
  type FileHandle,
} from 'node:fs/promises';
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

export interface NpcAtomicWriteResult {
  filePath: string;
  sizeBytes: number;
  sha256: string;
}

export interface NpcStorageFileInspection {
  sizeBytes: number;
  sha256: string;
}

const DIRECTORY_OPEN_FLAGS =
  constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW;

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

function currentUid(): number {
  if (typeof process.getuid !== 'function') {
    throw new Error('NPC storage requires a UID-capable Linux runtime');
  }
  return process.getuid();
}

function assertTrustedOwnership(stats: Stats, entryKind: string): void {
  const uid = currentUid();
  if (stats.uid !== 0 && stats.uid !== uid) {
    throw new Error(`NPC storage ${entryKind} has an untrusted owner`);
  }

  // Sticky directories are intentionally rejected too. The sticky bit prevents
  // cross-owner deletion, but it does not protect against a same-UID replacement.
  if ((stats.mode & 0o022) !== 0) {
    throw new Error(
      `NPC storage ${entryKind} must not be group/world-writable, even when sticky`,
    );
  }
}

function assertTrustedDirectory(stats: Stats, entryKind: string): void {
  if (!stats.isDirectory()) {
    throw new Error(`NPC storage ${entryKind} must be a directory`);
  }
  assertTrustedOwnership(stats, entryKind);
}

function assertTrustedRegularFile(stats: Stats): void {
  if (!stats.isFile()) {
    throw new Error('NPC storage entry must be a regular file');
  }
  assertTrustedOwnership(stats, 'file');
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

  if (
    isPathAtOrBelow(canonicalReleaseRoot, canonicalRoot) ||
    isPathAtOrBelow(canonicalRoot, canonicalReleaseRoot)
  ) {
    throw new Error('NPC storage root and active release must not overlap');
  }

  assertTrustedDirectory(rootStats, 'root');

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

function isNodeError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}

function sameInode(left: Stats, right: Stats): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

/**
 * Linux descriptor paths keep every accepted ancestor inode open while the
 * next component is opened with O_NOFOLLOW. This closes the demonstrated
 * rename-to-symlink window, but it is not openat2(RESOLVE_BENEATH). A hostile
 * process running under the same UID can still modify an inode it owns; that
 * same-UID adversary is outside this trust boundary.
 */
function descriptorPath(handle: FileHandle): string {
  return `/proc/${process.pid}/fd/${handle.fd}`;
}

async function verifyDirectoryHandle(
  handle: FileHandle,
  expectedPath: string,
  root: string,
): Promise<void> {
  const handleStats = await handle.stat();
  assertTrustedDirectory(handleStats, 'directory');

  const canonicalHandlePath = await realpath(descriptorPath(handle));
  if (
    canonicalHandlePath !== expectedPath ||
    !isPathAtOrBelow(root, canonicalHandlePath)
  ) {
    throw new Error('NPC storage directory handle no longer matches its trusted path');
  }

  const namedStats = await lstat(expectedPath);
  if (namedStats.isSymbolicLink() || !sameInode(handleStats, namedStats)) {
    throw new Error('NPC storage directory was replaced after validation');
  }
}

interface TrustedDirectoryChain {
  root: string;
  expectedDirectory: string;
  directory: FileHandle;
  handles: FileHandle[];
}

async function closeHandles(handles: FileHandle[]): Promise<void> {
  for (const handle of [...handles].reverse()) {
    await handle.close().catch(() => undefined);
  }
}

async function openTrustedDirectoryChain(
  segments: string[],
  options: { capability: StorageCapability; create: boolean },
): Promise<TrustedDirectoryChain> {
  const root = assertNpcStorageReady({ capability: options.capability });
  const handles: FileHandle[] = [];

  try {
    let expectedDirectory = root;
    let directory = await open(root, DIRECTORY_OPEN_FLAGS);
    handles.push(directory);
    await verifyDirectoryHandle(directory, expectedDirectory, root);

    for (const segment of segments) {
      const nextThroughDescriptor = join(descriptorPath(directory), segment);
      expectedDirectory = join(expectedDirectory, segment);

      let nextDirectory: FileHandle;
      try {
        nextDirectory = await open(nextThroughDescriptor, DIRECTORY_OPEN_FLAGS);
      } catch (error) {
        if (isNodeError(error, 'ELOOP') || isNodeError(error, 'ENOTDIR')) {
          throw new Error(
            'NPC storage path contains a symbolic or non-directory component',
          );
        }
        if (!options.create || !isNodeError(error, 'ENOENT')) {
          throw error;
        }

        try {
          await mkdir(nextThroughDescriptor, { mode: 0o750 });
        } catch (mkdirError) {
          if (!isNodeError(mkdirError, 'EEXIST')) {
            throw mkdirError;
          }
        }
        nextDirectory = await open(nextThroughDescriptor, DIRECTORY_OPEN_FLAGS);
      }

      handles.push(nextDirectory);
      directory = nextDirectory;
      await verifyDirectoryHandle(directory, expectedDirectory, root);
    }

    return { root, expectedDirectory, directory, handles };
  } catch (error) {
    await closeHandles(handles);
    throw error;
  }
}

interface TrustedParentContext extends TrustedDirectoryChain {
  filename: string;
  entryPath: string;
}

async function withTrustedParent<T>(
  relativePath: string,
  options: { capability: StorageCapability; createParents: boolean },
  callback: (context: TrustedParentContext) => Promise<T>,
): Promise<T> {
  const segments = storagePathSegments(relativePath);
  const filename = segments.pop();
  if (!filename) {
    throw new Error('NPC storage file path is missing a filename');
  }

  const chain = await openTrustedDirectoryChain(segments, {
    capability: options.capability,
    create: options.createParents,
  });

  try {
    await verifyDirectoryHandle(
      chain.directory,
      chain.expectedDirectory,
      chain.root,
    );
    return await callback({
      ...chain,
      filename,
      entryPath: join(descriptorPath(chain.directory), filename),
    });
  } finally {
    await closeHandles(chain.handles);
  }
}

async function verifyOpenedEntry(
  context: TrustedParentContext,
  handle: FileHandle,
): Promise<Stats> {
  const handleStats = await handle.stat();
  assertTrustedRegularFile(handleStats);
  await verifyDirectoryHandle(
    context.directory,
    context.expectedDirectory,
    context.root,
  );

  const namedStats = await lstat(context.entryPath);
  if (namedStats.isSymbolicLink() || !sameInode(handleStats, namedStats)) {
    throw new Error('NPC storage file was replaced during secure open');
  }
  return handleStats;
}

async function openTrustedEntry(
  context: TrustedParentContext,
  flags: number,
  mode?: number,
): Promise<FileHandle> {
  await verifyDirectoryHandle(
    context.directory,
    context.expectedDirectory,
    context.root,
  );
  const handle = await open(
    context.entryPath,
    flags | constants.O_NOFOLLOW,
    mode,
  );

  try {
    await verifyOpenedEntry(context, handle);
    return handle;
  } catch (error) {
    await handle.close().catch(() => undefined);
    throw error;
  }
}

async function readEntireHandle(
  handle: FileHandle,
  sizeBytes: number,
): Promise<Buffer> {
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
    throw new Error('NPC storage file size is invalid');
  }

  const bytes = Buffer.alloc(sizeBytes);
  let offset = 0;
  while (offset < sizeBytes) {
    const { bytesRead } = await handle.read(
      bytes,
      offset,
      sizeBytes - offset,
      offset,
    );
    if (bytesRead === 0) {
      throw new Error('NPC storage file ended during verified readback');
    }
    offset += bytesRead;
  }
  return bytes;
}

async function removeEntryIfItMatches(
  entryPath: string,
  handle: FileHandle,
): Promise<void> {
  try {
    const [handleStats, entryStats] = await Promise.all([
      handle.stat(),
      lstat(entryPath),
    ]);
    if (!entryStats.isSymbolicLink() && sameInode(handleStats, entryStats)) {
      await unlink(entryPath);
    }
  } catch (error) {
    if (!isNodeError(error, 'ENOENT')) {
      throw error;
    }
  }
}

export async function readNpcStorageFile(
  relativePath: string,
): Promise<Buffer> {
  return withTrustedParent(
    relativePath,
    { capability: 'read-only', createParents: false },
    async (context) => {
      const handle = await openTrustedEntry(context, constants.O_RDONLY);
      try {
        return await handle.readFile();
      } finally {
        await handle.close();
      }
    },
  );
}

export async function inspectNpcStorageFile(
  relativePath: string,
): Promise<NpcStorageFileInspection> {
  return withTrustedParent(
    relativePath,
    { capability: 'read-only', createParents: false },
    async (context) => {
      const handle = await openTrustedEntry(context, constants.O_RDONLY);
      try {
        const initialStats = await verifyOpenedEntry(context, handle);
        if (!Number.isSafeInteger(initialStats.size) || initialStats.size < 0) {
          throw new Error('NPC storage file size is invalid');
        }

        const hash = createHash('sha256');
        const chunk = Buffer.allocUnsafe(64 * 1024);
        let offset = 0;
        while (offset < initialStats.size) {
          const length = Math.min(chunk.length, initialStats.size - offset);
          const { bytesRead } = await handle.read(chunk, 0, length, offset);
          if (bytesRead === 0) {
            throw new Error('NPC storage file ended during verified inspection');
          }
          hash.update(chunk.subarray(0, bytesRead));
          offset += bytesRead;
        }

        const finalStats = await verifyOpenedEntry(context, handle);
        if (
          finalStats.size !== initialStats.size ||
          !sameInode(initialStats, finalStats)
        ) {
          throw new Error('NPC storage file changed during verified inspection');
        }

        return {
          sizeBytes: initialStats.size,
          sha256: hash.digest('hex'),
        };
      } finally {
        await handle.close();
      }
    },
  );
}

export async function withNpcStorageFilePath<T>(
  relativePath: string,
  callback: (descriptorFilePath: string) => Promise<T>,
): Promise<T> {
  return withTrustedParent(
    relativePath,
    { capability: 'read-only', createParents: false },
    async (context) => {
      const handle = await openTrustedEntry(context, constants.O_RDONLY);
      try {
        return await callback(descriptorPath(handle));
      } finally {
        await handle.close();
      }
    },
  );
}

export async function withNpcStorageDirectoryPath<T>(
  relativeDirectory: string,
  options: { create: boolean },
  callback: (descriptorDirectoryPath: string) => Promise<T>,
): Promise<T> {
  const chain = await openTrustedDirectoryChain(
    storagePathSegments(relativeDirectory),
    {
      capability: options.create ? 'read-write' : 'read-only',
      create: options.create,
    },
  );

  try {
    await verifyDirectoryHandle(
      chain.directory,
      chain.expectedDirectory,
      chain.root,
    );
    const result = await callback(descriptorPath(chain.directory));
    await verifyDirectoryHandle(
      chain.directory,
      chain.expectedDirectory,
      chain.root,
    );
    return result;
  } finally {
    await closeHandles(chain.handles);
  }
}

export async function ensureNpcStorageDirectory(
  relativeDirectory: string,
): Promise<string> {
  const chain = await openTrustedDirectoryChain(
    storagePathSegments(relativeDirectory),
    { capability: 'read-write', create: true },
  );
  try {
    return chain.expectedDirectory;
  } finally {
    await closeHandles(chain.handles);
  }
}

export async function writeNpcStorageFileAtomic(
  relativePath: string,
  bytes: Buffer,
  expectedSizeBytes: number,
): Promise<NpcAtomicWriteResult> {
  return withTrustedParent(
    relativePath,
    { capability: 'read-write', createParents: true },
    async (context) => {
      const temporaryName = `.npc-${randomBytes(16).toString('hex')}.tmp`;
      const temporaryPath = join(
        descriptorPath(context.directory),
        temporaryName,
      );
      const finalPath = context.entryPath;
      let temporaryHandle: FileHandle | undefined;
      let published = false;

      try {
        const temporaryContext = {
          ...context,
          filename: temporaryName,
          entryPath: temporaryPath,
        };
        temporaryHandle = await openTrustedEntry(
          temporaryContext,
          constants.O_RDWR | constants.O_CREAT | constants.O_EXCL,
          0o640,
        );

        await temporaryHandle.writeFile(bytes);
        await temporaryHandle.sync();
        const stats = await temporaryHandle.stat();
        if (stats.size !== expectedSizeBytes) {
          const error = new Error('NPC storage size mismatch after write');
          Object.assign(error, { code: 'NPC_STORAGE_SIZE_MISMATCH' });
          throw error;
        }

        const persistedBytes = await readEntireHandle(
          temporaryHandle,
          stats.size,
        );
        if (persistedBytes.length !== expectedSizeBytes) {
          const error = new Error('NPC storage size mismatch after readback');
          Object.assign(error, { code: 'NPC_STORAGE_SIZE_MISMATCH' });
          throw error;
        }

        await verifyDirectoryHandle(
          context.directory,
          context.expectedDirectory,
          context.root,
        );
        await verifyOpenedEntry(temporaryContext, temporaryHandle);
        await link(temporaryPath, finalPath);
        published = true;

        const finalStats = await lstat(finalPath);
        if (finalStats.isSymbolicLink() || !sameInode(stats, finalStats)) {
          throw new Error('NPC storage atomic publication inode mismatch');
        }

        await unlink(temporaryPath);
        await verifyDirectoryHandle(
          context.directory,
          context.expectedDirectory,
          context.root,
        );

        return {
          filePath: join(context.expectedDirectory, context.filename),
          sizeBytes: persistedBytes.length,
          sha256: createHash('sha256').update(persistedBytes).digest('hex'),
        };
      } catch (error) {
        if (temporaryHandle) {
          if (published) {
            await removeEntryIfItMatches(finalPath, temporaryHandle).catch(
              () => undefined,
            );
          }
          await removeEntryIfItMatches(
            temporaryPath,
            temporaryHandle,
          ).catch(() => undefined);
        }
        throw error;
      } finally {
        await temporaryHandle?.close().catch(() => undefined);
      }
    },
  );
}

export async function npcStorageFileExists(
  relativePath: string,
): Promise<boolean> {
  try {
    await withTrustedParent(
      relativePath,
      { capability: 'read-only', createParents: false },
      async (context) => {
        const handle = await openTrustedEntry(context, constants.O_RDONLY);
        await handle.close();
      },
    );
    return true;
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) {
      return false;
    }
    throw error;
  }
}

export async function deleteNpcStorageFile(
  relativePath: string,
): Promise<void> {
  await withTrustedParent(
    relativePath,
    { capability: 'read-write', createParents: false },
    async (context) => {
      const handle = await openTrustedEntry(context, constants.O_RDONLY);
      try {
        await verifyDirectoryHandle(
          context.directory,
          context.expectedDirectory,
          context.root,
        );
        await verifyOpenedEntry(context, handle);
        await unlink(context.entryPath);
      } finally {
        await handle.close();
      }
    },
  );
}

export async function removeNpcStorageDirectory(
  relativeDirectory: string,
): Promise<void> {
  await withTrustedParent(
    relativeDirectory,
    { capability: 'read-write', createParents: false },
    async (context) => {
      const directory = await open(context.entryPath, DIRECTORY_OPEN_FLAGS);
      try {
        const expectedDirectory = join(
          context.expectedDirectory,
          context.filename,
        );
        await verifyDirectoryHandle(
          directory,
          expectedDirectory,
          context.root,
        );
        await verifyDirectoryHandle(
          context.directory,
          context.expectedDirectory,
          context.root,
        );
        await rm(context.entryPath, { recursive: true, force: true });
      } finally {
        await directory.close();
      }
    },
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
  for (let index = 0; index < segments.length; index += 1) {
    currentPath = join(currentPath, segments[index]);

    try {
      const stats = await lstat(currentPath);
      if (stats.isSymbolicLink()) {
        throw new Error('NPC storage path contains a symbolic link');
      }

      if (index < segments.length - 1 || stats.isDirectory()) {
        assertTrustedDirectory(stats, 'directory');
      } else {
        assertTrustedRegularFile(stats);
      }

      const canonicalCurrentPath = await realpath(currentPath);
      if (!isPathAtOrBelow(root, canonicalCurrentPath)) {
        throw new Error('NPC storage path escapes the canonical root');
      }
    } catch (error) {
      if (isNodeError(error, 'ENOENT')) {
        break;
      }
      throw error;
    }
  }

  return targetPath;
}
