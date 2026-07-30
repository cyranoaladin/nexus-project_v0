import { randomUUID } from 'node:crypto';

import {
  AssessmentEngineError,
  autosaveAssessmentResponse,
  claimManualReviewTask,
  completeManualReviewTask,
  reviseManualReviewDecision,
  scoreAssessmentAttempt,
  startAssessmentAttempt,
  submitAssessmentAttempt,
} from '@/lib/bilans/engine';
import {
  canConnectToTestDb,
  setupTestDatabase,
  testPrisma,
} from '../setup/test-database';
import {
  createCanonicalWorkflowFixture,
  engineKey,
} from './support/canonical-assessment-fixture';

const prisma = testPrisma;

async function createSubmittedManualAttempt() {
  const fixture = await createCanonicalWorkflowFixture(prisma);
  const parentActor = {
    role: 'PARENT' as const,
    userId: fixture.parentUser.id,
  };
  const attempt = await startAssessmentAttempt(fixture.context, {
    actor: parentActor,
    assignmentId: fixture.assignment.id,
    idempotencyKey: engineKey('start'),
  });
  await autosaveAssessmentResponse(fixture.context, {
    actor: parentActor,
    command: {
      attemptId: attempt.id,
      itemId: 'qcm',
      expectedVersion: 0,
      response: { selectedOptionIndex: 1 },
    },
    idempotencyKey: engineKey('save'),
  });
  await autosaveAssessmentResponse(fixture.context, {
    actor: parentActor,
    command: {
      attemptId: attempt.id,
      itemId: 'manual',
      expectedVersion: 0,
      response: { textValue: 'Une justification à corriger.' },
    },
    idempotencyKey: engineKey('save'),
  });
  await submitAssessmentAttempt(fixture.context, {
    actor: parentActor,
    command: { attemptId: attempt.id },
    idempotencyKey: engineKey('submit'),
  });
  const task = await prisma.canonicalManualReviewTask.findFirstOrThrow({
    where: { assessmentAttemptId: attempt.id },
  });
  return { ...fixture, attempt, task };
}

describe('canonical manual review and scoring service', () => {
  beforeAll(async () => {
    if (!(await canConnectToTestDb())) {
      throw new Error('Assessment scoring tests require PostgreSQL');
    }
  }, 10_000);

  beforeEach(async () => {
    await setupTestDatabase();
  }, 30_000);

  afterAll(async () => {
    await setupTestDatabase();
    await prisma.$disconnect();
  }, 30_000);

  it('allows only one concurrent claim and permits a controlled expired-lease takeover', async () => {
    const fixture = await createSubmittedManualAttempt();
    const secondAdmin = await prisma.user.create({
      data: {
        email: `engine.admin.${randomUUID()}@nexus-test.com`,
        role: 'ADMIN',
      },
    });
    const contexts = [
      {
        actor: { role: 'ADMIN' as const, userId: fixture.admin.id },
        idempotencyKey: engineKey('claim'),
      },
      {
        actor: { role: 'ADMIN' as const, userId: secondAdmin.id },
        idempotencyKey: engineKey('claim'),
      },
    ];
    const claims = await Promise.allSettled(contexts.map((claim) => (
      claimManualReviewTask(fixture.context, {
        ...claim,
        taskId: fixture.task.id,
        leaseSeconds: 60,
      })
    )));

    expect(claims.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(claims.filter(({ status }) => status === 'rejected')).toHaveLength(1);

    const current = await prisma.canonicalManualReviewTask.findUniqueOrThrow({
      where: { id: fixture.task.id },
    });
    const takeoverActor = current.claimedByUserId === fixture.admin.id
      ? { role: 'ADMIN' as const, userId: secondAdmin.id }
      : { role: 'ADMIN' as const, userId: fixture.admin.id };
    const futureContext = {
      ...fixture.context,
      now: () => new Date(current.claimLeaseExpiresAt!.getTime() + 1),
    };
    const takeover = await claimManualReviewTask(futureContext, {
      actor: takeoverActor,
      taskId: fixture.task.id,
      leaseSeconds: 60,
      idempotencyKey: engineKey('claim'),
    });

    expect(takeover.claimedByUserId).toBe(takeoverActor.userId);
    expect(takeover.claimVersion).toBe(2);
  });

  it('keeps manual decisions append-only and enqueues rescoring by decision version', async () => {
    const fixture = await createSubmittedManualAttempt();
    const actor = { role: 'ADMIN' as const, userId: fixture.admin.id };
    const claimed = await claimManualReviewTask(fixture.context, {
      actor,
      taskId: fixture.task.id,
      leaseSeconds: 300,
      idempotencyKey: engineKey('claim'),
    });
    const completed = await completeManualReviewTask(fixture.context, {
      actor,
      command: {
        taskId: fixture.task.id,
        expectedClaimVersion: claimed.claimVersion,
        awardedPoints: 0.5,
        internalComment: 'Décision initiale interne.',
        publishableComment: 'À approfondir.',
        rubricVersion: 'raw-item-v1',
      },
      idempotencyKey: engineKey('complete'),
    });
    const revised = await reviseManualReviewDecision(fixture.context, {
      actor,
      command: {
        taskId: fixture.task.id,
        awardedPoints: 1,
        internalComment: 'Décision révisée interne.',
        publishableComment: 'Réponse validée.',
        rubricVersion: 'raw-item-v1',
      },
      idempotencyKey: engineKey('revise'),
    });

    expect(completed.decisionVersion).toBe(1);
    expect(revised.decisionVersion).toBe(2);
    expect(await prisma.canonicalManualReviewDecision.count({
      where: { taskId: fixture.task.id },
    })).toBe(2);
    expect((await prisma.canonicalManualReviewDecision.findUniqueOrThrow({
      where: { id: completed.decisionId },
    })).awardedPoints).toBe(0.5);
    expect(await prisma.jobOutbox.count({
      where: {
        aggregateId: fixture.attempt.id,
        jobType: 'SCORE_ATTEMPT',
      },
    })).toBe(2);
  });

  it('blocks final scoring while manual work is pending and gates provisional scoring', async () => {
    const fixture = await createSubmittedManualAttempt();
    const actor = { role: 'ADMIN' as const, userId: fixture.admin.id };

    await expect(scoreAssessmentAttempt(fixture.context, {
      actor,
      attemptId: fixture.attempt.id,
      resultKind: 'FINAL',
      provisionalResultsEnabled: false,
      idempotencyKey: engineKey('score'),
    })).rejects.toThrow(new AssessmentEngineError('MANUAL_REVIEW_REQUIRED'));
    await expect(scoreAssessmentAttempt(fixture.context, {
      actor,
      attemptId: fixture.attempt.id,
      resultKind: 'PROVISIONAL',
      provisionalResultsEnabled: false,
      idempotencyKey: engineKey('score'),
    })).rejects.toThrow(
      new AssessmentEngineError('PROVISIONAL_RESULTS_DISABLED'),
    );
    const provisional = await scoreAssessmentAttempt(fixture.context, {
      actor,
      attemptId: fixture.attempt.id,
      resultKind: 'PROVISIONAL',
      provisionalResultsEnabled: true,
      idempotencyKey: engineKey('score'),
    });

    expect(provisional.resultKind).toBe('PROVISIONAL');
    expect(provisional.calibrationStatus).toBe('PENDING_POLICY_VALIDATION');
    expect((await prisma.canonicalAssessmentAttempt.findUniqueOrThrow({
      where: { id: fixture.attempt.id },
    })).status).toBe('PENDING_MANUAL_REVIEW');
  });

  it('creates one deterministic final snapshot after correction', async () => {
    const fixture = await createSubmittedManualAttempt();
    const actor = { role: 'ADMIN' as const, userId: fixture.admin.id };
    const claimed = await claimManualReviewTask(fixture.context, {
      actor,
      taskId: fixture.task.id,
      leaseSeconds: 300,
      idempotencyKey: engineKey('claim'),
    });
    await completeManualReviewTask(fixture.context, {
      actor,
      command: {
        taskId: fixture.task.id,
        expectedClaimVersion: claimed.claimVersion,
        awardedPoints: 0.5,
        publishableComment: 'À approfondir.',
        rubricVersion: 'raw-item-v1',
      },
      idempotencyKey: engineKey('complete'),
    });
    const [first, recalculated] = await Promise.all([
      scoreAssessmentAttempt(fixture.context, {
        actor,
        attemptId: fixture.attempt.id,
        resultKind: 'FINAL',
        provisionalResultsEnabled: false,
        idempotencyKey: engineKey('score'),
      }),
      scoreAssessmentAttempt(fixture.context, {
        actor,
        attemptId: fixture.attempt.id,
        resultKind: 'FINAL',
        provisionalResultsEnabled: false,
        idempotencyKey: engineKey('score'),
      }),
    ]);

    expect(first.id).toBe(recalculated.id);
    expect(first).toMatchObject({
      calibrationStatus: 'PENDING_POLICY_VALIDATION',
      maxScore: 2,
      resultKind: 'FINAL',
      score: 1.5,
    });
    expect(first.inputChecksum).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(await prisma.scoreSnapshot.count({
      where: {
        assessmentAttemptId: fixture.attempt.id,
        resultKind: 'FINAL',
      },
    })).toBe(1);
    expect((await prisma.canonicalAssessmentAttempt.findUniqueOrThrow({
      where: { id: fixture.attempt.id },
    })).status).toBe('SCORED');
  });
});
