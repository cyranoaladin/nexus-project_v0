import { execFile } from 'node:child_process';
import { connect } from 'node:net';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { diagnosticsStorageRoot } from './storage';

const execFileAsync = promisify(execFile);
const SCAN_TIMEOUT_MS = 45_000;
const MAX_STDOUT_BYTES = 64 * 1024;
const MAX_INSTREAM_CHUNK_BYTES = 64 * 1024;

/**
 * Fail-closed antivirus hook — same contract and env var as the existing
 * candidat-libre (Core v1, flag off) feature's virus-scan.server.ts, pointed
 * at this feature's own storage root:
 *
 *   DIAGNOSTIC_AV_MODE=clamdscan -> execute clamdscan against the file.
 *   DIAGNOSTIC_AV_MODE=disabled  -> accepted only outside production.
 *
 * Transport (mission §3, revised): `--fdpass` passes an open file
 * descriptor to clamd over a UNIX domain socket ancillary message
 * (SCM_RIGHTS) — this has no equivalent over a network connection, and no
 * equivalent when the clamd daemon and this process are not the same
 * host/namespace. The default path below still uses `--fdpass` for the
 * ordinary case (a host-local clamd, same machine as the app).
 *
 * For a clamd that is NOT on the same host/namespace (e.g. running in its
 * own container), an earlier version of this module shelled out to
 * `docker exec ... clamdscan --stream`. That required the web server's own
 * OS user to be a member of the `docker` group — equivalent to root on the
 * host, since docker-group membership grants control of the whole daemon,
 * not just this one container. That is far more privilege than this
 * feature needs. Since the containerized daemon already publishes clamd's
 * OWN protocol port on a loopback-only address, this module instead speaks
 * clamd's native INSTREAM wire protocol directly over a plain TCP socket
 * to `DIAGNOSTIC_AV_CLAMD_TCP_HOST:DIAGNOSTIC_AV_CLAMD_TCP_PORT` — no
 * Docker socket access, no external client binary, no elevated group
 * membership of any kind. The protocol itself (`zINSTREAM\0`, then
 * 4-byte-big-endian-length-prefixed chunks, then a zero-length chunk) is
 * clamd's own documented wire format, not something this module invents.
 */
export async function scanDiagnosticSubmissionFile(relativePath: string): Promise<{ clean: true; engine: string }> {
  const mode = process.env.DIAGNOSTIC_AV_MODE ?? (process.env.NODE_ENV === 'production' ? 'required' : 'disabled');
  if (mode === 'disabled') {
    if (process.env.NODE_ENV === 'production') throw new Error('AV_NOT_CONFIGURED');
    return { clean: true, engine: 'disabled-development' };
  }
  if (mode !== 'clamdscan') throw new Error('AV_NOT_CONFIGURED');

  const absolutePath = resolve(diagnosticsStorageRoot(), relativePath);
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
