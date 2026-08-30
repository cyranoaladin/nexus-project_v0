/** @jest-environment node */

import { ragSearch } from '@/lib/rag-client';

describe('ARIA observable RAG client failures', () => {
  const originalUrl = process.env.RAG_INGESTOR_URL;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.RAG_INGESTOR_URL = 'http://rag-fixture.invalid';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.RAG_INGESTOR_URL;
    else process.env.RAG_INGESTOR_URL = originalUrl;
    jest.restoreAllMocks();
  });

  it('throws for canonical callers on network and HTTP failures', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('network detail')) as jest.Mock;
    await expect(ragSearch({ query: 'question', failureMode: 'throw' }))
      .rejects.toThrow('RAG_RUNTIME_UNAVAILABLE');

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'private upstream detail',
    }) as jest.Mock;
    await expect(ragSearch({ query: 'question', failureMode: 'throw' }))
      .rejects.toThrow('RAG_PROVIDER_UNAVAILABLE');
  });

  it('requires explicit endpoint configuration and rejects oversized canonical responses', async () => {
    delete process.env.RAG_INGESTOR_URL;
    await expect(ragSearch({ query: 'question', failureMode: 'throw' }))
      .rejects.toThrow('RAG_NOT_CONFIGURED');
    expect(global.fetch).toBe(originalFetch);

    process.env.RAG_INGESTOR_URL = 'http://rag-fixture.invalid';
    global.fetch = jest.fn().mockResolvedValueOnce(new Response('{"hits":[]}', {
      status: 200,
      headers: { 'content-length': String(300 * 1024) },
    })) as jest.Mock;
    await expect(ragSearch({
      query: 'question',
      failureMode: 'throw',
      maxResponseBytes: 256 * 1024,
    })).rejects.toThrow('RAG_RESPONSE_TOO_LARGE');
  });

  it('preserves the explicit legacy empty-result mode for non-ARIA consumers', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('network detail')) as jest.Mock;
    await expect(ragSearch({ query: 'legacy question', failureMode: 'empty' }))
      .resolves.toEqual([]);
    expect(log).toHaveBeenCalledWith('RAG search unavailable', {
      reasonCode: 'RUNTIME_UNAVAILABLE',
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain('network detail');
  });
});
