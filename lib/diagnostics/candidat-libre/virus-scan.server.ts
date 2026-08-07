import 'server-only';

import { execFile } from 'child_process';
import { promisify } from 'util';
import { resolveDiagnosticStoragePath } from './storage.server';

const execFileAsync = promisify(execFile);

/**
 * Fail-closed antivirus hook.
 *
 * DIAGNOSTIC_AV_MODE=clamdscan  -> execute clamdscan against the private file.
 * DIAGNOSTIC_AV_MODE=disabled   -> accepted only outside production.
 */
export async function scanDiagnosticFile(storageKey: string) {
  const mode = process.env.DIAGNOSTIC_AV_MODE ?? (process.env.NODE_ENV === 'production' ? 'required' : 'disabled');
  if (mode === 'disabled') {
    if (process.env.NODE_ENV === 'production') throw new Error('AV_NOT_CONFIGURED');
    return { clean: true, engine: 'disabled-development' } as const;
  }
  if (mode !== 'clamdscan') throw new Error('AV_NOT_CONFIGURED');

  const absolutePath = resolveDiagnosticStoragePath(storageKey);
  try {
    await execFileAsync('clamdscan', ['--no-summary', '--fdpass', absolutePath], {
      timeout: 45_000,
      maxBuffer: 64 * 1024,
      windowsHide: true,
    });
    return { clean: true, engine: 'clamdscan' } as const;
  } catch (error) {
    const exitCode = typeof error === 'object' && error && 'code' in error ? Number((error as { code?: unknown }).code) : NaN;
    if (exitCode === 1) throw new Error('MALWARE_DETECTED');
    throw new Error('AV_SCAN_FAILED');
  }
}
