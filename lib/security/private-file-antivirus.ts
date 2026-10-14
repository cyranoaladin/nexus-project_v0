import { connect } from 'node:net';
import { readFile } from 'node:fs/promises';
const SCAN_TIMEOUT_MS = 45_000;
const MAX_STDOUT_BYTES = 64 * 1024;
const MAX_INSTREAM_CHUNK_BYTES = 64 * 1024;

/** Internal callers supply a private, generated quarantine path, never a client path. */
export async function scanPrivateFile(absolutePath: string | (() => string)): Promise<{ clean: true; engine: string }> {
  return scanFile(typeof absolutePath === 'function' ? absolutePath : () => absolutePath);
}

async function scanFile(resolvePath: () => string): Promise<{ clean: true; engine: string }> {
  const disabled = disabledScanVerdict();
  if (disabled) return disabled;
  const absolutePath = resolvePath();
  const port = Number(process.env.DIAGNOSTIC_AV_CLAMD_TCP_PORT);
  if (!process.env.DIAGNOSTIC_AV_CLAMD_TCP_HOST || !Number.isInteger(port) || port <= 0 || port > 65_535)
    throw new Error('AV_NOT_CONFIGURED');
  let bytes: Buffer;
  try { bytes = await readFile(absolutePath); } catch { throw new Error('AV_SCAN_FAILED'); }
  return scanPrivateBytes(bytes);
}

function disabledScanVerdict(): { clean: true; engine: string } | undefined {
  const mode = process.env.DIAGNOSTIC_AV_MODE ?? (process.env.NODE_ENV === 'production' ? 'required' : 'disabled');
  if (mode === 'disabled') {
    // `disabled` in a NODE_ENV=production context is refused UNLESS this
    // is explicitly a disposable rehearsal stack, never inferred from
    // NODE_ENV alone (same discipline as the demo-scope allowlist) — a
    // real production deployment never sets E2E_DISPOSABLE_STACK, so this
    // cannot become an accidental way to silently skip AV there. Some CI
    // jobs deliberately build and run with NODE_ENV=production (a real
    // production-shaped artifact) while having no clamd of their own
    // available; that HTTP-boundary proof tier is legitimate as long as
    // it is explicit and separate from the real-engine proof (mission §3).
    if (process.env.NODE_ENV === 'production' && process.env.E2E_DISPOSABLE_STACK !== '1') {
      throw new Error('AV_NOT_CONFIGURED');
    }
    return { clean: true, engine: process.env.NODE_ENV === 'production' ? 'disabled-e2e-disposable' : 'disabled-development' };
  }
  if (mode !== 'clamdscan') throw new Error('AV_NOT_CONFIGURED');
  return undefined;
}

/** Scan the clear in-memory bytes before any file exists. No scratch file or disk fallback. */
export async function scanPrivateBytes(bytes: Buffer): Promise<{ clean: true; engine: string }> {
  const disabled = disabledScanVerdict();
  if (disabled) return disabled;
  const tcpHost = process.env.DIAGNOSTIC_AV_CLAMD_TCP_HOST;
  const tcpPort = process.env.DIAGNOSTIC_AV_CLAMD_TCP_PORT;
  const port = Number(tcpPort);
  if (!tcpHost || !Number.isInteger(port) || port <= 0 || port > 65_535) throw new Error('AV_NOT_CONFIGURED');
  let reply: string;
  try { reply = await runClamdInstream(tcpHost, port, bytes); }
  catch (error) { throw new Error(error instanceof Error && error.message === 'AV_SCAN_TIMEOUT' ? 'AV_SCAN_TIMEOUT' : 'AV_SCAN_FAILED'); }
  const trimmed = reply.replace(/\0+$/, '').trim();
  if (/FOUND$/.test(trimmed)) throw new Error('MALWARE_DETECTED');
  // Exact clamd INSTREAM verdict only. A looser match (`\bOK$`) would accept
  // any invalid reply that merely ends in "OK" (e.g. "stream: NOT OK") as clean.
  if (trimmed === 'stream: OK') return { clean: true, engine: 'clamd-instream-tcp' };
  throw new Error('AV_SCAN_FAILED');
}

/**
 * Speaks clamd's INSTREAM protocol directly over a TCP socket — never a
 * shell, never an external binary. Bounded by SCAN_TIMEOUT_MS end to end
 * and MAX_STDOUT_BYTES on the reply; the socket is always destroyed on
 * any exit path (success, error, or timeout), never left dangling.
 */
function runClamdInstream(host: string, port: number, bytes: Buffer): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const socket = connect(port, host);
    let reply = '';
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      fn();
    };

    const timer = setTimeout(() => finish(() => reject(new Error('AV_SCAN_TIMEOUT'))), SCAN_TIMEOUT_MS);

    socket.on('connect', () => {
      socket.write('zINSTREAM\0');
      for (let offset = 0; offset < bytes.length; offset += MAX_INSTREAM_CHUNK_BYTES) {
        const chunk = bytes.subarray(offset, offset + MAX_INSTREAM_CHUNK_BYTES);
        const lengthPrefix = Buffer.alloc(4);
        lengthPrefix.writeUInt32BE(chunk.length, 0);
        socket.write(lengthPrefix);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4)); // zero-length chunk terminates the stream
    });
    socket.on('data', (chunk: Buffer) => {
      if (Buffer.byteLength(reply) + chunk.length > MAX_STDOUT_BYTES) {
        finish(() => reject(new Error('AV_SCAN_FAILED')));
      } else reply += chunk.toString('utf8');
    });
    socket.on('end', () => finish(() => resolvePromise(reply)));
    socket.on('close', () => finish(() => resolvePromise(reply)));
    socket.on('error', (error) => finish(() => reject(error)));
  });
}
