/**
 * Diagnostics candidats libres — C2, first increment (mission §9, hardened
 * per mission §5): bounded, resumable text extraction of a deposited
 * submission. No deterministic correction, no AI, no publication here —
 * those stay unbuilt until the AI budget/provider prerequisite is
 * confirmed by the owner (see docs/core-v2/candidat-libre-diagnostics-c2-plan.md).
 * This file is additive-only with respect to C1: it reads
 * DiagnosticSubmission but never mutates it, and never reads a
 * REJECTED/quarantined copy.
 *
 * Enqueue/drain split (mission §5): the staff-facing route only registers
 * or finds the job and hands back control — it never runs the extraction
 * inline and pretends 202 means "already done". The actual work happens
 * in drainDiagnosticSubmissionProcessingQueue, the same lease-based claim
 * pattern already proven by lib/bilans/worker/drain-outbox.ts
 * (FOR UPDATE SKIP LOCKED, a lease that expires rather than a status that
 * can get stuck forever, an attempt cap so a deterministically-broken
 * submission stops being retried instead of looping). EXTRACTING is a
 * LEASED state, not a terminal one: a worker that dies mid-extraction
 * (process crash, not just an in-process exception) simply leaves an
 * expired lease, reclaimable by the next drain cycle with no separate
 * crash-detection needed.
 */
import type {
  DiagnosticSubmissionExtraction,
  DiagnosticSubmissionProcessing,
  PrismaClient,
} from '@/core-v2/generated/client';
import { Prisma } from '../client';
import { appendAuditEvent } from '../audit';
import { extractSubmissionTextBounded } from '../diagnostics/text-extraction';
import { readDiagnosticStorageFile } from '../diagnostics/storage';
import { ConflictError, InvalidStateError, NotFoundError } from '../errors';
import { assertCapability } from '../rbac';
import type { ServiceContext, Tx } from './context';
import { inTransaction } from './context';
import { idSchema, parseInput } from './validation';
import { createHash, randomUUID } from 'node:crypto';

const LEASE_DURATION_MS = 90_000; // generous vs. the 20s bounded extraction + storage read overhead.
const MAX_PROCESSING_ATTEMPTS = 5; // a deterministically broken submission (corrupt/missing file) stops being reclaimed, it never loops forever.

async function loadSubmissionForProcessing(tx: Tx, submissionId: string) {
  const submission = await tx.diagnosticSubmission.findUnique({
    where: { id: submissionId },
    include: { assignment: true },
  });
  if (!submission) throw new NotFoundError('Submission not found.', { submissionId });
  return submission;
}

/**
 * Staff-facing entry point: registers the job if it does not exist yet,
 * or hands back the existing row unchanged — it never runs extraction
 * itself. A submission already EXTRACTING or already terminal
 * (EXTRACTED/NO_EXTRACTABLE_TEXT) is refused outright: the caller sees
 * "already in progress" / "already processed", never a silent duplicate
 * enqueue. EXTRACTION_FAILED is the one non-terminal state a caller may
 * re-enqueue from — the drain queue treats it exactly like QUEUED.
 */
export async function enqueueDiagnosticSubmissionProcessing(
  client: PrismaClient,
  ctx: ServiceContext,
  rawSubmissionId: string,
): Promise<DiagnosticSubmissionProcessing> {
  assertCapability(ctx.actor, 'DIAGNOSTIC_SUBMISSION_TRACK');
  const submissionId = parseInput(idSchema, rawSubmissionId);

  return inTransaction(client, async (tx) => {
    const existing = await tx.diagnosticSubmissionProcessing.findUnique({ where: { submissionId } });
    if (existing) {
      if (existing.status === 'QUEUED' || existing.status === 'EXTRACTION_FAILED') return existing;
      throw new ConflictError('This submission is already processing or has already been processed.', {
        submissionId,
        status: existing.status,
      });
    }

    const submission = await loadSubmissionForProcessing(tx, submissionId);
    if (submission.status === 'REJECTED') {
      throw new InvalidStateError('A rejected/quarantined submission is never processed.', { submissionId });
    }

    const processing = await tx.diagnosticSubmissionProcessing.create({
      data: {
        submissionId: submission.id,
        submissionSha256Snapshot: submission.sha256,
        submissionVersionSnapshot: submission.version,
        subjectVersionSnapshot: submission.assignment.instrumentVersionSnapshot,
      },
    });
    await appendAuditEvent(tx, {
      actorUserId: ctx.actor.userId,
      action: 'diagnostic.submission.processing.enqueued',
      subjectType: 'DiagnosticSubmissionProcessing',
      subjectId: processing.id,
      correlationId: ctx.correlationId,
      metadata: { submissionId },
    });
    return processing;
  });
}

/**
 * Claims up to `limit` jobs for `owner`: QUEUED or EXTRACTION_FAILED rows
 * (below the attempt cap), plus any EXTRACTING row whose lease has
 * expired — FOR UPDATE SKIP LOCKED so concurrent drain cycles (or a
 * scaled-out worker) never claim the same row twice. Never called with
 * an actor/RBAC context: this is the trusted worker boundary, not a
 * staff HTTP action.
 */
async function claimDiagnosticProcessingJobs(
  client: PrismaClient,
  input: { limit: number; owner: string; now: Date; leaseExpiresAt: Date },
): Promise<readonly string[]> {
  return client.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "diagnostic_submission_processings"
      WHERE "attemptCount" < ${MAX_PROCESSING_ATTEMPTS}
        AND (
          "status" IN ('QUEUED', 'EXTRACTION_FAILED')
          OR ("status" = 'EXTRACTING' AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" <= ${input.now}))
        )
      ORDER BY "updatedAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${input.limit}
    `);
    for (const row of rows) {
      await tx.diagnosticSubmissionProcessing.update({
        where: { id: row.id },
        data: { status: 'EXTRACTING', leaseOwner: input.owner, leaseExpiresAt: input.leaseExpiresAt, attemptCount: { increment: 1 } },
      });
    }
    return Object.freeze(rows.map(({ id }) => id));
  });
}

/**
 * Runs one already-claimed job. The file read and bounded extraction
 * happen OUTSIDE any open transaction — never hold a DB transaction for
 * the duration of a PDF extraction. ANY exception here (missing file,
 * permission denied, a read interrupted partway) is caught and recorded
 * as an explicit FAILED extraction — the job never gets stuck EXTRACTING
 * because of an in-process exception; only a process crash (no exception
 * at all) leaves that to the lease's own expiry.
 *
 * The final write is conditional on still holding the lease
 * (`leaseOwner` must match, re-confirmed inside the same transaction that
 * writes the result): if another drain cycle already reclaimed this job
 * (this one was merely slow, not dead) and has already recorded its own
 * result, this attempt's result is discarded entirely — no extraction
 * row, no status change. A late, no-longer-authoritative result can
 * never overwrite (or ambiguously coexist with) the current one.
 *
 * Exported (not just used internally by the drain) so the resumption/
 * lease-race behavior can be exercised directly by tests without racing
 * real wall-clock timers.
 */
export async function runOneDiagnosticProcessingJob(client: PrismaClient, processingId: string, leaseOwner: string): Promise<void> {
  const processing = await client.diagnosticSubmissionProcessing.findUniqueOrThrow({ where: { id: processingId } });
  const submission = await client.diagnosticSubmission.findUniqueOrThrow({ where: { id: processing.submissionId } });

  const startedAt = Date.now();
  let result: Awaited<ReturnType<typeof extractSubmissionTextBounded>> | { status: 'FAILED'; errorMessage: string };
  if (submission.status === 'REJECTED') {
    // Re-checked here (mission §5): a submission could only have become
    // REJECTED before this job was ever claimable in the first place
    // (enqueue already refuses a REJECTED submission), but a resumed job
    // must never trust a snapshot taken at enqueue time for something
    // this consequential — re-read the live row.
    result = { status: 'FAILED', errorMessage: 'SUBMISSION_REJECTED_SINCE_ENQUEUE' };
  } else {
    try {
      const document = await readDiagnosticStorageFile(submission.storageKey);
      let bytes: Buffer;
      try {
        bytes = await document.handle.readFile();
      } finally {
        await document.handle.close();
      }
      const actualSha256 = createHash('sha256').update(bytes).digest('hex');
      result =
        actualSha256 !== processing.submissionSha256Snapshot
          ? { status: 'FAILED', errorMessage: 'SUBMISSION_INTEGRITY_MISMATCH' }
          : await extractSubmissionTextBounded(bytes);
    } catch (error) {
      result = { status: 'FAILED', errorMessage: error instanceof Error ? error.message.slice(0, 300) : 'UNKNOWN_ERROR' };
    }
  }
  const durationMs = Date.now() - startedAt;

  await inTransaction(client, async (tx) => {
    // Confirm the lease is still ours BEFORE writing anything. This update
    // is a no-op re-assignment (same leaseOwner value) — its only purpose
    // is the row lock it takes and the count it reports: if a later drain
    // cycle already reclaimed this job (this attempt was merely slow, not
    // dead), the row's leaseOwner no longer matches and updateMany's
    // count is 0. That later attempt's own transaction takes the same
    // lock, so the two can never both believe they still hold it.
    const stillOwned = await tx.diagnosticSubmissionProcessing.updateMany({
      where: { id: processingId, leaseOwner },
      data: { leaseOwner },
    });
    if (stillOwned.count === 0) return; // reclaimed by a later attempt; this result is discarded entirely, never written.

    const lastRevision = await tx.diagnosticSubmissionExtraction.aggregate({
      where: { processingId },
      _max: { revision: true },
    });
    const revision = (lastRevision._max.revision ?? 0) + 1;
    await tx.diagnosticSubmissionExtraction.create({
      data: {
        processingId,
        revision,
        status: result.status,
        extractedText: result.status === 'SUCCEEDED' ? result.text : null,
        characterCount: result.status === 'SUCCEEDED' ? result.characterCount : null,
        truncated: result.status === 'SUCCEEDED' ? result.truncated : false,
        totalCharacterCount: result.status === 'SUCCEEDED' ? result.totalCharacterCount : null,
        durationMs,
        errorMessage: result.status === 'FAILED' ? result.errorMessage : null,
      },
    });

    const finalStatus = result.status === 'SUCCEEDED' ? 'EXTRACTED' : result.status === 'EMPTY' ? 'NO_EXTRACTABLE_TEXT' : 'EXTRACTION_FAILED';
    await tx.diagnosticSubmissionProcessing.update({
      where: { id: processingId },
      data: { status: finalStatus, leaseOwner: null, leaseExpiresAt: null },
    });

    await appendAuditEvent(tx, {
      actorUserId: null,
      action: 'diagnostic.submission.extraction.completed',
      subjectType: 'DiagnosticSubmissionProcessing',
      subjectId: processingId,
      correlationId: randomUUID(),
      metadata: { submissionId: submission.id, revision, status: result.status, durationMs },
    });
  });
}

export interface DiagnosticProcessingDrainMetrics {
  readonly claimed: number;
  readonly succeeded: number;
  readonly failed: number;
}

/**
 * The actual consumer (mission §5: "le consommateur doit être réellement
 * actif et supervisé"). Called on a schedule by
 * lib/core-v2/diagnostics/processing-scheduler.ts — never from a staff
 * HTTP route. Processes claimed jobs sequentially (bounded concurrency of
 * 1 is deliberate for this first increment; the queue is small and each
 * job is itself time-bounded).
 */
export async function drainDiagnosticSubmissionProcessingQueue(
  client: PrismaClient,
  options: { limit?: number; owner?: string } = {},
): Promise<DiagnosticProcessingDrainMetrics> {
  const limit = options.limit ?? 10;
  const owner = options.owner ?? randomUUID();
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + LEASE_DURATION_MS);

  const claimedIds = await claimDiagnosticProcessingJobs(client, { limit, owner, now, leaseExpiresAt });
  let succeeded = 0;
  let failed = 0;
  for (const id of claimedIds) {
    try {
      await runOneDiagnosticProcessingJob(client, id, owner);
      succeeded += 1;
    } catch {
      failed += 1;
    }
  }
  return { claimed: claimedIds.length, succeeded, failed };
}

export type DiagnosticSubmissionExtractionLogisticsView = Omit<DiagnosticSubmissionExtraction, 'extractedText'>;

/**
 * Strips the academic content itself from an extraction row, keeping only
 * logistics fields (status, revision, timing, error code). Triggering or
 * tracking a processing run only ever needs DIAGNOSTIC_SUBMISSION_TRACK
 * (ASSISTANTE has it); the right to trigger/track a run is not the right
 * to read what it produced — that stays behind
 * getLatestDiagnosticSubmissionExtraction's own DIAGNOSTIC_SUBMISSION_CONTENT_READ
 * check, on its own dedicated route, never incidentally returned by this
 * one. A caller that needs the text calls that route separately.
 */
export function toExtractionLogisticsView(extraction: DiagnosticSubmissionExtraction): DiagnosticSubmissionExtractionLogisticsView {
  const { extractedText, ...logistics } = extraction;
  void extractedText;
  return logistics;
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
