import 'server-only';

import { scanPrivateBytes } from '@/lib/security/private-file-antivirus';

/** Clear upload bytes are scanned in memory before encryption or persistence. */

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

export async function scanDiagnosticPlaintext(plaintext: Buffer): Promise<DiagnosticScanResult> {
  assertDiagnosticAvConfigured();

  try { return await scanPrivateBytes(plaintext); }
  catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'MALWARE_DETECTED' || code === 'AV_NOT_CONFIGURED') throw new Error(code);
    throw new Error('AV_SCAN_FAILED');
  }
}
