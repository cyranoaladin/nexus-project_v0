jest.unmock('@/lib/prisma');

import { NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';

const TEST_PREFIX = `a85-submit-${Date.now()}-`;
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

function request(revision: number, key: string) {
  return new NextRequest('http://localhost/api/bilans/attempts/attempt/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': key },
    body: JSON.stringify({ revision }),
  });
}

describe('POST /api/bilans/attempts/[id]/submit — PostgreSQL réel isolé', () => {
  let userId: string;
  let attemptId: string;
  let replayAttemptId: string;
  let disabledAttemptId: string;

  beforeAll(async () => {
    const parentUser = await prisma.user.create({
      data: { email: `${TEST_PREFIX}parent@example.test`, role: 'PARENT' },
    });
    const parent = await prisma.parentProfile.create({ data: { userId: parentUser.id } });
    const user = await prisma.user.create({
      data: { email: `${TEST_PREFIX}student@example.test`, role: 'ELEVE' },
    });
    userId = user.id;
    const student = await prisma.student.create({
      data: { userId: user.id, parentId: parent.id, gradeLevel: 'TERMINALE' },
    });
    const attempt = await prisma.canonicalAssessmentAttempt.create({
      data: {
        studentId: student.id,
        status: 'DRAFT',
        seed: 'integration-seed',
        startedAt: NOW,
        expiresAt: new Date('2026-08-02T11:00:00.000Z'),
        revision: 2,
        subject: 'MATHEMATIQUES',
        gradeLevel: 'TERMINALE',
        answers: {
          'ITEM-1': { optionId: 'A', confidence: 2 },
          'ITEM-2': { optionId: 'B', confidence: 4 },
        },
        curriculumId: 'terminale.maths',
        curriculumVersion: '1',
        assessmentPackId: pack.slug,
        assessmentPackVersion: '1',
        assessmentPackChecksum: 'fixture-checksum',
        scoringPolicyId: 'facts',
        scoringPolicyVersion: '1.0.1',
      },
    });
    attemptId = attempt.id;
    const replayAttempt = await prisma.canonicalAssessmentAttempt.create({
      data: {
        studentId: student.id,
        status: 'DRAFT',
        seed: 'integration-replay-seed',
        startedAt: NOW,
        expiresAt: new Date('2026-08-02T11:00:00.000Z'),
        revision: 7,
        subject: 'MATHEMATIQUES',
        gradeLevel: 'TERMINALE',
        answers: {
          'ITEM-1': { optionId: 'A', confidence: 2 },
          'ITEM-2': { optionId: 'B', confidence: 4 },
        },
        curriculumId: 'terminale.maths',
        curriculumVersion: '1',
        assessmentPackId: pack.slug,
        assessmentPackVersion: '1',
        assessmentPackChecksum: 'fixture-checksum',
        scoringPolicyId: 'facts',
        scoringPolicyVersion: '1.0.1',
      },
    });
    replayAttemptId = replayAttempt.id;
    const disabledAttempt = await prisma.canonicalAssessmentAttempt.create({
      data: {
        studentId: student.id,
        status: 'DRAFT',
        seed: 'integration-disabled-seed',
        startedAt: NOW,
        expiresAt: new Date('2026-08-02T11:00:00.000Z'),
        revision: 5,
        subject: 'MATHEMATIQUES',
        gradeLevel: 'TERMINALE',
        answers: {
          'ITEM-1': { optionId: 'A', confidence: 2 },
          'ITEM-2': { optionId: 'B', confidence: 4 },
        },
        curriculumId: 'terminale.maths',
        curriculumVersion: '1',
        assessmentPackId: pack.slug,
        assessmentPackVersion: '1',
        assessmentPackChecksum: 'fixture-checksum',
        scoringPolicyId: 'facts',
        scoringPolicyVersion: '1.0.1',
      },
    });
    disabledAttemptId = disabledAttempt.id;
  });

  afterAll(async () => {
    await prisma.canonicalApiIdempotencyKey.deleteMany({ where: { userId } });
    await prisma.jobOutbox.deleteMany({ where: { aggregateId: { in: [attemptId, replayAttemptId, disabledAttemptId] } } });
    // The production trigger correctly forbids DELETE after submission. This
    // database is disposable and test-only, so TRUNCATE is the isolation
    // boundary that removes synthetic append-only rows between suites.
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "canonical_assessment_attempts" CASCADE');
    await prisma.student.deleteMany({ where: { userId } });
    await prisma.parentProfile.deleteMany({ where: { user: { email: { startsWith: TEST_PREFIX } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: TEST_PREFIX } } });
    await prisma.$disconnect();
  });

  test('locks the attempt and creates exactly one scoring job under concurrent submission', async () => {
    const { createSubmitAttemptHandler } = require('@/lib/bilans/api/submit-attempt') as typeof import('@/lib/bilans/api/submit-attempt');
    const handler = createSubmitAttemptHandler({
      prisma,
      authenticate: async () => ({ user: { id: userId, role: 'ELEVE' } }) as never,
      resolvePack: () => ({ pack }) as never,
      now: () => NOW,
    });
    const context = { params: Promise.resolve({ id: attemptId }) };

    const responses = await Promise.all([
      handler(request(2, 'submit-concurrent-0001'), context),
      handler(request(2, 'submit-concurrent-0002'), context),
    ]);

    expect(responses.map(({ status }) => status).sort()).toEqual([200, 404]);
    const stored = await prisma.canonicalAssessmentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(stored.status).toBe('SUBMITTED');
    expect(stored.submittedAt).toEqual(NOW);
    expect(stored.revision).toBe(3);
    expect(await prisma.jobOutbox.count({ where: { aggregateId: attemptId, jobType: 'SCORE_ATTEMPT' } })).toBe(1);
  });

  test('replays a committed submission for the same idempotency key', async () => {
    const { createSubmitAttemptHandler } = require('@/lib/bilans/api/submit-attempt') as typeof import('@/lib/bilans/api/submit-attempt');
    const handler = createSubmitAttemptHandler({
      prisma,
      authenticate: async () => ({ user: { id: userId, role: 'ELEVE' } }) as never,
      resolvePack: () => ({ pack }) as never,
      now: () => NOW,
    });
    const context = { params: Promise.resolve({ id: replayAttemptId }) };

    const first = await handler(request(7, 'submit-replay-0001'), context);
    const replay = await handler(request(7, 'submit-replay-0001'), context);

    expect(first.status).toBe(200);
    expect(await replay.json()).toEqual(await first.json());
    expect(await prisma.jobOutbox.count({ where: { aggregateId: replayAttemptId, jobType: 'SCORE_ATTEMPT' } })).toBe(1);
  });

  test('returns 404 before locking or writing when the attempt pack has been disabled', async () => {
    const { createSubmitAttemptHandler } = require('@/lib/bilans/api/submit-attempt') as typeof import('@/lib/bilans/api/submit-attempt');
    const handler = createSubmitAttemptHandler({
      prisma,
      authenticate: async () => ({ user: { id: userId, role: 'ELEVE' } }) as never,
      resolvePack: () => null,
      now: () => NOW,
    });

    const response = await handler(
      request(5, 'submit-disabled-0001'),
      { params: Promise.resolve({ id: disabledAttemptId }) },
    );
    const stored = await prisma.canonicalAssessmentAttempt.findUniqueOrThrow({ where: { id: disabledAttemptId } });

    expect(response.status).toBe(404);
    expect(stored.status).toBe('DRAFT');
    expect(stored.revision).toBe(5);
    expect(await prisma.jobOutbox.count({ where: { aggregateId: disabledAttemptId } })).toBe(0);
    expect(await prisma.canonicalApiIdempotencyKey.count({
      where: { userId, route: `POST:/api/bilans/attempts/${disabledAttemptId}/submit` },
    })).toBe(0);
  });
});
