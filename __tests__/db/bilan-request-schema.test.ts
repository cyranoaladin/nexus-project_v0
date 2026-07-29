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
  'prisma/migrations/20260729_add_canonical_bilan_requests/migration.sql',
);

const requestData = {
  provisionalChildFirstName: 'Lina',
  provisionalChildLastName: 'Ben Salah',
  provisionalChildSchoolName: 'Lycée test',
  subject: 'MATHEMATIQUES',
  gradeLevel: 'TERMINALE',
  schoolYear: '2026-2027',
  academicTrack: 'EDS_GENERALE',
  speciality: 'MATHEMATIQUES',
  mainNeed: 'Consolider les automatismes.',
  message: 'Demande de test sans donnée réelle.',
  campaignKey: 'organic',
  offerKey: 'bilan-gratuit',
  sourcePath: '/bilan-gratuit',
  acquisitionChannel: 'WEBSITE',
  consent: true,
  consentVersion: 'bilan-public-v1',
  consentedAt: new Date(),
  status: 'NEW',
  accountVerificationState: 'UNVERIFIED',
};

async function createCanonicalAttempt(studentId: string) {
  return prisma.canonicalAssessmentAttempt.create({
    data: {
      studentId,
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
}

describe('canonical free assessment request persistence', () => {
  beforeAll(async () => {
    if (!(await canConnectToTestDb())) {
      throw new Error('Bilan request schema tests require a reachable disposable PostgreSQL test database');
    }
  }, 10_000);

  beforeEach(async () => {
    await setupTestDatabase();
  }, 30_000);

  afterAll(async () => {
    await setupTestDatabase();
    await prisma.$disconnect();
  }, 30_000);

  it('declares only additive request, session, magic-link and audience persistence', async () => {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    const migration = fs.readFileSync(migrationPath, 'utf8');

    for (const model of ['BilanRequest', 'BilanRequestEvent', 'BilanFlowSession', 'BilanMagicLink']) {
      expect(schema).toContain(`model ${model}`);
    }

    expect(schema).toContain('enum ReportAudience');
    expect(schema).toMatch(/audience\s+ReportAudience/);
    expect(schema).toContain('@@unique([assessmentAttemptId, audience])');
    expect(schema).toMatch(/recipientKey\s+String/);
    expect(schema).toMatch(/recipientUserId\s+String\?/);
    expect(schema).toMatch(/recipientAddress\s+String\?/);
    expect(schema).toContain('@@unique([eventType, sourceEventKey, recipientKey])');

    expect(migration).toContain('canonical_parent_student_links_one_active_idx');
    expect(migration).toContain('WHERE "revokedAt" IS NULL');
    expect(migration).toContain('canonical_notification_outbox_destination_check');
    expect(migration).toContain('canonical_report_artifacts_current_revision_same_artifact_fkey');
    expect(migration).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(migration).not.toMatch(/\bDROP\s+COLUMN\b/i);

    const legacyObjects = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'assessments',
          'bilans',
          'canonical_report_artifacts',
          'canonical_notification_outbox'
        )
      ORDER BY table_name
    `;

    expect(legacyObjects.map(({ table_name }: { table_name: string }) => table_name)).toEqual([
      'assessments',
      'bilans',
      'canonical_notification_outbox',
      'canonical_report_artifacts',
    ]);
  });

  it('rejects duplicate request submission hashes', async () => {
    const data = { ...requestData, submissionHash: 'sha256:same-submission' };

    await prisma.bilanRequest.create({ data });
    await expect(prisma.bilanRequest.create({ data })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('never allows raw flow or magic-link token hashes to collide', async () => {
    const request = await prisma.bilanRequest.create({
      data: { ...requestData, submissionHash: 'sha256:token-request' },
    });

    await prisma.bilanFlowSession.create({
      data: {
        requestId: request.id,
        tokenHash: 'sha256:flow-token',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await expect(
      prisma.bilanFlowSession.create({
        data: {
          requestId: request.id,
          tokenHash: 'sha256:flow-token',
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    await prisma.bilanMagicLink.create({
      data: {
        requestId: request.id,
        tokenHash: 'sha256:magic-token',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await expect(
      prisma.bilanMagicLink.create({
        data: {
          requestId: request.id,
          tokenHash: 'sha256:magic-token',
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rejects a second non-revoked parent-student link', async () => {
    const { parentUser, parentProfile } = await createTestParent();
    const { student } = await createTestStudent(parentProfile.id, {
      student: { gradeLevel: 'TERMINALE' },
    });

    await prisma.parentStudentLink.create({
      data: {
        parentUserId: parentUser.id,
        studentId: student.id,
        state: 'EXPIRED',
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    await expect(
      prisma.parentStudentLink.create({
        data: {
          parentUserId: parentUser.id,
          studentId: student.id,
          state: 'PENDING_PARENT_CONSENT',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    await prisma.parentStudentLink.updateMany({
      where: { parentUserId: parentUser.id, studentId: student.id },
      data: { state: 'REVOKED', revokedAt: new Date(), revokedReason: 'Replaced during test.' },
    });
    await expect(
      prisma.parentStudentLink.create({
        data: {
          parentUserId: parentUser.id,
          studentId: student.id,
          state: 'PENDING_PARENT_CONSENT',
        },
      }),
    ).resolves.toBeDefined();
  });

  it('keeps exactly one report artifact per attempt and audience', async () => {
    const { parentProfile } = await createTestParent();
    const { student } = await createTestStudent(parentProfile.id, {
      student: { gradeLevel: 'TERMINALE' },
    });
    const attempt = await createCanonicalAttempt(student.id);
    const artifact = {
      studentId: student.id,
      assessmentAttemptId: attempt.id,
      audience: 'PARENT',
    };

    await prisma.reportArtifact.create({ data: artifact });
    await expect(prisma.reportArtifact.create({ data: artifact })).rejects.toMatchObject({
      code: 'P2002',
    });
    await expect(
      prisma.reportArtifact.create({ data: { ...artifact, audience: 'NEXUS' } }),
    ).resolves.toBeDefined();
  });

  it('cannot publish a parent artifact from a Nexus artifact revision', async () => {
    const { parentProfile } = await createTestParent();
    const { student } = await createTestStudent(parentProfile.id, {
      student: { gradeLevel: 'TERMINALE' },
    });
    const { coachProfile } = await createTestCoach();
    const attempt = await createCanonicalAttempt(student.id);
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
    const nexusArtifact = await prisma.reportArtifact.create({
      data: {
        studentId: student.id,
        assessmentAttemptId: attempt.id,
        audience: 'NEXUS',
        status: 'PENDING_REVIEW',
      },
    });
    const parentArtifact = await prisma.reportArtifact.create({
      data: {
        studentId: student.id,
        assessmentAttemptId: attempt.id,
        audience: 'PARENT',
        status: 'PENDING_REVIEW',
      },
    });
    const nexusRevision = await prisma.reportRevision.create({
      data: {
        reportArtifactId: nexusArtifact.id,
        scoreSnapshotId: score.id,
        status: 'PENDING_REVIEW',
        reportPackId: 'maths-diagnostic-report',
        reportPackVersion: '2.0.0',
        corpusManifestId: 'lycee-general-corpus',
        corpusManifestVersion: '2026.1',
        promptRevision: 'prompt-7',
        contextChecksum: 'sha256:nexus-revision',
        content: { internalNotes: 'Projection équipe.' },
      },
    });
    await prisma.reportReview.create({
      data: {
        reportRevisionId: nexusRevision.id,
        coachId: coachProfile.id,
        decision: 'APPROVED',
        motif: 'Projection Nexus validée.',
      },
    });
    await prisma.reportRevision.update({
      where: { id: nexusRevision.id },
      data: { status: 'COACH_VALIDATED' },
    });

    await expect(
      prisma.reportArtifact.update({
        where: { id: parentArtifact.id },
        data: {
          currentPublishedRevisionId: nexusRevision.id,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      }),
    ).rejects.toBeDefined();
  });

  it('requires a destination matching the notification channel', async () => {
    const insert = (values: {
      id: string;
      channel: 'EMAIL' | 'WHATSAPP';
      recipientKey: string;
      recipientUserId?: string;
      recipientAddress?: string;
    }) => prisma.$executeRaw`
      INSERT INTO "canonical_notification_outbox"
        (
          "id",
          "eventType",
          "sourceEventKey",
          "recipientKey",
          "recipientUserId",
          "recipientAddress",
          "channel",
          "payload",
          "updatedAt"
        )
      VALUES (
        ${values.id},
        'BILAN_REQUEST_CREATED',
        ${`${values.id}.created`},
        ${values.recipientKey},
        ${values.recipientUserId ?? null},
        ${values.recipientAddress ?? null},
        ${values.channel}::"NotificationChannel",
        '{}'::jsonb,
        NOW()
      )
    `;

    await expect(
      insert({ id: 'email-without-address', channel: 'EMAIL', recipientKey: 'staff' }),
    ).rejects.toThrow(/destination|check constraint/i);
    await expect(
      insert({
        id: 'whatsapp-without-user',
        channel: 'WHATSAPP',
        recipientKey: 'user:missing',
      }),
    ).rejects.toThrow(/destination|check constraint/i);
  });

  it('deduplicates notification events by stable recipient key', async () => {
    const notification = {
      eventType: 'BILAN_REQUEST_CREATED',
      sourceEventKey: 'request-1.created',
      recipientKey: 'email:pedagogie@nexusreussite.academy',
      recipientAddress: 'pedagogie@nexusreussite.academy',
      channel: 'EMAIL',
      payload: {},
    };

    await prisma.notificationOutbox.create({ data: notification });
    await expect(prisma.notificationOutbox.create({ data: notification })).rejects.toMatchObject({
      code: 'P2002',
    });
  });
});
