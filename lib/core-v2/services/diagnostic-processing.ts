/**
 * Diagnostics candidats libres — C2, first increment (mission §9): bounded
 * text extraction of a deposited submission. No deterministic correction,
 * no AI, no publication here — those stay unbuilt until the AI budget/
 * provider prerequisite is confirmed by the owner (see
 * docs/core-v2/candidat-libre-diagnostics-c2-plan.md). This file is
 * additive-only with respect to C1: it reads DiagnosticSubmission but
 * never mutates it, and never reads a REJECTED/quarantined copy.
 */
import type {
  DiagnosticSubmissionExtraction,
  DiagnosticSubmissionProcessing,
  PrismaClient,
} from '@/core-v2/generated/client';
import { appendAuditEvent } from '../audit';
import { extractSubmissionTextBounded } from '../diagnostics/text-extraction';
import { readDiagnosticStorageFile } from '../diagnostics/storage';
import { ConflictError, InvalidStateError, NotFoundError } from '../errors';
import { assertCapability } from '../rbac';
import type { ServiceContext, Tx } from './context';
import { inTransaction } from './context';
import { idSchema, parseInput } from './validation';
import { createHash } from 'node:crypto';

async function loadSubmissionForProcessing(tx: Tx, submissionId: string) {
  const submission = await tx.diagnosticSubmission.findUnique({
    where: { id: submissionId },
    include: { assignment: true },
  });
  if (!submission) throw new NotFoundError('Submission not found.', { submissionId });
  return submission;
}

/**
 * Creates (or returns, unchanged) the ONE processing row for this
 * submission. A submission's frozen references never change after this —
 * a later catalog/assignment change cannot silently retarget a processing
 * already enqueued for it.
 */
async function ensureProcessingRow(tx: Tx, submissionId: string): Promise<DiagnosticSubmissionProcessing> {
  const existing = await tx.diagnosticSubmissionProcessing.findUnique({ where: { submissionId } });
  if (existing) return existing;

  const submission = await loadSubmissionForProcessing(tx, submissionId);
  if (submission.status === 'REJECTED') {
    throw new InvalidStateError('A rejected/quarantined submission is never processed.', { submissionId });
  }

  return tx.diagnosticSubmissionProcessing.create({
    data: {
      submissionId: submission.id,
      submissionSha256Snapshot: submission.sha256,
      submissionVersionSnapshot: submission.version,
      subjectVersionSnapshot: submission.assignment.instrumentVersionSnapshot,
    },
  });
}

/**
 * Runs (or retries) bounded text extraction for one submission. Idempotent
 * in the sense that matters: a caller that arrives while another run is
 * already EXTRACTING gets a typed CONFLICT, never a second concurrent run
 * and never a duplicated row (mission §9: "reprise contrôlée sans
 * duplication"). A retry after EXTRACTION_FAILED creates a NEW extraction
 * revision; it never overwrites the failed one.
 */
export async function processDiagnosticSubmission(
  client: PrismaClient,
  ctx: ServiceContext,
  rawSubmissionId: string,
): Promise<{ processing: DiagnosticSubmissionProcessing; extraction: DiagnosticSubmissionExtraction }> {
  assertCapability(ctx.actor, 'DIAGNOSTIC_SUBMISSION_TRACK');
  const submissionId = parseInput(idSchema, rawSubmissionId);

  const claimed = await inTransaction(client, async (tx) => {
    const processing = await ensureProcessingRow(tx, submissionId);
    if (processing.status !== 'QUEUED' && processing.status !== 'EXTRACTION_FAILED') {
      throw new ConflictError('This submission is already processing or has already been processed.', {
        submissionId,
        status: processing.status,
      });
    }
    const claim = await tx.diagnosticSubmissionProcessing.updateMany({
      where: { id: processing.id, status: processing.status },
      data: { status: 'EXTRACTING' },
    });
    if (claim.count === 0) {
      throw new ConflictError('Another run just claimed this submission for processing.', { submissionId });
    }
    return processing;
  });

  const startedAt = Date.now();
  const submission = await client.diagnosticSubmission.findUniqueOrThrow({ where: { id: submissionId } });

  const document = await readDiagnosticStorageFile(submission.storageKey);
  let bytes: Buffer;
  try {
    bytes = await document.handle.readFile();
  } finally {
    await document.handle.close();
  }

  const actualSha256 = createHash('sha256').update(bytes).digest('hex');
  const result =
    actualSha256 !== claimed.submissionSha256Snapshot
      ? ({ status: 'FAILED', errorMessage: 'SUBMISSION_INTEGRITY_MISMATCH' } as const)
      : await extractSubmissionTextBounded(bytes);
  const durationMs = Date.now() - startedAt;

  return inTransaction(client, async (tx) => {
    const lastRevision = await tx.diagnosticSubmissionExtraction.aggregate({
      where: { processingId: claimed.id },
      _max: { revision: true },
    });
    const revision = (lastRevision._max.revision ?? 0) + 1;

    const extraction = await tx.diagnosticSubmissionExtraction.create({
      data: {
        processingId: claimed.id,
        revision,
        status: result.status,
        extractedText: result.status === 'SUCCEEDED' ? result.text : null,
        characterCount: result.status === 'SUCCEEDED' ? result.characterCount : null,
        durationMs,
        errorMessage: result.status === 'FAILED' ? result.errorMessage : null,
      },
    });

    const finalStatus = result.status === 'SUCCEEDED' ? 'EXTRACTED' : result.status === 'EMPTY' ? 'NO_EXTRACTABLE_TEXT' : 'EXTRACTION_FAILED';
    const processing = await tx.diagnosticSubmissionProcessing.update({
      where: { id: claimed.id },
      data: { status: finalStatus },
    });

    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'diagnostic.submission.extraction.completed',
      subjectType: 'DiagnosticSubmissionProcessing',
      subjectId: processing.id,
      correlationId: ctx.correlationId,
      metadata: { submissionId, revision, status: result.status, durationMs },
    });

    return { processing, extraction };
  });
}

/** Staff logistics view: status/revision count only — never the extracted text (see content-read below). */
export async function getDiagnosticSubmissionProcessingStatus(
  client: PrismaClient,
  ctx: ServiceContext,
  rawSubmissionId: string,
): Promise<(DiagnosticSubmissionProcessing & { extractionCount: number }) | null> {
  assertCapability(ctx.actor, 'DIAGNOSTIC_SUBMISSION_TRACK');
  const submissionId = parseInput(idSchema, rawSubmissionId);
  const processing = await client.diagnosticSubmissionProcessing.findUnique({
    where: { submissionId },
    include: { _count: { select: { extractions: true } } },
  });
  if (!processing) return null;
  const { _count, ...rest } = processing;
  return { ...rest, extractionCount: _count.extractions };
}

/** Academic content (mission constraint: reserved to ADMIN, never ASSISTANTE — same split as DIAGNOSTIC_SUBMISSION_CONTENT_READ in C1). */
export async function getLatestDiagnosticSubmissionExtraction(
  client: PrismaClient,
  ctx: ServiceContext,
  rawSubmissionId: string,
): Promise<DiagnosticSubmissionExtraction | null> {
  assertCapability(ctx.actor, 'DIAGNOSTIC_SUBMISSION_CONTENT_READ');
  const submissionId = parseInput(idSchema, rawSubmissionId);
  const processing = await client.diagnosticSubmissionProcessing.findUnique({ where: { submissionId } });
  if (!processing) return null;
  return client.diagnosticSubmissionExtraction.findFirst({
    where: { processingId: processing.id },
    orderBy: { revision: 'desc' },
  });
}
