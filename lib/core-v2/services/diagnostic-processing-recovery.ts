import type { PrismaClient } from '@/core-v2/generated/client';
import { ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../errors';
import { assertCapability } from '../rbac';
import { appendAuditEvent } from '../audit';
import type { ServiceContext, Tx } from './context';
import { inTransaction } from './context';
import { idSchema, parseInput } from './validation';
import { MAX_PROCESSING_ATTEMPTS } from './diagnostic-processing';
import { assertDemoFixtureAttributable } from '../diagnostics/demo-scope';

const PDFJS_INCIDENT_REASON = 'PDFJS_STANDALONE_PACKAGING_INCIDENT' as const;
const RELEASE_SHA_PATTERN = /^[a-f0-9]{40}$/;
const FILE_SHA256_PATTERN = /^[a-f0-9]{64}$/;
const OPERATION_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

export interface AuthorizeDiagnosticProcessingRetryInput {
  readonly processingId: string;
  readonly submissionId: string;
  readonly submissionVersion: number;
  readonly submissionSha256: string;
  readonly subjectVersion: string;
  readonly lastExtractionId: string;
  readonly lastExtractionRevision: number;
  readonly attemptCount: number;
  readonly reason: typeof PDFJS_INCIDENT_REASON;
  readonly operationId: string;
}

function validateInput(input: AuthorizeDiagnosticProcessingRetryInput): AuthorizeDiagnosticProcessingRetryInput {
  parseInput(idSchema, input.processingId);
  parseInput(idSchema, input.submissionId);
  parseInput(idSchema, input.lastExtractionId);
  if (!Number.isSafeInteger(input.submissionVersion) || input.submissionVersion < 1
    || !Number.isSafeInteger(input.lastExtractionRevision) || input.lastExtractionRevision < 1
    || input.attemptCount !== 5
    || !FILE_SHA256_PATTERN.test(input.submissionSha256)
    || !input.subjectVersion || input.subjectVersion.length > 100
    || !OPERATION_PATTERN.test(input.operationId)
    || input.reason !== PDFJS_INCIDENT_REASON) {
    throw new ValidationError('Invalid bounded extraction retry authorization input.');
  }
  return input;
}

function isPdfJsPackagingIncident(errorMessage: string | null): boolean {
  if (!errorMessage) return false;
  return errorMessage.includes('pdfjs-dist')
    && (errorMessage.includes('ERR_MODULE_NOT_FOUND') || errorMessage.includes('not present in the standalone runtime'));
}

function sameAuthorization(
  row: {
    submissionId: string;
    submissionVersionSnapshot: number | null;
    submissionSha256Snapshot: string | null;
    subjectVersionSnapshot: string | null;
    extractionIdSnapshot: string | null;
    extractionRevisionSnapshot: number | null;
    attemptCountSnapshot: number | null;
    reason: string | null;
  },
  input: AuthorizeDiagnosticProcessingRetryInput,
): boolean {
  return row.submissionId === input.submissionId
    && row.submissionVersionSnapshot === input.submissionVersion
    && row.submissionSha256Snapshot === input.submissionSha256
    && row.subjectVersionSnapshot === input.subjectVersion
    && row.extractionIdSnapshot === input.lastExtractionId
    && row.extractionRevisionSnapshot === input.lastExtractionRevision
    && row.attemptCountSnapshot === input.attemptCount
    && row.reason === input.reason;
}

async function lockProcessing(tx: Tx, processingId: string): Promise<void> {
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "diagnostic_submission_processings" WHERE "id" = ${processingId} FOR UPDATE
  `;
  if (locked.length === 0) throw new NotFoundError('Processing record not found.', { processingId });
}

/**
 * Grants exactly one additional worker claim for the narrowly identified
 * historical PDF.js standalone omission. The caller supplies the SHA read
 * by the server from the immutable release marker; it is never request data.
 */
export async function authorizeDiagnosticProcessingRetry(
  client: PrismaClient,
  ctx: ServiceContext,
  rawInput: AuthorizeDiagnosticProcessingRetryInput,
  trustedReleaseSha: string,
) {
  assertCapability(ctx.actor, 'DIAGNOSTIC_PROCESSING_RECOVERY_AUTHORIZE');
  const input = validateInput(rawInput);
  if (!RELEASE_SHA_PATTERN.test(trustedReleaseSha)) throw new InvalidStateError('The running release identity is unavailable.');

  return inTransaction(client, async (tx) => {
    await lockProcessing(tx, input.processingId);

    const operation = await tx.diagnosticSubmissionProcessing.findUnique({
      where: { retryAuthorizationOperationId: input.operationId },
    });
    if (operation) {
      if (operation.id !== input.processingId) throw new ConflictError('Operation id is already bound to another processing record.');
      const snapshot = {
        submissionId: operation.retrySubmissionIdSnapshot ?? '',
        submissionVersionSnapshot: operation.retrySubmissionVersionSnapshot,
        submissionSha256Snapshot: operation.retrySubmissionSha256Snapshot,
        subjectVersionSnapshot: operation.retrySubjectVersionSnapshot,
        extractionIdSnapshot: operation.retryExtractionIdSnapshot,
        extractionRevisionSnapshot: operation.retryExtractionRevisionSnapshot,
        attemptCountSnapshot: operation.retryAttemptCountSnapshot,
        reason: operation.retryAuthorizationReason,
      };
      if (operation.retryAuthorizationActorId !== ctx.actor.userId
        || !sameAuthorization(snapshot, input)
        || operation.retryAuthorizationReleaseSha !== trustedReleaseSha) {
        throw new ConflictError('Operation id replay does not match the original authorization.');
      }
      return operation;
    }

    const processing = await tx.diagnosticSubmissionProcessing.findUnique({
      where: { id: input.processingId },
      include: {
        submission: {
          include: {
            assignment: { include: { instrumentRef: true } },
          },
        },
        extractions: { orderBy: { revision: 'desc' } },
      },
    });
    if (!processing) throw new NotFoundError('Processing record not found.', { processingId: input.processingId });
    if (processing.retryAuthorizationOperationId) throw new ConflictError('This processing already has a retry authorization.');
    if (processing.status !== 'EXTRACTION_FAILED' || processing.attemptCount !== 5
      || processing.leaseOwner !== null || processing.leaseExpiresAt !== null) {
      throw new InvalidStateError('Processing is not at the exact exhausted, unleased incident state.');
    }

    const submission = processing.submission;
    assertDemoFixtureAttributable(submission.assignment.studentId);
    if (submission.id !== input.submissionId || submission.version !== input.submissionVersion
      || submission.sha256 !== input.submissionSha256
      || processing.submissionId !== input.submissionId
      || processing.submissionVersionSnapshot !== input.submissionVersion
      || processing.submissionSha256Snapshot !== input.submissionSha256
      || processing.subjectVersionSnapshot !== input.subjectVersion
      || submission.assignment.instrumentVersionSnapshot !== input.subjectVersion
      || submission.status !== 'RECEIVED'
      || submission.assignment.status === 'REVOKED'
      || submission.assignment.instrumentRef.catalogStatus !== 'DEMO_FIXTURE') {
      throw new InvalidStateError('Submission, assignment, or frozen processing snapshot no longer matches the authorized target.');
    }

    const currentSubmission = await tx.diagnosticSubmission.findFirst({
      where: { assignmentId: submission.assignmentId, status: { in: ['RECEIVED', 'READABLE', 'ANALYZED'] } },
      orderBy: { version: 'desc' },
      select: { id: true },
    });
    if (currentSubmission?.id !== submission.id) throw new InvalidStateError('Submission is no longer the current usable version.');

    const latest = processing.extractions[0];
    if (processing.extractions.length !== MAX_PROCESSING_ATTEMPTS
      || processing.extractions.some((row, index) => row.revision !== MAX_PROCESSING_ATTEMPTS - index
        || row.status !== 'FAILED'
        || !isPdfJsPackagingIncident(row.errorMessage))
      || !latest || latest.id !== input.lastExtractionId || latest.revision !== input.lastExtractionRevision
      || latest.status !== 'FAILED' || !isPdfJsPackagingIncident(latest.errorMessage)) {
      throw new InvalidStateError('Latest extraction does not match the documented PDF.js standalone incident.');
    }
    if (!sameAuthorization({
      submissionId: submission.id,
      submissionVersionSnapshot: processing.submissionVersionSnapshot,
      submissionSha256Snapshot: processing.submissionSha256Snapshot,
      subjectVersionSnapshot: processing.subjectVersionSnapshot,
      extractionIdSnapshot: latest.id,
      extractionRevisionSnapshot: latest.revision,
      attemptCountSnapshot: processing.attemptCount,
      reason: input.reason,
    }, input)) throw new InvalidStateError('Retry request does not match the exact frozen target.');

    const authorized = await tx.diagnosticSubmissionProcessing.update({
      where: { id: processing.id },
      data: {
        retryAuthorizationOperationId: input.operationId,
        retryAuthorizationActorId: ctx.actor.userId,
        retryAuthorizationAt: ctx.now(),
        retryAuthorizationReason: input.reason,
        retryAuthorizationReleaseSha: trustedReleaseSha,
        retrySubmissionIdSnapshot: submission.id,
        retrySubmissionVersionSnapshot: submission.version,
        retrySubmissionSha256Snapshot: submission.sha256,
        retrySubjectVersionSnapshot: submission.assignment.instrumentVersionSnapshot,
        retryExtractionIdSnapshot: latest.id,
        retryExtractionRevisionSnapshot: latest.revision,
        retryExtractionErrorSnapshot: latest.errorMessage,
        retryAttemptCountSnapshot: processing.attemptCount,
      },
    });
    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'diagnostic.submission.processing.retry_authorized',
      subjectType: 'DiagnosticSubmissionProcessing',
      subjectId: processing.id,
      correlationId: ctx.correlationId,
      metadata: {
        submissionId: submission.id,
        operationId: input.operationId,
        reason: input.reason,
        attemptCount: processing.attemptCount,
      },
    });
    return authorized;
  });
}

export const PDFJS_RETRY_AUTHORIZATION_REASON = PDFJS_INCIDENT_REASON;
