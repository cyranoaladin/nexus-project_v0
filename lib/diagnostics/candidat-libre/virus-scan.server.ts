import 'server-only';

import { randomUUID } from 'node:crypto';
import { access, constants, mkdtemp, open, rm, rmdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scanPrivateFile } from '@/lib/security/private-file-antivirus';

/**
 * Antivirus gate for candidat-libre deposits.
 *
 * INVARIANT: the engine is shown the PLAINTEXT upload, before it is encrypted
 * and before anything is persisted. A previous version scanned the stored file,
 * which is an AES-GCM ciphertext: no signature can ever match it, so the scan
 * was a silent no-op as soon as an engine was configured.
 *
 * The verdict itself is delegated to `scanPrivateFile`, the project's single
 * scanning authority (clamd INSTREAM over TCP, shared with Documents / Espace /
 * NPC). That authority works on a path, so the bytes are handed to it through
 * an anonymous file: created in a private 0700 directory, unlinked and the
 * directory removed BEFORE any byte is written, then read back through
 * `/proc/<pid>/fd/<fd>` (the same technique as the NPC atomic writer). The
 * plaintext therefore never has a name on disk, is never written next to the
 * encrypted store, and the kernel reclaims it as soon as the descriptor is
 * closed — even if the process is killed mid-scan. Preferring `/dev/shm`
 * (tmpfs) keeps it off the block device altogether.
 */

export type DiagnosticScanResult = Readonly<{ clean: true; engine: string }>;

const KNOWN_AV_MODES = new Set(['disabled', 'clamdscan']);

function misconfigured(reason: string): never {
  // Operator-facing and loud: no upload content, no identifiers, no env values.
  console.error(`[candidat-libre] antivirus misconfigured: ${reason}`);
  throw new Error('AV_NOT_CONFIGURED');
}

/**
 * Fails loudly (AV_NOT_CONFIGURED) unless the antivirus configuration is
 * explicit. An unset or EMPTY DIAGNOSTIC_AV_MODE is never read as "no scanning".
 *
 * Production: DIAGNOSTIC_AV_MODE=clamdscan plus DIAGNOSTIC_AV_CLAMD_TCP_HOST and
 * DIAGNOSTIC_AV_CLAMD_TCP_PORT (the INSTREAM endpoint). `disabled` is accepted
 * only on a declared disposable stack (E2E_DISPOSABLE_STACK=1), exactly like the
 * shared authority. Outside production, unset means `disabled` (development).
 */
export function assertDiagnosticAvConfigured(env: NodeJS.ProcessEnv = process.env): void {
  const mode = env.DIAGNOSTIC_AV_MODE;
  const production = env.NODE_ENV === 'production';

  if (mode !== undefined && !KNOWN_AV_MODES.has(mode)) {
    misconfigured(mode === ''
      ? 'DIAGNOSTIC_AV_MODE is set but empty; set it to "clamdscan" (or unset it outside production)'
      : 'DIAGNOSTIC_AV_MODE has an unsupported value; expected "clamdscan"');
  }
  if (production && mode === 'disabled') {
    if (env.E2E_DISPOSABLE_STACK === '1') return;
    misconfigured('DIAGNOSTIC_AV_MODE=disabled is refused in production');
  }
  if (production && mode !== 'clamdscan') {
    misconfigured('DIAGNOSTIC_AV_MODE must be "clamdscan" in production (it is unset)');
  }
  if (mode === 'clamdscan') {
    const host = env.DIAGNOSTIC_AV_CLAMD_TCP_HOST;
    const port = Number(env.DIAGNOSTIC_AV_CLAMD_TCP_PORT);
    if (production && !host) misconfigured('DIAGNOSTIC_AV_CLAMD_TCP_HOST is required in production');
    if (host && (!Number.isInteger(port) || port <= 0 || port > 65_535)) {
      misconfigured('DIAGNOSTIC_AV_CLAMD_TCP_PORT must be a valid TCP port');
    }
  }
}

async function scratchBase(): Promise<string> {
  try {
    await access('/dev/shm', constants.W_OK);
    return '/dev/shm';
  } catch {
    return tmpdir();
  }
}

/** Short, content-free label for logs: an error code or the leading token of a message. */
function errorLabel(error: unknown): string {
  if (!(error instanceof Error)) return 'unknown';
  const code = (error as { code?: unknown }).code;
  return (typeof code === 'string' ? code : error.message.split(':')[0]).slice(0, 60);
}

/**
 * Scans the plaintext bytes of an upload. Resolves only on an explicit clean
 * verdict; every other outcome throws:
 *   MALWARE_DETECTED   the engine matched a signature
 *   AV_NOT_CONFIGURED  explicit configuration missing or invalid
 *   AV_SCAN_FAILED     engine unreachable, timeout, unknown verdict, or any I/O error
 */
export async function scanDiagnosticPlaintext(plaintext: Buffer): Promise<DiagnosticScanResult> {
  assertDiagnosticAvConfigured();

  let directory: string | null = null;
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    directory = await mkdtemp(path.join(await scratchBase(), 'nexus-av-'));
    const entry = path.join(directory, randomUUID());
    handle = await open(entry, 'wx', 0o600);
    // Anonymise BEFORE writing: from here on the content has no path.
    await unlink(entry);
    await rmdir(directory);
    directory = null;
    await handle.writeFile(plaintext);
    const verdict = await scanPrivateFile(`/proc/${process.pid}/fd/${handle.fd}`);
    return { clean: true, engine: verdict.engine };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('MALWARE_DETECTED')) {
      // Signature name only (e.g. "Eicar-Signature"): never content, never a file name.
      console.warn(`[candidat-libre] upload refused by antivirus: ${message.slice('MALWARE_DETECTED:'.length).replace(/^stream:\s*/, '').slice(0, 120)}`);
      throw new Error('MALWARE_DETECTED');
    }
    if (message === 'AV_NOT_CONFIGURED') throw new Error('AV_NOT_CONFIGURED');
    console.error(`[candidat-libre] antivirus scan failed: ${errorLabel(error)}`);
    throw new Error('AV_SCAN_FAILED');
  } finally {
    await handle?.close().catch(() => undefined);
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}
