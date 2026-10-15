/** Clear bytes are scanned in memory before encryption, filesystem writes or database mutations. */
import { createHash, randomUUID } from 'node:crypto';
import type { DiagnosticSubmission, PrismaClient } from '@/core-v2/generated/client';
import { InvalidStateError } from '../errors';
import { createOwnDiagnosticSubmission, getOwnDiagnosticAssignmentForSubjectAccess } from '../services/diagnostics';
import type { ServiceContext } from '../services/context';
import { CURRENT_DIAGNOSTIC_SUBMISSION_STATUSES } from '@/lib/diagnostics/current-submission';
import {
  deleteDiagnosticStagingFile,
  diagnosticStagingRelativePath,
  diagnosticSubmissionRelativePath,
  moveDiagnosticStorageFile,
  verifyStagedFile,
  writeDiagnosticStorageFile,
} from './storage';
import { scanDiagnosticSubmissionBytes } from './virus-scan';
import { encryptDocument, decryptDocument } from '@/lib/documents/encryption';
import { diagnosticSubmissionEncryptionContext, readDiagnosticStorageFile } from './storage';

export interface DepositInput {
  readonly assignmentId: string;
  readonly originalFilename: string;
  readonly mimeType: string;
  readonly bytes: Buffer;
}

export interface DepositResult {
  readonly submission: DiagnosticSubmission;
  /** True when this call was recognized as a repeat of the immediately-prior deposit (identical bytes), not a new version. */
  readonly idempotentReplay: boolean;
}

export async function depositOwnDiagnosticSubmission(
  client: PrismaClient,
  ctx: ServiceContext,
  input: DepositInput,
): Promise<DepositResult> {
  const clear = Buffer.from(input.bytes);
  // Ownership + not-revoked, re-checked here regardless of any earlier
  // check by a caller — access control applies at every access, not once
  // per page load.
  const assignment = await getOwnDiagnosticAssignmentForSubjectAccess(client, ctx, input.assignmentId);

  const sha256 = createHash('sha256').update(clear).digest('hex');
  try { await scanDiagnosticSubmissionBytes(clear); }
  catch { throw new InvalidStateError('The deposit was refused by the required security scan.'); }

  // Repeat of the same request (e.g. a network retry) vs. a distinct new
  // deposit: identical bytes as the current, non-rejected latest version
  // is a replay — return it as-is, write nothing, create nothing.
  const latest = await client.diagnosticSubmission.findFirst({
    where: { assignmentId: assignment.id, status: { in: [...CURRENT_DIAGNOSTIC_SUBMISSION_STATUSES] } },
    orderBy: { version: 'desc' },
  });
  if (latest && latest.sha256 === sha256) {
    return { submission: latest, idempotentReplay: true };
  }

  const token = randomUUID();
  const extension = 'enc';
  const finalPath = diagnosticSubmissionRelativePath(assignment.id, token, extension);
  const stagingPath = diagnosticStagingRelativePath(token, extension);
  const encryptionContext = diagnosticSubmissionEncryptionContext(finalPath);
  const encrypted = encryptDocument(clear, encryptionContext);
  const ciphertextDigest = createHash('sha256').update(encrypted).digest('hex');
  let persistedPath = stagingPath;
  let ownsPersistedFile = false;
  try {
    await writeDiagnosticStorageFile(stagingPath, encrypted);
    ownsPersistedFile = true;
    const verification = await verifyStagedFile(stagingPath, { sizeBytes: encrypted.length, sha256: ciphertextDigest });
    if (!verification.ok) throw new InvalidStateError('The encrypted deposit could not be verified.');
    const document = await readDiagnosticStorageFile(stagingPath);
    try {
      const reread = decryptDocument(await document.handle.readFile(), encryptionContext);
      if (reread.length !== clear.length || createHash('sha256').update(reread).digest('hex') !== sha256)
        throw new InvalidStateError('The encrypted deposit could not be verified.');
    } finally { await document.handle.close(); }
    await moveDiagnosticStorageFile(stagingPath, finalPath);
    persistedPath = finalPath;
    const submission = await createOwnDiagnosticSubmission(client, ctx, {
      assignmentId: assignment.id, originalFilename: input.originalFilename, mimeType: input.mimeType,
      sizeBytes: clear.length, sha256, storageKey: finalPath,
    });
    return { submission, idempotentReplay: false };
  } catch (error) {
    if (ownsPersistedFile && persistedPath === finalPath) {
      // A transport error can arrive after COMMIT. Never delete a document
      // referenced by a committed row, or guess when the database is unavailable.
      let committed: DiagnosticSubmission | null;
      try { committed = await client.diagnosticSubmission.findFirst({ where: { storageKey: finalPath } }); }
      catch { throw new InvalidStateError('The deposit requires storage reconciliation.'); }
      if (committed) {
        if (committed.assignmentId !== assignment.id || committed.sha256 !== sha256 || committed.sizeBytes !== clear.length)
          throw new InvalidStateError('The deposit requires storage reconciliation.');
        return { submission: committed, idempotentReplay: false };
      }
    }
    if (ownsPersistedFile) await deleteDiagnosticStagingFile(persistedPath);
    throw error;
  }
}
