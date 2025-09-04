// NOTE: use real fs/promises for LocalStorage; we'll create a temp file so copyFile succeeds.

describe('apps/web/lib/storage - LocalStorage and MinioStorage puts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('LocalStorage.put copies file and returns /files/key', async () => {
    const { LocalStorage } = await import('@/apps/web/lib/storage');
    const fs = await import('fs/promises');
    const path = await import('path');

    const baseDir = '/tmp/out';
    const store = new LocalStorage(baseDir);
    const key = 'reports/2025/09/file.pdf';
    const src = '/tmp/src.pdf';
    await fs.writeFile(src, Buffer.from('pdf'));

    const url = await store.put(src, key);
    expect(url).toBe(`/files/${key}`);
    const outPath = path.join(baseDir, key);
    const stat = await fs.stat(outPath);
    expect(stat.isFile()).toBe(true);
  });

  test('MinioStorage.put prefixes and normalizes key then delegates to putObjectFromFile', async () => {
    // Configure deterministic MinIO env for URL shape when using the real helper
    process.env.MINIO_ENDPOINT = 'localhost';
    process.env.MINIO_PORT = '9000';
    process.env.MINIO_USE_SSL = 'false';
    process.env.MINIO_BUCKET = 'nexus-docs-test';
    process.env.MINIO_PUBLIC_ENDPOINT = 'http://minio.local';

    const { MinioStorage } = await import('@/apps/web/lib/storage');
    const store = new MinioStorage('reports');
    const key = 'abc//nested/file.pdf';
    const src = '/tmp/file.pdf';

    const out = await store.put(src, key);

    // The Minio helper includes the bucket in the URL; key is now canonicalized to single slashes
    expect(out).toBe('http://minio.local/nexus-docs-test/reports/abc/nested/file.pdf');
  });
});

