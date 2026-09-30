/**
 * Small OpenRouter canary: at most four generation requests on openai/gpt-5-mini
 * with synthetic inputs only (short text, validated JSON, an image carrying a
 * known text, a short stream). It proves the targeted transports work; it does
 * not prove pedagogical quality or production availability.
 *
 * Prepared, not armed: running it needs one qualification key injected as
 * OPENROUTER_API_KEY AND an explicit approval naming the key alias and the cap.
 * One key, no retries (the SDK is pinned to maxRetries=0), no fallback model or
 * key, every request inspected by the transport guard, stop at the first failure.
 *
 *   OPENROUTER_CANARY_APPROVAL='alias=qualification-nexus-dev;cap-usd=1' \
 *   OPENROUTER_API_KEY=... npx tsx scripts/openrouter-canary/run.ts
 */
import { OpenRouterClient } from '../../lib/npc/ai/openrouter-client';
import { createGenerationGuard, OPENROUTER_API_PREFIX, type GenerationGuard } from './guard';
import { renderTextPng } from './png';

export const CANARY_MODEL = 'openai/gpt-5-mini';
export const CANARY_MAX_CAP_USD = 1;
export const CANARY_MAX_GENERATIONS = 4;
export const CATALOG_TIMEOUT_MS = 10_000;
const STREAM_TIMEOUT_MS = 60_000;
const STREAM_FIRST_TOKEN_TIMEOUT_MS = 30_000;
const IMAGE_TEXT = 'NEXUS 4271';

/**
 * Fixed per-request envelopes. They are deliberately generous allowances for
 * the fixed synthetic prompts, NOT a tokenizer bound. `maxCompletionTokens` is
 * the provider-side ceiling and, for this reasoning model, it includes the
 * reasoning tokens: a step can therefore fail with an empty answer rather than
 * overspend.
 */
export const ENVELOPES = Object.freeze({
  text: { inputTokens: 500, maxCompletionTokens: 1_200, images: 0 },
  json: { inputTokens: 900, maxCompletionTokens: 1_200, images: 0 },
  image: { inputTokens: 3_000, maxCompletionTokens: 4_000, images: 1 }, // 4 000 is fixed by the NPC OCR path
  stream: { inputTokens: 500, maxCompletionTokens: 1_200, images: 0 },
});
type StepName = keyof typeof ENVELOPES;
const STEP_ORDER: readonly StepName[] = ['text', 'json', 'image', 'stream'];

export interface Pricing {
  readonly promptUsdPerToken: number;
  readonly completionUsdPerToken: number;
  readonly reasoningUsdPerToken: number;
  readonly requestUsd: number;
  readonly imageUsd: number;
}

export interface CatalogMetadata {
  readonly pricing: Pricing;
  readonly inputModalities: readonly string[];
}

export type CostSource = 'reported' | 'tokens_x_tariff' | 'unknown';

export interface CanaryStep {
  readonly name: StepName;
  readonly ok: boolean;
  readonly detail: string;
  readonly generationId: string | null;
  readonly tokens: { prompt: number; completion: number; total: number } | null;
  /** Upper envelope reserved for this request before it is sent. */
  readonly reservedUsd: number;
  /** Consumption: reported by OpenRouter, computed from tokens, or unknown (never 0 by default). */
  readonly observedUsd: number | null;
  readonly observedSource: CostSource;
}

export interface CanaryReport {
  readonly model: string;
  readonly alias: string;
  readonly capUsd: number;
  readonly preEstimateEnvelopeUsd: number;
  readonly steps: readonly CanaryStep[];
  /** Sum of consumption actually known (reported or computed). Unknown steps are NOT included. */
  readonly observedKnownUsd: number;
  readonly unknownCostSteps: readonly StepName[];
  /** Budget check basis: observed where known, reserved envelope where unknown. */
  readonly boundUsd: number;
  readonly generationRequests: number;
  readonly catalogRequests: number;
  readonly excludedInheritedVariables: readonly string[];
  readonly completed: boolean;
}

export interface CanaryDeps {
  readonly client: OpenRouterClient;
  readonly catalog: CatalogMetadata;
  readonly stream: (prompt: string) => AsyncIterable<string>;
  readonly guard: GenerationGuard;
  readonly excludedInheritedVariables?: readonly string[];
}

export function parseApproval(value: string | undefined): { alias: string; capUsd: number } {
  if (!value) throw new Error('CANARY_APPROVAL_REQUIRED');
  const fields = Object.fromEntries(
    value.split(';').map((part) => part.split('=').map((piece) => piece.trim()) as [string, string]),
  );
  const capUsd = Number(fields['cap-usd']);
  if (!fields.alias || !Number.isFinite(capUsd) || capUsd <= 0) throw new Error('CANARY_APPROVAL_INVALID');
  if (capUsd > CANARY_MAX_CAP_USD) throw new Error('CANARY_CAP_ABOVE_PROPOSED_CEILING');
  return { alias: fields.alias, capUsd };
}

/** Reserved envelope for one request: fixed allowances priced at the consulted tariffs. */
export function reservedUsd(pricing: Pricing, step: StepName): number {
  const envelope = ENVELOPES[step];
  const outputRate = Math.max(pricing.completionUsdPerToken, pricing.reasoningUsdPerToken);
  return envelope.inputTokens * pricing.promptUsdPerToken
    + envelope.maxCompletionTokens * outputRate
    + pricing.requestUsd
    + envelope.images * pricing.imageUsd;
}

export function preEstimateEnvelopeUsd(pricing: Pricing): number {
  return STEP_ORDER.reduce((total, step) => total + reservedUsd(pricing, step), 0);
}

/**
 * Environment for the ARIA stream step: every inherited ARIA_MODEL* and OPENAI_*
 * variable (fallback model, second key, alternative base URL...) is excluded and
 * only the canary's own primary candidate is defined. Values are never reported,
 * only the excluded names.
 */
export function buildCanaryAriaEnvironment(
  parent: NodeJS.ProcessEnv,
  apiKey: string,
): { readonly environment: Readonly<Record<string, string>>; readonly excluded: readonly string[] } {
  const excluded = Object.keys(parent).filter((name) => /^(ARIA_MODEL|OPENAI_)/.test(name)).sort();
  return {
    excluded,
    environment: Object.freeze({
      ARIA_MODEL_PROVIDER: 'OPENROUTER_HOSTED',
      ARIA_MODEL: CANARY_MODEL,
      ARIA_MODEL_BASE_URL: 'https://openrouter.ai/api/v1',
      ARIA_MODEL_CAPABILITY_PROFILE: 'TEXT_STANDARD',
      ARIA_MODEL_API_KEY: apiKey,
      ARIA_MODEL_TIMEOUT_MS: String(STREAM_TIMEOUT_MS),
      ARIA_MODEL_FIRST_TOKEN_TIMEOUT_MS: String(STREAM_FIRST_TOKEN_TIMEOUT_MS),
    }),
  };
}

/** Replaces the inherited model variables of `target` by the canary's own set. */
export function applyCanaryAriaEnvironment(
  target: NodeJS.ProcessEnv,
  built: { readonly environment: Readonly<Record<string, string>>; readonly excluded: readonly string[] },
): void {
  for (const name of built.excluded) delete target[name];
  Object.assign(target, built.environment);
}

function observed(
  pricing: Pricing,
  tokens: { prompt: number; completion: number; total: number } | null,
  reported: number | null,
): { usd: number | null; source: CostSource } {
  if (typeof reported === 'number') return { usd: reported, source: 'reported' };
  if (tokens && tokens.total > 0) {
    const usd = tokens.prompt * pricing.promptUsdPerToken
      + tokens.completion * Math.max(pricing.completionUsdPerToken, pricing.reasoningUsdPerToken);
    return { usd, source: 'tokens_x_tariff' };
  }
  return { usd: null, source: 'unknown' };
}

export async function runCanary(
  deps: CanaryDeps,
  approval: { alias: string; capUsd: number },
): Promise<CanaryReport> {
  const { client, catalog, guard } = deps;
  const pricing = catalog.pricing;
  if (!catalog.inputModalities.includes('image')) throw new Error('CANARY_MODEL_WITHOUT_IMAGE_INPUT');
  const preEstimate = preEstimateEnvelopeUsd(pricing);
  if (!(preEstimate <= approval.capUsd)) throw new Error('CANARY_WORST_CASE_ABOVE_CAP');

  const steps: CanaryStep[] = [];
  const boundOf = () => steps.reduce((total, step) => total + (step.observedUsd ?? step.reservedUsd), 0);
  const report = (completed: boolean): CanaryReport => ({
    model: CANARY_MODEL,
    alias: approval.alias,
    capUsd: approval.capUsd,
    preEstimateEnvelopeUsd: Number(preEstimate.toFixed(6)),
    steps,
    observedKnownUsd: Number(steps.reduce((total, step) => total + (step.observedUsd ?? 0), 0).toFixed(6)),
    unknownCostSteps: steps.filter((step) => step.observedUsd === null).map((step) => step.name),
    boundUsd: Number(boundOf().toFixed(6)),
    generationRequests: guard.generationCount(),
    catalogRequests: guard.catalogCount(),
    excludedInheritedVariables: deps.excludedInheritedVariables ?? [],
    completed,
  });
  const push = (step: CanaryStep): boolean => {
    steps.push(step);
    return step.ok && boundOf() <= approval.capUsd;
  };
  const failed = (name: StepName, detail: string): CanaryStep => ({
    name, ok: false, detail, generationId: null, tokens: null,
    reservedUsd: reservedUsd(pricing, name), observedUsd: null, observedSource: 'unknown',
  });
  const succeeded = (
    name: StepName, ok: boolean, detail: string,
    tokens: { prompt: number; completion: number; total: number }, requestId: string | null, costUsd: number | null,
  ): CanaryStep => {
    const cost = observed(pricing, tokens, costUsd);
    return {
      name, ok, detail, generationId: requestId, tokens,
      reservedUsd: reservedUsd(pricing, name), observedUsd: cost.usd, observedSource: cost.source,
    };
  };

  const text = await client.complete({
    messages: [{ role: 'user', content: 'Réponds exactement par le mot: CANARY-OK' }],
    max_tokens: ENVELOPES.text.maxCompletionTokens,
  });
  if (!push(text.success
    ? succeeded('text', text.content.includes('CANARY-OK'), 'content checked', text.tokens, text.requestId, text.costUsd)
    : failed('text', text.error))) return report(false);

  const json = await client.completeJson<{ status: string; answer: number }>(
    [{ role: 'user', content: 'Retourne status="ok" et answer=42.' }],
    '{ "status": string, "answer": number }',
    { max_tokens: ENVELOPES.json.maxCompletionTokens },
  );
  if (!push(json.success
    ? succeeded('json', json.data.status === 'ok' && json.data.answer === 42, 'schema checked', json.tokens, json.requestId, json.costUsd)
    : failed('json', json.error))) return report(false);

  const ocr = await client.visionOcr(renderTextPng(IMAGE_TEXT).toString('base64'), 'image/png');
  if (!push(ocr.success
    ? succeeded('image', ocr.text.replace(/\s+/g, '').includes(IMAGE_TEXT.replace(/\s+/g, '')), 'text compared', ocr.tokens, ocr.requestId, ocr.costUsd)
    : failed('image', ocr.error))) return report(false);

  // The abstract stream hides usage and generation metadata: its consumption is
  // reported as unknown, never as a measured value; the reserved envelope is what counts.
  let received = '';
  let chunks = 0;
  let streamError = '';
  try {
    for await (const piece of deps.stream('Réponds exactement par le mot: STREAM-OK')) {
      received += piece;
      chunks += 1;
    }
  } catch (error) {
    streamError = error instanceof Error ? error.message || error.name : 'stream error';
  }
  const streamStep: CanaryStep = {
    name: 'stream',
    ok: !streamError && chunks > 0 && received.includes('STREAM-OK'),
    detail: streamError || `${chunks} chunk(s)`,
    generationId: null,
    tokens: null,
    reservedUsd: reservedUsd(pricing, 'stream'),
    observedUsd: null,
    observedSource: 'unknown',
  };
  return report(push(streamStep));
}

export async function fetchCatalogMetadata(guardedFetch: typeof fetch): Promise<CatalogMetadata> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CATALOG_TIMEOUT_MS);
  try {
    const response = await guardedFetch(`${OPENROUTER_API_PREFIX}models`, { signal: controller.signal });
    if (!response.ok) throw new Error('CANARY_PRICING_UNAVAILABLE');
    const payload = (await response.json()) as {
      data?: Array<{
        id: string;
        architecture?: { input_modalities?: string[] };
        pricing?: Record<string, string | undefined>;
      }>;
    };
    const row = payload.data?.find((model) => model.id === CANARY_MODEL);
    const number = (value: string | undefined): number => (value === undefined || value === '' ? 0 : Number(value));
    const prompt = number(row?.pricing?.prompt);
    const completion = number(row?.pricing?.completion);
    if (!row || !Number.isFinite(prompt) || !Number.isFinite(completion) || prompt <= 0 || completion <= 0) {
      throw new Error('CANARY_PRICING_UNAVAILABLE');
    }
    return {
      pricing: {
        promptUsdPerToken: prompt,
        completionUsdPerToken: completion,
        reasoningUsdPerToken: number(row.pricing?.internal_reasoning),
        requestUsd: number(row.pricing?.request),
        imageUsd: number(row.pricing?.image),
      },
      inputModalities: row.architecture?.input_modalities ?? [],
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('CANARY_')) throw error;
    throw new Error('CANARY_PRICING_UNAVAILABLE');
  } finally {
    clearTimeout(timer);
  }
}

async function main(): Promise<void> {
  const approval = parseApproval(process.env.OPENROUTER_CANARY_APPROVAL);
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY_REQUIRED');

  const guard = createGenerationGuard(fetch, { model: CANARY_MODEL, maxGenerations: CANARY_MAX_GENERATIONS });
  const catalog = await fetchCatalogMetadata(guard.fetch); // fail closed: no tariffs, no generation

  const built = buildCanaryAriaEnvironment(process.env, apiKey);
  applyCanaryAriaEnvironment(process.env, built);
  const { streamChatCompletion } = await import('../../lib/aria/gateway');
  const client = new OpenRouterClient({ apiKey, fetchImpl: guard.fetch, includeUsageCost: true });
  const report = await runCanary(
    {
      client,
      catalog,
      guard,
      excludedInheritedVariables: built.excluded,
      stream: (prompt) => streamChatCompletion([{ role: 'user', content: prompt }], {
        maxTokens: ENVELOPES.stream.maxCompletionTokens,
        providerClient: { maxRetries: 0, fetch: guard.fetch },
      }),
    },
    approval,
  );
  // The report carries no key, header, prompt or response body.
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.completed ? 0 : 1;
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'CANARY_FAILED');
    process.exitCode = 1;
  });
}
