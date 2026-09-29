import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Reads only the non-secret marker from the immutable standalone root. */
export async function readRunningReleaseSha(): Promise<string | null> {
  try {
    const value = (await readFile(join(process.cwd(), 'RELEASE_SHA'), 'utf8')).trim();
    return /^[a-f0-9]{40}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}
