/**
 * The C2 AI pilot's actual bounded completion call (mission §3/§4/§5).
 * Reuses openrouter-preflight.ts's live decision — it never re-derives its
 * own endpoint/provider list, and never sends a request the preflight did
 * not just certify. Reserves the ledger's worst-case cost BEFORE the
 * network call, never holds a DB transaction open across it, and leaves an
 * unresolved reservation RESERVED (never auto-released) on any ambiguous
 * outcome — a timeout, a malformed response, or a schema-validation
 * failure all still count as "provider status unknown", not "free".
 */
import type { PrismaClient } from '@/core-v2/generated/client';
import { reserveAiBudget, commitAiBudgetEntry, type ReserveAiBudgetInput } from './ai-budget-ledger';
import {
  BILAN_AI_JSON_SCHEMA,
  BILAN_JSON_SCHEMA_NAME,
  bilanAiProposalSchema,
  type BilanAiProposal,
} from './bilan-ai-schema';
import {
  buildCompliantProviderPreferences,
  runOpenRouterPreflight,
  type CompliantEndpoint,
} from './openrouter-preflight';
import { ConflictError } from '../errors';

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RESPONSE_BYTES = 200_000;

/** Conservative: never assumes the more generous ~4 chars/token some tokenizers achieve on French prose. */
export function estimateTokensFromChars(text: string): number {
  return Math.ceil(text.length / 3);
}

export type BilanGenerationOutcome =
  | Readonly<{
      readonly outcome: 'GENERATED';
      readonly proposal: BilanAiProposal;
      readonly provenance: BilanGenerationProvenance;
    }>
  | Readonly<{ readonly outcome: 'PREFLIGHT_BLOCKED'; readonly reason: string }>
  | Readonly<{ readonly outcome: 'BUDGET_BLOCKED'; readonly reason: string }>
  | Readonly<{
      readonly outcome: 'CALL_FAILED';
      readonly reason: string;
      /** Always RESERVED_UNRECONCILED here: this path never auto-releases — see the module doc. */
      readonly budgetStatus: 'RESERVED_UNRECONCILED';
      readonly ledgerEntryId: string;
    }>;

export interface BilanGenerationProvenance {
  readonly ledgerEntryId: string;
  readonly model: string;
  readonly providerName: string;
  readonly promptVersion: string;
  readonly schemaVersion: string;
  readonly attempt: number;
  readonly reservedCostUsd: number;
  readonly actualCostUsd: number;
  readonly providerRequestId: string | null;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly generatedAt: string;
}

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
  readonly fetchImpl?: typeof fetch;
}

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
  const estimatedPromptTokens = estimateTokensFromChars(input.systemPrompt) + estimateTokensFromChars(input.userPayload);

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

  const body = buildRequestBody({
    model: input.model,
    systemPrompt: input.systemPrompt,
    userPayload: input.userPayload,
    maxOutputTokens: input.maxOutputTokens,
    compliantEndpoints: preflight.compliantEndpoints,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchImpl(OPENROUTER_CHAT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${input.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    // Network error or timeout: the provider's own billing status is
    // genuinely unknown — the reservation stays RESERVED, never released.
    return { outcome: 'CALL_FAILED', reason: 'NETWORK_ERROR_OR_TIMEOUT', budgetStatus: 'RESERVED_UNRECONCILED', ledgerEntryId: ledgerEntry.id };
  } finally {
    clearTimeout(timeout);
  }

  let rawText: string;
  try {
    rawText = await readBoundedResponseText(response, MAX_RESPONSE_BYTES);
  } catch {
    return { outcome: 'CALL_FAILED', reason: 'RESPONSE_TOO_LARGE_OR_UNREADABLE', budgetStatus: 'RESERVED_UNRECONCILED', ledgerEntryId: ledgerEntry.id };
  }

  if (!response.ok) {
    // A real HTTP status came back from OpenRouter; we do not know from
    // this alone whether an upstream provider still incurred a cost before
    // returning the error (mission §4: never assume "no charge" from an
    // error status). The reservation stays RESERVED for explicit
    // reconciliation.
    return {
      outcome: 'CALL_FAILED',
      reason: `OPENROUTER_HTTP_${response.status}`,
      budgetStatus: 'RESERVED_UNRECONCILED',
      ledgerEntryId: ledgerEntry.id,
    };
  }

  let parsed: OpenRouterChatCompletionResponse;
  try {
    parsed = JSON.parse(rawText) as OpenRouterChatCompletionResponse;
  } catch {
    return { outcome: 'CALL_FAILED', reason: 'RESPONSE_NOT_JSON', budgetStatus: 'RESERVED_UNRECONCILED', ledgerEntryId: ledgerEntry.id };
  }

  const choice = parsed.choices?.[0];
  const actualCostUsd = typeof parsed.usage?.cost === 'number' ? parsed.usage.cost : preflight.worstCaseCostUsd;
  const promptTokens = parsed.usage?.prompt_tokens ?? 0;
  const completionTokens = parsed.usage?.completion_tokens ?? 0;
  const providerRequestId = typeof parsed.id === 'string' ? parsed.id : null;

  // A REAL generation happened (HTTP 200): commit the real cost regardless
  // of what happens next — a truncated or invalid response was still billed.
  await commitAiBudgetEntry(input.client, ledgerEntry.id, { actualCostUsd, providerRequestId });

  if (choice?.finish_reason === 'length') {
    return { outcome: 'CALL_FAILED', reason: 'RESPONSE_TRUNCATED_AT_MAX_TOKENS', budgetStatus: 'RESERVED_UNRECONCILED', ledgerEntryId: ledgerEntry.id };
  }
  const content = choice?.message?.content;
  if (typeof content !== 'string' || content.trim() === '') {
    return { outcome: 'CALL_FAILED', reason: 'EMPTY_CONTENT', budgetStatus: 'RESERVED_UNRECONCILED', ledgerEntryId: ledgerEntry.id };
  }

  let candidateJson: unknown;
  try {
    candidateJson = JSON.parse(content);
  } catch {
    return { outcome: 'CALL_FAILED', reason: 'CONTENT_NOT_JSON', budgetStatus: 'RESERVED_UNRECONCILED', ledgerEntryId: ledgerEntry.id };
  }

  const validated = bilanAiProposalSchema.safeParse(candidateJson);
  if (!validated.success) {
    return { outcome: 'CALL_FAILED', reason: 'SCHEMA_VALIDATION_FAILED', budgetStatus: 'RESERVED_UNRECONCILED', ledgerEntryId: ledgerEntry.id };
  }

  return {
    outcome: 'GENERATED',
    proposal: validated.data,
    provenance: {
      ledgerEntryId: ledgerEntry.id,
      model: input.model,
      providerName: preflight.compliantEndpoints[0]?.providerName ?? 'unknown',
      promptVersion: input.promptVersion,
      schemaVersion: input.schemaVersion,
      attempt: ledgerEntry.attempt,
      reservedCostUsd: preflight.worstCaseCostUsd,
      actualCostUsd,
      providerRequestId,
      promptTokens,
      completionTokens,
      generatedAt: new Date().toISOString(),
    },
  };
}
