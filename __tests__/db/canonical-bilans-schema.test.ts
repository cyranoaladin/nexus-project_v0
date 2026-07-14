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
const integrityMigrationPath = path.resolve(
  process.cwd(),
  'prisma/migrations/20260714_harden_canonical_bilans_integrity/migration.sql',
);

describe('canonical bilans persistence schema', () => {
  beforeAll(async () => {
    if (!(await canConnectToTestDb())) {
      throw new Error('Canonical bilans schema tests require a reachable PostgreSQL test database');
    }
  }, 10_000);

  beforeEach(async () => {
    await setupTestDatabase();
  }, 30_000);

  afterAll(async () => {
    await setupTestDatabase();
    await prisma.$disconnect();
  }, 30_000);

  it('declares the canonical models and immutable reference constraints', () => {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    const migration = fs.readFileSync(migrationPath, 'utf8');
    const integrityMigration = fs.readFileSync(integrityMigrationPath, 'utf8');

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
    expect(integrityMigration).toContain('canonical_bilans_reject_append_only_mutation');
    expect(integrityMigration).toContain('canonical_assessment_attempts_submitted_immutable');
    expect(integrityMigration).toContain('canonical_report_artifacts_current_revision_same_artifact_fkey');
    expect(schema).toContain('references: [id, reportArtifactId]');
  });

  it('stores an immutable report revision and its coach review', async () => {
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

  it('rejects mutations and deletions of submitted provenance and append-only audit records', async () => {
    const { parentProfile } = await createTestParent();
    const { student } = await createTestStudent(parentProfile.id, {
      student: { gradeLevel: 'TERMINALE' },
    });
    const attemptData = {
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
    };
    const attempt = await prisma.canonicalAssessmentAttempt.create({ data: attemptData });
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
    const evidence = await prisma.evidenceItem.create({
      data: { scoreSnapshotId: score.id, kind: 'ANSWER', sourceKey: 'q1', payload: { answer: 'B' } },
    });
    const artifact = await prisma.reportArtifact.create({
      data: { studentId: student.id, assessmentAttemptId: attempt.id },
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

    await expect(
      prisma.canonicalAssessmentAttempt.update({
        where: { id: attempt.id },
        data: { answers: { q1: 'A' } },
      }),
    ).rejects.toThrow(/immutable|append-only/i);
    await expect(prisma.scoreSnapshot.update({ where: { id: score.id }, data: { score: 10 } })).rejects.toThrow(
      /immutable|append-only/i,
    );
    await expect(
      prisma.evidenceItem.update({ where: { id: evidence.id }, data: { payload: { answer: 'A' } } }),
    ).rejects.toThrow(/immutable|append-only/i);
    await expect(
      prisma.reportRevision.update({ where: { id: revision.id }, data: { contextChecksum: 'changed' } }),
    ).rejects.toThrow(/immutable|append-only/i);

    const deletableAttempt = await prisma.canonicalAssessmentAttempt.create({ data: attemptData });
    await expect(prisma.canonicalAssessmentAttempt.delete({ where: { id: deletableAttempt.id } })).rejects.toThrow(
      /immutable|append-only/i,
    );
    await expect(prisma.scoreSnapshot.delete({ where: { id: score.id } })).rejects.toThrow(/immutable|append-only/i);
    await expect(prisma.evidenceItem.delete({ where: { id: evidence.id } })).rejects.toThrow(/immutable|append-only/i);
    await expect(prisma.reportRevision.delete({ where: { id: revision.id } })).rejects.toThrow(
      /immutable|append-only/i,
    );
  });

  it('rejects a published revision pointer to another artifact and protects the pointed revision', async () => {
    const { parentProfile } = await createTestParent();
    const { student } = await createTestStudent(parentProfile.id, {
      student: { gradeLevel: 'TERMINALE' },
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
        result: {},
      },
    });
    const firstArtifact = await prisma.reportArtifact.create({
      data: { studentId: student.id, assessmentAttemptId: attempt.id },
    });
    const secondArtifact = await prisma.reportArtifact.create({
      data: { studentId: student.id, assessmentAttemptId: attempt.id },
    });
    const firstRevision = await prisma.reportRevision.create({
      data: {
        reportArtifactId: firstArtifact.id,
        scoreSnapshotId: score.id,
        reportPackId: 'maths-diagnostic-report',
        reportPackVersion: '2.0.0',
        corpusManifestId: 'lycee-general-corpus',
        corpusManifestVersion: '2026.1',
        promptRevision: 'prompt-7',
        contextChecksum: 'sha256:first',
        content: {},
      },
    });

    await expect(
      prisma.reportArtifact.update({
        where: { id: secondArtifact.id },
        data: { currentPublishedRevisionId: firstRevision.id, status: 'PUBLISHED' },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await prisma.reportArtifact.update({
      where: { id: firstArtifact.id },
      data: { currentPublishedRevisionId: firstRevision.id, status: 'PUBLISHED' },
    });
    await expect(prisma.reportRevision.delete({ where: { id: firstRevision.id } })).rejects.toThrow(
      /immutable|append-only|foreign key/i,
    );
  });

  it('requires a notification source event and persists worker lease transitions', async () => {
    const { parentUser } = await createTestParent();
    const job = await prisma.jobOutbox.create({
      data: {
        jobType: 'GENERATE_REPORT',
        aggregateType: 'ReportArtifact',
        aggregateId: 'artifact-1',
        sourceEventKey: 'artifact-1.review-requested',
        idempotencyKey: 'artifact-1.generate',
        payload: {},
      },
    });
    const leasedAt = new Date(Date.now() + 60_000);
    const leased = await prisma.jobOutbox.update({
      where: { id: job.id },
      data: { status: 'LEASED', leaseOwner: 'worker-1', leaseExpiresAt: leasedAt },
    });

    expect(leased.status).toBe('LEASED');
    expect(leased.leaseOwner).toBe('worker-1');
    expect(leased.leaseExpiresAt).toEqual(leasedAt);
    await expect(
      prisma.$executeRaw`
        INSERT INTO "canonical_notification_outbox"
          ("id", "eventType", "sourceEventKey", "recipientUserId", "channel", "payload", "updatedAt")
        VALUES ('missing-source-event', 'REPORT_PUBLISHED', NULL, ${parentUser.id}, 'WHATSAPP', '{}'::jsonb, NOW())
      `,
    ).rejects.toThrow(/null|not-null/i);
  });
});
