import { resolve } from 'node:path';
import { diagnosticsStorageRoot } from './storage';
import { scanPrivateFile, scanPrivateBytes } from '@/lib/security/private-file-antivirus';

export async function scanDiagnosticSubmissionFile(relativePath: string): Promise<{ clean: true; engine: string }> {
  return scanPrivateFile(() => resolve(diagnosticsStorageRoot(), relativePath));
}

export async function scanDiagnosticSubmissionBytes(bytes: Buffer): Promise<{ clean: true; engine: string }> {
  return scanPrivateBytes(bytes);
}
