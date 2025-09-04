import { jest } from '@jest/globals';

jest.unstable_mockModule('minio', () => ({
  Client: class {
    constructor(_cfg: any) {}
    bucketExists = jest.fn(async (_b: string) => false);
    makeBucket = jest.fn(async (_b: string) => {});
    fPutObject = jest.fn(async (_b: string, _k: string, _p: string) => {});
  }
}));

describe('MinIO client', () => {
  beforeEach(() => {
    process.env.MINIO_ENDPOINT = 'localhost';
    process.env.MINIO_PORT = '9000';
    process.env.MINIO_USE_SSL = 'false';
    process.env.MINIO_ACCESS_KEY = 'minioadmin';
    process.env.MINIO_SECRET_KEY = 'minioadmin';
    process.env.MINIO_BUCKET = 'nexus-docs-test';
    process.env.MINIO_PUBLIC_ENDPOINT = 'http://localhost:9000';
    jest.resetModules();
  });

  test('ensureBucketExists + putObjectFromFile returns URL', async () => {
    const { ensureBucketExists, putObjectFromFile, getMinioClient } = await import('@/apps/web/lib/minio');
    // Create a temp file
    const fs = await import('fs');
    const tmp = '/tmp/file.pdf';
    fs.writeFileSync(tmp, Buffer.from('%PDF-1.4\n%EOF'));
    await ensureBucketExists();
    const url = await putObjectFromFile(tmp, 'reports/abc/bilan.pdf');
    expect(url).toBe('http://localhost:9000/nexus-docs-test/reports/abc/bilan.pdf');
    const { bucket } = getMinioClient();
    expect(bucket).toBe('nexus-docs-test');
  });
});
