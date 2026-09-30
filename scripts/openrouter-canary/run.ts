/**
 * Small OpenRouter canary: four sequential calls on openai/gpt-5-mini with
 * synthetic inputs only (short text, validated JSON, an image carrying a known
 * text, a short stream). It proves the targeted transports work; it does not
 * prove pedagogical quality or production availability.
 *
 * It is prepared, not armed: running it needs a qualification key injected as
 * OPENROUTER_API_KEY AND an explicit operator approval naming the key alias
 * and the spend cap. One key only, no retries, no key switching.
 *
 *   OPENROUTER_CANARY_APPROVAL='alias=<alias>;cap-usd=1' \
 *   OPENROUTER_API_KEY=... npx tsx scripts/openrouter-canary/run.ts
 */
import { OpenRouterClient } from '../../lib/npc/ai/openrouter-client';
import { renderTextPng } from './png';

export const CANARY_MODEL = 'openai/gpt-5-mini';
export const CANARY_MAX_CAP_USD = 1;
export const CANARY_CALL_COUNT = 4;
const OUTPUT_TOKEN_CEILING = 1_200;
const OCR_OUTPUT_TOKEN_CEILING = 4_000; // fixed by the NPC OCR path
const IMAGE_INPUT_TOKEN_CEILING = 2_000;
const IMAGE_TEXT = 'NEXUS 4271';

export interface Pricing {
  readonly promptUsdPerToken: number;
  readonly completionUsdPerToken: number;
}

export interface CanaryStep {
  readonly name: 'text' | 'json' | 'image' | 'stream';
  readonly ok: boolean;
  readonly detail: string;
  readonly tokens: number;
  readonly boundedCostUsd: number;
}

export interface CanaryReport {
  readonly model: string;
  readonly alias: string;
  readonly capUsd: number;
  readonly steps: readonly CanaryStep[];
  readonly boundedSpendUsd: number;
  readonly completed: boolean;
}

export interface CanaryDeps {
  readonly client: OpenRouterClient;
  readonly pricing: Pricing;
  readonly stream: (prompt: string) => AsyncIterable<string>;
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

/** Upper bound of one call's cost: generous input estimate plus the full output ceiling. */
export function worstCaseUsd(pricing: Pricing, inputChars: number, outputTokens: number, extraInputTokens = 0): number {
  const inputTokens = Math.ceil(inputChars / 2) + extraInputTokens + 200;
  return inputTokens * pricing.promptUsdPerToken + outputTokens * pricing.completionUsdPerToken;
}

function actualBoundUsd(pricing: Pricing, prompt: number, completion: number): number {
  return prompt * pricing.promptUsdPerToken + completion * pricing.completionUsdPerToken;
}

export async function runCanary(
  deps: CanaryDeps,
  approval: { alias: string; capUsd: number },
): Promise<CanaryReport> {
  const { client, pricing } = deps;
  const plannedWorstCase =
    worstCaseUsd(pricing, 200, OUTPUT_TOKEN_CEILING) * 3 // text, json, stream
    + worstCaseUsd(pricing, 400, OCR_OUTPUT_TOKEN_CEILING, IMAGE_INPUT_TOKEN_CEILING);
  if (!(plannedWorstCase <= approval.capUsd)) throw new Error('CANARY_WORST_CASE_ABOVE_CAP');

  const steps: CanaryStep[] = [];
  let spent = 0;
  const record = (step: CanaryStep): boolean => {
    steps.push(step);
    spent += step.boundedCostUsd;
    return step.ok && spent <= approval.capUsd;
  };
  const report = (completed: boolean): CanaryReport => ({
    model: CANARY_MODEL,
    alias: approval.alias,
    capUsd: approval.capUsd,
    steps,
    boundedSpendUsd: Number(spent.toFixed(6)),
    completed,
  });

  // 1. short text
  const text = await client.complete({
    messages: [{ role: 'user', content: 'Réponds exactement par le mot: CANARY-OK' }],
    max_tokens: OUTPUT_TOKEN_CEILING,
  });
  if (!record(text.success
    ? { name: 'text', ok: text.content.includes('CANARY-OK'), detail: 'content checked', tokens: text.tokens.total,
        boundedCostUsd: actualBoundUsd(pricing, text.tokens.prompt, text.tokens.completion) }
    : { name: 'text', ok: false, detail: text.error, tokens: 0, boundedCostUsd: 0 })) return report(false);

  // 2. structured JSON, validated
  const json = await client.completeJson<{ status: string; answer: number }>(
    [{ role: 'user', content: 'Retourne status="ok" et answer=42.' }],
    '{ "status": string, "answer": number }',
    { max_tokens: OUTPUT_TOKEN_CEILING },
  );
  if (!record(json.success
    ? { name: 'json', ok: json.data.status === 'ok' && json.data.answer === 42, detail: 'schema checked',
        tokens: json.tokens.total, boundedCostUsd: actualBoundUsd(pricing, json.tokens.prompt, json.tokens.completion) }
    : { name: 'json', ok: false, detail: json.error, tokens: 0, boundedCostUsd: 0 })) return report(false);

  // 3. synthetic image carrying a known text (NPC OCR path)
  const png = renderTextPng(IMAGE_TEXT).toString('base64');
  const ocr = await client.visionOcr(png, 'image/png');
  if (!record(ocr.success
    ? { name: 'image', ok: ocr.text.replace(/\s+/g, '').includes(IMAGE_TEXT.replace(/\s+/g, '')),
        detail: 'text compared', tokens: ocr.tokens.total,
        boundedCostUsd: actualBoundUsd(pricing, ocr.tokens.prompt, ocr.tokens.completion) }
    : { name: 'image', ok: false, detail: ocr.error, tokens: 0, boundedCostUsd: 0 })) return report(false);

  // 4. short stream (ARIA path); usage is not reported on the stream, so charge the full ceiling.
  let received = '';
  let chunks = 0;
  let streamError = '';
  try {
    for await (const piece of deps.stream('Réponds exactement par le mot: STREAM-OK')) {
      received += piece;
      chunks += 1;
    }
  } catch (error) {
    streamError = error instanceof Error ? error.name : 'stream error';
  }
  const streamCost = worstCaseUsd(pricing, 200, OUTPUT_TOKEN_CEILING);
  const streamOk = record({
    name: 'stream',
    ok: !streamError && chunks > 0 && received.includes('STREAM-OK'),
    detail: streamError || `${chunks} chunk(s)`,
    tokens: 0,
    boundedCostUsd: streamCost,
  });
  return report(streamOk);
}

async function fetchPricing(): Promise<Pricing> {
  const response = await fetch('https://openrouter.ai/api/v1/models');
  if (!response.ok) throw new Error('CANARY_PRICING_UNAVAILABLE');
  const payload = (await response.json()) as { data?: Array<{ id: string; pricing?: { prompt?: string; completion?: string } }> };
  const row = payload.data?.find((model) => model.id === CANARY_MODEL);
  const prompt = Number(row?.pricing?.prompt);
  const completion = Number(row?.pricing?.completion);
  if (!Number.isFinite(prompt) || !Number.isFinite(completion)) throw new Error('CANARY_PRICING_UNAVAILABLE');
  return { promptUsdPerToken: prompt, completionUsdPerToken: completion };
}

async function main(): Promise<void> {
  const approval = parseApproval(process.env.OPENROUTER_CANARY_APPROVAL);
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY_REQUIRED');
  const pricing = await fetchPricing(); // fail closed: no pricing, no call

  Object.assign(process.env, {
    ARIA_MODEL_PROVIDER: 'OPENROUTER_HOSTED',
    ARIA_MODEL: CANARY_MODEL,
    ARIA_MODEL_BASE_URL: 'https://openrouter.ai/api/v1',
    ARIA_MODEL_CAPABILITY_PROFILE: 'TEXT_STANDARD',
    ARIA_MODEL_API_KEY: apiKey,
  });
  const { streamChatCompletion } = await import('../../lib/aria/gateway');
  const client = new OpenRouterClient({ apiKey });
  const report = await runCanary(
    {
      client,
      pricing,
      stream: (prompt) => streamChatCompletion([{ role: 'user', content: prompt }], { maxTokens: OUTPUT_TOKEN_CEILING }),
    },
    approval,
  );
  // The report carries no key, header or response body.
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.completed ? 0 : 1;
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'CANARY_FAILED');
    process.exitCode = 1;
  });
}
