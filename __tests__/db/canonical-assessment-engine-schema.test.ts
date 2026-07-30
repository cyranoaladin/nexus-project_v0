import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';

import {
  canConnectToTestDb,
  createTestParent,
  createTestStudent,
  setupTestDatabase,
  testPrisma,
} from '../setup/test-database';

const prisma = testPrisma as any;
const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
const migrationPath = path.resolve(
  process.cwd(),
  'prisma/migrations/20260730_add_canonical_assessment_engine_v1/migration.sql',
);
const migrationsPath = path.resolve(process.cwd(), 'prisma/migrations');
const prismaBinaryPath = path.resolve(process.cwd(), 'node_modules/.bin/prisma');
const statusMigrationName = '20260730_add_canonical_assessment_attempt_statuses';
const engineMigrationName = '20260730_add_canonical_assessment_engine_v1';

function migrationDatabaseName(kind: 'fresh' | 'upgrade'): string {
  return `nexus_engine_${kind}_${randomUUID().replaceAll('-', '')}`;
}

function quotedDatabase(databaseName: string): string {
  if (!/^nexus_engine_(fresh|upgrade)_[a-f0-9]+$/.test(databaseName)) {
    throw new Error(`Unsafe disposable database name: ${databaseName}`);
  }
  return `"${databaseName}"`;
}

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
      'Assessment migration harness requires an explicit local Nexus test database',
    );
  }
  quotedDatabase(databaseName);
  url.pathname = `/${databaseName}`;
  url.searchParams.set('schema', 'public');
  return url.toString();
}

async function createDisposableDatabase(databaseName: string) {
  await prisma.$executeRawUnsafe(
    `CREATE DATABASE ${quotedDatabase(databaseName)} TEMPLATE template0`,
  );
}

async function dropDisposableDatabase(databaseName: string) {
  await prisma.$executeRawUnsafe(
    `DROP DATABASE IF EXISTS ${quotedDatabase(databaseName)} WITH (FORCE)`,
  );
}

function deployMigrations(targetSchemaPath: string, databaseUrl: string) {
  execFileSync(
    prismaBinaryPath,
    ['migrate', 'deploy', '--schema', targetSchemaPath],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 120_000,
    },
  );
}

function createPreviousMigrationWorkspace(): {
  root: string;
  schemaPath: string;
  migrationsPath: string;
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-engine-upgrade-'));
  const isolatedPrismaPath = path.join(root, 'prisma');
  const isolatedMigrationsPath = path.join(isolatedPrismaPath, 'migrations');
  fs.mkdirSync(isolatedMigrationsPath, { recursive: true });
  fs.copyFileSync(schemaPath, path.join(isolatedPrismaPath, 'schema.prisma'));
  fs.copyFileSync(
    path.join(migrationsPath, 'migration_lock.toml'),
    path.join(isolatedMigrationsPath, 'migration_lock.toml'),
  );

  for (const entry of fs.readdirSync(migrationsPath, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name >= statusMigrationName) {
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

async function createFixture() {
  const { parentUser, parentProfile } = await createTestParent();
  const { student } = await createTestStudent(parentProfile.id);
  const staff = await prisma.user.create({
    data: {
      email: `test.admin.${randomUUID()}@nexus-test.com`,
      role: 'ADMIN',
      firstName: 'Admin',
      lastName: 'Test',
    },
  });
  await prisma.parentStudentLink.create({
    data: {
      parentUserId: parentUser.id,
      studentId: student.id,
      state: 'VERIFIED',
      consentedAt: new Date(),
      verifiedAt: new Date(),
    },
  });
  const request = await prisma.bilanRequest.create({
    data: {
      parentUserId: parentUser.id,
      studentId: student.id,
      subject: 'MATHEMATIQUES',
      gradeLevel: 'TERMINALE',
      schoolYear: '2026-2027',
      mainNeed: 'Établir les priorités de révision.',
      consent: true,
      consentVersion: 'test-v1',
      consentedAt: new Date(),
      accountVerificationState: 'VERIFIED',
      status: 'READY_FOR_ASSESSMENT',
      submissionHash: `sha256:${randomUUID()}`,
    },
  });
  const assignment = await prisma.canonicalAssessmentAssignment.create({
    data: {
      bilanRequestId: request.id,
      studentId: student.id,
      definitionId: 'maths-entree-terminale',
      moduleId: 'terminale-mathematiques',
      definitionVersion: 'pre-rentree-2026:manifest-1:edition-2026',
      definitionChecksum:
        'sha256:db723beb770084dc1622f2644e0d64630d21b376c67895b54c58b8457ebde16c',
      manifestVersion: 1,
      manifestChecksum:
        'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      moduleCatalogVersion: '2026-pre-rentree-v5-planning-windows',
      moduleCatalogChecksum:
        'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      resolvedAt: new Date(),
      opensAt: new Date(Date.now() - 60_000),
      dueAt: new Date(Date.now() + 60_000),
      status: 'AVAILABLE',
      assignedByUserId: staff.id,
      maxAttempts: 1,
      idempotencyKey: `assignment-${randomUUID()}`,
      idempotencyRequestHash: `sha256:${'c'.repeat(64)}`,
    },
  });
  const attempt = await prisma.canonicalAssessmentAttempt.create({
    data: {
      assignmentId: assignment.id,
      attemptNumber: 1,
      studentId: student.id,
      status: 'IN_PROGRESS',
      subject: 'MATHEMATIQUES',
      gradeLevel: 'TERMINALE',
      curriculumId: 'pre-rentree-2026',
      curriculumVersion: '2026-pre-rentree-v5-planning-windows',
      assessmentPackId: assignment.definitionId,
      assessmentPackVersion: assignment.definitionVersion,
      assessmentPackChecksum: assignment.definitionChecksum,
      scoringPolicyId: 'canonical-raw-item-score',
      scoringPolicyVersion: '1.0.0',
      answers: {},
      startedAt: new Date(),
    },
  });
  return { assignment, attempt, parentUser, request, staff, student };
}

describe('canonical assessment engine v1 persistence', () => {
  beforeAll(async () => {
    if (!(await canConnectToTestDb())) {
      throw new Error('Assessment engine schema tests require PostgreSQL');
    }
  }, 10_000);

  beforeEach(async () => {
    await setupTestDatabase();
  }, 30_000);

  afterAll(async () => {
    await setupTestDatabase();
    await prisma.$disconnect();
  }, 30_000);

  it('declares only the consumed engine models and database invariants', () => {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    const migration = fs.readFileSync(migrationPath, 'utf8');

    for (const model of [
      'CanonicalAssessmentAssignment',
      'CanonicalAssessmentResponse',
      'CanonicalManualReviewTask',
      'CanonicalManualReviewDecision',
      'AssessmentIdempotencyRecord',
      'AssessmentAuditEvent',
      'ReportPublication',
    ]) {
      expect(schema).toContain(`model ${model}`);
    }
    for (const invariant of [
      'canonical_assessment_responses_content_check',
      'canonical_assessment_responses_sealed_guard',
      'canonical_manual_review_decisions_append_only',
      'canonical_assessment_audit_events_append_only',
      'canonical_score_snapshots_manual_gate',
      'canonical_report_revisions_final_score_guard',
      'canonical_report_publications_one_active_idx',
    ]) {
      expect(migration).toContain(invariant);
    }
    expect(schema).toContain('@@unique([assignmentId, attemptNumber])');
    expect(schema).toContain('@@unique([assessmentAttemptId, itemId])');
    expect(schema).toContain('@@unique([scope, actorKey, idempotencyKey])');
  });

  it('enforces assignment, attempt and response uniqueness', async () => {
    const { assignment, attempt } = await createFixture();
    const response = {
      assessmentAttemptId: attempt.id,
      itemId: 'n01-i1',
      responseType: 'AUTOMATIC_QCM',
      selectedOptionIndex: 1,
      version: 1,
      lastAutosavedAt: new Date(),
    };
    await prisma.canonicalAssessmentResponse.create({ data: response });

    await expect(
      prisma.canonicalAssessmentResponse.create({ data: response }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await expect(
      prisma.canonicalAssessmentAttempt.create({
        data: {
          assignmentId: assignment.id,
          attemptNumber: 1,
          studentId: attempt.studentId,
          status: 'IN_PROGRESS',
          subject: 'MATHEMATIQUES',
          gradeLevel: 'TERMINALE',
          curriculumId: 'pre-rentree-2026',
          curriculumVersion: 'v1',
          assessmentPackId: 'duplicate',
          assessmentPackVersion: 'v1',
          assessmentPackChecksum: `sha256:${'d'.repeat(64)}`,
          scoringPolicyId: 'raw',
          scoringPolicyVersion: 'v1',
          answers: {},
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rejects invalid response shapes and every mutation after sealing', async () => {
    const { attempt } = await createFixture();

    await expect(
      prisma.canonicalAssessmentResponse.create({
        data: {
          assessmentAttemptId: attempt.id,
          itemId: 'n01-i1',
          responseType: 'AUTOMATIC_QCM',
          textValue: 'réponse incompatible',
          version: 1,
          lastAutosavedAt: new Date(),
        },
      }),
    ).rejects.toThrow(/content|check constraint/i);

    const response = await prisma.canonicalAssessmentResponse.create({
      data: {
        assessmentAttemptId: attempt.id,
        itemId: 'n01-i1',
        responseType: 'AUTOMATIC_QCM',
        selectedOptionIndex: 1,
        automaticOutcome: 'AUTOMATIC_CORRECT',
        automaticPoints: 1,
        version: 1,
        lastAutosavedAt: new Date(),
      },
    });
    const sealedAt = new Date();
    await prisma.canonicalAssessmentResponse.update({
      where: { id: response.id },
      data: { sealedAt },
    });
    await prisma.canonicalAssessmentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'SUBMITTED',
        sealedAt,
        submittedAt: sealedAt,
        submissionHash: `sha256:${'e'.repeat(64)}`,
      },
    });

    await expect(
      prisma.canonicalAssessmentResponse.update({
        where: { id: response.id },
        data: { selectedOptionIndex: 2, version: { increment: 1 } },
      }),
    ).rejects.toThrow(/sealed|immutable/i);
    await expect(
      prisma.canonicalAssessmentResponse.delete({ where: { id: response.id } }),
    ).rejects.toThrow(/sealed|immutable/i);
  });

  it('allows only one concurrent manual-review claim and preserves revised decisions', async () => {
    const { attempt, staff } = await createFixture();
    const secondStaff = await prisma.user.create({
      data: {
        email: `test.admin.${randomUUID()}@nexus-test.com`,
        role: 'ADMIN',
      },
    });
    const response = await prisma.canonicalAssessmentResponse.create({
      data: {
        assessmentAttemptId: attempt.id,
        itemId: 'n01-i2',
        responseType: 'MANUAL_SHORT_RESPONSE',
        textValue: 'Une réponse à relire.',
        version: 1,
        lastAutosavedAt: new Date(),
      },
    });
    const task = await prisma.canonicalManualReviewTask.create({
      data: {
        responseId: response.id,
        assessmentAttemptId: attempt.id,
        status: 'PENDING',
      },
    });
    const lease = new Date(Date.now() + 60_000);
    const [first, second] = await Promise.all([
      prisma.canonicalManualReviewTask.updateMany({
        where: { id: task.id, status: 'PENDING', claimedByUserId: null },
        data: {
          status: 'CLAIMED',
          claimedByUserId: staff.id,
          claimLeaseExpiresAt: lease,
          claimVersion: { increment: 1 },
        },
      }),
      prisma.canonicalManualReviewTask.updateMany({
        where: { id: task.id, status: 'PENDING', claimedByUserId: null },
        data: {
          status: 'CLAIMED',
          claimedByUserId: secondStaff.id,
          claimLeaseExpiresAt: lease,
          claimVersion: { increment: 1 },
        },
      }),
    ]);
    expect(first.count + second.count).toBe(1);

    const reviewer = first.count === 1 ? staff : secondStaff;
    const firstDecision = await prisma.canonicalManualReviewDecision.create({
      data: {
        taskId: task.id,
        version: 1,
        reviewerUserId: reviewer.id,
        awardedPoints: 0.5,
        maxPoints: 1,
        internalComment: 'Décision initiale.',
        publishableComment: 'Réponse partiellement correcte.',
        rubricVersion: 'canonical-manual-rubric-v1',
        idempotencyKey: `manual-${randomUUID()}`,
        idempotencyRequestHash: `sha256:${'f'.repeat(64)}`,
      },
    });
    await prisma.canonicalManualReviewTask.update({
      where: { id: task.id },
      data: {
        status: 'COMPLETED',
        currentDecisionId: firstDecision.id,
        completedAt: new Date(),
        claimLeaseExpiresAt: null,
      },
    });
    const revised = await prisma.canonicalManualReviewDecision.create({
      data: {
        taskId: task.id,
        version: 2,
        reviewerUserId: reviewer.id,
        awardedPoints: 1,
        maxPoints: 1,
        internalComment: 'Décision révisée avec justification.',
        publishableComment: 'Réponse correcte.',
        rubricVersion: 'canonical-manual-rubric-v1',
        supersedesDecisionId: firstDecision.id,
        idempotencyKey: `manual-${randomUUID()}`,
        idempotencyRequestHash: `sha256:${'a'.repeat(64)}`,
      },
    });
    await prisma.canonicalManualReviewTask.update({
      where: { id: task.id },
      data: { currentDecisionId: revised.id },
    });

    await expect(
      prisma.canonicalManualReviewDecision.update({
        where: { id: firstDecision.id },
        data: { awardedPoints: 0 },
      }),
    ).rejects.toThrow(/append-only|immutable/i);
    const decisions = await prisma.canonicalManualReviewDecision.findMany({
      where: { taskId: task.id },
      orderBy: { version: 'asc' },
    });
    expect(decisions.map(({ awardedPoints }: { awardedPoints: number }) => awardedPoints))
      .toEqual([0.5, 1]);
  });

  it('blocks final scoring while manual review is incomplete', async () => {
    const { attempt } = await createFixture();
    const response = await prisma.canonicalAssessmentResponse.create({
      data: {
        assessmentAttemptId: attempt.id,
        itemId: 'n01-i2',
        responseType: 'MANUAL_SHORT_RESPONSE',
        textValue: 'À corriger.',
        version: 1,
        lastAutosavedAt: new Date(),
      },
    });
    await prisma.canonicalManualReviewTask.create({
      data: {
        responseId: response.id,
        assessmentAttemptId: attempt.id,
        status: 'PENDING',
      },
    });
    await prisma.canonicalAssessmentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'PENDING_MANUAL_REVIEW',
        submittedAt: new Date(),
        sealedAt: new Date(),
        submissionHash: `sha256:${'b'.repeat(64)}`,
      },
    });

    await expect(
      prisma.scoreSnapshot.create({
        data: {
          assessmentAttemptId: attempt.id,
          scoringPolicyId: 'canonical-raw-item-score',
          scoringPolicyVersion: '1.0.0',
          scoringPolicyChecksum: `sha256:${'c'.repeat(64)}`,
          inputChecksum: `sha256:${'d'.repeat(64)}`,
          resultKind: 'FINAL',
          score: 0,
          maxScore: 24,
          result: {},
          calibrationStatus: 'PENDING_POLICY_VALIDATION',
        },
      }),
    ).rejects.toThrow(/manual|review|correction/i);
  });

  it('deploys every migration on a fresh disposable PostgreSQL database', async () => {
    const databaseName = migrationDatabaseName('fresh');
    const databaseUrl = disposableDatabaseUrl(databaseName);
    let isolatedPrisma: PrismaClient | undefined;

    await createDisposableDatabase(databaseName);
    try {
      deployMigrations(schemaPath, databaseUrl);
      isolatedPrisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
      const tables = await isolatedPrisma.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN (
            'canonical_assessment_assignments',
            'canonical_assessment_responses',
            'canonical_manual_review_tasks',
            'canonical_manual_review_decisions',
            'canonical_assessment_idempotency',
            'canonical_assessment_audit_events',
            'canonical_report_publications'
          )
        ORDER BY table_name
      `;

      expect(tables.map(({ table_name }) => table_name)).toEqual([
        'canonical_assessment_assignments',
        'canonical_assessment_audit_events',
        'canonical_assessment_idempotency',
        'canonical_assessment_responses',
        'canonical_manual_review_decisions',
        'canonical_manual_review_tasks',
        'canonical_report_publications',
      ]);
    } finally {
      await isolatedPrisma?.$disconnect();
      await dropDisposableDatabase(databaseName);
    }
  }, 120_000);

  it('upgrades the prior schema without inventing historical score denominators', async () => {
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
        VALUES ('engine-upgrade-parent', 'engine-upgrade-parent@example.test', 'PARENT', NOW())
      `);
      await isolatedPrisma.$executeRawUnsafe(`
        INSERT INTO "parent_profiles" ("id", "userId")
        VALUES ('engine-upgrade-parent-profile', 'engine-upgrade-parent')
      `);
      await isolatedPrisma.$executeRawUnsafe(`
        INSERT INTO "users" ("id", "email", "role", "updatedAt")
        VALUES ('engine-upgrade-child', 'engine-upgrade-child@example.test', 'ELEVE', NOW())
      `);
      await isolatedPrisma.$executeRawUnsafe(`
        INSERT INTO "students" ("id", "parentId", "userId", "gradeLevel", "updatedAt")
        VALUES (
          'engine-upgrade-student',
          'engine-upgrade-parent-profile',
          'engine-upgrade-child',
          'TERMINALE',
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
          'engine-upgrade-attempt',
          'engine-upgrade-student',
          'SUBMITTED',
          'MATHEMATIQUES',
          'TERMINALE',
          '{}'::jsonb,
          NOW(),
          'legacy-curriculum',
          '2026.1',
          'legacy-pack',
          '1',
          'sha256:legacy-pack',
          'legacy-policy',
          '1',
          NOW()
        )
      `);
      await isolatedPrisma.$executeRawUnsafe(`
        INSERT INTO "canonical_score_snapshots"
          (
            "id",
            "assessmentAttemptId",
            "scoringPolicyId",
            "scoringPolicyVersion",
            "scoringPolicyChecksum",
            "score",
            "result"
          )
        VALUES (
          'engine-upgrade-score',
          'engine-upgrade-attempt',
          'legacy-policy',
          '1',
          'legacy-checksum',
          175,
          '{"legacyScale": true}'::jsonb
        )
      `);
      await isolatedPrisma.$executeRawUnsafe(`
        INSERT INTO "canonical_report_artifacts"
          ("id", "studentId", "assessmentAttemptId", "updatedAt")
        VALUES (
          'engine-upgrade-report',
          'engine-upgrade-student',
          'engine-upgrade-attempt',
          NOW()
        )
      `);
      await isolatedPrisma.$disconnect();
      isolatedPrisma = undefined;

      for (const migrationName of [statusMigrationName, engineMigrationName]) {
        fs.cpSync(
          path.join(migrationsPath, migrationName),
          path.join(workspace.migrationsPath, migrationName),
          { recursive: true },
        );
      }
      deployMigrations(workspace.schemaPath, databaseUrl);

      isolatedPrisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
      const preserved = await isolatedPrisma.$queryRaw<Array<{
        assignment_id: string | null;
        attempt_exists: boolean;
        input_checksum: string | null;
        max_score: number | null;
        report_exists: boolean;
        result_kind: string;
        started_at_present: boolean;
      }>>`
        SELECT
          EXISTS (
            SELECT 1
            FROM "canonical_assessment_attempts"
            WHERE "id" = 'engine-upgrade-attempt'
          ) AS attempt_exists,
          (
            SELECT "assignmentId"
            FROM "canonical_assessment_attempts"
            WHERE "id" = 'engine-upgrade-attempt'
          ) AS assignment_id,
          (
            SELECT "startedAt" IS NOT NULL
            FROM "canonical_assessment_attempts"
            WHERE "id" = 'engine-upgrade-attempt'
          ) AS started_at_present,
          (
            SELECT "inputChecksum"
            FROM "canonical_score_snapshots"
            WHERE "id" = 'engine-upgrade-score'
          ) AS input_checksum,
          (
            SELECT "maxScore"
            FROM "canonical_score_snapshots"
            WHERE "id" = 'engine-upgrade-score'
          ) AS max_score,
          (
            SELECT "resultKind"::text
            FROM "canonical_score_snapshots"
            WHERE "id" = 'engine-upgrade-score'
          ) AS result_kind,
          EXISTS (
            SELECT 1
            FROM "canonical_report_artifacts"
            WHERE "id" = 'engine-upgrade-report'
          ) AS report_exists
      `;

      expect(preserved).toEqual([{
        assignment_id: null,
        attempt_exists: true,
        input_checksum: null,
        max_score: null,
        report_exists: true,
        result_kind: 'FINAL',
        started_at_present: true,
      }]);
    } finally {
      await isolatedPrisma?.$disconnect();
      await dropDisposableDatabase(databaseName);
      fs.rmSync(workspace.root, { recursive: true, force: true });
    }
  }, 120_000);
});
