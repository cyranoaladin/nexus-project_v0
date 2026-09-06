/**
 * Same-filesystem atomic replacement for a canonical generated/derived JSON
 * artifact. A failure at any point before the publish step leaves the
 * destination byte-identical to what it was; the temporary file is never
 * left behind.
 */
import { closeSync, fsyncSync, linkSync, mkdirSync, openSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

function writeTemporaryFile(path: string, bytes: Buffer): string {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}-${randomBytes(6).toString('hex')}`;
  writeFileSync(temporary, bytes, { mode: 0o644, flag: 'wx' });
  const descriptor = openSync(temporary, 'r');
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  return temporary;
}

function cleanUpAfterPublishFailure(temporary: string, error: unknown): never {
  try {
    rmSync(temporary, { force: true });
  } catch (cleanupError) {
    throw new AggregateError([error, cleanupError], 'ARIA_ATOMIC_WRITE_AND_CLEANUP_FAILED');
  }
  throw error;
}

/** Replaces `path` unconditionally — the normal case for a canonical generated/derived artifact meant to be regenerated freely. */
export function writeJsonFileAtomic(path: string, bytes: Buffer): void {
  const temporary = writeTemporaryFile(path, bytes);
  try {
    renameSync(temporary, path);
  } catch (error) {
    cleanUpAfterPublishFailure(temporary, error);
  }
}

/**
 * Same atomic write, but the publish step is exclusive: if `path` already
 * exists at that instant, this throws `ARIA_ATOMIC_WRITE_DESTINATION_EXISTS`
 * instead of silently replacing it. A preflight `existsSync` check alone
 * cannot close this race — two processes can both pass the check before
 * either creates the file; `linkSync` fails atomically at the filesystem
 * level when the destination already exists, so at most one caller ever
 * wins.
 */
export function writeJsonFileAtomicNoClobber(path: string, bytes: Buffer): void {
  const temporary = writeTemporaryFile(path, bytes);
  try {
    linkSync(temporary, path);
  } catch (error) {
    const publishError = (error as NodeJS.ErrnoException).code === 'EEXIST'
      ? new Error(`ARIA_ATOMIC_WRITE_DESTINATION_EXISTS:${path}`)
      : error;
    cleanUpAfterPublishFailure(temporary, publishError);
  }
  rmSync(temporary, { force: true });
}
