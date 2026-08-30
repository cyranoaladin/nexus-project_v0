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
      .rejects.toThrow('network detail');

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'private upstream detail',
    }) as jest.Mock;
    await expect(ragSearch({ query: 'question', failureMode: 'throw' }))
      .rejects.toThrow('RAG_PROVIDER_UNAVAILABLE');
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
