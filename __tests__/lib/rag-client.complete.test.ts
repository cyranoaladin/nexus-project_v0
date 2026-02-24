/**
 * RAG Client — Complete Test Suite
 *
 * Tests: ragSearch, ragSearchBySubject, ragHealthCheck,
 *        ragCollectionStats, buildRAGContext
 *
 * Source: lib/rag-client.ts
 */

import {
  ragSearch,
  ragSearchBySubject,
  ragHealthCheck,
  ragCollectionStats,
  buildRAGContext,
} from '@/lib/rag-client';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── ragSearch ───────────────────────────────────────────────────────────────

describe('ragSearch', () => {
  it('should return hits from successful search', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        hits: [
          { id: 'h1', document: 'Les dérivées...', metadata: {}, distance: 0.1 },
        ],
      }),
    });

    const result = await ragSearch({ query: 'dérivées' });

    expect(result).toHaveLength(1);
    expect(result[0].document).toContain('dérivées');
  });

  it('should return empty array on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Error' });

    const result = await ragSearch({ query: 'test' });

    expect(result).toEqual([]);
  });

  it('should return empty array on fetch error', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'));

    const result = await ragSearch({ query: 'test' });

    expect(result).toEqual([]);
  });

  it('should return empty array on timeout (AbortError)', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValue(abortError);

    const result = await ragSearch({ query: 'test' });

    expect(result).toEqual([]);
  });

  it('should send correct request body with defaults', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ hits: [] }),
    });

    await ragSearch({ query: 'intégrales' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.q).toBe('intégrales');
    expect(body.k).toBe(4);
    expect(body.include_documents).toBe(true);
    expect(body.collection).toBe('ressources_pedagogiques_terminale');
  });

  it('should pass custom k and filters', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ hits: [] }),
    });

    await ragSearch({ query: 'test', k: 8, filters: { subject: 'maths' } });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.k).toBe(8);
    expect(body.filters).toEqual({ subject: 'maths' });
  });

  it('should return empty array when hits is missing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const result = await ragSearch({ query: 'test' });
    expect(result).toEqual([]);
  });
});

// ─── ragSearchBySubject ──────────────────────────────────────────────────────

describe('ragSearchBySubject', () => {
  it('should pass subject filter', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ hits: [] }),
    });

    await ragSearchBySubject('dérivées', 'maths');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.filters).toEqual({ subject: 'maths' });
  });

  it('should pass subject and level filters', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ hits: [] }),
    });

    await ragSearchBySubject('récursivité', 'nsi', 'terminale');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.filters).toEqual({ subject: 'nsi', level: 'terminale' });
  });

  it('should use custom k value', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ hits: [] }),
    });

    await ragSearchBySubject('test', 'maths', undefined, 10);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.k).toBe(10);
  });
});

// ─── ragHealthCheck ──────────────────────────────────────────────────────────

describe('ragHealthCheck', () => {
  it('should return true when healthy', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'healthy' }),
    });

    expect(await ragHealthCheck()).toBe(true);
  });

  it('should return false when status is not healthy', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'degraded' }),
    });

    expect(await ragHealthCheck()).toBe(false);
  });

  it('should return false on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false });

    expect(await ragHealthCheck()).toBe(false);
  });

  it('should return false on fetch error', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'));

    expect(await ragHealthCheck()).toBe(false);
  });
});

// ─── ragCollectionStats ──────────────────────────────────────────────────────

describe('ragCollectionStats', () => {
  it('should return stats on success', async () => {
    const stats = {
      collection: 'ressources_pedagogiques_terminale',
      count: 1934,
      subjects: { maths: 142, nsi: 69 },
      levels: { terminale: 115, premiere: 96 },
      types: {},
      sources: {},
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => stats,
    });

    const result = await ragCollectionStats();

    expect(result).not.toBeNull();
    expect(result!.count).toBe(1934);
    expect(result!.subjects.maths).toBe(142);
  });

  it('should return null on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false });

    expect(await ragCollectionStats()).toBeNull();
  });

  it('should return null on fetch error', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'));

    expect(await ragCollectionStats()).toBeNull();
  });

  it('should use custom collection name', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ collection: 'custom', count: 0, subjects: {}, levels: {}, types: {}, sources: {} }),
    });

    await ragCollectionStats('custom');

    expect(mockFetch.mock.calls[0][0]).toContain('/collections/custom/stats');
  });
});

// ─── buildRAGContext ─────────────────────────────────────────────────────────

describe('buildRAGContext', () => {
  it('should return empty string for no hits', () => {
    expect(buildRAGContext([])).toBe('');
  });

  it('should build context with numbered hits', () => {
    const hits = [
      { id: 'h1', document: 'Les dérivées sont...', metadata: { source: 'Programme Maths Tle', subject: 'maths', level: 'terminale' }, distance: 0.1 },
      { id: 'h2', document: 'La récursivité...', metadata: { source: 'Programme NSI Tle', subject: 'nsi' }, distance: 0.2 },
    ];

    const context = buildRAGContext(hits);

    expect(context).toContain('[1]');
    expect(context).toContain('[2]');
    expect(context).toContain('Les dérivées sont...');
    expect(context).toContain('La récursivité...');
    expect(context).toContain('Programme Maths Tle');
    expect(context).toContain('maths — terminale');
  });

  it('should include header and footer markers', () => {
    const hits = [
      { id: 'h1', document: 'Content', metadata: {}, distance: 0.1 },
    ];

    const context = buildRAGContext(hits);

    expect(context).toContain('CONTEXTE PÉDAGOGIQUE');
    expect(context).toContain('FIN DU CONTEXTE');
  });

  it('should use default source when metadata.source is missing', () => {
    const hits = [
      { id: 'h1', document: 'Content', metadata: {}, distance: 0.1 },
    ];

    const context = buildRAGContext(hits);

    expect(context).toContain('Document pédagogique');
  });
});
