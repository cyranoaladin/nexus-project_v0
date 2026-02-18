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
global.fetch = mockFetch as unknown as typeof fetch;

// Spy on clearTimeout to verify it's always called
let clearTimeoutSpy: jest.SpyInstance;

beforeEach(() => {
  jest.resetModules();
  mockFetch.mockReset();
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

    expect(result).toHaveLength(1);
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

    expect(result).toEqual([]);
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('clears timeout on network error (fetch throws)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const ragSearch = await importRagSearch();
    const result = await ragSearch({ query: 'test' });

    expect(result).toEqual([]);
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('clears timeout on AbortError (timeout triggered)', async () => {
    const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
    mockFetch.mockRejectedValueOnce(abortError);

    const ragSearch = await importRagSearch();
    const result = await ragSearch({ query: 'test' });

    expect(result).toEqual([]);
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('clears timeout when response.json() throws', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => { throw new SyntaxError('Unexpected token'); },
    });

    const ragSearch = await importRagSearch();
    const result = await ragSearch({ query: 'test' });

    expect(result).toEqual([]);
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('returns empty array gracefully (never throws)', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const ragSearch = await importRagSearch();
    const result = await ragSearch({ query: 'anything' });

    expect(result).toEqual([]);
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
