import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { PrismaClient } from '@prisma/client';

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
const migrationsPath = path.resolve(process.cwd(), 'prisma/migrations');
const prismaBinaryPath = path.resolve(process.cwd(), 'node_modules/.bin/prisma');
const targetMigrationName = '20260729_add_canonical_bilan_requests';

function disposableDatabaseUrl(databaseName: string): string {
  const rawUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!rawUrl) {
    throw new Error('An explicit disposable TEST_DATABASE_URL is required');
  }

  const url = new URL(rawUrl);
  if (
    !['localhost', '127.0.0.1'].includes(url.hostname)
    || !['5432', '5434'].includes(url.port)
    || !['/nexus_test', '/nexus_bilan_engine_dev'].includes(url.pathname)
  ) {
    throw new Error(
      'Migration harness is restricted to localhost ports 5432/5434 and an explicit Nexus test database',
    );
  }
  if (!/^nexus_bilan_(fresh|upgrade)_[a-f0-9]+$/.test(databaseName)) {
    throw new Error(`Unsafe disposable database name: ${databaseName}`);
  }

  url.pathname = `/${databaseName}`;
  url.searchParams.set('schema', 'public');
  return url.toString();
}

function migrationDatabaseName(kind: 'fresh' | 'upgrade'): string {
  return `nexus_bilan_${kind}_${randomUUID().replaceAll('-', '')}`;
}

function quotedDatabase(databaseName: string): string {
  if (!/^nexus_bilan_(fresh|upgrade)_[a-f0-9]+$/.test(databaseName)) {
    throw new Error(`Unsafe disposable database name: ${databaseName}`);
  }
  return `"${databaseName}"`;
}

async function createDisposableDatabase(databaseName: string) {
  await prisma.$executeRawUnsafe(`CREATE DATABASE ${quotedDatabase(databaseName)} TEMPLATE template0`);
}

async function dropDisposableDatabase(databaseName: string) {
  await prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${quotedDatabase(databaseName)} WITH (FORCE)`);
}

function deployMigrations(schemaPath: string, databaseUrl: string) {
  execFileSync(
    prismaBinaryPath,
    ['migrate', 'deploy', '--schema', schemaPath],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 120_000,
    },
  );
}

function createPreviousMigrationWorkspace(): { root: string; schemaPath: string; migrationsPath: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-bilan-upgrade-'));
  const isolatedPrismaPath = path.join(root, 'prisma');
  const isolatedMigrationsPath = path.join(isolatedPrismaPath, 'migrations');
  fs.mkdirSync(isolatedMigrationsPath, { recursive: true });
  fs.copyFileSync(path.resolve(process.cwd(), 'prisma/schema.prisma'), path.join(isolatedPrismaPath, 'schema.prisma'));
  fs.copyFileSync(
    path.resolve(migrationsPath, 'migration_lock.toml'),
    path.join(isolatedMigrationsPath, 'migration_lock.toml'),
  );

  for (const entry of fs.readdirSync(migrationsPath, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name >= targetMigrationName) {
      continue;
    }
    fs.cpSync(
      path.join(migrationsPath, entry.name),
      path.join(isolatedMigrationsPath, entry.name),
      { recursive: true },
    );
  }

  return {
    root,
    schemaPath: path.join(isolatedPrismaPath, 'schema.prisma'),
    migrationsPath: isolatedMigrationsPath,
  };
}

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
    expect(migration).toContain('canonical_bilan_request_events_append_only');
    expect(migration).toContain('canonical_bilan_requests_attempt_student_check');
    expect(migration).toContain('canonical_bilan_requests_attempt_student_fkey');
    expect(migration).toContain('canonical_parent_student_links_terminal_revoked_check');
    expect(schema).toMatch(
      /BilanRequest\s+@relation\(fields: \[requestId\], references: \[id\], onDelete: Restrict\)/,
    );
    expect(schema).toContain('references: [id, studentId]');
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

  it('keeps request events append-only at the database boundary', async () => {
    const request = await prisma.bilanRequest.create({
      data: { ...requestData, submissionHash: 'sha256:append-only-request' },
    });
    const event = await prisma.bilanRequestEvent.create({
      data: {
        requestId: request.id,
        type: 'REQUEST_CREATED',
        actor: 'SYSTEM',
        correlationId: 'correlation-append-only',
        payload: { source: 'test' },
      },
    });

    await expect(
      prisma.bilanRequestEvent.update({
        where: { id: event.id },
        data: { payload: { source: 'mutated' } },
      }),
    ).rejects.toThrow(/append-only|immutable/i);
    await expect(
      prisma.bilanRequestEvent.delete({ where: { id: event.id } }),
    ).rejects.toThrow(/append-only|immutable/i);
  });

  it('retains an audited request and its events instead of cascading deletion', async () => {
    const request = await prisma.bilanRequest.create({
      data: { ...requestData, submissionHash: 'sha256:retained-request' },
    });
    const event = await prisma.bilanRequestEvent.create({
      data: {
        requestId: request.id,
        type: 'REQUEST_CREATED',
        actor: 'SYSTEM',
        correlationId: 'correlation-retained-request',
      },
    });
    const foreignKey = await prisma.$queryRaw<Array<{ delete_action: string }>>`
      SELECT confdeltype::text AS delete_action
      FROM pg_constraint
      WHERE conname = 'canonical_bilan_request_events_requestId_fkey'
    `;

    expect(foreignKey).toEqual([{ delete_action: 'r' }]);
    await expect(
      prisma.bilanRequest.delete({ where: { id: request.id } }),
    ).rejects.toBeDefined();
    await expect(
      prisma.bilanRequestEvent.findUnique({ where: { id: event.id } }),
    ).resolves.toMatchObject({ requestId: request.id });
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

  it('rejects terminal parent-student link creation without a revocation timestamp', async () => {
    const { parentUser, parentProfile } = await createTestParent();
    const { student } = await createTestStudent(parentProfile.id, {
      student: { gradeLevel: 'TERMINALE' },
    });

    await expect(
      prisma.parentStudentLink.create({
        data: {
          parentUserId: parentUser.id,
          studentId: student.id,
          state: 'EXPIRED',
          expiresAt: new Date(Date.now() - 60_000),
        },
      }),
    ).rejects.toThrow(/revokedAt|terminal|check constraint/i);
  });

  it('rejects terminal parent-student link updates without a revocation timestamp', async () => {
    const { parentUser, parentProfile } = await createTestParent();
    const { student } = await createTestStudent(parentProfile.id, {
      student: { gradeLevel: 'TERMINALE' },
    });
    const link = await prisma.parentStudentLink.create({
      data: {
        parentUserId: parentUser.id,
        studentId: student.id,
        state: 'PENDING_PARENT_CONSENT',
      },
    });

    await expect(
      prisma.parentStudentLink.update({
        where: { id: link.id },
        data: { state: 'EXPIRED', expiresAt: new Date(Date.now() - 60_000) },
      }),
    ).rejects.toThrow(/revokedAt|terminal|check constraint/i);
  });

  it('allows a new link only after the previous link is atomically closed', async () => {
    const { parentUser, parentProfile } = await createTestParent();
    const { student } = await createTestStudent(parentProfile.id, {
      student: { gradeLevel: 'TERMINALE' },
    });
    const firstLink = await prisma.parentStudentLink.create({
      data: {
        parentUserId: parentUser.id,
        studentId: student.id,
        state: 'PENDING_PARENT_CONSENT',
      },
    });

    await expect(
      prisma.parentStudentLink.create({
        data: {
          parentUserId: parentUser.id,
          studentId: student.id,
          state: 'VERIFIED',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    await prisma.parentStudentLink.update({
      where: { id: firstLink.id },
      data: {
        state: 'EXPIRED',
        expiresAt: new Date(Date.now() - 60_000),
        revokedAt: new Date(),
        revokedReason: 'Expired and replaced during test.',
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

  it('rejects linking a request to another student canonical attempt', async () => {
    const { parentProfile } = await createTestParent();
    const { student: requestStudent } = await createTestStudent(parentProfile.id, {
      student: { gradeLevel: 'TERMINALE' },
    });
    const { student: attemptStudent } = await createTestStudent(parentProfile.id, {
      student: { gradeLevel: 'TERMINALE' },
    });
    const foreignAttempt = await createCanonicalAttempt(attemptStudent.id);

    await expect(
      prisma.bilanRequest.create({
        data: {
          ...requestData,
          studentId: requestStudent.id,
          canonicalAttemptId: foreignAttempt.id,
          submissionHash: 'sha256:cross-student-request',
        },
      }),
    ).rejects.toBeDefined();
  });

  it('cannot publish a parent artifact from a Nexus artifact revision', async () => {
    const { parentProfile } = await createTestParent();
    const { student } = await createTestStudent(parentProfile.id, {
      student: { gradeLevel: 'TERMINALE' },
    });
    const { coachProfile, coachUser } = await createTestCoach();
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
        reviewerUserId: coachUser.id,
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

  it('deploys the complete migration history into a fresh disposable database', async () => {
    const databaseName = migrationDatabaseName('fresh');
    const databaseUrl = disposableDatabaseUrl(databaseName);
    let isolatedPrisma: PrismaClient | undefined;

    await createDisposableDatabase(databaseName);
    try {
      deployMigrations(path.resolve(process.cwd(), 'prisma/schema.prisma'), databaseUrl);
      isolatedPrisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
      const tables = await isolatedPrisma.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name IN (
            'canonical_bilan_requests',
            'canonical_bilan_request_events',
            'canonical_bilan_flow_sessions',
            'canonical_bilan_magic_links'
          )
        ORDER BY table_name
      `;

      expect(tables.map(({ table_name }) => table_name)).toEqual([
        'canonical_bilan_flow_sessions',
        'canonical_bilan_magic_links',
        'canonical_bilan_request_events',
        'canonical_bilan_requests',
      ]);
    } finally {
      await isolatedPrisma?.$disconnect();
      await dropDisposableDatabase(databaseName);
    }
  }, 120_000);

  it('upgrades preserved legacy and canonical rows with private audience and stable recipient backfills', async () => {
    const databaseName = migrationDatabaseName('upgrade');
    const databaseUrl = disposableDatabaseUrl(databaseName);
    const workspace = createPreviousMigrationWorkspace();
    let isolatedPrisma: PrismaClient | undefined;

    await createDisposableDatabase(databaseName);
    try {
      deployMigrations(workspace.schemaPath, databaseUrl);
      isolatedPrisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

      await isolatedPrisma.$executeRawUnsafe(`
        INSERT INTO "users" ("id", "email", "role", "updatedAt")
        VALUES ('upgrade-parent-user', 'upgrade-parent@example.test', 'PARENT', NOW())
      `);
      await isolatedPrisma.$executeRawUnsafe(`
        INSERT INTO "parent_profiles" ("id", "userId")
        VALUES ('upgrade-parent-profile', 'upgrade-parent-user')
      `);
      await isolatedPrisma.$executeRawUnsafe(`
        INSERT INTO "users" ("id", "email", "role", "updatedAt")
        VALUES ('upgrade-child-user', 'upgrade-child@example.test', 'ELEVE', NOW())
      `);
      await isolatedPrisma.$executeRawUnsafe(`
        INSERT INTO "students" ("id", "parentId", "userId", "gradeLevel", "updatedAt")
        VALUES (
          'upgrade-student',
          'upgrade-parent-profile',
          'upgrade-child-user',
          'TERMINALE',
          NOW()
        )
      `);
      await isolatedPrisma.$executeRawUnsafe(`
        INSERT INTO "assessments"
          ("id", "publicShareId", "subject", "grade", "studentEmail", "studentName", "answers", "updatedAt")
        VALUES (
          'upgrade-assessment',
          'upgrade-assessment-share',
          'MATHEMATIQUES',
          'TERMINALE',
          'upgrade-child@example.test',
          'Upgrade Child',
          '{}'::jsonb,
          NOW()
        )
      `);
      await isolatedPrisma.$executeRawUnsafe(`
        INSERT INTO "bilans"
          ("id", "publicShareId", "type", "subject", "studentEmail", "studentName", "updatedAt")
        VALUES (
          'upgrade-bilan',
          'upgrade-bilan-share',
          'ASSESSMENT_QCM',
          'MATHEMATIQUES',
          'upgrade-child@example.test',
          'Upgrade Child',
          NOW()
        )
      `);
      await isolatedPrisma.$executeRawUnsafe(`
        INSERT INTO "canonical_assessment_attempts"
          (
            "id",
            "studentId",
            "status",
            "subject",
            "gradeLevel",
            "answers",
            "submittedAt",
            "curriculumId",
            "curriculumVersion",
            "assessmentPackId",
            "assessmentPackVersion",
            "assessmentPackChecksum",
            "scoringPolicyId",
            "scoringPolicyVersion",
            "updatedAt"
          )
        VALUES (
          'upgrade-attempt',
          'upgrade-student',
          'SUBMITTED',
          'MATHEMATIQUES',
          'TERMINALE',
          '{}'::jsonb,
          NOW(),
          'lycee-general',
          '2026.1',
          'upgrade-pack',
          '1',
          'sha256:upgrade-pack',
          'upgrade-policy',
          '1',
          NOW()
        )
      `);
      await isolatedPrisma.$executeRawUnsafe(`
        INSERT INTO "canonical_report_artifacts"
          ("id", "studentId", "assessmentAttemptId", "updatedAt")
        VALUES ('upgrade-report-artifact', 'upgrade-student', 'upgrade-attempt', NOW())
      `);
      await isolatedPrisma.$executeRawUnsafe(`
        INSERT INTO "canonical_parent_student_links"
          ("id", "parentUserId", "studentId", "state", "expiresAt", "updatedAt")
        VALUES (
          'upgrade-expired-parent-link',
          'upgrade-parent-user',
          'upgrade-student',
          'EXPIRED',
          NOW() - INTERVAL '1 day',
          NOW()
        )
      `);
      await isolatedPrisma.$executeRawUnsafe(`
        INSERT INTO "canonical_notification_outbox"
          (
            "id",
            "eventType",
            "sourceEventKey",
            "recipientUserId",
            "channel",
            "payload",
            "updatedAt"
          )
        VALUES (
          'upgrade-notification',
          'REPORT_PUBLISHED',
          'upgrade-report.published',
          'upgrade-parent-user',
          'WHATSAPP',
          '{}'::jsonb,
          NOW()
        )
      `);
      await isolatedPrisma.$disconnect();
      isolatedPrisma = undefined;

      fs.cpSync(
        path.join(migrationsPath, targetMigrationName),
        path.join(workspace.migrationsPath, targetMigrationName),
        { recursive: true },
      );
      deployMigrations(workspace.schemaPath, databaseUrl);

      isolatedPrisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
      const preserved = await isolatedPrisma.$queryRaw<Array<{
        assessment_exists: boolean;
        bilan_exists: boolean;
        audience: string;
        recipient_key: string;
        expired_link_backfilled: boolean;
      }>>`
        SELECT
          EXISTS (
            SELECT 1 FROM "assessments" WHERE "id" = 'upgrade-assessment'
          ) AS assessment_exists,
          EXISTS (
            SELECT 1 FROM "bilans" WHERE "id" = 'upgrade-bilan'
          ) AS bilan_exists,
          (
            SELECT "audience"::text
            FROM "canonical_report_artifacts"
            WHERE "id" = 'upgrade-report-artifact'
          ) AS audience,
          (
            SELECT "recipientKey"
            FROM "canonical_notification_outbox"
            WHERE "id" = 'upgrade-notification'
          ) AS recipient_key,
          (
            SELECT "revokedAt" IS NOT NULL
            FROM "canonical_parent_student_links"
            WHERE "id" = 'upgrade-expired-parent-link'
          ) AS expired_link_backfilled
      `;

      expect(preserved).toEqual([{
        assessment_exists: true,
        bilan_exists: true,
        audience: 'NEXUS',
        recipient_key: 'user:upgrade-parent-user',
        expired_link_backfilled: true,
      }]);
    } finally {
      await isolatedPrisma?.$disconnect();
      await dropDisposableDatabase(databaseName);
      fs.rmSync(workspace.root, { recursive: true, force: true });
    }
  }, 120_000);
});
