import {
  OpenRouterBilanTransport,
  OpenRouterTransportError,
} from '@/lib/bilans/llm/openrouter-transport';
import type { BilanGenerationRequest } from '@/lib/bilans/llm/gateway';

function request(overrides: Partial<BilanGenerationRequest> = {}): BilanGenerationRequest {
  return {
    schemaVersion: 'nexus-bilan-gateway/v1',
    pack: { slug: 'entree-seconde-maths-v1', version: 1 },
    agent: {
      id: 'eleve',
      prompt: 'Tu rédiges un compte-rendu pédagogique à partir de ces données uniquement.',
      outputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    },
    factSheet: { globalScore: 62.5, coverage: 100, calibrationIndex: 33.3, domains: [] } as never,
    ragEvidence: [],
    priorOutputs: {},
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function chatCompletion(content: string): unknown {
  return { choices: [{ message: { content } }] };
}

const silentLogger = { info: jest.fn(), error: jest.fn() };

describe('OpenRouterBilanTransport', () => {
  beforeEach(() => {
    silentLogger.info.mockClear();
    silentLogger.error.mockClear();
  });

  it('rejects construction without an API key', () => {
    expect(() => new OpenRouterBilanTransport({ apiKey: '', model: 'mistralai/mistral-large-2512' }))
      .toThrow('OPENROUTER_API_KEY_MISSING');
  });

  it('sends the agent prompt as system message and the FactSheet payload as user message', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(chatCompletion(JSON.stringify({ ok: true }))));
    const transport = new OpenRouterBilanTransport(
      { apiKey: 'sk-test-key', model: 'mistralai/mistral-large-2512' },
      { fetchImpl: fetchImpl as unknown as typeof fetch, logger: silentLogger },
    );

    await transport.generate(request());

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(headers.Authorization).toBe('Bearer sk-test-key');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('mistralai/mistral-large-2512');
    expect(body.messages[0]).toEqual({ role: 'system', content: expect.stringContaining('compte-rendu') });
    const userPayload = JSON.parse(body.messages[1].content);
    expect(userPayload.factSheet.globalScore).toBe(62.5);
  });

  it('never logs the API key or the raw model content', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(chatCompletion(JSON.stringify({ secretLeak: 'nope' }))));
    const transport = new OpenRouterBilanTransport(
      { apiKey: 'sk-super-secret-value', model: 'mistralai/mistral-large-2512' },
      { fetchImpl: fetchImpl as unknown as typeof fetch, logger: silentLogger },
    );

    await transport.generate(request());

    const allLoggedText = JSON.stringify([...silentLogger.info.mock.calls, ...silentLogger.error.mock.calls]);
    expect(allLoggedText).not.toContain('sk-super-secret-value');
    expect(allLoggedText).not.toContain('secretLeak');
  });

  it('parses a JSON object wrapped in a markdown code fence', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(chatCompletion('```json\n{"synthese":"ok"}\n```')));
    const transport = new OpenRouterBilanTransport(
      { apiKey: 'sk-test', model: 'mistralai/mistral-large-2512' },
      { fetchImpl: fetchImpl as unknown as typeof fetch, logger: silentLogger },
    );

    await expect(transport.generate(request())).resolves.toEqual({ synthese: 'ok' });
  });

  it('throws OPENROUTER_INVALID_JSON on unparsable content without retrying (non-retryable)', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(chatCompletion('this is not json')));
    const transport = new OpenRouterBilanTransport(
      { apiKey: 'sk-test', model: 'mistralai/mistral-large-2512', maxRetries: 2 },
      { fetchImpl: fetchImpl as unknown as typeof fetch, logger: silentLogger },
    );

    await expect(transport.generate(request())).rejects.toThrow('OPENROUTER_INVALID_JSON');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries on 5xx up to maxRetries then fails with the http error code', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse({ error: 'boom' }, 503));
    const transport = new OpenRouterBilanTransport(
      { apiKey: 'sk-test', model: 'mistralai/mistral-large-2512', maxRetries: 2 },
      { fetchImpl: fetchImpl as unknown as typeof fetch, logger: silentLogger },
    );

    await expect(transport.generate(request())).rejects.toThrow('OPENROUTER_HTTP_503');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('does not retry a non-retryable 4xx error', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse({ error: 'bad request' }, 400));
    const transport = new OpenRouterBilanTransport(
      { apiKey: 'sk-test', model: 'mistralai/mistral-large-2512', maxRetries: 2 },
      { fetchImpl: fetchImpl as unknown as typeof fetch, logger: silentLogger },
    );

    await expect(transport.generate(request())).rejects.toThrow('OPENROUTER_HTTP_400');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('recovers after a transient 500 followed by a success', async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500))
      .mockResolvedValueOnce(jsonResponse(chatCompletion(JSON.stringify({ ok: true }))));
    const transport = new OpenRouterBilanTransport(
      { apiKey: 'sk-test', model: 'mistralai/mistral-large-2512', maxRetries: 2 },
      { fetchImpl: fetchImpl as unknown as typeof fetch, logger: silentLogger },
    );

    await expect(transport.generate(request())).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('treats a network throw (timeout) as retryable and eventually fails with OPENROUTER_TIMEOUT', async () => {
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const fetchImpl = jest.fn(async () => { throw abortError; });
    const transport = new OpenRouterBilanTransport(
      { apiKey: 'sk-test', model: 'mistralai/mistral-large-2512', maxRetries: 1, timeoutMs: 10 },
      { fetchImpl: fetchImpl as unknown as typeof fetch, logger: silentLogger },
    );

    await expect(transport.generate(request())).rejects.toThrow('OPENROUTER_TIMEOUT');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws OPENROUTER_EMPTY_CONTENT when the model returns no content', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse({ choices: [{ message: {} }] }));
    const transport = new OpenRouterBilanTransport(
      { apiKey: 'sk-test', model: 'mistralai/mistral-large-2512', maxRetries: 0 },
      { fetchImpl: fetchImpl as unknown as typeof fetch, logger: silentLogger },
    );

    await expect(transport.generate(request())).rejects.toThrow('OPENROUTER_EMPTY_CONTENT');
  });

  it('is an instance of OpenRouterTransportError for all thrown failures', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse({}, 400));
    const transport = new OpenRouterBilanTransport(
      { apiKey: 'sk-test', model: 'mistralai/mistral-large-2512', maxRetries: 0 },
      { fetchImpl: fetchImpl as unknown as typeof fetch, logger: silentLogger },
    );
    await expect(transport.generate(request())).rejects.toBeInstanceOf(OpenRouterTransportError);
  });
});
