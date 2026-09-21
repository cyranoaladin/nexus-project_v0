import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { diagnosticsStorageRoot } from './storage';

const execFileAsync = promisify(execFile);

/**
 * Fail-closed antivirus hook — same contract and env var as the existing
 * candidat-libre (Core v1, flag off) feature's virus-scan.server.ts, pointed
 * at this feature's own storage root:
 *
 *   DIAGNOSTIC_AV_MODE=clamdscan -> execute clamdscan against the file.
 *   DIAGNOSTIC_AV_MODE=disabled  -> accepted only outside production.
 */
export async function scanDiagnosticSubmissionFile(relativePath: string): Promise<{ clean: true; engine: string }> {
  const mode = process.env.DIAGNOSTIC_AV_MODE ?? (process.env.NODE_ENV === 'production' ? 'required' : 'disabled');
  if (mode === 'disabled') {
    if (process.env.NODE_ENV === 'production') throw new Error('AV_NOT_CONFIGURED');
    return { clean: true, engine: 'disabled-development' };
  }
  if (mode !== 'clamdscan') throw new Error('AV_NOT_CONFIGURED');

  const absolutePath = resolve(diagnosticsStorageRoot(), relativePath);
  try {
    await execFileAsync('clamdscan', ['--no-summary', '--fdpass', absolutePath], {
      timeout: 45_000,
      maxBuffer: 64 * 1024,
      windowsHide: true,
    });
    return { clean: true, engine: 'clamdscan' };
  } catch (error) {
    const exitCode = typeof error === 'object' && error && 'code' in error ? Number((error as { code?: unknown }).code) : NaN;
    if (exitCode === 1) throw new Error('MALWARE_DETECTED');
    throw new Error('AV_SCAN_FAILED');
  }
}
