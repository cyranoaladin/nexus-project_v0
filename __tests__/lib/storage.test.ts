import { jest } from '@jest/globals';

jest.unstable_mockModule('@/apps/web/lib/minio', () => ({
  putObjectFromFile: jest.fn(async (_p: string, _k: string) => 'http://minio/bucket/key'),
}));

describe('Storage provider factory', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('returns LocalStorage by default', async () => {
    delete process.env.STORAGE_PROVIDER;
    const { createStorageFromEnv } = await import('@/apps/web/lib/storage');
    const storage = createStorageFromEnv();
    expect(storage.constructor.name).toBe('LocalStorage');
  });

  test('returns MinioStorage when STORAGE_PROVIDER=minio', async () => {
    process.env.STORAGE_PROVIDER = 'minio';
    const { createStorageFromEnv } = await import('@/apps/web/lib/storage');
    const storage = createStorageFromEnv();
    expect(storage.constructor.name).toBe('MinioStorage');
  });
});
