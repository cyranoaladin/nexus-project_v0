import { auth } from '@/auth';
import { POST as postEds } from '@/app/api/programme/maths-1ere/rag/route';
import { POST as postStmg } from '@/app/api/programme/maths-1ere-stmg/rag/route';
import { searchProgrammeResourcesV2 } from '@/lib/programme/rag-v2';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { NextResponse } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/programme/rag-v2', () => ({
  searchProgrammeResourcesV2: jest.fn(),
}));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn() }));

function request(body: unknown) {
  return new Request('http://localhost/api/programme/rag', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as never;
}

describe('Cockpit programme RAG v2 routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (guardSensitiveRateLimit as jest.Mock).mockResolvedValue(null);
  });

  it('rate-limits by IP before authentication and returns private no-store headers', async () => {
    (guardSensitiveRateLimit as jest.Mock).mockResolvedValueOnce(
      NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 }),
    );

    const response = await postEds(request({ chapId: 'second-degre', chapTitre: 'Second degré' }));

    expect(response.status).toBe(429);
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(guardSensitiveRateLimit).toHaveBeenCalledWith(expect.any(Request), {
      scope: 'programme-rag-v2',
      dimensions: ['ip'],
    });
    expect(auth).not.toHaveBeenCalled();
  });

  it('rate-limits the authenticated student identity before retrieval', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'student-user', role: 'ELEVE' } });
    (guardSensitiveRateLimit as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 }));

    const response = await postEds(request({ chapId: 'second-degre', chapTitre: 'Second degré' }));

    expect(response.status).toBe(429);
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(guardSensitiveRateLimit).toHaveBeenNthCalledWith(2, expect.any(Request), {
      scope: 'programme-rag-v2',
      identity: 'student-user',
      dimensions: ['identity'],
    });
    expect(searchProgrammeResourcesV2).not.toHaveBeenCalled();
  });

  it.each([undefined, 'PARENT', 'COACH', 'ADMIN', 'ASSISTANTE'])(
    'rejects a non-student actor (%s) before retrieval',
    async (role) => {
      (auth as jest.Mock).mockResolvedValue(role
        ? { user: { id: 'user-1', role } }
        : null);

      const response = await postEds(request({ chapId: 'second-degre', chapTitre: 'Second degré' }));

      expect(response.status).toBe(401);
      expect(response.headers.get('cache-control')).toContain('private');
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(searchProgrammeResourcesV2).not.toHaveBeenCalled();
    },
  );

  it('routes EDS requests to the promoted course through the v2 adapter', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'student-user', role: 'ELEVE' } });
    (searchProgrammeResourcesV2 as jest.Mock).mockResolvedValue({
      status: 'SUCCESS', source: 'rag-v2', hits: [], context: '',
    });

    const response = await postEds(request({
      chapId: 'second-degre',
      chapTitre: 'Second degré',
      query: 'Comment factoriser ?',
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(searchProgrammeResourcesV2).toHaveBeenCalledWith(expect.objectContaining({
      actor: { userId: 'student-user', role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
      query: expect.stringContaining('Comment factoriser ?'),
    }));
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ source: 'rag-v2' }));
  });

  it('uses the STMG course capability and returns a clean unavailable response', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'student-user', role: 'ELEVE' } });
    (searchProgrammeResourcesV2 as jest.Mock).mockResolvedValue({
      status: 'UNAVAILABLE',
      source: 'none',
      hits: [],
      context: '',
      reason: 'SERVABLE_CORPUS_NOT_CONFIGURED',
    });

    const response = await postStmg(request({ chapId: 'suites', chapTitre: 'Suites' }));

    expect(response.status).toBe(200);
    expect(searchProgrammeResourcesV2).toHaveBeenCalledWith(expect.objectContaining({
      courseKey: 'stmg-maths-premiere',
    }));
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      status: 'UNAVAILABLE',
      source: 'none',
      hits: [],
    }));
  });

  it.each([
    ['malformed JSON', new Request('http://localhost/api/programme/rag', { method: 'POST', body: '{' }), 400],
    ['invalid payload', request({ chapId: '', chapTitre: '' }), 422],
  ])('returns private no-store headers for %s', async (_label, incoming, status) => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'student-user', role: 'ELEVE' } });

    const response = await postEds(incoming as never);

    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('returns private no-store headers when retrieval fails unexpectedly', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'student-user', role: 'ELEVE' } });
    (searchProgrammeResourcesV2 as jest.Mock).mockRejectedValue(new Error('upstream unavailable'));

    const response = await postEds(request({ chapId: 'second-degre', chapTitre: 'Second degré' }));

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
});
