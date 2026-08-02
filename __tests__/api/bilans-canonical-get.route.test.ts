import { NextRequest } from 'next/server';

const NOW = new Date('2026-08-02T10:00:00.000Z');

const options = [
  { id: 'A', text: 'Option A', isCorrect: false, distractorRationale: '__RATIONALE__' },
  { id: 'B', text: 'Option B', isCorrect: true },
  { id: 'C', text: 'Option C', isCorrect: false, distractorRationale: 'Erreur C' },
  { id: 'D', text: 'Option D', isCorrect: false, distractorRationale: 'Erreur D' },
];

const pack = {
  slug: 'fixture-non-publiable-v0',
  version: 1,
  level: 'TERMINALE',
  subject: 'MATHS',
  questionnaire: {
    items: [
      {
        id: 'ITEM-1',
        questionText: 'Question visible',
        options,
        shortCorrection: '__CORRECT__',
        explanation: '__CORRECT__',
        weight: 3,
      },
      {
        id: 'ITEM-2',
        questionText: 'Deuxième question',
        options: options.map((option) => ({ ...option, id: `2${option.id}` })),
        shortCorrection: 'Correction secrète',
        explanation: 'Explication secrète',
        weight: 1,
      },
    ],
  },
  scoring: { engine: 'facts.v1.0.1', domains: ['analyse'] },
  review: { validatedBy: 'Fixture', validatedAt: '1970-01-01T00:00:00.000Z' },
} as const;

type FakeAttempt = Readonly<{
  id: string;
  studentId: string;
  status: string;
  seed: string;
  revision: number;
  expiresAt: Date;
  assessmentPackId: string;
  assessmentPackVersion: string;
  answers: unknown;
}>;

function database(attemptOverrides: Partial<FakeAttempt> = {}) {
  const findFirst = jest.fn<Promise<FakeAttempt | null>, [unknown]>(async () => ({
    id: 'attempt-1',
    studentId: 'student-1',
    status: 'DRAFT',
    seed: 'seed-001',
    revision: 4,
    expiresAt: new Date('2026-08-02T10:30:00.000Z'),
    assessmentPackId: pack.slug,
    assessmentPackVersion: '1',
    answers: { 'ITEM-1': { optionId: 'B', confidence: 3 } },
    ...attemptOverrides,
  }));
  return {
    student: { findUnique: jest.fn(async () => ({ id: 'student-1', userId: 'user-1' })) },
    canonicalAssessmentAttempt: { findFirst },
    findFirst,
  };
}

function recursiveKeysAndValues(value: unknown, keys: string[] = [], values: string[] = []) {
  if (Array.isArray(value)) {
    value.forEach((child) => recursiveKeysAndValues(child, keys, values));
  } else if (value !== null && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => {
      keys.push(key);
      recursiveKeysAndValues(child, keys, values);
    });
  } else if (typeof value === 'string') {
    values.push(value);
  }
  return { keys, values };
}

function handlerFor(db: ReturnType<typeof database>, resolvePack: jest.Mock = jest.fn(() => ({ pack }))) {
  const { createGetAttemptHandler } = require('@/lib/bilans/api/get-attempt') as typeof import('@/lib/bilans/api/get-attempt');
  return {
    resolvePack,
    handler: createGetAttemptHandler({
      prisma: db as never,
      authenticate: async () => ({ user: { id: 'user-1', role: 'ELEVE' } }) as never,
      resolvePack: resolvePack as never,
      now: () => NOW,
    }),
  };
}

const request = new NextRequest('http://localhost/api/bilans/attempts/attempt-1');
const context = { params: Promise.resolve({ id: 'attempt-1' }) };

describe('GET /api/bilans/attempts/[id]', () => {
  test('checks ownership before resolving the pack and returns 404 for a third party', async () => {
    const db = database();
    db.findFirst.mockResolvedValueOnce(null);
    const { handler, resolvePack } = handlerFor(db);

    const response = await handler(request, context);

    expect(response.status).toBe(404);
    expect(db.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'attempt-1', studentId: 'student-1' },
    }));
    expect(resolvePack).not.toHaveBeenCalled();
  });

  test('returns 404 for an expired DRAFT', async () => {
    const db = database({ expiresAt: new Date('2026-08-02T09:59:59.000Z') });
    const { handler } = handlerFor(db);

    expect((await handler(request, context)).status).toBe(404);
  });

  test('returns 404 when the attempt pack has been disabled', async () => {
    const db = database();
    const resolvePack = jest.fn(() => null);
    const { handler } = handlerFor(db, resolvePack);

    expect((await handler(request, context)).status).toBe(404);
    expect(resolvePack).toHaveBeenCalledWith(pack.slug, 1);
  });

  test('returns the stable permuted questionnaire and saved answers', async () => {
    const db = database();
    const { handler } = handlerFor(db);

    const first = await (await handler(request, context)).json();
    const replay = await (await handler(request, context)).json();

    expect(first).toEqual(replay);
    expect(first).toMatchObject({
      attemptId: 'attempt-1',
      pack: { slug: pack.slug, version: 1 },
      status: 'DRAFT',
      revision: 4,
      expiresAt: '2026-08-02T10:30:00.000Z',
      items: [
        {
          id: 'ITEM-1',
          prompt: 'Question visible',
          savedAnswer: { optionId: 'B', confidence: 3 },
        },
        {
          id: 'ITEM-2',
          prompt: 'Deuxième question',
          savedAnswer: { optionId: null, confidence: null },
        },
      ],
    });
    expect(first.items[0].options).toHaveLength(4);
    expect(options.map(({ id }) => id)).toEqual(['A', 'B', 'C', 'D']);
  });

  test('recursively excludes correction, rationale, scoring and sentinels', async () => {
    const db = database();
    const { handler } = handlerFor(db);
    const body = await (await handler(request, context)).json();
    const serialized = JSON.stringify(body);
    const observed = recursiveKeysAndValues(body);
    const denylist = [
      'correct', 'isCorrect', 'correctAnswer', 'distractorRationale', 'shortCorrection',
      'explanation', 'weight', 'scoring', 'checksum', 'review',
    ];

    expect(observed.keys.filter((key) => denylist.includes(key))).toEqual([]);
    expect(serialized).not.toContain('__CORRECT__');
    expect(serialized).not.toContain('__RATIONALE__');
  });
});
