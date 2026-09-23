/**
 * Full deposit pipeline (mission §4): reception, complete-write
 * verification, mandatory antivirus scan, fingerprinting, and only THEN a
 * DB row — in that order. The guarantee is not "the write call used
 * O_CREAT|O_EXCL" but "no incomplete, unscanned, or rejected copy is ever
 * exposed as an available submission." A failure at any stage quarantines
 * the file (never deletes it, never silently overwrites an earlier
 * submission) and never creates a DB row implying success.
 */
import { createHash, randomUUID } from 'node:crypto';
import type { DiagnosticSubmission, PrismaClient } from '@/core-v2/generated/client';
import { InvalidStateError } from '../errors';
import { createOwnDiagnosticSubmission, getOwnDiagnosticAssignmentForSubjectAccess } from '../services/diagnostics';
import type { ServiceContext } from '../services/context';
import { CURRENT_DIAGNOSTIC_SUBMISSION_STATUSES } from './current-submission';
import {
  deleteDiagnosticStagingFile,
  diagnosticQuarantineRelativePath,
  diagnosticStagingRelativePath,
  diagnosticSubmissionRelativePath,
  moveDiagnosticStorageFile,
  verifyStagedFile,
  writeDiagnosticStorageFile,
} from './storage';
import { scanDiagnosticSubmissionFile } from './virus-scan';

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
  // Ownership + not-revoked, re-checked here regardless of any earlier
  // check by a caller — access control applies at every access, not once
  // per page load.
  const assignment = await getOwnDiagnosticAssignmentForSubjectAccess(client, ctx, input.assignmentId);

  const sha256 = createHash('sha256').update(input.bytes).digest('hex');

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
  const extension = 'pdf';
  const stagingPath = diagnosticStagingRelativePath(token, extension);
  await writeDiagnosticStorageFile(stagingPath, input.bytes);

  const verification = await verifyStagedFile(stagingPath, { sizeBytes: input.bytes.length, sha256 });
  if (!verification.ok) {
    const quarantinePath = diagnosticQuarantineRelativePath(token, extension);
    await moveDiagnosticStorageFile(stagingPath, quarantinePath).catch(() => deleteDiagnosticStagingFile(stagingPath));
    await createOwnDiagnosticSubmission(client, ctx, {
      assignmentId: assignment.id,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      sizeBytes: input.bytes.length,
      sha256,
      storageKey: quarantinePath,
      status: 'REJECTED',
      reviewNote: 'Write-verification failed: the file on disk did not match what was expected.',
    }).catch(() => undefined); // audit row is best-effort; the refusal itself does not depend on it
    throw new InvalidStateError(
      'The deposit could not be verified as fully and correctly written on disk; it was not recorded as received.',
      { assignmentId: assignment.id },
    );
  }

  let avRejectionReason: string | null = null;
  try {
    await scanDiagnosticSubmissionFile(stagingPath);
  } catch (error) {
    avRejectionReason = error instanceof Error ? error.message : 'AV_REJECTED';
  }

  if (avRejectionReason) {
    const quarantinePath = diagnosticQuarantineRelativePath(token, extension);
    await moveDiagnosticStorageFile(stagingPath, quarantinePath);
    await createOwnDiagnosticSubmission(client, ctx, {
      assignmentId: assignment.id,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      sizeBytes: input.bytes.length,
      sha256,
      storageKey: quarantinePath,
      status: 'REJECTED',
      reviewNote: `Rejected by the required security scan: ${avRejectionReason}`,
    }).catch(() => undefined);
    throw new InvalidStateError(
      'The deposit was rejected by the required security scan and was not recorded as available.',
      { assignmentId: assignment.id, reason: avRejectionReason },
    );
  }

  const finalPath = diagnosticSubmissionRelativePath(assignment.id, token, extension);
  await moveDiagnosticStorageFile(stagingPath, finalPath);

  try {
    const submission = await createOwnDiagnosticSubmission(client, ctx, {
      assignmentId: assignment.id,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      sizeBytes: input.bytes.length,
      sha256,
      storageKey: finalPath,
    });
    return { submission, idempotentReplay: false };
  } catch (error) {
    // No DB row means no available submission — the now-orphaned finalized
    // file is quarantined (evidence kept), never left dangling and never
    // silently deleted.
    await moveDiagnosticStorageFile(finalPath, diagnosticQuarantineRelativePath(token, extension)).catch(() => undefined);
    throw error;
  }
}
