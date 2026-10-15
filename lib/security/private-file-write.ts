import { open, unlink } from 'node:fs/promises';

/** Exclusive creation: failed writes remove only the file opened by this call. */
export async function writePrivateFileExclusive(path: string, bytes: Buffer): Promise<void> {
  let handle: Awaited<ReturnType<typeof open>>;
  try { handle = await open(path, 'wx', 0o600); }
  catch { throw new Error('PRIVATE_FILE_WRITE_FAILED'); }
  try {
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
  } catch {
    await handle.close().catch(() => undefined);
    try { await unlink(path); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('PRIVATE_FILE_CLEANUP_FAILED');
    }
    throw new Error('PRIVATE_FILE_WRITE_FAILED');
  }
}
