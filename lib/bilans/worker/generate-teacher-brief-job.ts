import { Prisma, type PrismaClient, type Subject, type GradeLevel } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';

import { resolveEnabledPack, type PackResolver } from '../api/pack-access';
import type { FactSheet } from '../facts/fact-sheet';
import {
  assertBriefRespectsFacts,
  buildStudentFactsPayload,
  callTeacherBriefDomain,
  estimateCostUsd,
  resolveTeacherBriefConfig,
  TeacherBriefError,
  type TeacherBriefConfig,
  type TeacherBriefFactsPayload,
} from '../llm/teacher-brief-service';
import { teacherBriefSchema, TEACHER_BRIEF_PROMPT_VERSION } from '../llm/teacher-brief-schema';
import { reserveBudget, regularizeBudget, releaseBudget } from '../llm/teacher-brief-budget';
import { BRIEF_STATUSES_BLOCKING_DUPLICATE_GENERATION } from '../staff/teacher-brief-status';

/**
 * Traitement asynchrone d'UNE tentative de génération de brief enseignant
 * (§7/§8/§10/§11 de l'incident P0). Mêmes principes que
 * `generate-report-job.ts` : claim verrouillé, aucune écriture partielle,
 * classification explicite du résultat, jamais de retry aveugle.
 *
 * Codes RETRYABLE (réseau, HTTP 5xx/429, JSON invalide, schéma invalide,
 * sortie tronquée) => le job est marqué FAILED et repris par le cycle de
 * drain existant (bornage MAX_JOB_ATTEMPTS, quarantaine, alerte — voir
 * drain-outbox.ts). Tout le reste (BUDGET_BLOCKED, STALE_INPUT,
 * DETERMINISTIC_ONLY, BLOCKED_FAILURE) est un état TERMINAL pour CETTE
 * tentative : le job est marqué COMPLETED et ne sera jamais retenté
 * automatiquement — un nouveau clic assistante crée un nouveau job.
 */

const RETRYABLE_CODES: ReadonlySet<string> = new Set([
  'TEACHER_BRIEF_TIMEOUT',
  'TEACHER_BRIEF_NETWORK',
  'TEACHER_BRIEF_EMPTY',
  'TEACHER_BRIEF_TRUNCATED',
  'TEACHER_BRIEF_INVALID_JSON',
  'TEACHER_BRIEF_SCHEMA_REJECTED',
  'TEACHER_BRIEF_ASSEMBLY_REJECTED',
  'TEACHER_BRIEF_DOMAIN_MISMATCH',
]);
// Tout code non listé ici (PII_BOUNDARY, FORBIDDEN_TERM, UNGROUNDED_ERROR,
// PACK_UNAVAILABLE, config invalide, etc.) est BLOCKED_FAILURE par défaut —
// jamais de retry automatique pour un garde de sécurité ou d'ancrage.
function isHttpStatusRetryable(code: string): boolean {
  const match = /^TEACHER_BRIEF_HTTP_(\d{3})$/.exec(code);
  if (match === null) return false;
  const status = Number(match[1]);
  return status === 429 || status >= 500;
}

function classifyFailure(code: string): 'RETRYABLE_FAILURE' | 'BLOCKED_FAILURE' {
  if (RETRYABLE_CODES.has(code) || isHttpStatusRetryable(code)) return 'RETRYABLE_FAILURE';
  return 'BLOCKED_FAILURE';
}

const payloadSchema = z.object({
  reportArtifactId: z.string().min(1),
  expectedScoreSnapshotId: z.string().min(1),
  actorId: z.string().min(1),
}).strict();

type WorkerDatabase = Pick<PrismaClient, '$transaction' | 'jobOutbox' | 'reportArtifact' | 'teacherBrief' | 'teacherBriefAttempt'>;
type WorkerLogger = Readonly<{ info(event: Readonly<Record<string, unknown>>): void; error(event: Readonly<Record<string, unknown>>): void }>;

export type GenerateTeacherBriefJobDependencies = Readonly<{
  prisma: WorkerDatabase;
  resolvePack: PackResolver;
  resolveConfig: (environment?: Readonly<Record<string, string | undefined>>) => TeacherBriefConfig;
  fetchImpl: typeof fetch;
  now: () => Date;
  logger: WorkerLogger;
  reserveBudget: typeof reserveBudget;
  regularizeBudget: typeof regularizeBudget;
  releaseBudget: typeof releaseBudget;
}>;

export class GenerateTeacherBriefJobError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'GenerateTeacherBriefJobError';
  }
}

const defaultDependencies: GenerateTeacherBriefJobDependencies = {
  prisma,
  resolvePack: resolveEnabledPack,
  resolveConfig: resolveTeacherBriefConfig,
  fetchImpl: fetch,
  now: () => new Date(),
  logger: {
    info: (event) => console.info(JSON.stringify(event)),
    error: (event) => console.error(JSON.stringify(event)),
  },
  reserveBudget,
  regularizeBudget,
  releaseBudget,
};

type Claim = Readonly<{
  reportArtifactId: string;
  subject: Subject;
  gradeLevel: GradeLevel;
  actorId: string;
  currentScoreSnapshotId: string;
  factSheet: FactSheet;
  answers: unknown;
  assessmentPackId: string;
  assessmentPackVersion: number;
  assessmentPackChecksum: string;
  subjectLabel: string;
}>;

type ClaimOutcome =
  | Readonly<{ kind: 'REPLAYED' }>
  | Readonly<{ kind: 'ALREADY_PRESENT' }>
  | Readonly<{ kind: 'STALE_INPUT' }>
  | Readonly<{ kind: 'PROCEED'; claim: Claim }>;

async function claimJob(
  transaction: Prisma.TransactionClient,
  jobId: string,
  dependencies: GenerateTeacherBriefJobDependencies,
): Promise<ClaimOutcome> {
  const rows = await transaction.$queryRaw<Array<{
    id: string; jobType: string; aggregateId: string; status: string; payload: unknown;
  }>>(Prisma.sql`
    SELECT "id", "jobType", "aggregateId", "status", "payload" FROM "canonical_job_outbox" WHERE "id" = ${jobId} FOR UPDATE
  `);
  const job = rows[0];
  if (job === undefined || job.jobType !== 'GENERATE_TEACHER_BRIEF') throw new GenerateTeacherBriefJobError('TB_JOB_INVALID');
  if (job.status === 'COMPLETED') return { kind: 'REPLAYED' };
  if (job.status !== 'PENDING' && job.status !== 'LEASED') throw new GenerateTeacherBriefJobError('TB_JOB_NOT_PROCESSABLE');

  const payload = payloadSchema.parse(job.payload);
  if (payload.reportArtifactId !== job.aggregateId) throw new GenerateTeacherBriefJobError('TB_JOB_PAYLOAD_MISMATCH');

  const artifact = await transaction.reportArtifact.findUnique({
    where: { id: payload.reportArtifactId },
    select: {
      id: true,
      assessmentAttempt: {
        select: {
          subject: true, gradeLevel: true, answers: true,
          assessmentPackId: true, assessmentPackVersion: true, assessmentPackChecksum: true,
        },
      },
      revisions: {
        orderBy: { createdAt: 'desc' as const }, take: 1,
        select: { scoreSnapshotId: true, content: true, scoreSnapshot: { select: { result: true } } },
      },
      teacherBriefs: {
        where: { status: { in: [...BRIEF_STATUSES_BLOCKING_DUPLICATE_GENERATION] } },
        take: 1, select: { id: true },
      },
    },
  });
  if (artifact === null || artifact.revisions.length === 0) throw new GenerateTeacherBriefJobError('TB_ARTIFACT_NOT_FOUND');

  await transaction.jobOutbox.update({
    where: { id: job.id },
    data: { status: 'LEASED', leaseOwner: 'a90-teacher-brief-worker', leaseExpiresAt: new Date(dependencies.now().getTime() + 5 * 60_000) },
  });

  if (artifact.teacherBriefs.length > 0) return { kind: 'ALREADY_PRESENT' };

  const revision = artifact.revisions[0];
  if (revision.scoreSnapshotId !== payload.expectedScoreSnapshotId) return { kind: 'STALE_INPUT' };

  return {
    kind: 'PROCEED',
    claim: {
      reportArtifactId: artifact.id,
      subject: artifact.assessmentAttempt.subject,
      gradeLevel: artifact.assessmentAttempt.gradeLevel,
      actorId: payload.actorId,
      currentScoreSnapshotId: revision.scoreSnapshotId,
      factSheet: revision.scoreSnapshot.result as unknown as FactSheet,
      answers: artifact.assessmentAttempt.answers,
      assessmentPackId: artifact.assessmentAttempt.assessmentPackId,
      assessmentPackVersion: Number(artifact.assessmentAttempt.assessmentPackVersion),
      assessmentPackChecksum: artifact.assessmentAttempt.assessmentPackChecksum,
      subjectLabel: artifact.assessmentAttempt.subject,
    },
  };
}

type DomainOutcomeLog = Readonly<{
  domainId: string;
  outcome: 'OK' | string;
  promptTokens: number;
  cachedPromptTokens: number;
  completionTokens: number;
  costUsd: number | null;
}>;

async function persistAttempt(
  database: Pick<PrismaClient, 'teacherBriefAttempt'>,
  input: Readonly<{
    reportArtifactId: string; expectedScoreSnapshotId: string; jobId: string;
    subject: Subject; gradeLevel: GradeLevel; actorId: string; model: string; promptVersion: string;
    startedAt: Date; finishedAt: Date;
    result: 'GENERATED' | 'ALREADY_PRESENT' | 'DETERMINISTIC_ONLY' | 'RETRYABLE_FAILURE' | 'BLOCKED_FAILURE' | 'BUDGET_BLOCKED' | 'STALE_INPUT' | 'CANCELLED_BEFORE_START';
    causeCode: string | null; retryCount: number;
    promptTokens: number; cachedPromptTokens: number; completionTokens: number;
    estimatedCostUsd: number | null; costUnknown: boolean;
    domainsRequested: number; domainsProcessed: number; domainOutcomes: readonly DomainOutcomeLog[];
  }>,
): Promise<void> {
  await database.teacherBriefAttempt.create({
    data: {
      reportArtifactId: input.reportArtifactId,
      expectedScoreSnapshotId: input.expectedScoreSnapshotId,
      jobId: input.jobId,
      subject: input.subject,
      gradeLevel: input.gradeLevel,
      actorId: input.actorId,
      model: input.model,
      promptVersion: input.promptVersion,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      result: input.result,
      causeCode: input.causeCode,
      retryCount: input.retryCount,
      promptTokens: input.promptTokens,
      cachedPromptTokens: input.cachedPromptTokens,
      completionTokens: input.completionTokens,
      estimatedCostUsd: input.estimatedCostUsd,
      costUnknown: input.costUnknown,
      durationMs: input.finishedAt.getTime() - input.startedAt.getTime(),
      domainsRequested: input.domainsRequested,
      domainsProcessed: input.domainsProcessed,
      domainOutcomes: input.domainOutcomes as unknown as Prisma.InputJsonValue,
    },
  });
}

async function markJobTerminal(database: Pick<PrismaClient, 'jobOutbox'>, jobId: string, now: Date): Promise<void> {
  await database.jobOutbox.update({
    where: { id: jobId },
    data: { status: 'COMPLETED', attemptCount: { increment: 1 }, completedAt: now, leaseOwner: null, leaseExpiresAt: null, lastError: null },
  });
}

export async function processGenerateTeacherBriefJob(
  jobId: string,
  dependencies: GenerateTeacherBriefJobDependencies = defaultDependencies,
): Promise<Readonly<{ jobId: string; result: string }>> {
  const startedAt = dependencies.now();
  const claimed = await dependencies.prisma.$transaction((transaction) => claimJob(transaction, jobId, dependencies));

  if (claimed.kind === 'REPLAYED') return { jobId, result: 'ALREADY_PRESENT' };

  if (claimed.kind === 'ALREADY_PRESENT' || claimed.kind === 'STALE_INPUT') {
    // Pas d'appel LLM : rien à réserver, rien à comptabiliser. Terminal pour
    // CE job — jamais de retry automatique (un nouveau job sera créé si
    // pertinent au prochain scan de groupe).
    const finishedAt = dependencies.now();
    await dependencies.prisma.$transaction(async (transaction) => {
      // reportArtifactId nécessaire pour journaliser ; relu hors verrou (lecture seule, non sensible).
      const jobRow = await transaction.jobOutbox.findUniqueOrThrow({ where: { id: jobId }, select: { aggregateId: true, payload: true } });
      const payload = payloadSchema.parse(jobRow.payload);
      const artifact = await transaction.reportArtifact.findUniqueOrThrow({
        where: { id: jobRow.aggregateId }, select: { assessmentAttempt: { select: { subject: true, gradeLevel: true } } },
      });
      await persistAttempt(transaction, {
        reportArtifactId: jobRow.aggregateId, expectedScoreSnapshotId: payload.expectedScoreSnapshotId, jobId,
        subject: artifact.assessmentAttempt.subject, gradeLevel: artifact.assessmentAttempt.gradeLevel,
        actorId: payload.actorId, model: 'n/a', promptVersion: 'n/a',
        startedAt, finishedAt, result: claimed.kind, causeCode: null, retryCount: 0,
        promptTokens: 0, cachedPromptTokens: 0, completionTokens: 0, estimatedCostUsd: 0, costUnknown: false,
        domainsRequested: 0, domainsProcessed: 0, domainOutcomes: [],
      });
      await markJobTerminal(transaction, jobId, finishedAt);
    });
    dependencies.logger.info({ event: 'A90_GENERATE_TEACHER_BRIEF_JOB_COMPLETED', jobId, result: claimed.kind });
    return { jobId, result: claimed.kind };
  }

  const { claim } = claimed;

  let config: TeacherBriefConfig;
  try {
    config = dependencies.resolveConfig();
  } catch {
    const finishedAt = dependencies.now();
    await dependencies.prisma.$transaction(async (transaction) => {
      await persistAttempt(transaction, {
        reportArtifactId: claim.reportArtifactId, expectedScoreSnapshotId: claim.currentScoreSnapshotId, jobId,
        subject: claim.subject, gradeLevel: claim.gradeLevel, actorId: claim.actorId, model: 'n/a', promptVersion: 'n/a',
        startedAt, finishedAt, result: 'BLOCKED_FAILURE', causeCode: 'CONFIG', retryCount: 0,
        promptTokens: 0, cachedPromptTokens: 0, completionTokens: 0, estimatedCostUsd: 0, costUnknown: false,
        domainsRequested: 0, domainsProcessed: 0, domainOutcomes: [],
      });
      await markJobTerminal(transaction, jobId, finishedAt);
    });
    return { jobId, result: 'BLOCKED_FAILURE' };
  }

  // Faits pédagogiques + garde-fou TOO_FEW_PRIORITIES AVANT toute réservation
  // de budget et tout appel réseau — c'est un état terminal déterministe, pas
  // une panne (§8, catégorie A).
  let facts: ReturnType<typeof buildStudentFactsPayload>;
  try {
    const resolved = dependencies.resolvePack(claim.assessmentPackId, claim.assessmentPackVersion);
    if (resolved === null || resolved.checksum !== claim.assessmentPackChecksum) {
      throw new TeacherBriefError('PACK_UNAVAILABLE');
    }
    facts = buildStudentFactsPayload(claim.factSheet, resolved.pack, claim.answers, claim.subjectLabel);
  } catch (error) {
    const code = error instanceof TeacherBriefError ? error.code : 'TEACHER_BRIEF_UNKNOWN';
    const finishedAt = dependencies.now();
    const result = code === 'TEACHER_BRIEF_TOO_FEW_PRIORITIES' ? 'DETERMINISTIC_ONLY' : 'BLOCKED_FAILURE';
    await dependencies.prisma.$transaction(async (transaction) => {
      await persistAttempt(transaction, {
        reportArtifactId: claim.reportArtifactId, expectedScoreSnapshotId: claim.currentScoreSnapshotId, jobId,
        subject: claim.subject, gradeLevel: claim.gradeLevel, actorId: claim.actorId, model: config.model, promptVersion: 'n/a',
        startedAt, finishedAt, result, causeCode: code, retryCount: 0,
        promptTokens: 0, cachedPromptTokens: 0, completionTokens: 0, estimatedCostUsd: 0, costUnknown: false,
        domainsRequested: 0, domainsProcessed: 0, domainOutcomes: [],
      });
      await markJobTerminal(transaction, jobId, finishedAt);
    });
    dependencies.logger.info({ event: 'A90_GENERATE_TEACHER_BRIEF_JOB_COMPLETED', jobId, result });
    return { jobId, result };
  }

  const domainsRequested = facts.domainesPrioritaires.length;
  // Réservation conservatrice : plafond de sortie théorique du modèle, jamais
  // le coût réel encore inconnu — régularisée après l'appel.
  const reservationUsd = 0.20;
  const reserved = await dependencies.reserveBudget(reservationUsd, config.monthlyBudgetUsd, { now: dependencies.now });
  if (!reserved) {
    const finishedAt = dependencies.now();
    await dependencies.prisma.$transaction(async (transaction) => {
      await persistAttempt(transaction, {
        reportArtifactId: claim.reportArtifactId, expectedScoreSnapshotId: claim.currentScoreSnapshotId, jobId,
        subject: claim.subject, gradeLevel: claim.gradeLevel, actorId: claim.actorId, model: config.model, promptVersion: 'n/a',
        startedAt, finishedAt, result: 'BUDGET_BLOCKED', causeCode: 'TEACHER_BRIEF_BUDGET_EXCEEDED', retryCount: 0,
        promptTokens: 0, cachedPromptTokens: 0, completionTokens: 0, estimatedCostUsd: 0, costUnknown: false,
        domainsRequested, domainsProcessed: 0, domainOutcomes: [],
      });
      await markJobTerminal(transaction, jobId, finishedAt);
    });
    dependencies.logger.info({ event: 'A90_GENERATE_TEACHER_BRIEF_JOB_COMPLETED', jobId, result: 'BUDGET_BLOCKED' });
    return { jobId, result: 'BUDGET_BLOCKED' };
  }

  // Appel domaine par domaine (pas `callTeacherBriefModel` en un bloc) : un
  // premier domaine facturé reste compté même si un domaine suivant échoue
  // (§7 de l'incident P0) — jamais un coût réel sous-estimé.
  const domainOutcomes: DomainOutcomeLog[] = [];
  let partialCostUsd = 0;
  try {
    const outcomes: Array<{ domaine: unknown; promptTokens: number; cachedPromptTokens: number; completionTokens: number }> = [];
    for (const domaine of facts.domainesPrioritaires) {
      const singleDomainFacts: TeacherBriefFactsPayload = Object.freeze({
        eleve: facts.eleve, matiere: facts.matiere, domainesPrioritaires: Object.freeze([domaine]),
      });
      try {
        const outcome = await callTeacherBriefDomain(config, singleDomainFacts, dependencies.fetchImpl);
        outcomes.push(outcome);
        const costUsd = estimateCostUsd(config.model, outcome);
        partialCostUsd += costUsd;
        domainOutcomes.push({
          domainId: domaine.domainId, outcome: 'OK',
          promptTokens: outcome.promptTokens, cachedPromptTokens: outcome.cachedPromptTokens, completionTokens: outcome.completionTokens,
          costUsd,
        });
      } catch (domainError) {
        const domainCode = domainError instanceof TeacherBriefError ? domainError.code : 'TEACHER_BRIEF_UNKNOWN';
        domainOutcomes.push({ domainId: domaine.domainId, outcome: domainCode, promptTokens: 0, cachedPromptTokens: 0, completionTokens: 0, costUsd: null });
        throw domainError;
      }
    }

    const assembled = teacherBriefSchema.safeParse({
      version: TEACHER_BRIEF_PROMPT_VERSION,
      domaines: outcomes.map((outcome) => outcome.domaine),
    });
    if (!assembled.success) throw new TeacherBriefError('TEACHER_BRIEF_ASSEMBLY_REJECTED');
    assertBriefRespectsFacts(assembled.data, facts);

    const generation = {
      content: assembled.data,
      promptTokens: outcomes.reduce((total, o) => total + o.promptTokens, 0),
      cachedPromptTokens: outcomes.reduce((total, o) => total + o.cachedPromptTokens, 0),
      completionTokens: outcomes.reduce((total, o) => total + o.completionTokens, 0),
      estimatedCostUsd: partialCostUsd,
      generationMs: dependencies.now().getTime() - startedAt.getTime(),
      model: config.model,
      promptVersion: TEACHER_BRIEF_PROMPT_VERSION,
    };
    const finishedAt = dependencies.now();
    await dependencies.regularizeBudget(reservationUsd, generation.estimatedCostUsd, { now: dependencies.now });

    await dependencies.prisma.$transaction(async (transaction) => {
      await transaction.teacherBrief.updateMany({
        where: { reportArtifactId: claim.reportArtifactId, status: 'CORRECTION_REQUESTED' },
        data: { status: 'SUPERSEDED' },
      });
      const latest = await transaction.teacherBrief.findFirst({
        where: { reportArtifactId: claim.reportArtifactId }, orderBy: { version: 'desc' }, select: { version: true },
      });
      await transaction.teacherBrief.create({
        data: {
          reportArtifactId: claim.reportArtifactId,
          scoreSnapshotId: claim.currentScoreSnapshotId,
          version: (latest?.version ?? 0) + 1,
          status: 'PENDING_REVIEW',
          content: generation.content as unknown as Prisma.InputJsonValue,
          promptVersion: generation.promptVersion,
          model: generation.model,
          promptTokens: generation.promptTokens,
          cachedPromptTokens: generation.cachedPromptTokens,
          completionTokens: generation.completionTokens,
          estimatedCostUsd: generation.estimatedCostUsd,
          generationMs: generation.generationMs,
          createdById: claim.actorId,
        },
      });
      await persistAttempt(transaction, {
        reportArtifactId: claim.reportArtifactId, expectedScoreSnapshotId: claim.currentScoreSnapshotId, jobId,
        subject: claim.subject, gradeLevel: claim.gradeLevel, actorId: claim.actorId,
        model: generation.model, promptVersion: generation.promptVersion,
        startedAt, finishedAt, result: 'GENERATED', causeCode: null, retryCount: 0,
        promptTokens: generation.promptTokens, cachedPromptTokens: generation.cachedPromptTokens, completionTokens: generation.completionTokens,
        estimatedCostUsd: generation.estimatedCostUsd, costUnknown: false,
        domainsRequested, domainsProcessed: domainsRequested, domainOutcomes,
      });
      await markJobTerminal(transaction, jobId, finishedAt);
    });
    dependencies.logger.info({ event: 'A90_GENERATE_TEACHER_BRIEF_JOB_COMPLETED', jobId, result: 'GENERATED', estimatedCostUsd: generation.estimatedCostUsd });
    return { jobId, result: 'GENERATED' };
  } catch (error) {
    const finishedAt = dependencies.now();
    const code = error instanceof TeacherBriefError ? error.code : 'TEACHER_BRIEF_UNKNOWN';
    const classification = classifyFailure(code);
    // Coût inconnu UNIQUEMENT sur un échec réseau/timeout AVANT toute
    // réponse (aucun usage exploitable) — jamais compté à zéro
    // silencieusement (§7). Dans tous les autres cas, `partialCostUsd`
    // porte le coût RÉEL des domaines effectivement facturés avant l'échec
    // (0 si le tout premier appel a échoué, > 0 si un domaine précédent a
    // réussi) — jamais une sous-estimation.
    const costUnknown = code === 'TEACHER_BRIEF_TIMEOUT' || code === 'TEACHER_BRIEF_NETWORK';
    const domainsProcessed = domainOutcomes.filter((entry) => entry.outcome === 'OK').length;
    await dependencies.releaseBudget(reservationUsd, { now: dependencies.now });
    if (partialCostUsd > 0) await dependencies.regularizeBudget(0, partialCostUsd, { now: dependencies.now });
    await dependencies.prisma.$transaction(async (transaction) => {
      await persistAttempt(transaction, {
        reportArtifactId: claim.reportArtifactId, expectedScoreSnapshotId: claim.currentScoreSnapshotId, jobId,
        subject: claim.subject, gradeLevel: claim.gradeLevel, actorId: claim.actorId, model: config.model, promptVersion: 'n/a',
        startedAt, finishedAt, result: classification, causeCode: code, retryCount: 0,
        promptTokens: 0, cachedPromptTokens: 0, completionTokens: 0,
        estimatedCostUsd: costUnknown ? null : partialCostUsd, costUnknown,
        domainsRequested, domainsProcessed, domainOutcomes,
      });
      if (classification === 'RETRYABLE_FAILURE') {
        await transaction.jobOutbox.update({
          where: { id: jobId },
          data: { status: 'FAILED', attemptCount: { increment: 1 }, lastError: code, leaseOwner: null, leaseExpiresAt: null },
        });
      } else {
        await markJobTerminal(transaction, jobId, finishedAt);
      }
    });
    dependencies.logger.error({ event: 'A90_GENERATE_TEACHER_BRIEF_JOB_FAILED', jobId, code, classification });
    if (classification === 'RETRYABLE_FAILURE') throw new GenerateTeacherBriefJobError(code);
    return { jobId, result: classification };
  }
}
