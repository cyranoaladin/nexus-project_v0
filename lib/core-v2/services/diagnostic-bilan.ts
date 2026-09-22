/**
 * C2 bilan draft lifecycle (mission §6/§7): generation (deterministic +
 * optional AI-assisted proposal), human review/correction, validation, and
 * a controlled publication to exactly one self-service audience. Every
 * mutation here is ADMIN-only (DIAGNOSTIC_BILAN_REVIEW) — ASSISTANTE's
 * existing DIAGNOSTIC_SUBMISSION_TRACK never reaches this file at all, so
 * academic content can never leak through it.
 *
 * Revision discipline (mission §6): a new generation is always a NEW row
 * (never an update to a prior one); the "current" draft for a processing
 * is MAX(revision), computed at query time. Once PUBLISHED a draft is
 * immutable — a later generation creates revision N+1, it never touches
 * the published revision.
 */
import { z } from 'zod';
import { Prisma, type DiagnosticBilanDraft, type PrismaClient } from '@/core-v2/generated/client';
import { appendAuditEvent } from '../audit';
import { runBoundedBilanGeneration } from '../diagnostics/bilan-ai-generation';
import { MAX_OUTPUT_TOKENS } from '../diagnostics/ai-budget-ledger';
import { BILAN_PROMPT_VERSION, BILAN_SCHEMA_VERSION, buildBilanSystemPrompt, buildBilanUserPayload } from '../diagnostics/bilan-ai-schema';
import { correctDemoFixtureDeterministically } from '../diagnostics/deterministic-correction';
import { DEMO_FIXTURE_AI_REVIEW_ITEMS, DEMO_INSTRUMENT_TITLE } from '../diagnostics/demo-content';
import { PILOT_MODEL } from '../diagnostics/openrouter-preflight';
import { ConflictError, InvalidStateError, NotFoundError } from '../errors';
import { assertCapability, assertSelfServiceRole } from '../rbac';
import type { ServiceContext } from './context';
import { idSchema, parseInput } from './validation';

/** The pilot's single internal review audience for this increment (mission §2/§5: "une seule audience interne de revue"). */
export const PEDAGOGICAL_REVIEW_AUDIENCE = 'pedagogical-review';
/** The only publishable audience scope wired up so far — the candidate's own self-service read. */
const PUBLISHABLE_AUDIENCE_SCOPES = ['own-student'] as const;

async function loadCurrentBilanDraft(client: PrismaClient, processingId: string): Promise<DiagnosticBilanDraft | null> {
  return client.diagnosticBilanDraft.findFirst({ where: { processingId }, orderBy: { revision: 'desc' } });
}

async function loadProcessingForBilan(client: PrismaClient, processingId: string) {
  const processing = await client.diagnosticSubmissionProcessing.findUnique({
    where: { id: processingId },
    include: {
      submission: { include: { assignment: { include: { instrumentRef: true } } } },
      extractions: { orderBy: { revision: 'desc' }, take: 1 },
    },
  });
  if (!processing) throw new NotFoundError('Processing record not found.', { processingId });
  return processing;
}

/**
 * Generates a new bilan-draft revision: deterministic correction always
 * runs; the AI proposal runs only if the DEMO_FIXTURE-only, budget/preflight
 * gates all clear — and its absence (any outcome other than GENERATED)
 * stays visible in the stored row, never silently backfilled or hidden.
 */
export async function generateBilanDraft(
  client: PrismaClient,
  ctx: ServiceContext,
  rawProcessingId: string,
  options: { readonly fetchImpl?: typeof fetch } = {},
): Promise<DiagnosticBilanDraft> {
  assertCapability(ctx.actor, 'DIAGNOSTIC_BILAN_REVIEW');
  const processingId = parseInput(idSchema, rawProcessingId);
  const processing = await loadProcessingForBilan(client, processingId);

  if (processing.submission.assignment.instrumentRef.catalogStatus !== 'DEMO_FIXTURE') {
    throw new InvalidStateError('The AI pilot is restricted to the DEMO_FIXTURE catalog entry.', {
      processingId,
      catalogStatus: processing.submission.assignment.instrumentRef.catalogStatus,
    });
  }
  const extraction = processing.extractions[0];
  if (!extraction || extraction.status !== 'SUCCEEDED' || !extraction.extractedText) {
    throw new InvalidStateError('No successful extraction available for this processing yet.', { processingId });
  }

  const deterministicResults = correctDemoFixtureDeterministically(extraction.extractedText);

  const apiKey = process.env.OPENROUTER_API_KEY ?? '';
  const systemPrompt = buildBilanSystemPrompt();
  const userPayload = buildBilanUserPayload({
    instrumentTitle: DEMO_INSTRUMENT_TITLE,
    items: DEMO_FIXTURE_AI_REVIEW_ITEMS,
    deterministicResults,
    extractedText: extraction.extractedText,
    truncated: extraction.truncated,
  });

  const generation = await runBoundedBilanGeneration({
    client,
    apiKey,
    model: PILOT_MODEL,
    processingId,
    audienceScope: PEDAGOGICAL_REVIEW_AUDIENCE,
    systemPrompt,
    userPayload,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    promptVersion: BILAN_PROMPT_VERSION,
    schemaVersion: BILAN_SCHEMA_VERSION,
    fetchImpl: options.fetchImpl,
  });

  const lastRevision = await client.diagnosticBilanDraft.aggregate({ where: { processingId }, _max: { revision: true } });
  const revision = (lastRevision._max.revision ?? 0) + 1;

  const draft = await client.diagnosticBilanDraft.create({
    data: {
      processingId,
      revision,
      extractionId: extraction.id,
      extractionRevisionSnapshot: extraction.revision,
      extractionTruncatedSnapshot: extraction.truncated,
      deterministicResults: deterministicResults as unknown as Prisma.InputJsonValue,
      aiProposal: (generation.outcome === 'GENERATED' ? generation.proposal : Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
      aiProvenance: (generation.outcome === 'GENERATED'
        ? generation.provenance
        : { outcome: generation.outcome, reason: generation.reason, promptVersion: BILAN_PROMPT_VERSION, schemaVersion: BILAN_SCHEMA_VERSION, model: PILOT_MODEL }
      ) as unknown as Prisma.InputJsonValue,
    },
  });

  await appendAuditEvent(client, {
    actorUserId: ctx.actor.userId,
    action: 'diagnostic.bilan.draft.generated',
    subjectType: 'DiagnosticBilanDraft',
    subjectId: draft.id,
    correlationId: ctx.correlationId,
    metadata: { processingId, revision, aiOutcome: generation.outcome },
  });
  return draft;
}

/** ADMIN review read: the current (latest-revision) draft, or null if none was ever generated. */
export async function getCurrentBilanDraftForReview(client: PrismaClient, ctx: ServiceContext, rawProcessingId: string): Promise<DiagnosticBilanDraft | null> {
  assertCapability(ctx.actor, 'DIAGNOSTIC_BILAN_REVIEW');
  const processingId = parseInput(idSchema, rawProcessingId);
  return loadCurrentBilanDraft(client, processingId);
}

const humanReviewSchema = z.object({
  note: z.string().trim().max(2000).optional(),
  itemCorrections: z
    .array(z.object({ itemId: z.string().min(1).max(64), correctedConstat: z.string().trim().min(1).max(500) }))
    .max(10)
    .optional(),
});
export type HumanBilanReviewInput = z.input<typeof humanReviewSchema>;

/** Exported so the staff route can validate the exact same shape at the HTTP boundary. */
export const applyHumanBilanCorrectionBodySchema = z.object({
  editVersion: z.number().int().positive(),
  humanReview: humanReviewSchema,
});
export type ApplyHumanBilanCorrectionBody = z.input<typeof applyHumanBilanCorrectionBodySchema>;

/**
 * Optimistic-concurrency write (mission §7: "les écritures concurrentes
 * doivent empêcher qu'une validation porte silencieusement sur une version
 * modifiée depuis l'ouverture de l'écran"): the caller must supply the
 * editVersion it read; a mismatch (concurrent edit, or the draft has since
 * moved past DRAFT) is refused outright, never silently overwritten.
 */
export async function applyHumanBilanCorrection(
  client: PrismaClient,
  ctx: ServiceContext,
  rawProcessingId: string,
  input: { readonly editVersion: number; readonly humanReview: HumanBilanReviewInput },
): Promise<DiagnosticBilanDraft> {
  assertCapability(ctx.actor, 'DIAGNOSTIC_BILAN_REVIEW');
  const processingId = parseInput(idSchema, rawProcessingId);
  const humanReview = humanReviewSchema.parse(input.humanReview);

  const current = await loadCurrentBilanDraft(client, processingId);
  if (!current) throw new NotFoundError('No bilan draft to correct.', { processingId });
  if (current.status !== 'DRAFT') {
    throw new InvalidStateError('Only a DRAFT bilan may be corrected.', { processingId, status: current.status });
  }

  const updated = await client.diagnosticBilanDraft.updateMany({
    where: { id: current.id, editVersion: input.editVersion },
    data: { humanReview, editVersion: { increment: 1 } },
  });
  if (updated.count === 0) {
    throw new ConflictError('This bilan was modified since you opened it — reload and retry.', {
      processingId,
      expectedEditVersion: input.editVersion,
    });
  }
  await appendAuditEvent(client, {
    actorUserId: ctx.actor.userId,
    action: 'diagnostic.bilan.draft.human_reviewed',
    subjectType: 'DiagnosticBilanDraft',
    subjectId: current.id,
    correlationId: ctx.correlationId,
    metadata: { processingId },
  });
  return client.diagnosticBilanDraft.findUniqueOrThrow({ where: { id: current.id } });
}

/** Exported so the staff route can validate the exact same shape at the HTTP boundary. */
export const validateBilanDraftBodySchema = z.object({ editVersion: z.number().int().positive() });
export type ValidateBilanDraftBody = z.input<typeof validateBilanDraftBodySchema>;

/** DRAFT -> VALIDATED. Same optimistic-concurrency guard as correction. */
export async function validateBilanDraft(
  client: PrismaClient,
  ctx: ServiceContext,
  rawProcessingId: string,
  input: { readonly editVersion: number },
): Promise<DiagnosticBilanDraft> {
  assertCapability(ctx.actor, 'DIAGNOSTIC_BILAN_REVIEW');
  const processingId = parseInput(idSchema, rawProcessingId);

  const current = await loadCurrentBilanDraft(client, processingId);
  if (!current) throw new NotFoundError('No bilan draft to validate.', { processingId });
  if (current.status !== 'DRAFT') {
    throw new InvalidStateError('Only a DRAFT bilan may be validated.', { processingId, status: current.status });
  }
  const updated = await client.diagnosticBilanDraft.updateMany({
    where: { id: current.id, editVersion: input.editVersion },
    data: { status: 'VALIDATED', validatedById: ctx.actor.userId, validatedAt: new Date(), editVersion: { increment: 1 } },
  });
  if (updated.count === 0) {
    throw new ConflictError('This bilan was modified since you opened it — reload and retry.', {
      processingId,
      expectedEditVersion: input.editVersion,
    });
  }
  await appendAuditEvent(client, {
    actorUserId: ctx.actor.userId,
    action: 'diagnostic.bilan.draft.validated',
    subjectType: 'DiagnosticBilanDraft',
    subjectId: current.id,
    correlationId: ctx.correlationId,
    metadata: { processingId },
  });
  return client.diagnosticBilanDraft.findUniqueOrThrow({ where: { id: current.id } });
}

export const publishBilanDraftBodySchema = z.object({
  editVersion: z.number().int().positive(),
  audienceScope: z.enum(PUBLISHABLE_AUDIENCE_SCOPES),
});
export type PublishBilanDraftInput = z.input<typeof publishBilanDraftBodySchema>;

/**
 * VALIDATED -> PUBLISHED, for exactly the audience named — never a model
 * action, always this explicit, human-triggered call (mission §7: "la
 * publication reste une opération applicative autorisée, jamais une
 * instruction donnée au modèle").
 */
export async function publishBilanDraft(
  client: PrismaClient,
  ctx: ServiceContext,
  rawProcessingId: string,
  rawInput: PublishBilanDraftInput,
): Promise<DiagnosticBilanDraft> {
  assertCapability(ctx.actor, 'DIAGNOSTIC_BILAN_REVIEW');
  const processingId = parseInput(idSchema, rawProcessingId);
  const input = publishBilanDraftBodySchema.parse(rawInput);

  const current = await loadCurrentBilanDraft(client, processingId);
  if (!current) throw new NotFoundError('No bilan draft to publish.', { processingId });
  if (current.status !== 'VALIDATED') {
    throw new InvalidStateError('Only a VALIDATED bilan may be published.', { processingId, status: current.status });
  }
  const updated = await client.diagnosticBilanDraft.updateMany({
    where: { id: current.id, editVersion: input.editVersion },
    data: {
      status: 'PUBLISHED',
      publishedById: ctx.actor.userId,
      publishedAt: new Date(),
      publishedAudienceScope: input.audienceScope,
      editVersion: { increment: 1 },
    },
  });
  if (updated.count === 0) {
    throw new ConflictError('This bilan was modified since you opened it — reload and retry.', {
      processingId,
      expectedEditVersion: input.editVersion,
    });
  }
  await appendAuditEvent(client, {
    actorUserId: ctx.actor.userId,
    action: 'diagnostic.bilan.draft.published',
    subjectType: 'DiagnosticBilanDraft',
    subjectId: current.id,
    correlationId: ctx.correlationId,
    metadata: { processingId, audienceScope: input.audienceScope },
  });
  return client.diagnosticBilanDraft.findUniqueOrThrow({ where: { id: current.id } });
}

export type OwnPublishedBilanView = Pick<
  DiagnosticBilanDraft,
  'id' | 'revision' | 'deterministicResults' | 'aiProposal' | 'humanReview' | 'publishedAt' | 'extractionTruncatedSnapshot'
>;

/**
 * Self-service read for the "own-student" audience (mission §7: the real
 * audience matrix — ownership of the underlying assignment is re-checked
 * here, never inferred from "a parent/student account exists"). Only the
 * PUBLISHED revision is ever reachable; a DRAFT or VALIDATED one is a
 * NotFoundError from this path, exactly as if nothing had been generated
 * yet — its existence is never leaked to the candidate.
 */
export async function getOwnPublishedBilan(client: PrismaClient, ctx: ServiceContext, rawProcessingId: string): Promise<OwnPublishedBilanView> {
  assertSelfServiceRole(ctx.actor, 'ELEVE');
  const processingId = parseInput(idSchema, rawProcessingId);

  const processing = await client.diagnosticSubmissionProcessing.findUnique({
    where: { id: processingId },
    include: { submission: { include: { assignment: { select: { studentId: true } } } } },
  });
  if (!processing) throw new NotFoundError('Processing record not found.', { processingId });

  const student = await client.student.findUnique({ where: { userId: ctx.actor.userId } });
  if (!student || student.id !== processing.submission.assignment.studentId) {
    throw new NotFoundError('Processing record not found.', { processingId });
  }

  const draft = await client.diagnosticBilanDraft.findFirst({
    where: { processingId, status: 'PUBLISHED', publishedAudienceScope: 'own-student' },
    orderBy: { revision: 'desc' },
  });
  if (!draft) throw new NotFoundError('No published bilan available yet.', { processingId });

  return {
    id: draft.id,
    revision: draft.revision,
    deterministicResults: draft.deterministicResults,
    aiProposal: draft.aiProposal,
    humanReview: draft.humanReview,
    publishedAt: draft.publishedAt,
    extractionTruncatedSnapshot: draft.extractionTruncatedSnapshot,
  };
}

