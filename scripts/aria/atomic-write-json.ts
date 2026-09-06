/**
 * Same-filesystem atomic replacement for a canonical generated/derived JSON
 * artifact. A failure at any point before the rename leaves the destination
 * byte-identical to what it was; the temporary file is never left behind.
 */
import { closeSync, fsyncSync, mkdirSync, openSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

export function writeJsonFileAtomic(path: string, bytes: Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}-${randomBytes(6).toString('hex')}`;
  try {
    writeFileSync(temporary, bytes, { mode: 0o644, flag: 'wx' });
    const descriptor = openSync(temporary, 'r');
    try {
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    renameSync(temporary, path);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}
