/**
 * `projectDiagnosticQueueState` — pure state machine deciding which single
 * queue bucket a submission belongs to. Exhaustive over the real enum
 * combinations (never re-derived differently by the API route or the UI).
 */
import { createHash, randomUUID } from 'node:crypto';
import {
  listDiagnosticSubmissionsQueue,
  projectDiagnosticQueueState,
  queueCandidateSelect,
} from '@/lib/core-v2/queries/diagnostics-queue';
import { selectCurrentDiagnosticSubmission } from '@/lib/diagnostics/current-submission';
import { createHousehold, createStudent } from '@/lib/core-v2/services';
import { attributeDiagnostic } from '@/lib/core-v2/services/diagnostics';
import { setupServiceHarness } from '../helpers/service-harness';

const h = setupServiceHarness();

beforeEach(() => {
  process.env.DIAGNOSTIC_DEMO_MODE = '1';
  process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = '';
});

async function seedAssignment(label: string) {
  const { household } = await createHousehold(h.client, h.ctx(), {
    parent: {
      firstName: `P${label}`,
      lastName: 'Synthetic',
      email: `parent-queue-query-${label}@synthetic.test`,
    },
  });
  const { student, user } = await createStudent(h.client, h.ctx(), {
    householdId: household.id,
    student: { firstName: `S${label}`, lastName: 'Synthetic' },
  });
  process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = student.id;
  await h.client.user.update({
    where: { id: user.id },
    data: { accountStatus: 'ACTIVE', phone: '+21699192829', activatedAt: new Date('2026-09-23T10:00:00Z') },
  });
  const instrumentKey = `QUEUE-QUERY-${label}`;
  const instrument = await h.client.diagnosticInstrumentRef.create({
    data: {
      instrumentKey,
      version: '1.0.0',
      title: `Queue query instrument ${label}`,
      subject: 'Test',
      level: 'Toutes',
      targetSession: 'DEMO',
      form: 'FORM_TEST',
      durationMinutes: 30,
      modalities: 'Test only.',
      catalogStatus: 'DEMO_FIXTURE',
      manifestChecksum: createHash('sha256').update(instrumentKey).digest('hex'),
      manifestVersion: 'test/1.0',
      subjectSha256: createHash('sha256').update(`subject-${instrumentKey}`).digest('hex'),
    },
  });
  const assignment = await attributeDiagnostic(h.client, h.ctx(), {
    studentId: student.id,
    instrumentRefId: instrument.id,
  });
  return { assignment, student, user };
}

async function createSubmission(input: {
  assignmentId: string;
  submittedById: string;
  version: number;
  status?: 'RECEIVED' | 'READABLE' | 'ANALYZED' | 'REJECTED';
}) {
  const id = randomUUID();
  return h.client.diagnosticSubmission.create({
    data: {
      id,
      assignmentId: input.assignmentId,
      submittedById: input.submittedById,
      version: input.version,
      storageKey: `queue-query/${id}.pdf`,
      originalFilename: `version-${input.version}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: 123,
      sha256: createHash('sha256').update(id).digest('hex'),
      status: input.status ?? 'RECEIVED',
    },
  });
}

function row(overrides: {
  submissionStatus?: 'RECEIVED' | 'READABLE' | 'ANALYZED';
  processingStatus?: 'QUEUED' | 'EXTRACTING' | 'EXTRACTED' | 'NO_EXTRACTABLE_TEXT' | 'EXTRACTION_FAILED' | null;
  draftStatus?: 'DRAFT' | 'VALIDATED' | 'PUBLISHED' | null;
}) {
  return {
    submissionStatus: overrides.submissionStatus ?? 'RECEIVED',
    processingStatus: overrides.processingStatus ?? null,
    draftStatus: overrides.draftStatus ?? null,
  };
}

describe('projectDiagnosticQueueState', () => {
  test('no processing row yet → NOT_PROCESSED for every usable submission status', () => {
    expect(projectDiagnosticQueueState(row({ submissionStatus: 'RECEIVED' }))).toBe('NOT_PROCESSED');
    expect(projectDiagnosticQueueState(row({ submissionStatus: 'READABLE' }))).toBe('NOT_PROCESSED');
    expect(projectDiagnosticQueueState(row({ submissionStatus: 'ANALYZED' }))).toBe('NOT_PROCESSED');
  });

  test('processing QUEUED or EXTRACTING → PROCESSING', () => {
    expect(projectDiagnosticQueueState(row({ processingStatus: 'QUEUED' }))).toBe('PROCESSING');
    expect(projectDiagnosticQueueState(row({ processingStatus: 'EXTRACTING' }))).toBe('PROCESSING');
  });

  test('processing EXTRACTION_FAILED or NO_EXTRACTABLE_TEXT → FAILED', () => {
    expect(projectDiagnosticQueueState(row({ processingStatus: 'EXTRACTION_FAILED' }))).toBe('FAILED');
    expect(projectDiagnosticQueueState(row({ processingStatus: 'NO_EXTRACTABLE_TEXT' }))).toBe('FAILED');
  });

  test('EXTRACTED with no draft yet → READY_FOR_REVIEW', () => {
    expect(projectDiagnosticQueueState(row({ processingStatus: 'EXTRACTED', draftStatus: null }))).toBe(
      'READY_FOR_REVIEW',
    );
  });

  test('EXTRACTED + draft DRAFT → READY_FOR_REVIEW', () => {
    expect(projectDiagnosticQueueState(row({ processingStatus: 'EXTRACTED', draftStatus: 'DRAFT' }))).toBe(
      'READY_FOR_REVIEW',
    );
  });

  test('EXTRACTED + draft VALIDATED → VALIDATED_UNPUBLISHED', () => {
    expect(projectDiagnosticQueueState(row({ processingStatus: 'EXTRACTED', draftStatus: 'VALIDATED' }))).toBe(
      'VALIDATED_UNPUBLISHED',
    );
  });

  test('EXTRACTED + draft PUBLISHED → PUBLISHED', () => {
    expect(projectDiagnosticQueueState(row({ processingStatus: 'EXTRACTED', draftStatus: 'PUBLISHED' }))).toBe(
      'PUBLISHED',
    );
  });
});

describe('isActionRequired', () => {
  it('is true for NOT_PROCESSED, READY_FOR_REVIEW, VALIDATED_UNPUBLISHED, FAILED — false for PROCESSING and PUBLISHED', async () => {
    const { isActionRequiredState } = await import('@/lib/core-v2/queries/diagnostics-queue');
    expect(isActionRequiredState('NOT_PROCESSED')).toBe(true);
    expect(isActionRequiredState('READY_FOR_REVIEW')).toBe(true);
    expect(isActionRequiredState('VALIDATED_UNPUBLISHED')).toBe(true);
    expect(isActionRequiredState('FAILED')).toBe(true);
    expect(isActionRequiredState('PROCESSING')).toBe(false);
    expect(isActionRequiredState('PUBLISHED')).toBe(false);
  });
});

describe('current diagnostic submission contract', () => {
  const v1 = { id: 'v1', version: 1, status: 'RECEIVED' as const };
  const v2 = { id: 'v2', version: 2, status: 'READABLE' as const };
  const rejectedV3 = { id: 'v3', version: 3, status: 'REJECTED' as const };

  test('selects the greatest usable version and ignores later rejected audit rows', () => {
    expect(selectCurrentDiagnosticSubmission([v1, v2, rejectedV3])).toBe(v2);
    expect(selectCurrentDiagnosticSubmission([v1, rejectedV3])).toBe(v1);
    expect(selectCurrentDiagnosticSubmission([rejectedV3])).toBeNull();
  });

  test('the dedicated candidate select requests identity only', () => {
    expect(queueCandidateSelect).toEqual({
      id: true,
      user: { select: { firstName: true, lastName: true } },
    });
  });
});

describe('listDiagnosticSubmissionsQueue — current usable submission contract', () => {
  test('returns only v2 as the operational action when v1 and v2 are both received', async () => {
    const fixture = await seedAssignment(`SUPERSEDED-${randomUUID()}`);
    const v1 = await createSubmission({
      assignmentId: fixture.assignment.id,
      submittedById: fixture.user.id,
      version: 1,
    });
    const v2 = await createSubmission({
      assignmentId: fixture.assignment.id,
      submittedById: fixture.user.id,
      version: 2,
    });

    const page = await listDiagnosticSubmissionsQueue(h.client, h.ctx(), { status: 'ALL', limit: 20 });

    expect(page.items.map((item) => item.submissionId)).toEqual([v2.id]);
    expect(page.items.map((item) => item.submissionId)).not.toContain(v1.id);
  });

  test('a later rejected version does not supplant the latest non-rejected usable version', async () => {
    const fixture = await seedAssignment(`REJECTED-LATEST-${randomUUID()}`);
    const usable = await createSubmission({
      assignmentId: fixture.assignment.id,
      submittedById: fixture.user.id,
      version: 1,
    });
    const rejected = await createSubmission({
      assignmentId: fixture.assignment.id,
      submittedById: fixture.user.id,
      version: 2,
      status: 'REJECTED',
    });

    const page = await listDiagnosticSubmissionsQueue(h.client, h.ctx(), { status: 'ALL', limit: 20 });

    expect(page.items.map((item) => item.submissionId)).toEqual([usable.id]);
    expect(page.items.map((item) => item.submissionId)).not.toContain(rejected.id);
  });

  test('an assignment with rejected-only history has no operational queue row', async () => {
    const fixture = await seedAssignment(`REJECTED-ONLY-${randomUUID()}`);
    await createSubmission({
      assignmentId: fixture.assignment.id,
      submittedById: fixture.user.id,
      version: 1,
      status: 'REJECTED',
    });

    const page = await listDiagnosticSubmissionsQueue(h.client, h.ctx(), { status: 'ALL', limit: 20 });

    expect(page.items).toEqual([]);
  });

  test('projects the exact flat candidate identity needed by the queue and no User PII', async () => {
    const label = `PII-${randomUUID()}`;
    const fixture = await seedAssignment(label);
    const submission = await createSubmission({
      assignmentId: fixture.assignment.id,
      submittedById: fixture.user.id,
      version: 1,
    });

    const page = await listDiagnosticSubmissionsQueue(h.client, h.ctx(), { status: 'ALL', limit: 20 });
    const row = page.items.find((item) => item.submissionId === submission.id);

    expect(row?.candidate).toEqual({
      id: fixture.student.id,
      firstName: `S${label}`,
      lastName: 'Synthetic',
    });
    expect(Object.keys(row?.candidate ?? {}).sort()).toEqual(['firstName', 'id', 'lastName']);
    expect(JSON.stringify(row?.candidate)).not.toMatch(
      /user|email|phone|accountStatus|activatedAt|createdAt|updatedAt/i,
    );
  });
});
