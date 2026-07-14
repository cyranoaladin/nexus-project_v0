import fs from 'fs';
import path from 'path';

import {
  canConnectToTestDb,
  createTestCoach,
  createTestParent,
  createTestStudent,
  setupTestDatabase,
  testPrisma,
} from '../setup/test-database';

const prisma = testPrisma as any;
const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
const migrationPath = path.resolve(
  process.cwd(),
  'prisma/migrations/20260714_add_canonical_bilans_foundation/migration.sql',
);

describe('canonical bilans persistence schema', () => {
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await canConnectToTestDb();
  }, 10_000);

  beforeEach(async () => {
    if (dbAvailable) await setupTestDatabase();
  }, 30_000);

  afterAll(async () => {
    if (dbAvailable) await setupTestDatabase();
    await prisma.$disconnect();
  }, 30_000);

  it('declares the canonical models and immutable reference constraints', () => {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    const migration = fs.readFileSync(migrationPath, 'utf8');

    for (const model of [
      'ParentStudentLink',
      'CanonicalAssessmentAttempt',
      'ScoreSnapshot',
      'EvidenceItem',
      'ReportArtifact',
      'ReportRevision',
      'ReportReview',
      'JobOutbox',
      'NotificationOutbox',
    ]) {
      expect(schema).toContain(`model ${model}`);
    }

    expect(schema).toContain('curriculumVersion');
    expect(schema).toContain('assessmentPackChecksum');
    expect(schema).toContain('scoringPolicyVersion');
    expect(schema).toContain('corpusManifestVersion');
    expect(schema).toContain('contextChecksum');
    expect(schema).toContain('currentPublishedRevisionId');
    expect(schema).toContain('@@unique([eventType, sourceEventKey, recipientUserId])');
    expect(migration).toContain('canonical_parent_student_links_one_active_idx');
    expect(migration).toContain("WHERE \"state\" IN ('PENDING_PARENT_CONSENT', 'VERIFIED')");
  });

  it('stores an immutable report revision and its coach review', async () => {
    if (!dbAvailable) return;

    const { parentUser, parentProfile } = await createTestParent();
    const { student } = await createTestStudent(parentProfile.id, {
      student: { gradeLevel: 'TERMINALE' },
    });
    const { coachProfile } = await createTestCoach();

    const parentLink = await prisma.parentStudentLink.create({
      data: { parentUserId: parentUser.id, studentId: student.id, state: 'VERIFIED' },
    });
    const attempt = await prisma.canonicalAssessmentAttempt.create({
      data: {
        studentId: student.id,
        status: 'SUBMITTED',
        subject: 'MATHEMATIQUES',
        gradeLevel: 'TERMINALE',
        curriculumId: 'lycee-general',
        curriculumVersion: '2026.1',
        assessmentPackId: 'maths-terminale-diagnostic',
        assessmentPackVersion: '3.2.0',
        assessmentPackChecksum: 'sha256:assessment-pack',
        scoringPolicyId: 'mastery-v1',
        scoringPolicyVersion: '1.0.0',
        submittedAt: new Date(),
        answers: { q1: 'B' },
      },
    });
    const score = await prisma.scoreSnapshot.create({
      data: {
        assessmentAttemptId: attempt.id,
        scoringPolicyId: 'mastery-v1',
        scoringPolicyVersion: '1.0.0',
        scoringPolicyChecksum: 'sha256:scoring-policy',
        score: 72.5,
        result: { domains: [] },
      },
    });
    const artifact = await prisma.reportArtifact.create({
      data: { studentId: student.id, assessmentAttemptId: attempt.id, status: 'PENDING_REVIEW' },
    });
    const revision = await prisma.reportRevision.create({
      data: {
        reportArtifactId: artifact.id,
        scoreSnapshotId: score.id,
        reportPackId: 'maths-diagnostic-report',
        reportPackVersion: '2.0.0',
        corpusManifestId: 'lycee-general-corpus',
        corpusManifestVersion: '2026.1',
        promptRevision: 'prompt-7',
        contextChecksum: 'sha256:report-context',
        content: { summary: 'Prioriser les fonctions.' },
      },
    });
    const review = await prisma.reportReview.create({
      data: {
        reportRevisionId: revision.id,
        coachId: coachProfile.id,
        decision: 'APPROVED',
        motif: 'Recommandations vérifiées.',
      },
    });
    const published = await prisma.reportArtifact.update({
      where: { id: artifact.id },
      data: { currentPublishedRevisionId: revision.id, status: 'PUBLISHED', publishedAt: new Date() },
      include: { currentPublishedRevision: true },
    });

    expect(parentLink.state).toBe('VERIFIED');
    expect(review.reportRevisionId).toBe(revision.id);
    expect(published.currentPublishedRevision.contextChecksum).toBe('sha256:report-context');
  });

  it('rejects duplicate outbox idempotency keys', async () => {
    if (!dbAvailable) return;

    await prisma.jobOutbox.create({
      data: {
        jobType: 'SCORE_ATTEMPT',
        aggregateType: 'CanonicalAssessmentAttempt',
        aggregateId: 'attempt-1',
        sourceEventKey: 'attempt-1.submitted',
        idempotencyKey: 'attempt-1.score',
        payload: {},
      },
    });

    await expect(
      prisma.jobOutbox.create({
        data: {
          jobType: 'SCORE_ATTEMPT',
          aggregateType: 'CanonicalAssessmentAttempt',
          aggregateId: 'attempt-1',
          sourceEventKey: 'attempt-1.submitted',
          idempotencyKey: 'attempt-1.score',
          payload: {},
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rejects duplicate recipient notification events', async () => {
    if (!dbAvailable) return;

    const { parentUser } = await createTestParent();
    const notification = {
      eventType: 'REPORT_PUBLISHED',
      sourceEventKey: 'report-revision-1.published',
      recipientUserId: parentUser.id,
      channel: 'WHATSAPP',
      payload: {},
    };

    await prisma.notificationOutbox.create({ data: notification });
    await expect(prisma.notificationOutbox.create({ data: notification })).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('rejects a second active link for the same parent and student', async () => {
    if (!dbAvailable) return;

    const { parentUser, parentProfile } = await createTestParent();
    const { student } = await createTestStudent(parentProfile.id, {
      student: { gradeLevel: 'SECONDE' },
    });

    await prisma.parentStudentLink.create({
      data: { parentUserId: parentUser.id, studentId: student.id, state: 'PENDING_PARENT_CONSENT' },
    });
    await expect(
      prisma.parentStudentLink.create({
        data: { parentUserId: parentUser.id, studentId: student.id, state: 'VERIFIED' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
