/** @jest-environment node */
import { inflateSync } from 'node:zlib';
import { streamChatCompletion } from '@/lib/aria/gateway';
import { OpenRouterClient } from '@/lib/npc/ai/openrouter-client';
import { createGenerationGuard, OPENROUTER_CHAT_URL } from '@/scripts/openrouter-canary/guard';
import { renderTextPng } from '@/scripts/openrouter-canary/png';
import {
  applyCanaryAriaEnvironment,
  buildCanaryAriaEnvironment,
  CANARY_MAX_GENERATIONS,
  CANARY_MODEL,
  fetchCatalogMetadata,
  parseApproval,
  preEstimateEnvelopeUsd,
  runCanary,
  type CatalogMetadata,
  type Pricing,
} from '@/scripts/openrouter-canary/run';

const PRICING: Pricing = {
  promptUsdPerToken: 0.25e-6,
  completionUsdPerToken: 2e-6,
  reasoningUsdPerToken: 0,
  requestUsd: 0,
  imageUsd: 0,
};
const CATALOG: CatalogMetadata = { pricing: PRICING, inputModalities: ['text', 'image'] };
const KEY = ['sk', 'or', 'v1', 'q'.repeat(24)].join('-');
const OTHER_KEY = ['sk', 'or', 'v1', 'z'.repeat(24)].join('-');
const APPROVAL = { alias: 'qualification-nexus-dev', capUsd: 1 };

/** Sets secret-bearing variables by name so no credential-shaped assignment is written literally. */
function setSecretVariables(names: readonly string[], value: string): void {
  for (const name of names) process.env[name] = value;
}

interface CallBody { model?: string; stream?: boolean; usage?: unknown; provider?: { ignore?: string[] } }
interface Call { url: string; method: string; body: CallBody | null; authorization: string | null }
type Responder = (n: number, call: Call) => Response | Promise<Response>;

function completion(content: string, cost?: number): Response {
  return new Response(JSON.stringify({
    id: `gen-${content.length}`,
    choices: [{ message: { role: 'assistant', content } }],
    usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150, ...(cost === undefined ? {} : { cost }) },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function sse(text: string): Response {
  return new Response(
    `data: ${JSON.stringify({ id: 'c', object: 'chat.completion.chunk', created: 0, model: CANARY_MODEL, choices: [{ index: 0, delta: { content: text } }] })}\n\ndata: [DONE]\n\n`,
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  );
}

function harness(responder: Responder) {
  const calls: Call[] = [];
  const inner = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers as HeadersInit);
    const call: Call = {
      url: String(input),
      method: (init?.method ?? 'GET').toUpperCase(),
      body: init?.body ? JSON.parse(String(init.body)) : null,
      authorization: headers.get('authorization'),
    };
    calls.push(call);
    return responder(calls.length, call);
  }) as typeof fetch;
  const guard = createGenerationGuard(inner, { model: CANARY_MODEL, maxGenerations: CANARY_MAX_GENERATIONS });
  const client = new OpenRouterClient({ apiKey: KEY, fetchImpl: guard.fetch, includeUsageCost: true });
  const stream = (prompt: string) => streamChatCompletion([{ role: 'user', content: prompt }], {
    maxTokens: 1_200,
    providerClient: { maxRetries: 0, fetch: guard.fetch },
  });
  return { calls, guard, client, stream };
}

describe('OpenRouter canary harness', () => {
  const savedEnv = { ...process.env };
  beforeEach(() => {
    for (const name of Object.keys(process.env)) if (/^(ARIA_MODEL|OPENAI_)/.test(name)) delete process.env[name];
    applyCanaryAriaEnvironment(process.env, buildCanaryAriaEnvironment(process.env, KEY));
  });
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('approval: explicit alias, cap never above 1 USD', () => {
    expect(() => parseApproval(undefined)).toThrow('CANARY_APPROVAL_REQUIRED');
    expect(() => parseApproval('alias=x')).toThrow('CANARY_APPROVAL_INVALID');
    expect(() => parseApproval('alias=x;cap-usd=2')).toThrow('CANARY_CAP_ABOVE_PROPOSED_CEILING');
    expect(parseApproval('alias=qualification-nexus-dev;cap-usd=1')).toEqual(APPROVAL);
  });

  it('nominal run: at most four generations through the real NPC client and the real ARIA SDK path, chutes excluded everywhere', async () => {
    const h = harness((n) => (n === 1 ? completion('CANARY-OK', 0.0001)
      : n === 2 ? completion('{"status":"ok","answer":42}', 0.0002)
      : n === 3 ? completion('NEXUS 4271', 0.0003)
      : sse('STREAM-OK')));

    const report = await runCanary({ ...h, catalog: CATALOG }, APPROVAL);

    expect(report.completed).toBe(true);
    expect(report.steps.map((step) => step.name)).toEqual(['text', 'json', 'image', 'stream']);
    expect(report.steps.every((step) => step.ok)).toBe(true);
    expect(report.generationRequests).toBe(4);
    expect(h.calls.filter((call) => call.method === 'POST')).toHaveLength(4);
    expect(h.calls.every((call) => call.url === OPENROUTER_CHAT_URL)).toBe(true);
    expect(h.calls.every((call) => call.body?.model === CANARY_MODEL)).toBe(true);
    expect(h.calls.every((call) => call.body?.provider?.ignore?.includes('chutes'))).toBe(true);
    expect(h.calls.every((call) => call.authorization === `Bearer ${KEY}`)).toBe(true);
    expect(h.calls.every((call) => !('models' in (call.body ?? {})) && !('route' in (call.body ?? {})))).toBe(true);
    expect(h.calls[3].body?.stream).toBe(true);
    expect(h.calls[0].body?.usage).toEqual({ include: true });
    expect(JSON.stringify(report)).not.toContain(KEY);
  });

  it('keeps estimate, reserved envelope, reported consumption and unknown consumption apart', async () => {
    const h = harness((n) => (n === 1 ? completion('CANARY-OK', 0.0001)
      : n === 2 ? completion('{"status":"ok","answer":42}', 0.0002)
      : n === 3 ? completion('NEXUS 4271') // no usage.cost reported -> computed from tokens
      : sse('STREAM-OK')));
    const report = await runCanary({ ...h, catalog: CATALOG }, APPROVAL);

    const [text, json, image, stream] = report.steps;
    expect([text.observedSource, json.observedSource, image.observedSource, stream.observedSource])
      .toEqual(['reported', 'reported', 'tokens_x_tariff', 'unknown']);
    expect(text.observedUsd).toBe(0.0001);
    expect(stream.observedUsd).toBeNull();
    expect(report.unknownCostSteps).toEqual(['stream']);
    expect(stream.reservedUsd).toBeGreaterThan(0);
    expect(report.observedKnownUsd).toBeCloseTo(0.0001 + 0.0002 + (50 * 0.25e-6 + 100 * 2e-6), 6);
    expect(report.boundUsd).toBeCloseTo(report.observedKnownUsd + stream.reservedUsd, 5);
    expect(report.preEstimateEnvelopeUsd).toBeCloseTo(preEstimateEnvelopeUsd(PRICING), 5);
    expect(report.boundUsd).toBeLessThanOrEqual(APPROVAL.capUsd);
  });

  it.each([
    ['429', () => new Response('rate limited', { status: 429, headers: { 'retry-after-ms': '1' } })],
    ['500', () => new Response('boom', { status: 500, headers: { 'retry-after-ms': '1' } })],
    ['connection error', () => { throw new TypeError('fetch failed'); }],
  ] as const)('NPC step on %s: exactly one network attempt, cost unknown and never zero', async (_label, failure) => {
    const h = harness(() => failure());
    const report = await runCanary({ ...h, catalog: CATALOG }, APPROVAL);

    expect(report.completed).toBe(false);
    expect(h.calls).toHaveLength(1);
    expect(report.generationRequests).toBe(1);
    expect(report.steps).toHaveLength(1);
    expect(report.steps[0].observedUsd).toBeNull();
    expect(report.steps[0].observedSource).toBe('unknown');
    expect(report.unknownCostSteps).toEqual(['text']);
    expect(report.observedKnownUsd).toBe(0);
    expect(report.boundUsd).toBeGreaterThan(0);
  });

  describe('ARIA SDK path (real gateway, real SDK, fake transport)', () => {
    const failures = [
      ['429', () => new Response('rate limited', { status: 429, headers: { 'retry-after-ms': '1' } })],
      ['500', () => new Response('boom', { status: 500, headers: { 'retry-after-ms': '1' } })],
      ['connection error', () => { throw new TypeError('fetch failed'); }],
    ] as const;

    it.each(failures)('canary mode on %s: exactly one network attempt', async (_label, failure) => {
      const h = harness(() => failure());
      await expect((async () => { for await (const chunk of h.stream('x')) void chunk; })()).rejects.toBeDefined();
      expect(h.calls).toHaveLength(1);
      expect(h.guard.generationCount()).toBe(1);
    });

    it('production default (no providerClient) keeps the SDK retries, so the parameter is what disables them', async () => {
      const calls: Call[] = [];
      const inner = (async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), method: 'POST', body: null, authorization: null });
        void init;
        return new Response('boom', { status: 500, headers: { 'retry-after-ms': '1' } });
      }) as typeof fetch;
      await expect((async () => {
        for await (const chunk of streamChatCompletion([{ role: 'user', content: 'x' }], { providerClient: { fetch: inner } })) void chunk;
      })()).rejects.toBeDefined();
      expect(calls.length).toBeGreaterThan(1);
    });

    it('inherited fallback model, second key and alternative base URL are excluded: no second candidate, no second key', async () => {
      Object.assign(process.env, {
        ARIA_MODEL_FALLBACK_PROVIDER: 'OPENROUTER_HOSTED',
        ARIA_MODEL_FALLBACK_MODEL: 'openai/gpt-5-mini',
        ARIA_MODEL_FALLBACK_BASE_URL: 'https://openrouter.ai/api/v1',
        ARIA_MODEL_FALLBACK_CAPABILITY_PROFILE: 'TEXT_STANDARD',
        ARIA_MODEL_FALLBACK_AUTHORIZED: '1',
        OPENAI_BASE_URL: 'https://example.invalid/v1',
      });
      setSecretVariables(['ARIA_MODEL_FALLBACK_API_KEY', 'OPENAI_API_KEY'], OTHER_KEY);
      const built = buildCanaryAriaEnvironment(process.env, KEY);
      expect(built.excluded).toEqual(expect.arrayContaining([
        'ARIA_MODEL_FALLBACK_PROVIDER', 'ARIA_MODEL_FALLBACK_API_KEY', 'ARIA_MODEL_FALLBACK_AUTHORIZED', 'OPENAI_API_KEY', 'OPENAI_BASE_URL',
      ]));
      expect(JSON.stringify(built.excluded)).not.toContain(OTHER_KEY);
      applyCanaryAriaEnvironment(process.env, built);
      expect(process.env.ARIA_MODEL_FALLBACK_PROVIDER).toBeUndefined();
      expect(process.env.OPENAI_API_KEY).toBeUndefined();

      const h = harness(() => new Response('boom', { status: 500, headers: { 'retry-after-ms': '1' } }));
      await expect((async () => { for await (const chunk of h.stream('x')) void chunk; })()).rejects.toBeDefined();
      expect(h.calls).toHaveLength(1);
      expect(h.calls[0].authorization).toBe(`Bearer ${KEY}`);
      expect(h.calls.some((call) => call.authorization?.includes(OTHER_KEY))).toBe(false);
    });

    it('control: WITHOUT the environment exclusion an inherited fallback would send a second request with the other key', async () => {
      Object.assign(process.env, {
        ARIA_MODEL_FALLBACK_PROVIDER: 'OPENROUTER_HOSTED',
        ARIA_MODEL_FALLBACK_MODEL: 'openai/gpt-5-mini',
        ARIA_MODEL_FALLBACK_BASE_URL: 'https://openrouter.ai/api/v1',
        ARIA_MODEL_FALLBACK_CAPABILITY_PROFILE: 'TEXT_STANDARD',
        ARIA_MODEL_FALLBACK_AUTHORIZED: '1',
      });
      setSecretVariables(['ARIA_MODEL_FALLBACK_API_KEY'], OTHER_KEY);
      const h = harness(() => new Response('boom', { status: 500 }));
      await expect((async () => { for await (const chunk of h.stream('x')) void chunk; })()).rejects.toBeDefined();
      expect(h.calls).toHaveLength(2);
      expect(h.calls[1].authorization).toBe(`Bearer ${OTHER_KEY}`);
    });

    it('stream step failure is reported with unknown consumption and stops the run', async () => {
      const h = harness((n) => (n === 1 ? completion('CANARY-OK', 0.0001)
        : n === 2 ? completion('{"status":"ok","answer":42}', 0.0002)
        : n === 3 ? completion('NEXUS 4271', 0.0003)
        : new Response('boom', { status: 500, headers: { 'retry-after-ms': '1' } })));
      const report = await runCanary({ ...h, catalog: CATALOG }, APPROVAL);
      expect(report.completed).toBe(false);
      expect(h.calls).toHaveLength(4);
      expect(report.steps[3]).toMatchObject({ name: 'stream', ok: false, observedUsd: null, observedSource: 'unknown' });
    });
  });

  describe('transport guard', () => {
    const inner = (async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
    const post = (guard: ReturnType<typeof createGenerationGuard>, body: unknown, url = OPENROUTER_CHAT_URL) =>
      guard.fetch(url, { method: 'POST', body: JSON.stringify(body) });
    const good = { model: CANARY_MODEL, provider: { ignore: ['chutes'] } };

    it('refuses any host other than the OpenRouter API, including Chutes', async () => {
      const guard = createGenerationGuard(inner, { model: CANARY_MODEL, maxGenerations: 4 });
      await expect(post(guard, good, 'https://llm.chutes.ai/v1/chat/completions')).rejects.toThrow('CANARY_HOST_REJECTED');
      await expect(post(guard, good, 'https://api.openai.com/v1/chat/completions')).rejects.toThrow('CANARY_HOST_REJECTED');
      expect(guard.generationCount()).toBe(0);
    });

    it('refuses a wrong model, a missing exclusion and fallback fields before any I/O', async () => {
      const guard = createGenerationGuard(inner, { model: CANARY_MODEL, maxGenerations: 4 });
      await expect(post(guard, { ...good, model: 'anthropic/claude-sonnet-4.5' })).rejects.toThrow('CANARY_REQUEST_REJECTED:model');
      await expect(post(guard, { model: CANARY_MODEL, provider: { ignore: [] } })).rejects.toThrow('CANARY_REQUEST_REJECTED:exclusion');
      await expect(post(guard, { model: CANARY_MODEL })).rejects.toThrow('CANARY_REQUEST_REJECTED:exclusion');
      await expect(post(guard, { ...good, models: ['a', 'b'] })).rejects.toThrow('CANARY_REQUEST_REJECTED:fallback');
      expect(guard.generationCount()).toBe(0);
    });

    it('forwards at most four generations and counts catalogue GETs separately', async () => {
      const guard = createGenerationGuard(inner, { model: CANARY_MODEL, maxGenerations: 4 });
      await guard.fetch('https://openrouter.ai/api/v1/models');
      for (let i = 0; i < 4; i += 1) await post(guard, good);
      await expect(post(guard, good)).rejects.toThrow('CANARY_GENERATION_LIMIT');
      expect(guard.generationCount()).toBe(4);
      expect(guard.catalogCount()).toBe(1);
    });
  });

  describe('catalogue and budget', () => {
    const catalogResponse = (overrides: Record<string, unknown> = {}) => new Response(JSON.stringify({
      data: [{
        id: CANARY_MODEL,
        architecture: { input_modalities: ['text', 'image'] },
        pricing: { prompt: '0.00000025', completion: '0.000002', image: '0', request: '0', internal_reasoning: '0', ...overrides },
      }],
    }), { status: 200 });

    it('reads tariffs and input modalities, counted as a catalogue request, not a generation', async () => {
      const guard = createGenerationGuard((async () => catalogResponse()) as unknown as typeof fetch, { model: CANARY_MODEL, maxGenerations: 4 });
      const catalog = await fetchCatalogMetadata(guard.fetch);
      expect(catalog.pricing.promptUsdPerToken).toBeCloseTo(0.25e-6, 12);
      expect(catalog.inputModalities).toContain('image');
      expect(guard.catalogCount()).toBe(1);
      expect(guard.generationCount()).toBe(0);
    });

    it('fails closed on unavailable or malformed tariffs', async () => {
      const make = (response: Response) => createGenerationGuard((async () => response) as unknown as typeof fetch, { model: CANARY_MODEL, maxGenerations: 4 });
      await expect(fetchCatalogMetadata(make(new Response('x', { status: 503 })).fetch)).rejects.toThrow('CANARY_PRICING_UNAVAILABLE');
      await expect(fetchCatalogMetadata(make(new Response(JSON.stringify({ data: [] }), { status: 200 })).fetch)).rejects.toThrow('CANARY_PRICING_UNAVAILABLE');
      await expect(fetchCatalogMetadata(make(catalogResponse({ prompt: 'n/a' })).fetch)).rejects.toThrow('CANARY_PRICING_UNAVAILABLE');
    });

    it('bounds the catalogue read in time', async () => {
      jest.useFakeTimers();
      try {
        const hanging = ((_url: unknown, init?: RequestInit) => new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })) as unknown as typeof fetch;
        const guard = createGenerationGuard(hanging, { model: CANARY_MODEL, maxGenerations: 4 });
        const pending = expect(fetchCatalogMetadata(guard.fetch)).rejects.toThrow('CANARY_PRICING_UNAVAILABLE');
        await jest.advanceTimersByTimeAsync(10_001);
        await pending;
      } finally {
        jest.useRealTimers();
      }
    });

    it('refuses to start, with zero calls, when the envelope exceeds the cap or the model has no image input', async () => {
      const h = harness(() => completion('x'));
      await expect(runCanary({ ...h, catalog: CATALOG }, { alias: 'q', capUsd: 0.001 })).rejects.toThrow('CANARY_WORST_CASE_ABOVE_CAP');
      await expect(runCanary({ ...h, catalog: { ...CATALOG, inputModalities: ['text'] } }, APPROVAL)).rejects.toThrow('CANARY_MODEL_WITHOUT_IMAGE_INPUT');
      expect(h.calls).toHaveLength(0);
    });

    it('prices reasoning and per-request fees into the envelope', () => {
      const base = preEstimateEnvelopeUsd(PRICING);
      expect(preEstimateEnvelopeUsd({ ...PRICING, reasoningUsdPerToken: 4e-6 })).toBeGreaterThan(base);
      expect(preEstimateEnvelopeUsd({ ...PRICING, requestUsd: 0.01 })).toBeCloseTo(base + 0.04, 6);
      expect(base).toBeLessThan(1);
    });
  });

  it('renders a valid synthetic PNG', () => {
    const png = renderTextPng('NEXUS 4271');
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    const idatStart = png.indexOf(Buffer.from('IDAT')) + 4;
    const idatLength = png.readUInt32BE(idatStart - 8);
    expect(inflateSync(png.subarray(idatStart, idatStart + idatLength)).length).toBe(height * (width + 1));
  });
});
