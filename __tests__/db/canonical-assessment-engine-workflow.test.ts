import {
  AssessmentEngineError,
  autosaveAssessmentResponse,
  getAssignmentPublicDefinition,
  startAssessmentAttempt,
  submitAssessmentAttempt,
} from '@/lib/bilans/engine';
import {
  canConnectToTestDb,
  createTestParent,
  setupTestDatabase,
  testPrisma,
} from '../setup/test-database';
import {
  createCanonicalWorkflowFixture,
  engineKey as key,
  publishedAssessmentFixture as definition,
} from './support/canonical-assessment-fixture';

const prisma = testPrisma;
const createFixture = () => createCanonicalWorkflowFixture(prisma);

describe('canonical assessment workflow service', () => {
  beforeAll(async () => {
    if (!(await canConnectToTestDb())) {
      throw new Error('Assessment workflow tests require PostgreSQL');
    }
  }, 10_000);

  beforeEach(async () => {
    await setupTestDatabase();
  }, 30_000);

  afterAll(async () => {
    await setupTestDatabase();
    await prisma.$disconnect();
  }, 30_000);

  it('creates a hash-bound assignment and returns only the public definition', async () => {
    const fixture = await createFixture();
    expect(fixture.assignment).toMatchObject({
      definitionId: definition.id,
      definitionVersion: definition.ref.version,
      definitionChecksum: definition.ref.sha256,
      status: 'AVAILABLE',
    });

    const publicDefinition = await getAssignmentPublicDefinition(fixture.context, {
      actor: { role: 'PARENT', userId: fixture.parentUser.id },
      assignmentId: fixture.assignment.id,
    });
    const serialized = JSON.stringify(publicDefinition);
    expect(serialized).not.toContain('"correct"');
    expect(serialized).not.toContain('Corrigé interne');
    expect(serialized).not.toContain('gradingCriteria');
  });

  it('starts once and resumes the same active attempt across different keys', async () => {
    const fixture = await createFixture();
    const actor = { role: 'PARENT' as const, userId: fixture.parentUser.id };
    const first = await startAssessmentAttempt(fixture.context, {
      actor,
      assignmentId: fixture.assignment.id,
      idempotencyKey: key('start'),
    });
    const resumed = await startAssessmentAttempt(fixture.context, {
      actor,
      assignmentId: fixture.assignment.id,
      idempotencyKey: key('start'),
    });

    expect(resumed.id).toBe(first.id);
    expect(await prisma.canonicalAssessmentAttempt.count()).toBe(1);
  });

  it('rejects one of two concurrent autosaves with the same expected version', async () => {
    const fixture = await createFixture();
    const actor = { role: 'PARENT' as const, userId: fixture.parentUser.id };
    const attempt = await startAssessmentAttempt(fixture.context, {
      actor,
      assignmentId: fixture.assignment.id,
      idempotencyKey: key('start'),
    });
    const command = {
      attemptId: attempt.id,
      itemId: 'qcm',
      expectedVersion: 0,
      response: { selectedOptionIndex: 1 },
    };
    const outcomes = await Promise.allSettled([
      autosaveAssessmentResponse(fixture.context, {
        actor,
        command,
        idempotencyKey: key('save'),
      }),
      autosaveAssessmentResponse(fixture.context, {
        actor,
        command,
        idempotencyKey: key('save'),
      }),
    ]);

    expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.find(({ status }) => status === 'rejected');
    expect(rejected).toMatchObject({
      status: 'rejected',
      reason: new AssessmentEngineError('RESPONSE_VERSION_CONFLICT'),
    });
  });

  it('seals responses, creates manual work and refuses a late autosave', async () => {
    const fixture = await createFixture();
    const actor = { role: 'PARENT' as const, userId: fixture.parentUser.id };
    const attempt = await startAssessmentAttempt(fixture.context, {
      actor,
      assignmentId: fixture.assignment.id,
      idempotencyKey: key('start'),
    });
    await autosaveAssessmentResponse(fixture.context, {
      actor,
      command: {
        attemptId: attempt.id,
        itemId: 'manual',
        expectedVersion: 0,
        response: { textValue: 'Ma justification.' },
      },
      idempotencyKey: key('save'),
    });
    const submitted = await submitAssessmentAttempt(fixture.context, {
      actor,
      command: { attemptId: attempt.id },
      idempotencyKey: key('submit'),
    });

    expect(submitted.status).toBe('PENDING_MANUAL_REVIEW');
    expect(await prisma.canonicalManualReviewTask.count({
      where: { assessmentAttemptId: attempt.id, status: 'PENDING' },
    })).toBe(1);
    expect(await prisma.jobOutbox.count({
      where: { aggregateId: attempt.id, jobType: 'SCORE_ATTEMPT' },
    })).toBe(0);
    await expect(autosaveAssessmentResponse(fixture.context, {
      actor,
      command: {
        attemptId: attempt.id,
        itemId: 'manual',
        expectedVersion: 1,
        response: { textValue: 'Modification tardive.' },
      },
      idempotencyKey: key('save'),
    })).rejects.toThrow(new AssessmentEngineError('ATTEMPT_NOT_EDITABLE'));
  });

  it('detects reuse of an idempotency key with a different payload', async () => {
    const fixture = await createFixture();
    const actor = { role: 'PARENT' as const, userId: fixture.parentUser.id };
    const attempt = await startAssessmentAttempt(fixture.context, {
      actor,
      assignmentId: fixture.assignment.id,
      idempotencyKey: key('start'),
    });
    const idempotencyKey = key('save');
    await autosaveAssessmentResponse(fixture.context, {
      actor,
      command: {
        attemptId: attempt.id,
        itemId: 'qcm',
        expectedVersion: 0,
        response: { selectedOptionIndex: 0 },
      },
      idempotencyKey,
    });
    await expect(autosaveAssessmentResponse(fixture.context, {
      actor,
      command: {
        attemptId: attempt.id,
        itemId: 'qcm',
        expectedVersion: 1,
        response: { selectedOptionIndex: 1 },
      },
      idempotencyKey,
    })).rejects.toThrow(
      new AssessmentEngineError('IDEMPOTENCY_PAYLOAD_MISMATCH'),
    );
  });

  it('does not reveal an assignment or attempt to another parent', async () => {
    const fixture = await createFixture();
    const { parentUser: foreignParent } = await createTestParent();
    const foreignActor = {
      role: 'PARENT' as const,
      userId: foreignParent.id,
    };

    await expect(getAssignmentPublicDefinition(fixture.context, {
      actor: foreignActor,
      assignmentId: fixture.assignment.id,
    })).rejects.toThrow(new AssessmentEngineError('ASSIGNMENT_NOT_FOUND', 404));
    await expect(startAssessmentAttempt(fixture.context, {
      actor: foreignActor,
      assignmentId: fixture.assignment.id,
      idempotencyKey: key('start'),
    })).rejects.toThrow(new AssessmentEngineError('ASSIGNMENT_NOT_FOUND', 404));
  });

  it('refuses a foreign item and enqueues final scoring when no manual answer exists', async () => {
    const fixture = await createFixture();
    const actor = { role: 'PARENT' as const, userId: fixture.parentUser.id };
    const attempt = await startAssessmentAttempt(fixture.context, {
      actor,
      assignmentId: fixture.assignment.id,
      idempotencyKey: key('start'),
    });
    await expect(autosaveAssessmentResponse(fixture.context, {
      actor,
      command: {
        attemptId: attempt.id,
        itemId: 'foreign-item',
        expectedVersion: 0,
        response: { selectedOptionIndex: 0 },
      },
      idempotencyKey: key('save'),
    })).rejects.toThrow(new AssessmentEngineError('ITEM_NOT_IN_DEFINITION', 400));

    await autosaveAssessmentResponse(fixture.context, {
      actor,
      command: {
        attemptId: attempt.id,
        itemId: 'qcm',
        expectedVersion: 0,
        response: { selectedOptionIndex: 1 },
      },
      idempotencyKey: key('save'),
    });
    const submitted = await submitAssessmentAttempt(fixture.context, {
      actor,
      command: { attemptId: attempt.id },
      idempotencyKey: key('submit'),
    });
    const replayed = await submitAssessmentAttempt(fixture.context, {
      actor,
      command: { attemptId: attempt.id },
      idempotencyKey: key('submit'),
    });

    expect(submitted.status).toBe('SUBMITTED');
    expect(replayed).toEqual(submitted);
    expect(await prisma.canonicalManualReviewTask.count()).toBe(0);
    expect(await prisma.jobOutbox.count({
      where: { aggregateId: attempt.id, jobType: 'SCORE_ATTEMPT' },
    })).toBe(1);
  });
});
