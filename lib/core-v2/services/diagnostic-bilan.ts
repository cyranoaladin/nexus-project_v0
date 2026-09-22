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
import type { DiagnosticBilanDraft, PrismaClient } from '@/core-v2/generated/client';
import { Prisma } from '../client';
import { appendAuditEvent } from '../audit';
import { runBoundedBilanGeneration } from '../diagnostics/bilan-ai-generation';
import { MAX_OUTPUT_TOKENS } from '../diagnostics/ai-budget-ledger';
import { BILAN_PROMPT_VERSION, BILAN_SCHEMA_VERSION, type BilanAiProposal, buildBilanSystemPrompt, buildBilanUserPayload } from '../diagnostics/bilan-ai-schema';
import { buildPublishedBilanContent, type PublishedBilanContent } from '../diagnostics/bilan-published-content';
import { correctDemoFixtureDeterministically, type DeterministicCorrectionResult } from '../diagnostics/deterministic-correction';
import { DEMO_FIXTURE_AI_REVIEW_ITEMS, DEMO_INSTRUMENT_TITLE } from '../diagnostics/demo-content';
import { PILOT_MODEL } from '../diagnostics/openrouter-preflight';
import { ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../errors';
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

/**
 * Binds a mutation to the EXACT draft the caller says it read — never "the
 * current revision, whatever that now is" (mission §2). A fresh revision's
 * editVersion restarts at 1, so a stale draftId + a matching-but-coincidental
 * editVersion must never be allowed to fall through onto a different,
 * newer revision. `draftId` mismatching the actual current revision is a
 * distinct, explicit refusal from a stale editVersion on the right draft.
 */
async function requireCurrentDraftForMutation(
  client: PrismaClient,
  processingId: string,
  draftId: string,
  expectedStatus: DiagnosticBilanDraft['status'],
): Promise<DiagnosticBilanDraft> {
  const current = await loadCurrentBilanDraft(client, processingId);
  if (!current) throw new NotFoundError('No bilan draft exists for this processing.', { processingId });
  if (current.id !== draftId) {
    throw new ConflictError('This is no longer the current revision — reload and retry.', {
      processingId,
      requestedDraftId: draftId,
      currentDraftId: current.id,
      currentRevision: current.revision,
    });
  }
  if (current.status !== expectedStatus) {
    throw new InvalidStateError(`Only a ${expectedStatus} bilan may receive this action.`, {
      processingId,
      draftId,
      status: current.status,
    });
  }
  return current;
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
    extractedText: extraction.extractedText,
    allowedItemIds: DEMO_FIXTURE_AI_REVIEW_ITEMS.map((item) => item.itemId),
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
        : {
            outcome: generation.outcome,
            reason: generation.reason,
            promptVersion: BILAN_PROMPT_VERSION,
            schemaVersion: BILAN_SCHEMA_VERSION,
            model: PILOT_MODEL,
            // A REJECTED outcome was still really billed — record that spend here too, never only visible in the ledger table.
            ...(generation.outcome === 'REJECTED' ? { budgetStatus: generation.budgetStatus, actualCostUsd: generation.actualCostUsd, ledgerEntryId: generation.ledgerEntryId } : {}),
          }
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
  draftId: idSchema,
  editVersion: z.number().int().positive(),
  humanReview: humanReviewSchema,
});
export type ApplyHumanBilanCorrectionBody = z.input<typeof applyHumanBilanCorrectionBodySchema>;

/**
 * Optimistic-concurrency write, bound to the EXACT draft the caller read
 * (mission §2/§7): a stale `draftId` (a superseded revision) is refused
 * outright — it never falls through onto whatever the current revision
 * happens to be, even when the two revisions' editVersion coincide (a
 * fresh revision always restarts at editVersion 1). A correction may only
 * ever target an itemId that actually exists in the current AI proposal
 * (mission §3) — never an arbitrary string.
 */
export async function applyHumanBilanCorrection(
  client: PrismaClient,
  ctx: ServiceContext,
  rawProcessingId: string,
  input: { readonly draftId: string; readonly editVersion: number; readonly humanReview: HumanBilanReviewInput },
): Promise<DiagnosticBilanDraft> {
  assertCapability(ctx.actor, 'DIAGNOSTIC_BILAN_REVIEW');
  const processingId = parseInput(idSchema, rawProcessingId);
  const humanReview = humanReviewSchema.parse(input.humanReview);

  const current = await requireCurrentDraftForMutation(client, processingId, input.draftId, 'DRAFT');

  const proposalItemIds = new Set(((current.aiProposal as unknown as BilanAiProposal | null)?.items ?? []).map((item) => item.itemId));
  for (const correction of humanReview.itemCorrections ?? []) {
    if (!proposalItemIds.has(correction.itemId)) {
      throw new ValidationError('A correction may only target an item that exists in the current AI proposal.', {
        itemId: correction.itemId,
        knownItemIds: [...proposalItemIds],
      });
    }
  }

  const updated = await client.diagnosticBilanDraft.updateMany({
    where: { id: current.id, editVersion: input.editVersion },
    data: { humanReview, editVersion: { increment: 1 } },
  });
  if (updated.count === 0) {
    throw new ConflictError('This bilan was modified since you opened it — reload and retry.', {
      processingId,
      draftId: current.id,
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
export const validateBilanDraftBodySchema = z.object({ draftId: idSchema, editVersion: z.number().int().positive() });
export type ValidateBilanDraftBody = z.input<typeof validateBilanDraftBodySchema>;

/**
 * DRAFT -> VALIDATED, bound to the exact draftId (mission §2). Freezes
 * `publishedContent` from EXACTLY what is stored right now (deterministic
 * result + AI proposal + any human corrections) — this is what publish
 * later serves verbatim; validating never re-reads a different, possibly
 * newer, state.
 */
export async function validateBilanDraft(
  client: PrismaClient,
  ctx: ServiceContext,
  rawProcessingId: string,
  input: { readonly draftId: string; readonly editVersion: number },
): Promise<DiagnosticBilanDraft> {
  assertCapability(ctx.actor, 'DIAGNOSTIC_BILAN_REVIEW');
  const processingId = parseInput(idSchema, rawProcessingId);

  const current = await requireCurrentDraftForMutation(client, processingId, input.draftId, 'DRAFT');

  const publishedContent = buildPublishedBilanContent({
    deterministicResults: current.deterministicResults as unknown as readonly DeterministicCorrectionResult[],
    aiProposal: current.aiProposal as unknown as BilanAiProposal | null,
    humanReview: current.humanReview as unknown as HumanBilanReviewInput | null,
  });

  const updated = await client.diagnosticBilanDraft.updateMany({
    where: { id: current.id, editVersion: input.editVersion },
    data: {
      status: 'VALIDATED',
      validatedById: ctx.actor.userId,
      validatedAt: new Date(),
      publishedContent: publishedContent as unknown as Prisma.InputJsonValue,
      editVersion: { increment: 1 },
    },
  });
  if (updated.count === 0) {
    throw new ConflictError('This bilan was modified since you opened it — reload and retry.', {
      processingId,
      draftId: current.id,
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
  draftId: idSchema,
  editVersion: z.number().int().positive(),
  audienceScope: z.enum(PUBLISHABLE_AUDIENCE_SCOPES),
});
export type PublishBilanDraftInput = z.input<typeof publishBilanDraftBodySchema>;

/**
 * VALIDATED -> PUBLISHED, for exactly the audience named and the exact
 * draftId the caller read — never a model action, always this explicit,
 * human-triggered call (mission §7: "la publication reste une opération
 * applicative autorisée, jamais une instruction donnée au modèle"). Serves
 * the `publishedContent` frozen at validation time, unchanged.
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

  const current = await requireCurrentDraftForMutation(client, processingId, input.draftId, 'VALIDATED');

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
      draftId: current.id,
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

export interface OwnPublishedBilanView {
  readonly id: string;
  readonly revision: number;
  readonly publishedAt: Date | null;
  readonly extractionTruncatedSnapshot: boolean;
  /** The one and only content the candidate ever sees — never the raw humanReview note, never an AI item a human correction replaced. */
  readonly content: PublishedBilanContent;
}

/**
 * Self-service read for the "own-student" audience (mission §7: the real
 * audience matrix — ownership of the underlying assignment is re-checked
 * here, never inferred from "a parent/student account exists"). Only the
 * PUBLISHED revision is ever reachable; a DRAFT or VALIDATED one is a
 * NotFoundError from this path, exactly as if nothing had been generated
 * yet — its existence is never leaked to the candidate. Serves
 * `publishedContent` exclusively (mission §3) — the raw `humanReview` and
 * `aiProposal` columns are never part of this response's shape at all.
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
  if (!draft || !draft.publishedContent) throw new NotFoundError('No published bilan available yet.', { processingId });

  return {
    id: draft.id,
    revision: draft.revision,
    publishedAt: draft.publishedAt,
    extractionTruncatedSnapshot: draft.extractionTruncatedSnapshot,
    content: draft.publishedContent as unknown as PublishedBilanContent,
  };
}

/**
 * Same self-service read, keyed by the candidate's own submissionId
 * instead of the internal processingId — the vocabulary the candidate's
 * own "Diagnostics libres" screen already uses (mission §7: "le candidat
 * doit pouvoir retrouver le bilan depuis son attribution ou sa copie").
 * Delegates to getOwnPublishedBilan for the actual ownership/audience
 * check — this wrapper only resolves the id, it adds no new logic.
 */
export async function getOwnPublishedBilanForSubmission(
  client: PrismaClient,
  ctx: ServiceContext,
  rawSubmissionId: string,
): Promise<OwnPublishedBilanView> {
  const submissionId = parseInput(idSchema, rawSubmissionId);
  const processing = await client.diagnosticSubmissionProcessing.findUnique({ where: { submissionId } });
  if (!processing) throw new NotFoundError('No published bilan available yet.', { submissionId });
  return getOwnPublishedBilan(client, ctx, processing.id);
}

