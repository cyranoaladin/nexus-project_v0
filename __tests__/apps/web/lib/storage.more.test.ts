import { LocalStorage, MinioStorage, createStorageFromEnv } from '@/apps/web/lib/storage';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('apps/web/lib/storage - more coverage', () => {
  it('LocalStorage.put copies file and returns /files URL', async () => {
    const base = path.join(os.tmpdir(), `storage-${Date.now()}`);
    process.env.RAG_STORAGE_DIR = base;
    const file = path.join(os.tmpdir(), `src-${Date.now()}.txt`);
    await fs.writeFile(file, 'hello');

    const storage = new LocalStorage();
    const url = await storage.put(file, 'a/b/c.txt');
    expect(url).toBe('/files/a/b/c.txt');
    const target = path.join(base, 'a/b/c.txt');
    const stat = await fs.stat(target);
    expect(stat.isFile()).toBe(true);
  });

  it('LocalStorage.put rejects when source missing', async () => {
    process.env.RAG_STORAGE_DIR = path.join(os.tmpdir(), `storage-${Date.now()}`);
    const storage = new LocalStorage();
    await expect(storage.put('/no/such/file.txt', 'x/y.txt')).rejects.toBeTruthy();
  });

  it('MinioStorage.put delegates to putObjectFromFile with normalized key', async () => {
    const putObjectFromFile = jest.fn().mockResolvedValue('https://object/url');
    jest.doMock('@/apps/web/lib/minio', () => ({ __esModule: true, default: {}, putObjectFromFile } as any));
    // Re-require after mocking
    const { MinioStorage: MinioAfter } = require('@/apps/web/lib/storage');
    const storage = new MinioAfter('reports');
    const url = await storage.put('/tmp/file.pdf', 'folder/doc.pdf');
    expect(url).toBe('https://object/url');
    expect(putObjectFromFile).toHaveBeenCalledWith('/tmp/file.pdf', 'reports/folder/doc.pdf');
  });

  it('createStorageFromEnv picks provider based on env', async () => {
    delete process.env.STORAGE_PROVIDER;
    expect(createStorageFromEnv() instanceof LocalStorage).toBe(true);
    process.env.STORAGE_PROVIDER = 'minio';
    const s = createStorageFromEnv();
    expect(s instanceof MinioStorage).toBe(true);
  });
});
