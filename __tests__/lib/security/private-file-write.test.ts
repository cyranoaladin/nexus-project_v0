/** @jest-environment node */
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
jest.mock('node:fs/promises', () => {
  const actual = jest.requireActual('node:fs/promises');
  return { ...actual, open: jest.fn(actual.open), unlink: jest.fn(actual.unlink) };
});
import { writePrivateFileExclusive } from '@/lib/security/private-file-write';

let root: string;
beforeEach(async () => {
  (fs.open as jest.Mock).mockImplementation(jest.requireActual('node:fs/promises').open);
  (fs.unlink as jest.Mock).mockImplementation(jest.requireActual('node:fs/promises').unlink);
  root = await mkdtemp(join(tmpdir(), 'nexus-private-write-'));
});
afterEach(async () => { jest.restoreAllMocks(); await rm(root, { recursive: true, force: true }); });
const bytes = Buffer.from('synthetic private document');
test('writes the complete document with private permissions', async () => {
  const path = join(root, 'document');
  await writePrivateFileExclusive(path, bytes);
  expect(await readFile(path)).toEqual(bytes);
  expect((await stat(path)).mode & 0o777).toBe(0o600);
});
test('a collision preserves the existing file', async () => {
  const path = join(root, 'document');
  await writeFile(path, 'existing document');
  await expect(writePrivateFileExclusive(path, bytes)).rejects.toThrow('PRIVATE_FILE_WRITE_FAILED');
  expect(await readFile(path, 'utf8')).toBe('existing document');
});
test.each(['write', 'sync', 'close'])('cleans up its own partial file after %s failure', async failure => {
  const originalOpen = jest.requireActual('node:fs/promises').open as typeof fs.open;
  jest.spyOn(fs, 'open').mockImplementation(async (...args: Parameters<typeof fs.open>) => {
    const handle = await originalOpen(...args);
    const originalWrite = handle.writeFile.bind(handle);
    const originalClose = handle.close.bind(handle);
    if (failure === 'write') handle.writeFile = async () => { await originalWrite(bytes.subarray(0, 4)); throw new Error('sensitive path'); };
    if (failure === 'sync') handle.sync = async () => { throw new Error('sensitive path'); };
    if (failure === 'close') handle.close = async () => { await originalClose(); throw new Error('sensitive path'); };
    return handle;
  });
  await expect(writePrivateFileExclusive(join(root, 'document'), bytes)).rejects.toThrow('PRIVATE_FILE_WRITE_FAILED');
  expect(await readdir(root)).toEqual([]);
});
test('reports a failed cleanup without leaking its path or original error', async () => {
  const originalOpen = jest.requireActual('node:fs/promises').open as typeof fs.open;
  jest.spyOn(fs, 'open').mockImplementation(async (...args: Parameters<typeof fs.open>) => {
    const handle = await originalOpen(...args);
    handle.sync = async () => { throw new Error('sensitive original error'); };
    return handle;
  });
  jest.spyOn(fs, 'unlink').mockRejectedValue(new Error('sensitive cleanup path'));
  await expect(writePrivateFileExclusive(join(root, 'document'), bytes)).rejects.toThrow('PRIVATE_FILE_CLEANUP_FAILED');
});
