import { createHash } from 'node:crypto';
import { constants, type Stats } from 'node:fs';
import {
  lstat,
  open,
  realpath,
  type FileHandle,
} from 'node:fs/promises';
import { isAbsolute, join, resolve, win32 } from 'node:path';
import { Readable } from 'node:stream';

const DIRECTORY_FLAGS = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const MAX_RESOURCE_BYTES = 16 * 1024 * 1024;

export interface OpenVerifiedAriaResourceFileInput {
  readonly rootDirectory: string;
  readonly relativePath: string;
  readonly expectedSizeBytes: number;
  readonly expectedSha256: string;
  readonly expectedMimeType: 'application/pdf';
}

export interface OpenedVerifiedAriaResourceFile {
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly mimeType: 'application/pdf';
  createReadStream(): Readable;
  close(): Promise<void>;
}

function descriptorPath(handle: FileHandle): string {
  return `/proc/${process.pid}/fd/${handle.fd}`;
}

function sameInode(left: Stats, right: Stats): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function pathSegments(relativePath: string): string[] {
  if (!relativePath || isAbsolute(relativePath) || win32.isAbsolute(relativePath)
    || relativePath.includes('\0')) {
    throw new Error('ARIA resource path must be a non-empty relative path');
  }
  const segments = relativePath.split(/[\\/]/);
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error('ARIA resource path contains traversal components');
  }
  return segments;
}

function isNodeError(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

function normalizeOpenError(error: unknown, kind: 'directory' | 'file'): never {
  if (isNodeError(error, 'ELOOP') || isNodeError(error, 'ENOTDIR')) {
    throw new Error(`ARIA resource ${kind} is symbolic or invalid`);
  }
  throw error;
}

async function assertDirectoryHandle(
  handle: FileHandle,
  expectedPath: string,
): Promise<void> {
  const handleStats = await handle.stat();
  if (!handleStats.isDirectory()) throw new Error('ARIA resource directory is invalid');
  const namedStats = await lstat(expectedPath);
  if (namedStats.isSymbolicLink() || !sameInode(handleStats, namedStats)) {
    throw new Error('ARIA resource directory was replaced');
  }
  if (await realpath(descriptorPath(handle)) !== expectedPath) {
    throw new Error('ARIA resource directory handle changed identity');
  }
}

async function closeHandles(handles: readonly FileHandle[]): Promise<void> {
  const failures: unknown[] = [];
  for (const handle of [...handles].reverse()) {
    try {
      await handle.close();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0) throw new AggregateError(failures, 'ARIA resource descriptors failed to close');
}

async function readVerifiedSnapshot(
  handle: FileHandle,
  sizeBytes: number,
): Promise<{ readonly bytes: Buffer; readonly sha256: string }> {
  const hash = createHash('sha256');
  const bytes = Buffer.allocUnsafe(sizeBytes);
  let offset = 0;
  while (offset < sizeBytes) {
    const { bytesRead } = await handle.read(
      bytes,
      offset,
      Math.min(64 * 1024, sizeBytes - offset),
      offset,
    );
    if (bytesRead === 0) throw new Error('ARIA resource changed during integrity verification');
    offset += bytesRead;
  }
  hash.update(bytes);
  return Object.freeze({ bytes, sha256: hash.digest('hex') });
}

function detectMimeType(bytes: Buffer): 'application/pdf' | null {
  return bytes.subarray(0, 5).equals(Buffer.from('%PDF-', 'ascii'))
    ? 'application/pdf'
    : null;
}

export async function openVerifiedAriaResourceFile(
  input: OpenVerifiedAriaResourceFileInput,
): Promise<OpenedVerifiedAriaResourceFile> {
  if (process.platform !== 'linux') {
    throw new Error('ARIA resource descriptor security requires Linux');
  }
  if (!Number.isSafeInteger(input.expectedSizeBytes) || input.expectedSizeBytes < 1
    || input.expectedSizeBytes > MAX_RESOURCE_BYTES
    || !SHA256_PATTERN.test(input.expectedSha256)
    || input.expectedMimeType !== 'application/pdf') {
    throw new Error('ARIA resource integrity metadata is invalid');
  }

  const segments = pathSegments(input.relativePath);
  const filename = segments.pop()!;
  const configuredRoot = resolve(input.rootDirectory);
  const rootStats = await lstat(configuredRoot);
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    throw new Error('ARIA resource root must be a real directory');
  }
  const canonicalRoot = await realpath(configuredRoot);
  if (canonicalRoot !== configuredRoot) {
    throw new Error('ARIA resource root must already be canonical');
  }

  const directoryHandles: FileHandle[] = [];
  let fileHandle: FileHandle | undefined;
  try {
    let expectedDirectory = canonicalRoot;
    let directory: FileHandle;
    try {
      directory = await open(canonicalRoot, DIRECTORY_FLAGS);
    } catch (error) {
      return normalizeOpenError(error, 'directory');
    }
    directoryHandles.push(directory);
    await assertDirectoryHandle(directory, expectedDirectory);

    for (const segment of segments) {
      const nextPath = join(descriptorPath(directory), segment);
      expectedDirectory = join(expectedDirectory, segment);
      let next: FileHandle;
      try {
        next = await open(nextPath, DIRECTORY_FLAGS);
      } catch (error) {
        return normalizeOpenError(error, 'directory');
      }
      directoryHandles.push(next);
      directory = next;
      await assertDirectoryHandle(directory, expectedDirectory);
    }

    await assertDirectoryHandle(directory, expectedDirectory);
    const entryPath = join(descriptorPath(directory), filename);
    try {
      fileHandle = await open(entryPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    } catch (error) {
      return normalizeOpenError(error, 'file');
    }
    const before = await fileHandle.stat();
    const named = await lstat(entryPath);
    if (!before.isFile() || named.isSymbolicLink() || !sameInode(before, named)) {
      throw new Error('ARIA resource file identity is invalid');
    }
    if (before.size !== input.expectedSizeBytes) {
      throw new Error('ARIA resource size integrity check failed');
    }
    const snapshot = await readVerifiedSnapshot(fileHandle, before.size);
    const after = await fileHandle.stat();
    const namedAfter = await lstat(entryPath);
    if (!sameInode(before, after) || before.size !== after.size
      || namedAfter.isSymbolicLink() || !sameInode(after, namedAfter)) {
      throw new Error('ARIA resource changed during integrity verification');
    }
    if (snapshot.sha256 !== input.expectedSha256) {
      throw new Error('ARIA resource digest integrity check failed');
    }
    const mimeType = detectMimeType(snapshot.bytes);
    if (mimeType !== input.expectedMimeType) {
      throw new Error('ARIA resource MIME integrity check failed');
    }

    await closeHandles(directoryHandles.splice(0));
    const retainedHandle = fileHandle;
    fileHandle = undefined;
    let streamCreated = false;
    let closed = false;
    return Object.freeze({
      sizeBytes: before.size,
      sha256: snapshot.sha256,
      mimeType,
      createReadStream(): Readable {
        if (closed || streamCreated) throw new Error('ARIA resource descriptor is no longer available');
        streamCreated = true;
        return Readable.from([snapshot.bytes]);
      },
      async close(): Promise<void> {
        if (closed) return;
        closed = true;
        await retainedHandle.close();
      },
    });
  } catch (error) {
    if (fileHandle) {
      try {
        await fileHandle.close();
      } catch (closeError) {
        throw new AggregateError([error, closeError], 'ARIA resource open and cleanup failed');
      }
    }
    try {
      await closeHandles(directoryHandles);
    } catch (closeError) {
      throw new AggregateError([error, closeError], 'ARIA resource open and cleanup failed');
    }
    throw error;
  }
}
