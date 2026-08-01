/**
 * Unit tests for lib/rag-client.ts
 *
 * Focus: timeout cleanup (clearTimeout via finally) and graceful degradation.
 * Uses global fetch mock — no real network calls.
 *
 * @module __tests__/lib/rag-client.test
 */

// Mock fetch globally
const mockFetch = jest.fn();
const mockTelegramSendMessage = jest.fn().mockResolvedValue({
  ok: true,
  status: 'sent',
});
global.fetch = mockFetch as unknown as typeof fetch;

jest.mock('@/lib/telegram/client', () => ({
  telegramSendMessage: mockTelegramSendMessage,
}));

// Spy on clearTimeout to verify it's always called
let clearTimeoutSpy: jest.SpyInstance;

beforeEach(() => {
  jest.resetModules();
  mockFetch.mockReset();
  mockTelegramSendMessage.mockClear();
  clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
});

afterEach(() => {
  clearTimeoutSpy.mockRestore();
});

describe('ragSearch', () => {
  async function importRagSearch() {
    const mod = await import('@/lib/rag-client');
    return mod.ragSearch;
  }

  it('clears timeout on successful response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ hits: [{ id: '1', document: 'doc', metadata: {}, distance: 0.1 }] }),
    });

    const ragSearch = await importRagSearch();
    const result = await ragSearch({ query: 'test' });

    expect(result.status).toBe('success');
    expect(result.hits).toHaveLength(1);
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('clears timeout on HTTP error (non-ok response)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const ragSearch = await importRagSearch();
    const result = await ragSearch({ query: 'test' });

    expect(result).toMatchObject({
      status: 'error',
      error: { code: 'HTTP_ERROR', httpStatus: 500 },
    });
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('clears timeout on network error (fetch throws)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const ragSearch = await importRagSearch();
    const result = await ragSearch({ query: 'test' });

    expect(result).toMatchObject({
      status: 'error',
      error: { code: 'NETWORK_ERROR' },
    });
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('clears timeout on AbortError (timeout triggered)', async () => {
    const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
    mockFetch.mockRejectedValueOnce(abortError);

    const ragSearch = await importRagSearch();
    const result = await ragSearch({ query: 'test' });

    expect(result).toMatchObject({
      status: 'error',
      error: { code: 'TIMEOUT' },
    });
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('clears timeout when response.json() throws', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => { throw new SyntaxError('Unexpected token'); },
    });

    const ragSearch = await importRagSearch();
    const result = await ragSearch({ query: 'test' });

    expect(result).toMatchObject({
      status: 'error',
      error: { code: 'INVALID_RESPONSE' },
    });
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('returns an explicit technical error instead of an empty result', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const ragSearch = await importRagSearch();
    const result = await ragSearch({ query: 'anything' });

    expect(result.status).toBe('error');
  });

  it('distinguishes a successful empty search from a technical failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ hits: [] }),
    });

    const ragSearch = await importRagSearch();
    const result = await ragSearch({ query: 'anything' });

    expect(result).toMatchObject({ status: 'empty', hits: [] });
  });

  it('logs only the technical code, duration and HTTP status', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    const ragSearch = await importRagSearch();
    await ragSearch({ query: 'question privée élève' });

    expect(consoleError).toHaveBeenCalledWith('[rag] search failed', {
      code: 'HTTP_ERROR',
      durationMs: expect.any(Number),
      httpStatus: 503,
    });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('question privée élève');
    consoleError.mockRestore();
  });

  it('alerts Telegram when the sliding-window failure rate exceeds its threshold', async () => {
    process.env.RAG_FAILURE_ALERT_MIN_SAMPLES = '3';
    process.env.RAG_FAILURE_ALERT_RATE = '0.5';
    process.env.RAG_FAILURE_ALERT_WINDOW_MS = '60000';
    mockFetch
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ hits: [] }) })
      .mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const ragSearch = await importRagSearch();
    await ragSearch({ query: 'first private query' });
    await ragSearch({ query: 'second private query' });
    await ragSearch({ query: 'third private query' });
    await Promise.resolve();

    expect(mockTelegramSendMessage).toHaveBeenCalledTimes(1);
    const alertText = mockTelegramSendMessage.mock.calls[0][1];
    expect(alertText).toContain('2/3');
    expect(alertText).not.toContain('private query');

    delete process.env.RAG_FAILURE_ALERT_MIN_SAMPLES;
    delete process.env.RAG_FAILURE_ALERT_RATE;
    delete process.env.RAG_FAILURE_ALERT_WINDOW_MS;
  });
});

describe('ragHealthCheck', () => {
  async function importRagHealthCheck() {
    const mod = await import('@/lib/rag-client');
    return mod.ragHealthCheck;
  }

  it('clears timeout on healthy response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'healthy' }),
    });

    const ragHealthCheck = await importRagHealthCheck();
    const result = await ragHealthCheck();

    expect(result).toBe(true);
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('clears timeout on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const ragHealthCheck = await importRagHealthCheck();
    const result = await ragHealthCheck();

    expect(result).toBe(false);
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
