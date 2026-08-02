import { NextRequest } from 'next/server';

import { ENTRY_VALIDATED_PACK_FIXTURE } from '@/__tests__/bilans/fixtures/validated-pack';

function createHandlerModule(): typeof import('@/lib/bilans/api/create-attempt') {
  return require('@/lib/bilans/api/create-attempt');
}

function createDatabase() {
  const idempotency = new Map<string, any>();
  const coordinate = ({ userId, route, key }: any) => `${userId}|${route}|${key}`;
  const idempotencyDelegate = {
    findUnique: jest.fn(async ({ where }: any) => idempotency.get(coordinate(where.userId_route_key)) ?? null),
    deleteMany: jest.fn(async () => ({ count: 0 })),
    create: jest.fn(async ({ data }: any) => {
      const id = coordinate(data);
      if (idempotency.has(id)) throw Object.assign(new Error('unique'), { code: 'P2002' });
      idempotency.set(id, { ...data, response: null, responseStatus: null });
      return idempotency.get(id);
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const id = coordinate(where.userId_route_key);
      idempotency.set(id, { ...idempotency.get(id), ...data });
      return idempotency.get(id);
    }),
  };
  const createAttempt = jest.fn(async ({ data }: any) => ({
    id: 'attempt-1',
    status: data.status,
    startedAt: data.startedAt,
    expiresAt: data.expiresAt,
  }));
  const transaction = {
    canonicalApiIdempotencyKey: idempotencyDelegate,
    canonicalAssessmentAttempt: { create: createAttempt },
  };
  const database = {
    student: {
      findUnique: jest.fn(async () => ({ id: 'student-1', userId: 'user-1' })),
    },
    canonicalApiIdempotencyKey: idempotencyDelegate,
    canonicalAssessmentAttempt: transaction.canonicalAssessmentAttempt,
    $transaction: jest.fn(async (operation: (tx: any) => Promise<unknown>) => operation(transaction)),
  };
  return { database, createAttempt };
}

const pack = {
  slug: 'fixture-non-publiable-v0',
  version: 1,
  status: 'VALIDATED',
  review: {
    validatedBy: 'FIXTURE — JAMAIS UN ENSEIGNANT',
    validatedAt: '1970-01-01T00:00:00.000Z',
  },
  level: 'TERMINALE',
  subject: 'MATHS',
  questionnaire: { targetDurationMin: 25, items: [] },
  scoring: { engine: 'facts.v1.0.1', domains: ['analyse'] },
} as const;

function request(body: unknown, key = 'request-create-0001'): NextRequest {
  return new NextRequest('http://localhost/api/bilans/attempts', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': key },
    body: JSON.stringify(body),
  });
}

describe('POST /api/bilans/attempts', () => {
  test('returns 404 before writing when the exact pack is not enabled', async () => {
    const { createCreateAttemptHandler } = createHandlerModule();
    const { database, createAttempt } = createDatabase();
    const handler = createCreateAttemptHandler({
      prisma: database as never,
      authenticate: async () => ({ user: { id: 'user-1', role: 'ELEVE', email: 'eleve@example.test' } }) as never,
      resolvePack: () => null,
      now: () => new Date('2026-08-02T10:00:00.000Z'),
      generateSeed: () => 'server-seed',
    });

    const response = await handler(request({ packSlug: pack.slug }));

    expect(response.status).toBe(404);
    expect(createAttempt).not.toHaveBeenCalled();
  });

  test('creates a sealed DRAFT from session identity and never returns the seed', async () => {
    const { createCreateAttemptHandler } = createHandlerModule();
    const { database, createAttempt } = createDatabase();
    const handler = createCreateAttemptHandler({
      prisma: database as never,
      authenticate: async () => ({ user: { id: 'user-1', role: 'ELEVE', email: 'eleve@example.test' } }) as never,
      resolvePack: () => ({ pack, validatedPack: ENTRY_VALIDATED_PACK_FIXTURE, checksum: 'pack-checksum', path: 'fixture' }) as never,
      now: () => new Date('2026-08-02T10:00:00.000Z'),
      generateSeed: () => 'server-seed',
    });

    const response = await handler(request({ packSlug: pack.slug }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      attemptId: 'attempt-1',
      status: 'DRAFT',
      startedAt: '2026-08-02T10:00:00.000Z',
      expiresAt: '2026-08-02T10:30:00.000Z',
    });
    expect(JSON.stringify(body)).not.toContain('seed');
    expect(createAttempt).toHaveBeenCalledWith({ data: expect.objectContaining({
      studentId: 'student-1',
      status: 'DRAFT',
      seed: 'server-seed',
      startedAt: new Date('2026-08-02T10:00:00.000Z'),
      expiresAt: new Date('2026-08-02T10:30:00.000Z'),
      subject: 'MATHEMATIQUES',
      gradeLevel: 'TERMINALE',
      answers: {},
      assessmentPackId: pack.slug,
      assessmentPackVersion: '1',
      assessmentPackChecksum: 'pack-checksum',
      scoringPolicyId: 'facts',
      scoringPolicyVersion: '1.0.1',
    }) });
    expect(JSON.stringify(createAttempt.mock.calls)).not.toContain('eleve@example.test');
  });

  test('replays the committed response for the same user, route and key', async () => {
    const { createCreateAttemptHandler } = createHandlerModule();
    const { database, createAttempt } = createDatabase();
    const handler = createCreateAttemptHandler({
      prisma: database as never,
      authenticate: async () => ({ user: { id: 'user-1', role: 'ELEVE', email: 'eleve@example.test' } }) as never,
      resolvePack: () => ({ pack, validatedPack: ENTRY_VALIDATED_PACK_FIXTURE, checksum: 'pack-checksum', path: 'fixture' }) as never,
      now: () => new Date('2026-08-02T10:00:00.000Z'),
      generateSeed: () => 'server-seed',
    });

    const first = await handler(request({ packSlug: pack.slug }));
    const replay = await handler(request({ packSlug: pack.slug }));

    expect(first.status).toBe(201);
    expect(await replay.json()).toEqual(await first.json());
    expect(createAttempt).toHaveBeenCalledTimes(1);
  });

  test('rejects client ownership, seed or status fields', async () => {
    const { createCreateAttemptHandler } = createHandlerModule();
    const { database, createAttempt } = createDatabase();
    const handler = createCreateAttemptHandler({
      prisma: database as never,
      authenticate: async () => ({ user: { id: 'user-1', role: 'ELEVE', email: 'eleve@example.test' } }) as never,
      resolvePack: () => ({ pack, validatedPack: ENTRY_VALIDATED_PACK_FIXTURE, checksum: 'pack-checksum', path: 'fixture' }) as never,
      now: () => new Date('2026-08-02T10:00:00.000Z'),
      generateSeed: () => 'server-seed',
    });

    const response = await handler(request({ packSlug: pack.slug, studentId: 'other', seed: 'client', status: 'PUBLISHED' }));

    expect(response.status).toBe(400);
    expect(createAttempt).not.toHaveBeenCalled();
  });
});
