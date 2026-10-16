import { createHash } from 'node:crypto';
import { open, unlink } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const SHA256 = /^[0-9a-f]{64}$/;

/** Digest-verify a pinned public asset before a downloaded binary can execute. */
export async function downloadVerified({ url, sha256, sizeBytes, destination,
  fetchImpl = fetch } = {}) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('DOWNLOAD_CONFIG_INVALID'); }
  if (parsed.protocol !== 'https:' ||
      !['huggingface.co', 'github.com'].includes(parsed.hostname) ||
      !SHA256.test(sha256 ?? '') || !Number.isSafeInteger(sizeBytes) || sizeBytes < 1 ||
      typeof destination !== 'string' || !destination.startsWith('/') ||
      destination.split('/').includes('..') || typeof fetchImpl !== 'function') {
    throw new Error('DOWNLOAD_CONFIG_INVALID');
  }
  let response;
  try { response = await fetchImpl(url, { signal: AbortSignal.timeout(20 * 60 * 1000) }); }
  catch { throw new Error('DOWNLOAD_UNAVAILABLE'); }
  if (!response?.ok || !response.body) throw new Error('DOWNLOAD_UNAVAILABLE');

  let file;
  try { file = await open(destination, 'wx', 0o600); }
  catch { throw new Error('DOWNLOAD_TARGET_NOT_NEW'); }
  let bytes = 0;
  const hash = createHash('sha256');
  const verifier = new Transform({ transform(chunk, _encoding, callback) {
    bytes += chunk.length;
    if (bytes > sizeBytes) return callback(new Error('DOWNLOAD_SIZE_MISMATCH'));
    hash.update(chunk);
    callback(null, chunk);
  } });
  try {
    await pipeline(Readable.fromWeb(response.body), verifier, file.createWriteStream());
    if (bytes !== sizeBytes) throw new Error('DOWNLOAD_SIZE_MISMATCH');
    const actual = hash.digest('hex');
    if (actual !== sha256) throw new Error('DOWNLOAD_DIGEST_MISMATCH');
    return { sha256: actual, sizeBytes: bytes };
  } catch (error) {
    try { await file.close(); } catch {}
    await unlink(destination);
    if (['DOWNLOAD_SIZE_MISMATCH', 'DOWNLOAD_DIGEST_MISMATCH'].includes(error?.message)) throw error;
    throw new Error('DOWNLOAD_UNAVAILABLE');
  }
}
