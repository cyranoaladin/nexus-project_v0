import { execFile } from 'node:child_process';
import { connect } from 'node:net';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
const SCAN_TIMEOUT_MS = 45_000;
const MAX_STDOUT_BYTES = 64 * 1024;
const MAX_INSTREAM_CHUNK_BYTES = 64 * 1024;

/** Internal callers supply a private, generated quarantine path, never a client path. */
export async function scanPrivateFile(absolutePath: string | (() => string)): Promise<{ clean: true; engine: string }> {
  return scanFile(typeof absolutePath === 'function' ? absolutePath : () => absolutePath);
}

async function scanFile(resolvePath: () => string): Promise<{ clean: true; engine: string }> {
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

  const absolutePath = resolvePath();
  const tcpHost = process.env.DIAGNOSTIC_AV_CLAMD_TCP_HOST;
  const tcpPort = process.env.DIAGNOSTIC_AV_CLAMD_TCP_PORT;

  if (!tcpHost) {
    try {
      await execFileAsync('clamdscan', ['--no-summary', '--fdpass', absolutePath], {
        timeout: SCAN_TIMEOUT_MS,
        maxBuffer: MAX_STDOUT_BYTES,
        windowsHide: true,
      });
      return { clean: true, engine: 'clamdscan-fdpass' };
    } catch (error) {
      const exitCode = typeof error === 'object' && error && 'code' in error ? Number((error as { code?: unknown }).code) : NaN;
      if (exitCode === 1) throw new Error('MALWARE_DETECTED');
      throw new Error('AV_SCAN_FAILED');
    }
  }

  const port = Number(tcpPort);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) throw new Error('AV_NOT_CONFIGURED');

  const bytes = await readFile(absolutePath);
  const reply = await runClamdInstream(tcpHost, port, bytes);
  const trimmed = reply.replace(/\0+$/, '').trim();
  if (/FOUND$/.test(trimmed)) throw new Error(`MALWARE_DETECTED:${trimmed.slice(0, 200)}`);
  if (/\bOK$/.test(trimmed)) return { clean: true, engine: `clamd-instream-tcp:${tcpHost}:${port}` };
  throw new Error(`AV_SCAN_FAILED:${trimmed.slice(0, 200)}`);
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
      if (reply.length < MAX_STDOUT_BYTES) reply += chunk.toString('utf8');
    });
    socket.on('end', () => finish(() => resolvePromise(reply)));
    socket.on('close', () => finish(() => resolvePromise(reply)));
    socket.on('error', (error) => finish(() => reject(error)));
  });
}
