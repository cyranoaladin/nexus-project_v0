import { execFile, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { diagnosticsStorageRoot } from './storage';

const execFileAsync = promisify(execFile);
const SCAN_TIMEOUT_MS = 45_000;
const MAX_STDOUT_BYTES = 64 * 1024;

/**
 * Fail-closed antivirus hook — same contract and env var as the existing
 * candidat-libre (Core v1, flag off) feature's virus-scan.server.ts, pointed
 * at this feature's own storage root:
 *
 *   DIAGNOSTIC_AV_MODE=clamdscan -> execute clamdscan against the file.
 *   DIAGNOSTIC_AV_MODE=disabled  -> accepted only outside production.
 *
 * Transport (mission §3): `--fdpass` passes an open file descriptor to
 * clamd over a UNIX domain socket ancillary message (SCM_RIGHTS) — this
 * has no equivalent over a network/TCP connection, and no equivalent when
 * the clamd daemon and this process are not the same host/namespace (e.g.
 * clamd running in its own container). The default path below still uses
 * `--fdpass` for the ordinary case (a host-local clamd, same machine as
 * the app). When `DIAGNOSTIC_AV_CLAMDSCAN_COMMAND` is set (a JSON array —
 * e.g. `["docker","exec","-i","nexus-clamav-c1","clamdscan"]` for a
 * containerized daemon), the file's bytes are streamed to that exact
 * command's stdin with `--stream` instead: no shared filesystem, no file
 * descriptor passing, works across the container boundary, and is the
 * documented clamdscan mode "for streaming files to clamd... running on
 * another machine." The resolved command is used exactly as configured —
 * never silently substituted — so what actually runs is always the
 * command an operator explicitly named, not a same-named binary that
 * happened to resolve first on PATH.
 */
export async function scanDiagnosticSubmissionFile(relativePath: string): Promise<{ clean: true; engine: string }> {
  const mode = process.env.DIAGNOSTIC_AV_MODE ?? (process.env.NODE_ENV === 'production' ? 'required' : 'disabled');
  if (mode === 'disabled') {
    if (process.env.NODE_ENV === 'production') throw new Error('AV_NOT_CONFIGURED');
    return { clean: true, engine: 'disabled-development' };
  }
  if (mode !== 'clamdscan') throw new Error('AV_NOT_CONFIGURED');

  const absolutePath = resolve(diagnosticsStorageRoot(), relativePath);
  const configuredCommand = process.env.DIAGNOSTIC_AV_CLAMDSCAN_COMMAND;

  if (!configuredCommand) {
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

  let command: string[];
  try {
    command = JSON.parse(configuredCommand);
    if (!Array.isArray(command) || command.length === 0 || !command.every((part) => typeof part === 'string')) {
      throw new Error('not a non-empty string array');
    }
  } catch {
    throw new Error('AV_NOT_CONFIGURED');
  }

  const bytes = await readFile(absolutePath);
  const { exitCode, stdout } = await runClamdscanStream(command, bytes);
  if (exitCode === 0) return { clean: true, engine: `clamdscan-stream:${command[0]}` };
  if (exitCode === 1) throw new Error(`MALWARE_DETECTED:${stdout.trim().slice(0, 200)}`);
  throw new Error(`AV_SCAN_FAILED:exit=${exitCode}`);
}

function runClamdscanStream(
  command: readonly string[],
  bytes: Buffer,
): Promise<{ exitCode: number; stdout: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command[0], [...command.slice(1), '--stream', '--no-summary', '-'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new Error('AV_SCAN_TIMEOUT'));
    }, SCAN_TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => {
      if (stdout.length < MAX_STDOUT_BYTES) stdout += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise({ exitCode: code ?? -1, stdout });
    });
    child.stdin.on('error', () => {
      // clamd closing the connection early (e.g. on immediate detection)
      // surfaces as EPIPE here; the real outcome is reported via the exit
      // code from the 'close' handler above, not this write error.
    });
    child.stdin.write(bytes);
    child.stdin.end();
  });
}
