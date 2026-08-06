import { NextRequest } from 'next/server';

function database(attempt: Record<string, unknown> | null) {
  const findFirst = jest.fn(async () => attempt);
  return {
    student: { findUnique: jest.fn(async () => ({ id: 'student-1', userId: 'user-1' })) },
    canonicalAssessmentAttempt: { findFirst },
    findFirst,
  };
}

const enabledPack = { pack: { slug: 'fixture-non-publiable-v0', version: 1 } };

function handlerFor(
  db: ReturnType<typeof database>,
  resolvePack: jest.Mock = jest.fn(() => enabledPack),
) {
  const { createGetAttemptStatusHandler } = require('@/lib/bilans/api/get-status') as typeof import('@/lib/bilans/api/get-status');
  return createGetAttemptStatusHandler({
    prisma: db as never,
    authenticate: async () => ({ user: { id: 'user-1', role: 'ELEVE' } }) as never,
    resolvePack: resolvePack as never,
  });
}

const request = new NextRequest('http://localhost/api/bilans/attempts/attempt-1/status');
const context = { params: Promise.resolve({ id: 'attempt-1' }) };

describe('GET /api/bilans/attempts/[id]/status', () => {
  test('returns only Canonical status fields and an explicit null without report', async () => {
    const db = database({
      id: 'attempt-1',
      status: 'SUBMITTED',
      assessmentPackId: enabledPack.pack.slug,
      assessmentPackVersion: '1',
      updatedAt: new Date('2026-08-02T10:05:00.000Z'),
      reportArtifacts: [],
      scoreSnapshots: [{ score: 20, result: { secret: true } }],
    });

    const response = await handlerFor(db)(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      attemptId: 'attempt-1',
      status: 'SUBMITTED',
      reportStatus: null,
      updatedAt: '2026-08-02T10:05:00.000Z',
    });
    expect(JSON.stringify(body)).not.toMatch(/score|result|content|profile/i);
  });

  test('reports the Canonical report lifecycle only when an artifact exists', async () => {
    const db = database({
      id: 'attempt-1',
      status: 'REPORT_PENDING_REVIEW',
      assessmentPackId: enabledPack.pack.slug,
      assessmentPackVersion: '1',
      updatedAt: new Date('2026-08-02T10:06:00.000Z'),
      reportArtifacts: [{ id: 'artifact-1' }],
    });

    expect(await (await handlerFor(db)(request, context)).json()).toMatchObject({
      status: 'REPORT_PENDING_REVIEW',
      reportStatus: 'REPORT_PENDING_REVIEW',
    });
  });

  test('returns 404 for another student without revealing the attempt', async () => {
    const db = database(null);
    const response = await handlerFor(db)(request, context);

    expect(response.status).toBe(404);
    expect(db.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'attempt-1', studentId: 'student-1' },
    }));
  });

  test('returns 404 when the attempt pack has been disabled', async () => {
    const db = database({
      id: 'attempt-1',
      status: 'SUBMITTED',
      assessmentPackId: enabledPack.pack.slug,
      assessmentPackVersion: '1',
      updatedAt: new Date('2026-08-02T10:05:00.000Z'),
      reportArtifacts: [],
    });
    const resolvePack = jest.fn(() => null);
    const response = await handlerFor(db, resolvePack)(request, context);

    expect(response.status).toBe(404);
    expect(resolvePack).toHaveBeenCalledWith(enabledPack.pack.slug, 1);
  });
});
