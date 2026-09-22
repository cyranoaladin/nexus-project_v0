/**
 * The C2 AI pilot's actual bounded completion call (mission §3/§4/§5/§6).
 * Reuses openrouter-preflight.ts's live decision — it never re-derives its
 * own endpoint/provider list, and never sends a request the preflight did
 * not just certify. Reserves the ledger's worst-case cost BEFORE the
 * network call, never holds a DB transaction open across it.
 *
 * Three distinct outcome families, never conflated (mission §6 — "ne
 * confonds pas succès technique, validité pédagogique et résultat
 * financier"):
 *   - PREFLIGHT_BLOCKED / BUDGET_BLOCKED: no call was ever made, no ledger row exists.
 *   - CALL_FAILED: the provider's billing status is genuinely UNKNOWN
 *     (network error, timeout — including a timeout while reading the
 *     body, not just while waiting for headers — an HTTP error status, or
 *     an anomalous missing usage.cost). The reservation stays RESERVED,
 *     never auto-released.
 *   - REJECTED: a real HTTP 200 was received and a real cost IS known and
 *     COMMITTED, but the content is unusable (truncated, invalid JSON,
 *     schema-invalid, or evidence-invalid). A billed-but-unusable
 *     generation is never reported as "still RESERVED".
 */
import type { PrismaClient } from '@/core-v2/generated/client';
import { reserveAiBudget, commitAiBudgetEntry, type ReserveAiBudgetInput } from './ai-budget-ledger';
import {
  BILAN_AI_JSON_SCHEMA,
  BILAN_JSON_SCHEMA_NAME,
  bilanAiProposalSchema,
  type BilanAiProposal,
} from './bilan-ai-schema';
import { validateAiProposalAgainstSource, type EvidenceCoverage } from './bilan-evidence';
import {
  buildCompliantProviderPreferences,
  runOpenRouterPreflight,
  type CompliantEndpoint,
} from './openrouter-preflight';
import { ConflictError } from '../errors';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const OPENROUTER_CHAT_URL = `${OPENROUTER_BASE_URL}/chat/completions`;
const REQUEST_TIMEOUT_MS = 20_000;
const GENERATION_LOOKUP_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_BYTES = 200_000;

/** Conservative: never assumes the more generous ~4 chars/token some tokenizers achieve on French prose. */
export function estimateTokensFromChars(text: string): number {
  return Math.ceil(text.length / 3);
}

export interface BilanGenerationProvenance {
  readonly ledgerEntryId: string;
  readonly model: string;
  /** The provider ACTUALLY reported by OpenRouter's own /generation lookup — null when that lookup itself did not succeed within its bounded timeout. Never filled from the preflight's theoretical list. */
  readonly providerName: string | null;
  /** The provider names the preflight found compliant BEFORE the call — kept explicitly separate from `providerName`. */
  readonly preflightCandidateProviders: readonly string[];
  readonly promptVersion: string;
  readonly schemaVersion: string;
  readonly attempt: number;
  readonly reservedCostUsd: number;
  readonly actualCostUsd: number;
  readonly providerRequestId: string | null;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly coverage: EvidenceCoverage;
  readonly generatedAt: string;
}

export type BilanGenerationOutcome =
  | Readonly<{ readonly outcome: 'GENERATED'; readonly proposal: BilanAiProposal; readonly provenance: BilanGenerationProvenance }>
  | Readonly<{ readonly outcome: 'PREFLIGHT_BLOCKED'; readonly reason: string }>
  | Readonly<{ readonly outcome: 'BUDGET_BLOCKED'; readonly reason: string }>
  | Readonly<{
      /** Provider billing status genuinely unknown — never auto-released, see module doc. */
      readonly outcome: 'CALL_FAILED';
      readonly reason: string;
      readonly budgetStatus: 'RESERVED_UNRECONCILED';
      readonly ledgerEntryId: string;
    }>
  | Readonly<{
      /** A real, billed generation (COMMITTED, real actualCostUsd) that is unusable as a bilan proposal. */
      readonly outcome: 'REJECTED';
      readonly reason: string;
      readonly budgetStatus: 'COMMITTED';
      readonly ledgerEntryId: string;
      readonly actualCostUsd: number;
    }>;

export interface RunBoundedBilanGenerationInput {
  readonly client: PrismaClient;
  readonly apiKey: string;
  readonly model: string;
  readonly processingId: string;
  readonly audienceScope: string;
  readonly systemPrompt: string;
  readonly userPayload: string;
  readonly maxOutputTokens: number;
  readonly promptVersion: string;
  readonly schemaVersion: string;
  /** The exact extracted copy the prompt was built from — evidence in the AI's response is checked against THIS, never re-read from elsewhere. */
  readonly extractedText: string;
  /** The only itemIds the model was ever asked about — anything else in the response is an unknown item, not a proposal to accept. */
  readonly allowedItemIds: readonly string[];
  readonly fetchImpl?: typeof fetch;
}

/**
 * Reads the response body under the SAME AbortSignal used for the fetch
 * itself (mission §6: "le délai de génération doit couvrir la réception
 * complète, pas seulement l'attente de fetch jusqu'aux en-têtes") — a slow
 * or stalled body still aborts, bounded, and the reader is always
 * cancelled on every exit path.
 */
async function readBoundedResponseText(response: Response, maxBytes: number): Promise<string> {
  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > maxBytes) throw new Error('RESPONSE_TOO_LARGE');
  const reader = response.body?.getReader();
  if (!reader) return response.text();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) throw new Error('RESPONSE_TOO_LARGE');
        chunks.push(Buffer.from(value));
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks).toString('utf-8');
}

interface OpenRouterChatCompletionResponse {
  readonly id?: string;
  readonly choices?: readonly {
    readonly finish_reason?: string;
    readonly message?: { readonly content?: unknown };
  }[];
  readonly usage?: {
    readonly prompt_tokens?: number;
    readonly completion_tokens?: number;
    readonly cost?: number;
  };
}

/**
 * Best-effort, bounded, FREE lookup of the provider OpenRouter itself
 * reports for a given generation id (mission §6: "distingue... fournisseur
 * effectivement rapporté" — never the preflight's theoretical list). A
 * failure or timeout here is non-fatal: the generation was already billed
 * and committed regardless; this only fills in which provider actually
 * served it, when that can be confirmed.
 */
async function lookupActualProviderName(
  fetchImpl: typeof fetch,
  apiKey: string,
  generationId: string,
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GENERATION_LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${OPENROUTER_BASE_URL}/generation?id=${encodeURIComponent(generationId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { data?: { provider_name?: unknown } };
    return typeof payload.data?.provider_name === 'string' ? payload.data.provider_name : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function buildRequestBody(input: {
  model: string;
  systemPrompt: string;
  userPayload: string;
  maxOutputTokens: number;
  compliantEndpoints: readonly CompliantEndpoint[];
}) {
  return {
    model: input.model,
    messages: [
      { role: 'system' as const, content: input.systemPrompt },
      { role: 'user' as const, content: input.userPayload },
    ],
    max_tokens: input.maxOutputTokens,
    provider: buildCompliantProviderPreferences(input.compliantEndpoints),
    response_format: {
      type: 'json_schema' as const,
      json_schema: { name: BILAN_JSON_SCHEMA_NAME, strict: true, schema: BILAN_AI_JSON_SCHEMA },
    },
    // Deliberately nothing else: no temperature, top_p, seed, tools, plugins,
    // or reasoning knobs — none is required by the policy, so none is sent.
  };
}

/**
 * Runs preflight against the ACTUAL content about to be sent (never a
 * canned token estimate), reserves the worst-case cost, and — only if that
 * reservation succeeds — makes exactly one bounded provider call. Returns a
 * discriminated outcome rather than throwing for any ordinary refusal path;
 * it throws only for a genuine programming/infra error (a Prisma
 * connection failure, for instance).
 */
export async function runBoundedBilanGeneration(input: RunBoundedBilanGenerationInput): Promise<BilanGenerationOutcome> {
  const fetchImpl = input.fetchImpl ?? fetch;
  // The full serialized request body is what is actually billed, not just
  // the two message strings — the JSON schema and its wrapper add real
  // tokens too (mission §5: "vérifie le contenu complet envoyé, y compris
  // le schéma et les surcoûts pertinents"). Estimate from THAT.
  const estimatedRequestBody = buildRequestBody({
    model: input.model,
    systemPrompt: input.systemPrompt,
    userPayload: input.userPayload,
    maxOutputTokens: input.maxOutputTokens,
    compliantEndpoints: [],
  });
  const estimatedPromptTokens = estimateTokensFromChars(JSON.stringify(estimatedRequestBody));

  const preflight = await runOpenRouterPreflight({
    apiKey: input.apiKey,
    model: input.model,
    estimatedPromptTokens,
    maxOutputTokens: input.maxOutputTokens,
    fetchImpl,
  });
  if (!preflight.ok) return { outcome: 'PREFLIGHT_BLOCKED', reason: preflight.reason ?? 'UNKNOWN' };

  const reserveInput: ReserveAiBudgetInput = {
    processingId: input.processingId,
    audienceScope: input.audienceScope,
    estimatedCostUsd: preflight.worstCaseCostUsd,
    provider: 'openrouter',
    model: input.model,
    endpointTag: Array.from(new Set(preflight.compliantEndpoints.map((e) => e.tag))).join(','),
  };
  let ledgerEntry: Awaited<ReturnType<typeof reserveAiBudget>>;
  try {
    ledgerEntry = await reserveAiBudget(input.client, reserveInput);
  } catch (error) {
    if (error instanceof ConflictError) return { outcome: 'BUDGET_BLOCKED', reason: error.message };
    throw error;
  }

  const preflightCandidateProviders = Array.from(new Set(preflight.compliantEndpoints.map((e) => e.providerName)));
  const body = buildRequestBody({
    model: input.model,
    systemPrompt: input.systemPrompt,
    userPayload: input.userPayload,
    maxOutputTokens: input.maxOutputTokens,
    compliantEndpoints: preflight.compliantEndpoints,
  });

  const ambiguous = (reason: string): BilanGenerationOutcome => ({
    outcome: 'CALL_FAILED',
    reason,
    budgetStatus: 'RESERVED_UNRECONCILED',
    ledgerEntryId: ledgerEntry.id,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    let response: Response;
    try {
      response = await fetchImpl(OPENROUTER_CHAT_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${input.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      // Network error or timeout waiting for headers: the provider's own
      // billing status is genuinely unknown — stays RESERVED.
      return ambiguous('NETWORK_ERROR_OR_TIMEOUT');
    }

    let rawText: string;
    try {
      // Same controller/signal: a timeout while the body is still
      // streaming aborts here too, not just while waiting for headers.
      rawText = await readBoundedResponseText(response, MAX_RESPONSE_BYTES);
    } catch {
      return ambiguous(controller.signal.aborted ? 'RESPONSE_BODY_TIMEOUT' : 'RESPONSE_TOO_LARGE_OR_UNREADABLE');
    }

    if (!response.ok) {
      // A real HTTP status came back; we do not know from this alone
      // whether an upstream provider still incurred a cost before
      // returning the error — stays RESERVED for explicit reconciliation.
      return ambiguous(`OPENROUTER_HTTP_${response.status}`);
    }

    let parsed: OpenRouterChatCompletionResponse;
    try {
      parsed = JSON.parse(rawText) as OpenRouterChatCompletionResponse;
    } catch {
      return ambiguous('RESPONSE_NOT_JSON');
    }

    if (typeof parsed.usage?.cost !== 'number') {
      // OpenRouter's own current API always includes usage.cost — its
      // absence is an anomaly, not "free": never substitute the
      // worst-case estimate here and call it reconciled (mission §6).
      return ambiguous('USAGE_COST_MISSING');
    }

    // From here on, a real HTTP 200 with a real reported cost: commit
    // NOW, before anything else can fail — every subsequent rejection
    // reason is REJECTED (billed, COMMITTED), never "still RESERVED".
    const actualCostUsd = parsed.usage.cost;
    const promptTokens = parsed.usage.prompt_tokens ?? 0;
    const completionTokens = parsed.usage.completion_tokens ?? 0;
    const providerRequestId = typeof parsed.id === 'string' ? parsed.id : null;
    await commitAiBudgetEntry(input.client, ledgerEntry.id, { actualCostUsd, providerRequestId });

    const rejected = (reason: string): BilanGenerationOutcome => ({
      outcome: 'REJECTED',
      reason,
      budgetStatus: 'COMMITTED',
      ledgerEntryId: ledgerEntry.id,
      actualCostUsd,
    });

    const choice = parsed.choices?.[0];
    if (choice?.finish_reason === 'length') return rejected('RESPONSE_TRUNCATED_AT_MAX_TOKENS');
    const content = choice?.message?.content;
    if (typeof content !== 'string' || content.trim() === '') return rejected('EMPTY_CONTENT');

    let candidateJson: unknown;
    try {
      candidateJson = JSON.parse(content);
    } catch {
      return rejected('CONTENT_NOT_JSON');
    }

    const validated = bilanAiProposalSchema.safeParse(candidateJson);
    if (!validated.success) return rejected('SCHEMA_VALIDATION_FAILED');

    const evidence = validateAiProposalAgainstSource(validated.data, {
      allowedItemIds: input.allowedItemIds,
      extractedText: input.extractedText,
    });
    if (!evidence.ok) return rejected(`EVIDENCE_VALIDATION_FAILED:${evidence.reason}`);

    const providerName = providerRequestId ? await lookupActualProviderName(fetchImpl, input.apiKey, providerRequestId) : null;

    return {
      outcome: 'GENERATED',
      proposal: validated.data,
      provenance: {
        ledgerEntryId: ledgerEntry.id,
        model: input.model,
        providerName,
        preflightCandidateProviders,
        promptVersion: input.promptVersion,
        schemaVersion: input.schemaVersion,
        attempt: ledgerEntry.attempt,
        reservedCostUsd: preflight.worstCaseCostUsd,
        actualCostUsd,
        providerRequestId,
        promptTokens,
        completionTokens,
        coverage: evidence.coverage,
        generatedAt: new Date().toISOString(),
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}
