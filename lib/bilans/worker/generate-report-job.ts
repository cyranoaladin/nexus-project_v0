import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { resolveEnabledPack, type PackResolver } from '../api/pack-access';
import { advanceAttemptLifecycle, createPendingReport } from '../core/report-service';
import type { FactSheet } from '../facts/fact-sheet';
import { BilanLlmGateway, type BilanLlmTransport } from '../llm/gateway';
import { BilanLlmConfigError, resolveOpenRouterConfig } from '../llm/config';
import { OpenRouterBilanTransport } from '../llm/openrouter-transport';
import { sha256Canonical } from '../local-first/hash';
import { createPseudonymizedFactSheet } from '../local-first/contracts';
import { buildLlmReports } from '../render/llm-report';
import { prepareReportPassationPresentation } from '../render/passation-presentation';
import type { RenderIdentity } from '../render/render-identity';
import { buildDeterministicReports, type DeterministicBilanReportBundle } from '../render/report';
import { buildPreRentreeStageLabel } from '../render/stage-label';
import type { ValidatedPack } from '../validators/contracts';
import { prisma } from '@/lib/prisma';

const payloadSchema = z.object({
  attemptId: z.string().min(1),
  scoreSnapshotId: z.string().min(1),
}).strict();

type WorkerDatabase = Pick<PrismaClient, '$transaction' | 'jobOutbox'>;
type WorkerLogger = Readonly<{
  info(event: Readonly<Record<string, unknown>>): void;
  error(event: Readonly<Record<string, unknown>>): void;
}>;

export type GenerateReportJobDependencies = Readonly<{
  prisma: WorkerDatabase;
  resolvePack: PackResolver;
  buildTransport: () => BilanLlmTransport;
  now: () => Date;
  logger: WorkerLogger;
}>;

export class GenerateReportJobError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'GenerateReportJobError';
  }
}

function defaultBuildTransport(): BilanLlmTransport {
  return new OpenRouterBilanTransport(resolveOpenRouterConfig());
}

const defaultDependencies: GenerateReportJobDependencies = {
  prisma,
  resolvePack: resolveEnabledPack,
  buildTransport: defaultBuildTransport,
  now: () => new Date(),
  logger: {
    info: (event) => console.info(JSON.stringify(event)),
    error: (event) => console.error(JSON.stringify(event)),
  },
};

type GenerateLlmReportResult = Readonly<{
  content: DeterministicBilanReportBundle;
  attempts: number;
}> | Readonly<{
  content: null;
  attempts: number;
  reason: 'GATEWAY_THREW' | 'NO_VALID_BUNDLE';
}>;

/**
 * Pure LLM narration step, deliberately outside any DB transaction: an
 * OpenRouter round trip across 5 agents can take up to a minute, and a report
 * revision must never be written unless this succeeds.
 */
async function generateLlmReportContent(
  factSheet: FactSheet,
  identity: RenderIdentity,
  validatedPack: ValidatedPack,
  transport: BilanLlmTransport,
): Promise<GenerateLlmReportResult> {
  try {
    const gateway = new BilanLlmGateway(transport);
    const result = await gateway.run(createPseudonymizedFactSheet(factSheet), validatedPack);
    if (result.bundle === null) {
      return { content: null, attempts: result.attempts, reason: 'NO_VALID_BUNDLE' };
    }
    return { content: buildLlmReports(factSheet, identity, result.bundle), attempts: result.attempts };
  } catch {
    return { content: null, attempts: 0, reason: 'GATEWAY_THREW' };
  }
}

type ReportContentOutcome = Readonly<{ content: DeterministicBilanReportBundle; mode: 'LLM'; attempts: number }>
  | Readonly<{ content: DeterministicBilanReportBundle; mode: 'DETERMINISTIC_FALLBACK' }>;

/**
 * Narration is authorized only when OpenRouter is actually configured
 * (OPENROUTER_API_KEY set). Its absence is the deliberate PLANCHER
 * operating mode -- not a failure -- so this falls back to the same
 * deterministic renderer the pipeline used before the LLM gateway existed,
 * guaranteeing a submitted attempt is never stranded at SCORED for lack of
 * a narration key. Any OTHER config error (e.g. an unallowlisted model) is
 * a real misconfiguration and must still fail loudly, not be swallowed.
 */
async function resolveReportContent(
  claim: ClaimedJob,
  dependencies: GenerateReportJobDependencies,
): Promise<ReportContentOutcome> {
  let transport: BilanLlmTransport;
  try {
    transport = dependencies.buildTransport();
  } catch (error) {
    if (error instanceof BilanLlmConfigError && error.code === 'OPENROUTER_API_KEY_MISSING') {
      return { content: buildDeterministicReports(claim.factSheet, claim.identity), mode: 'DETERMINISTIC_FALLBACK' };
    }
    throw error;
  }
  // ── FLIP POINT ──────────────────────────────────────────────────────
  // Reaching here means OPENROUTER_API_KEY is configured and the pipeline
  // is about to publish AI-narrated text about a child's diagnostic.
  // review-service.ts currently authorizes ASSISTANTE ALONE to validate
  // and publish (lib/bilans/staff/review-service.ts, assertAssistante) --
  // that model was decided while narration was OFF. The DAY this branch
  // starts running for real, a subject-qualified COACH review must become
  // a prerequisite again before publication: an assistante is an
  // administrative gate, not a check on whether the AI's text about this
  // specific child, in this specific subject, is pedagogically sound.
  // Do not remove this comment when re-enabling COACH in the state machine
  // and review-service.ts -- that wiring has not been rebuilt since the
  // assistante-only cutover. mode:'LLM' is logged on every completed job
  // (A88_GENERATE_REPORT_JOB_COMPLETED) -- alert on it appearing to catch
  // an accidental flip before this gap is closed.
  const generated = await generateLlmReportContent(claim.factSheet, claim.identity, claim.enabled.validatedPack, transport);
  if (generated.content === null) {
    throw new GenerateReportJobError(generated.reason === 'GATEWAY_THREW' ? 'A88_GATEWAY_THREW' : 'A88_NO_VALID_BUNDLE');
  }
  return { content: generated.content, mode: 'LLM', attempts: generated.attempts };
}

type ClaimedJob = Readonly<{
  attemptId: string;
  studentId: string;
  scoreSnapshotId: string;
  factSheet: FactSheet;
  identity: RenderIdentity;
  enabled: NonNullable<ReturnType<PackResolver>>;
}>;

async function claimJob(
  transaction: Prisma.TransactionClient,
  jobId: string,
  dependencies: GenerateReportJobDependencies,
): Promise<Readonly<{ replayed: true; revisionId: string; artifactId: string }> | Readonly<{ replayed: false; claim: ClaimedJob }>> {
  const rows = await transaction.$queryRaw<Array<{
    id: string;
    jobType: string;
    aggregateId: string;
    status: string;
    payload: unknown;
  }>>(Prisma.sql`
    SELECT "id", "jobType", "aggregateId", "status", "payload"
    FROM "canonical_job_outbox"
    WHERE "id" = ${jobId}
    FOR UPDATE
  `);
  const job = rows[0];
  if (job === undefined || job.jobType !== 'GENERATE_REPORT') throw new GenerateReportJobError('A88_JOB_INVALID');

  if (job.status === 'COMPLETED') {
    const snapshot = await transaction.scoreSnapshot.findUnique({ where: { assessmentAttemptId: job.aggregateId } });
    if (snapshot === null) throw new GenerateReportJobError('A88_COMPLETED_JOB_INCONSISTENT');
    const revision = await transaction.reportRevision.findUnique({ where: { scoreSnapshotId: snapshot.id } });
    if (revision === null) throw new GenerateReportJobError('A88_COMPLETED_JOB_INCONSISTENT');
    return { replayed: true, revisionId: revision.id, artifactId: revision.reportArtifactId };
  }
  if (job.status !== 'PENDING' && job.status !== 'LEASED') throw new GenerateReportJobError('A88_JOB_NOT_PROCESSABLE');

  const payload = payloadSchema.parse(job.payload);
  if (payload.attemptId !== job.aggregateId) throw new GenerateReportJobError('A88_JOB_PAYLOAD_MISMATCH');

  const attempt = await transaction.canonicalAssessmentAttempt.findUnique({ where: { id: payload.attemptId } });
  if (attempt === null || attempt.submittedAt === null) throw new GenerateReportJobError('A88_ATTEMPT_NOT_SCORED');
  if (attempt.status === 'REPORT_GENERATION_FAILED') {
    await advanceAttemptLifecycle(transaction, {
      attemptId: attempt.id,
      from: 'REPORT_GENERATION_FAILED',
      action: 'RETRY_REPORT_GENERATION',
      actor: 'WORKER',
    });
  } else if (attempt.status !== 'SCORED') {
    throw new GenerateReportJobError('A88_ATTEMPT_NOT_SCORED');
  }

  const snapshot = await transaction.scoreSnapshot.findUnique({ where: { id: payload.scoreSnapshotId } });
  if (snapshot === null || snapshot.assessmentAttemptId !== attempt.id) throw new GenerateReportJobError('A88_SNAPSHOT_MISMATCH');

  const enabled = dependencies.resolvePack(attempt.assessmentPackId, Number(attempt.assessmentPackVersion));
  if (enabled === null || attempt.assessmentPackChecksum !== enabled.checksum) throw new GenerateReportJobError('A88_PACK_UNAVAILABLE');

  await transaction.jobOutbox.update({
    where: { id: job.id },
    data: {
      status: 'LEASED',
      leaseOwner: 'a88-llm-report-worker',
      leaseExpiresAt: new Date(dependencies.now().getTime() + 5 * 60_000),
    },
  });

  const rawFactSheet = snapshot.result as unknown as FactSheet;
  const presentation = prepareReportPassationPresentation(rawFactSheet, attempt.provenance);
  const identity: RenderIdentity = Object.freeze({
    displayName: rawFactSheet.student.alias,
    level: enabled.pack.level,
    subject: enabled.pack.subject,
    date: attempt.submittedAt.toISOString().slice(0, 10),
    stageLabel: buildPreRentreeStageLabel(enabled.pack.level, enabled.pack.subject),
    ...(presentation.durationMeasurement === undefined
      ? {}
      : { durationMeasurement: presentation.durationMeasurement }),
  });

  return {
    replayed: false,
    claim: {
      attemptId: attempt.id,
      studentId: attempt.studentId,
      scoreSnapshotId: snapshot.id,
      factSheet: presentation.factSheet,
      identity,
      enabled,
    },
  };
}

/**
 * Generates the LLM-narrated report for a SCORED attempt and hands it off to
 * the ASSISTANTE review queue. Never persists partial or invented content:
 * on any failure the attempt moves to REPORT_GENERATION_FAILED and the job
 * to FAILED, to be retried automatically on the next drain cycle -- no
 * ReportRevision is ever created for a failed generation.
 */
export async function processGenerateReportJob(
  jobId: string,
  dependencies: GenerateReportJobDependencies = defaultDependencies,
) {
  const started = Date.now();
  try {
    const claimed = await dependencies.prisma.$transaction((transaction) => claimJob(transaction, jobId, dependencies));
    if (claimed.replayed) {
      dependencies.logger.info({ event: 'A88_GENERATE_REPORT_JOB_COMPLETED', jobId, replayed: true, durationMs: Date.now() - started });
      return { jobId, revisionId: claimed.revisionId, artifactId: claimed.artifactId, replayed: true };
    }

    const { claim } = claimed;
    const outcome = await resolveReportContent(claim, dependencies);

    const result = await dependencies.prisma.$transaction(async (transaction) => {
      const pending = await createPendingReport(transaction, {
        attemptId: claim.attemptId,
        studentId: claim.studentId,
        scoreSnapshotId: claim.scoreSnapshotId,
        reportPackId: claim.enabled.pack.slug,
        reportPackVersion: String(claim.enabled.pack.version),
        contextChecksum: sha256Canonical(outcome.content),
        content: outcome.content as unknown as Prisma.InputJsonValue,
        validationFailures: [],
      });
      await transaction.jobOutbox.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          attemptCount: { increment: 1 },
          completedAt: dependencies.now(),
          leaseOwner: null,
          leaseExpiresAt: null,
          lastError: null,
        },
      });
      return { jobId, revisionId: pending.revision.id, artifactId: pending.artifact.id, replayed: false };
    });

    dependencies.logger.info({
      event: 'A88_GENERATE_REPORT_JOB_COMPLETED',
      jobId,
      replayed: false,
      mode: outcome.mode,
      attempts: outcome.mode === 'LLM' ? outcome.attempts : 0,
      durationMs: Date.now() - started,
    });
    return result;
  } catch (error) {
    const code = error instanceof GenerateReportJobError ? error.code : 'A88_WORKER_FAILED';
    await dependencies.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<Array<{ aggregateId: string; status: string }>>(Prisma.sql`
        SELECT "aggregateId", "status" FROM "canonical_job_outbox" WHERE "id" = ${jobId} FOR UPDATE
      `);
      const job = rows[0];
      if (job !== undefined && job.status !== 'COMPLETED') {
        const attempt = await transaction.canonicalAssessmentAttempt.findUnique({ where: { id: job.aggregateId } });
        if (attempt?.status === 'SCORED') {
          await advanceAttemptLifecycle(transaction, {
            attemptId: job.aggregateId,
            from: 'SCORED',
            action: 'MARK_REPORT_GENERATION_FAILED',
            actor: 'WORKER',
          });
        }
        await transaction.jobOutbox.update({
          where: { id: jobId },
          data: {
            status: 'FAILED',
            attemptCount: { increment: 1 },
            lastError: code,
            leaseOwner: null,
            leaseExpiresAt: null,
          },
        });
      }
    });
    dependencies.logger.error({ event: 'A88_GENERATE_REPORT_JOB_FAILED', jobId, code, durationMs: Date.now() - started });
    throw new GenerateReportJobError(code);
  }
}
