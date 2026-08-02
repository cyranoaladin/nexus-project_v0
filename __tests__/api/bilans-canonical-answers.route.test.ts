import { NextRequest } from 'next/server';

type Attempt = {
  id: string;
  studentId: string;
  status: string;
  revision: number;
  expiresAt: Date;
  assessmentPackId: string;
  assessmentPackVersion: string;
  answers: Record<string, unknown>;
};

const NOW = new Date('2026-08-02T10:00:00.000Z');
const pack = {
  slug: 'fixture-non-publiable-v0',
  version: 1,
  questionnaire: {
    items: [
      { id: 'ITEM-1', options: [{ id: 'A' }, { id: 'B' }] },
      { id: 'ITEM-2', options: [{ id: 'A' }, { id: 'B' }] },
    ],
  },
} as const;

function createDatabase(overrides: Partial<Attempt> = {}) {
  let attempt: Attempt = {
    id: 'attempt-1',
    studentId: 'student-1',
    status: 'DRAFT',
    revision: 3,
    expiresAt: new Date('2026-08-02T10:30:00.000Z'),
    assessmentPackId: pack.slug,
    assessmentPackVersion: '1',
    answers: { 'ITEM-1': { optionId: 'A', confidence: 2 } },
    ...overrides,
  };
  const idempotency = new Map<string, Record<string, unknown>>();
  const coordinate = ({ userId, route, key }: Record<string, string>) => `${userId}|${route}|${key}`;
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
  const findFirst = jest.fn(async ({ where }: any) => (
    where.id === attempt.id && where.studentId === attempt.studentId ? { ...attempt } : null
  ));
  const updateMany = jest.fn(async ({ where, data }: any) => {
    if (where.id !== attempt.id || where.studentId !== attempt.studentId || where.revision !== attempt.revision) {
      return { count: 0 };
    }
    attempt = {
      ...attempt,
      answers: data.answers,
      revision: attempt.revision + Number(data.revision.increment),
    };
    return { count: 1 };
  });
  const transaction = {
    canonicalApiIdempotencyKey: idempotencyDelegate,
    canonicalAssessmentAttempt: { findFirst, updateMany },
  };
  return {
    database: {
      student: { findUnique: jest.fn(async () => ({ id: 'student-1', userId: 'user-1' })) },
      canonicalApiIdempotencyKey: idempotencyDelegate,
      canonicalAssessmentAttempt: transaction.canonicalAssessmentAttempt,
      $transaction: jest.fn(async (operation: (tx: typeof transaction) => Promise<unknown>) => operation(transaction)),
    },
    findFirst,
    updateMany,
    current: () => attempt,
  };
}

function request(body: unknown, key = 'answers-request-0001') {
  return new NextRequest('http://localhost/api/bilans/attempts/attempt-1/answers', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'idempotency-key': key },
    body: JSON.stringify(body),
  });
}

function handlerFor(state: ReturnType<typeof createDatabase>) {
  const { createPatchAnswersHandler } = require('@/lib/bilans/api/patch-answers') as typeof import('@/lib/bilans/api/patch-answers');
  return createPatchAnswersHandler({
    prisma: state.database as never,
    authenticate: async () => ({ user: { id: 'user-1', role: 'ELEVE' } }) as never,
    resolvePack: () => ({ pack }) as never,
    now: () => NOW,
  });
}

const context = { params: Promise.resolve({ id: 'attempt-1' }) };

describe('PATCH /api/bilans/attempts/[id]/answers', () => {
  test('merges only supplied answers and increments the optimistic revision once', async () => {
    const state = createDatabase();
    const response = await handlerFor(state)(request({
      revision: 3,
      answers: [{ itemId: 'ITEM-2', optionId: 'B', confidence: 4 }],
    }), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revision: 4, savedItemIds: ['ITEM-2'] });
    expect(state.current().answers).toEqual({
      'ITEM-1': { optionId: 'A', confidence: 2 },
      'ITEM-2': { optionId: 'B', confidence: 4 },
    });
    expect(state.updateMany).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(state.database)).not.toContain('scoring');
  });

  test('replays the same committed response without incrementing twice', async () => {
    const state = createDatabase();
    const handler = handlerFor(state);
    const body = { revision: 3, answers: [{ itemId: 'ITEM-2', optionId: 'B', confidence: 4 }] };

    const first = await handler(request(body), context);
    const replay = await handler(request(body), context);

    expect(await replay.json()).toEqual(await first.json());
    expect(state.updateMany).toHaveBeenCalledTimes(1);
    expect(state.current().revision).toBe(4);
  });

  test('returns the server revision on conflict without overwriting', async () => {
    const state = createDatabase({ revision: 5 });
    const before = JSON.parse(JSON.stringify(state.current().answers)) as Record<string, unknown>;

    const response = await handlerFor(state)(request({
      revision: 3,
      answers: [{ itemId: 'ITEM-2', optionId: 'B', confidence: 4 }],
    }), context);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: 'REVISION_CONFLICT', details: { serverRevision: 5 } } });
    expect(state.current().answers).toEqual(before);
    expect(state.updateMany).not.toHaveBeenCalled();
  });

  test.each([
    [{ revision: 3, answers: [{ itemId: 'ITEM-2', optionId: 'B' }] }],
    [{ revision: 3, answers: [{ itemId: 'ITEM-2', optionId: 'B', confidence: 5 }] }],
    [{ revision: 3, answers: [{ itemId: 'UNKNOWN', optionId: 'B', confidence: 3 }] }],
    [{ revision: 3, answers: [{ itemId: 'ITEM-2', optionId: 'Z', confidence: 3 }] }],
  ])('refuses incomplete confidence or identifiers outside the sealed pack', async (body) => {
    const state = createDatabase();
    const response = await handlerFor(state)(request(body), context);

    expect(response.status).toBe(400);
    expect(state.updateMany).not.toHaveBeenCalled();
  });

  test('returns 409 ATTEMPT_EXPIRED for an expired DRAFT', async () => {
    const state = createDatabase({ expiresAt: new Date('2026-08-02T09:59:59.000Z') });
    const response = await handlerFor(state)(request({
      revision: 3,
      answers: [{ itemId: 'ITEM-2', optionId: 'B', confidence: 4 }],
    }), context);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: 'ATTEMPT_EXPIRED' } });
    expect(state.updateMany).not.toHaveBeenCalled();
  });
});
