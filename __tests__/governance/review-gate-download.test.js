const { createHash } = require('crypto');
const { mkdtempSync, readFileSync, existsSync, rmSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');

let downloadVerified;
beforeAll(async () => {
  ({ downloadVerified } = await import('../../scripts/github/review-gate/qualification/download.mjs'));
});

describe('digest-pinned external model/runtime inputs', () => {
  test('downloads a verified stream without loading whole model in memory', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'nexus-review-download-'));
    try {
      const bytes = Buffer.from('synthetic fixture');
      const digest = createHash('sha256').update(bytes).digest('hex');
      const destination = join(directory, 'model.gguf');
      const response = { ok: true, body: new ReadableStream({ start(controller) {
        controller.enqueue(bytes); controller.close();
      } }) };
      expect(await downloadVerified({ url: 'https://huggingface.co/model/revision/file.gguf',
        sha256: digest, sizeBytes: bytes.length, destination,
        fetchImpl: async () => response })).toEqual({ sha256: digest, sizeBytes: bytes.length });
      expect(readFileSync(destination)).toEqual(bytes);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  test('digest mismatch or oversize leaves no executable artifact', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'nexus-review-download-'));
    try {
      const bytes = Buffer.from('synthetic fixture');
      const response = () => ({ ok: true, body: new ReadableStream({ start(controller) {
        controller.enqueue(bytes); controller.close();
      } }) });
      const destination = join(directory, 'model.gguf');
      await expect(downloadVerified({ url: 'https://huggingface.co/model/revision/file.gguf',
        sha256: '0'.repeat(64), sizeBytes: bytes.length, destination,
        fetchImpl: async () => response() })).rejects.toThrow('DOWNLOAD_DIGEST_MISMATCH');
      expect(existsSync(destination)).toBe(false);
      await expect(downloadVerified({ url: 'https://huggingface.co/model/revision/file.gguf',
        sha256: '0'.repeat(64), sizeBytes: 1, destination,
        fetchImpl: async () => response() })).rejects.toThrow('DOWNLOAD_SIZE_MISMATCH');
      expect(existsSync(destination)).toBe(false);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  test('HTTP, missing digest or existing target is refused', async () => {
    await expect(downloadVerified({ url: 'http://example.test/model', sha256: '0'.repeat(64),
      sizeBytes: 1, destination: '/tmp/model.gguf' })).rejects.toThrow('DOWNLOAD_CONFIG_INVALID');
  });
});
