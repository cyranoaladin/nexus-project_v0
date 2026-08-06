jest.unmock('@/lib/prisma');

import { prisma } from '@/lib/prisma';
import { drainScoreAttemptJobs } from '@/lib/bilans/worker/drain-outbox';
import { processScoreAttemptJob } from '@/lib/bilans/worker/score-job';
import {
  CANONICAL_WORKER_ANSWERS,
  CANONICAL_WORKER_ENABLED_PACK,
} from '@/__tests__/bilans/fixtures/canonical-worker';

const PREFIX = `a87-drain-${Date.now()}-`;

async function seedJob(suffix: string, status: 'PENDING' | 'FAILED' = 'PENDING') {
  return prisma.jobOutbox.create({
    data: {
      jobType: 'SCORE_ATTEMPT',
      aggregateType: 'CanonicalAssessmentAttempt',
      aggregateId: `${PREFIX}${suffix}`,
      sourceEventKey: `${PREFIX}source-${suffix}`,
      idempotencyKey: `${PREFIX}idem-${suffix}`,
      status,
      payload: { attemptId: `${PREFIX}${suffix}`, packSlug: 'fixture', packVersion: 1 },
      lastError: status === 'FAILED' ? 'A86_SCORING_FAILED' : null,
    },
  });
}

describe('Canonical scoring outbox drainer', () => {
  afterEach(async () => {
    await prisma.jobOutbox.deleteMany({ where: { idempotencyKey: { startsWith: PREFIX } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('drains a pending job once', async () => {
    const job = await seedJob('pending');
    const processed: string[] = [];

    const result = await drainScoreAttemptJobs({ limit: 10 }, {
      prisma,
      processJob: async (jobId) => {
        processed.push(jobId);
        await prisma.jobOutbox.update({
          where: { id: jobId },
          data: { status: 'COMPLETED', completedAt: new Date(), leaseOwner: null, leaseExpiresAt: null },
        });
      },
    });

    expect(processed).toEqual([job.id]);
    expect(result).toMatchObject({ claimed: 1, completed: 1, failed: 0 });
  });

  test('two concurrent drainers never process the same job twice', async () => {
    const job = await seedJob('concurrent');
    const processed: string[] = [];
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const processJob = async (jobId: string) => {
      processed.push(jobId);
      await barrier;
      await prisma.jobOutbox.update({
        where: { id: jobId },
        data: { status: 'COMPLETED', completedAt: new Date(), leaseOwner: null, leaseExpiresAt: null },
      });
    };

    const first = drainScoreAttemptJobs({ limit: 1, owner: 'a87-first' }, { prisma, processJob });
    await new Promise((resolve) => setTimeout(resolve, 25));
    const second = drainScoreAttemptJobs({ limit: 1, owner: 'a87-second' }, { prisma, processJob });
    release();
    const results = await Promise.all([first, second]);

    expect(processed).toEqual([job.id]);
    expect(results.reduce((sum, result) => sum + result.claimed, 0)).toBe(1);
  });

  test('claims a failed job again without a new submission', async () => {
    const job = await seedJob('failed', 'FAILED');
    const processed: string[] = [];

    await drainScoreAttemptJobs({ limit: 1 }, {
      prisma,
      processJob: async (jobId) => {
        processed.push(jobId);
        await prisma.jobOutbox.update({
          where: { id: jobId },
          data: { status: 'COMPLETED', completedAt: new Date(), leaseOwner: null, leaseExpiresAt: null },
        });
      },
    });

    expect(processed).toEqual([job.id]);
    expect((await prisma.jobOutbox.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('COMPLETED');
  });

  test('replays a failed scoring job through A86 with one snapshot and one revision', async () => {
    const parentUser = await prisma.user.create({
      data: { email: `${PREFIX}parent@example.test`, role: 'PARENT' },
    });
    const parent = await prisma.parentProfile.create({ data: { userId: parentUser.id } });
    const studentUser = await prisma.user.create({
      data: { email: `${PREFIX}student@example.test`, role: 'ELEVE' },
    });
    const student = await prisma.student.create({
      data: { userId: studentUser.id, parentId: parent.id, gradeLevel: 'TERMINALE' },
    });
    const attempt = await prisma.canonicalAssessmentAttempt.create({
      data: {
        studentId: student.id,
        status: 'SUBMITTED',
        seed: `${PREFIX}seed`,
        startedAt: new Date('2026-08-02T09:00:00.000Z'),
        expiresAt: new Date('2026-08-02T11:00:00.000Z'),
        submittedAt: new Date('2026-08-02T09:30:00.000Z'),
        subject: 'MATHEMATIQUES',
        gradeLevel: 'TERMINALE',
        answers: CANONICAL_WORKER_ANSWERS,
        curriculumId: 'fixture-curriculum',
        curriculumVersion: '1',
        assessmentPackId: CANONICAL_WORKER_ENABLED_PACK.pack.slug,
        assessmentPackVersion: String(CANONICAL_WORKER_ENABLED_PACK.pack.version),
        assessmentPackChecksum: CANONICAL_WORKER_ENABLED_PACK.checksum,
        scoringPolicyId: 'fixture-policy',
        scoringPolicyVersion: '1',
      },
    });
    const job = await prisma.jobOutbox.create({
      data: {
        jobType: 'SCORE_ATTEMPT',
        aggregateType: 'CanonicalAssessmentAttempt',
        aggregateId: attempt.id,
        sourceEventKey: `${PREFIX}real-source`,
        idempotencyKey: `${PREFIX}real-idem`,
        status: 'FAILED',
        payload: {
          attemptId: attempt.id,
          packSlug: CANONICAL_WORKER_ENABLED_PACK.pack.slug,
          packVersion: CANONICAL_WORKER_ENABLED_PACK.pack.version,
        },
        lastError: 'A86_SCORING_FAILED',
      },
    });
    const workerDependencies = {
      prisma,
      resolvePack: () => CANONICAL_WORKER_ENABLED_PACK,
      now: () => new Date('2026-08-02T10:00:00.000Z'),
      logger: { info: jest.fn(), error: jest.fn() },
    };

    await drainScoreAttemptJobs({ limit: 1, owner: 'a87-real-replay' }, {
      prisma,
      processJob: (jobId) => processScoreAttemptJob(jobId, workerDependencies),
    });
    await drainScoreAttemptJobs({ limit: 1, owner: 'a87-real-replay-again' }, {
      prisma,
      processJob: (jobId) => processScoreAttemptJob(jobId, workerDependencies),
    });

    expect((await prisma.jobOutbox.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('COMPLETED');
    expect(await prisma.scoreSnapshot.count({ where: { assessmentAttemptId: attempt.id } })).toBe(1);
    expect(await prisma.reportRevision.count({ where: { reportArtifact: { assessmentAttemptId: attempt.id } } })).toBe(0);
    expect(await prisma.jobOutbox.count({
      where: { jobType: 'GENERATE_REPORT', idempotencyKey: `${attempt.id}.generate-report` },
    })).toBe(1);
  });
});
