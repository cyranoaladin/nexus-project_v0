/** @jest-environment node */

import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { PrismaClient, type Prisma } from '@prisma/client';

import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import {
  canonicalJson,
  createTombstoneCryptoContext,
  readVerifiedTombstoneExport,
  tombstoneArtifactPath,
} from '@/lib/npc/tombstone/export';
import { executeNpcTombstone } from '@/lib/npc/tombstone/service';
import {
  NPC_TOMBSTONE_AUDIT_ACTION,
  NPC_TOMBSTONE_REASON,
  NPC_TOMBSTONE_REASON_CODE,
  buildTombstoneOperationIdentity,
  type TombstoneArguments,
} from '@/lib/npc/tombstone/types';
import {
  cleanupNpcRealFixture,
  createNpcRealFixture,
  databaseUrlWithApplicationName,
} from './npc-real-test-helpers';

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
const firstClient = new PrismaClient({
  datasources: { db: { url: databaseUrlWithApplicationName(databaseUrl, 'npc-tombstone-first') } },
});
const secondClient = new PrismaClient({
  datasources: { db: { url: databaseUrlWithApplicationName(databaseUrl, 'npc-tombstone-second') } },
});
const prefix = 'npc-tombstone-real-synthetic';
const appliedAt = new Date('2026-08-11T12:00:00.000Z');
const encryptionSecret = process.env.DOCUMENT_ENCRYPTION_KEY ?? '';
const cryptoContext = createTombstoneCryptoContext(encryptionSecret);

let temporaryRoot: string;
let exportRoot: string;
let sourceDirectory: string;
let submissionId: string;
let reportId: string;
let jobId: string;
let actorId: string;

function commandArgs(overrides: Partial<TombstoneArguments> = {}): TombstoneArguments {
  return {
    version: 1,
    submissionId,
    expectedInitialStatus: 'COMPLETED',
    expectedPageCount: 4,
    expectedReportId: reportId,
    expectedReportStatus: 'DRAFT',
    expectedReportVisibility: 'COACH_ONLY',
    reasonCode: NPC_TOMBSTONE_REASON_CODE,
    reason: NPC_TOMBSTONE_REASON,
    actorId,
    actorRole: 'ADMIN',
    exportRoot,
    ...overrides,
  };
}

function artifactPath(args = commandArgs()): string {
  return tombstoneArtifactPath(args);
}

async function seedFixture(): Promise<void> {
  const fixture = await createNpcRealFixture(firstClient, prefix);
  submissionId = fixture.submissionId;
  reportId = `${prefix}-report`;
  jobId = `${prefix}-job`;
  actorId = `${prefix}-admin`;

  await firstClient.user.create({
    data: {
      id: actorId,
      role: 'ADMIN',
      email: `${actorId}@example.test`,
      activatedAt: new Date('2026-08-10T08:00:00.000Z'),
    },
  });
  // Production-compatible legacy link: the submission owns aiJobId while the
  // job back-reference is null.
  await firstClient.aiProcessingJob.create({
    data: {
      id: jobId,
      type: 'PEDAGOGICAL_DIAGNOSIS',
      status: 'COMPLETED',
      priority: 'NORMAL',
      copySubmissionId: null,
      inputData: { password: 'encrypted-but-excluded' },
      outputData: { retained: true },
      retryCount: 0,
      maxRetries: 3,
    },
  });
  await firstClient.copySubmission.update({
    where: { id: submissionId },
    data: {
      status: 'COMPLETED',
      aiJobId: jobId,
      storedFilePath: `${submissionId}/page-1.pdf`,
      fileSizeBytes: 16,
      mimeType: 'application/pdf',
      ocrText: 'OCR synthétique conservé',
    },
  });

  for (let pageNumber = 1; pageNumber <= 5; pageNumber += 1) {
    const bytes = Buffer.from(`synthetic-page-${pageNumber}`);
    writeFileSync(join(sourceDirectory, `page-${pageNumber}.pdf`), bytes, { mode: 0o600 });
    await firstClient.copyPage.create({
      data: {
        id: `${prefix}-page-${pageNumber}`,
        submissionId,
        pageNumber,
        status: 'READY',
        documentType: 'STUDENT_COPY',
        originalFilePath: `${submissionId}/page-${pageNumber}.pdf`,
        originalFilename: `page-${pageNumber}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        convertedFilePaths: [],
        width: 1000,
        height: 1400,
      },
    });
  }
  await firstClient.pedagogicalReport.create({
    data: {
      id: reportId,
      copySubmissionId: submissionId,
      studentId: fixture.studentId,
      status: 'DRAFT',
      visibility: 'COACH_ONLY',
      diagnostic: { synthetic: true, retained: 'exactly' },
      strengths: ['Calcul'],
      weaknesses: ['Rédaction'],
      rawAiOutput: { authorization: 'Bearer excluded' },
      coachNotes: 'Rapport synthétique à préserver',
    },
  });
  await firstClient.npcAuditLog.createMany({
    data: [
      {
        id: `${prefix}-audit-submission-existing`,
        action: 'SYNTHETIC_SUBMISSION_REVIEW',
        actorId: `${prefix}-coach`,
        actorRole: 'COACH',
        entityType: 'CopySubmission',
        entityId: submissionId,
        details: { retained: 1 },
      },
      {
        id: `${prefix}-audit-report-existing`,
        reportId,
        action: 'SYNTHETIC_REPORT_REVIEW',
        actorId: `${prefix}-coach`,
        actorRole: 'COACH',
        entityType: 'PedagogicalReport',
        entityId: reportId,
        details: { retained: 2 },
      },
      {
        id: `${prefix}-audit-current-page`,
        action: 'SYNTHETIC_PAGE_REVIEW',
        actorId: `${prefix}-coach`,
        actorRole: 'COACH',
        entityType: 'CopyPage',
        entityId: `${prefix}-page-1`,
        details: { retained: 3 },
      },
      {
        id: `${prefix}-audit-deleted-page-object`,
        action: 'SYNTHETIC_DELETED_PAGE_OBJECT',
        actorId: `${prefix}-coach`,
        actorRole: 'COACH',
        entityType: 'CopyPage',
        entityId: `${prefix}-page-5`,
        details: { submissionId, retained: 4 },
      },
      {
        id: `${prefix}-audit-deleted-page-string`,
        action: 'SYNTHETIC_DELETED_PAGE_STRING',
        actorId: `${prefix}-coach`,
        actorRole: 'COACH',
        entityType: 'CopyPage',
        entityId: `${prefix}-deleted-page-string`,
        details: JSON.stringify({ submissionId, retained: 5 }),
      },
      {
        id: `${prefix}-audit-unrelated`,
        action: 'SYNTHETIC_UNRELATED_REVIEW',
        actorId: `${prefix}-coach`,
        actorRole: 'COACH',
        entityType: 'CopyPage',
        entityId: `${prefix}-unrelated-page`,
        details: { submissionId: `${prefix}-other-submission` },
      },
    ],
  });
  await firstClient.copyPage.delete({ where: { id: `${prefix}-page-5` } });

  for (let witness = 1; witness <= 2; witness += 1) {
    await firstClient.copySubmission.create({
      data: {
        id: `${prefix}-witness-${witness}`,
        studentId: fixture.studentId,
        subject: 'MATHEMATIQUES',
        title: `Témoin synthétique ${witness}`,
        status: witness === 1 ? 'ARCHIVED' : 'UPLOADED',
        pages: {
          create: {
            id: `${prefix}-witness-${witness}-page`,
            pageNumber: 1,
            documentType: 'STUDENT_COPY',
            originalFilePath: `witness-${witness}/page.pdf`,
            sizeBytes: witness,
            sha256: String(witness + 4).repeat(64),
          },
        },
      },
    });
  }
}

async function preservedState() {
  const [report, job, witnesses, sourceFiles] = await Promise.all([
    firstClient.pedagogicalReport.findUniqueOrThrow({ where: { id: reportId } }),
    firstClient.aiProcessingJob.findUniqueOrThrow({ where: { id: jobId } }),
    firstClient.copySubmission.findMany({
      where: { id: { startsWith: `${prefix}-witness-` } },
      include: { pages: { orderBy: { pageNumber: 'asc' } } },
      orderBy: { id: 'asc' },
    }),
    Promise.resolve(Array.from({ length: 5 }, (_, index) =>
      readFileSync(join(sourceDirectory, `page-${index + 1}.pdf`)))),
  ]);
  return { report, job, witnesses, sourceFiles };
}

async function targetState() {
  return firstClient.copySubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { pages: { orderBy: { pageNumber: 'asc' } } },
  });
}

async function expectTargetUntouched(
  expectedPageCount = 4,
  expectedCommandAudits = 0,
): Promise<void> {
  const target = await targetState();
  expect(target.status).toBe('COMPLETED');
  expect(target.unavailableReason).toBeNull();
  expect(target.unavailableAt).toBeNull();
  expect(target.pages).toHaveLength(expectedPageCount);
  expect(target.pages.every((page) =>
    page.status !== 'UNAVAILABLE' &&
    page.unavailableReason === null &&
    page.unavailableAt === null)).toBe(true);
  await expect(firstClient.npcAuditLog.count({
    where: { action: NPC_TOMBSTONE_AUDIT_ACTION, entityId: submissionId },
  })).resolves.toBe(expectedCommandAudits);
}

describe('NPC audited tombstone command on PostgreSQL 15', () => {
  beforeAll(() => {
    assertDisposablePostgresUrl(databaseUrl);
    expect(process.getuid?.()).toBe(0);
  });

  beforeEach(async () => {
    const runtimeRoot = process.env.NPC_TEST_RUNTIME_ROOT;
    if (!runtimeRoot) throw new Error('NPC_TEST_RUNTIME_ROOT is required');
    temporaryRoot = mkdtempSync(join(runtimeRoot, 'tombstone-'));
    exportRoot = join(temporaryRoot, 'artifacts');
    sourceDirectory = join(temporaryRoot, 'sources');
    mkdirSync(exportRoot, { mode: 0o700 });
    mkdirSync(sourceDirectory, { mode: 0o700 });
    chmodSync(exportRoot, 0o700);
    await cleanupNpcRealFixture(firstClient, prefix);
    await seedFixture();
  });

  afterEach(async () => {
    await cleanupNpcRealFixture(firstClient, prefix);
    rmSync(temporaryRoot, { recursive: true, force: true });
  });

  afterAll(async () => {
    await Promise.all([firstClient.$disconnect(), secondClient.$disconnect()]);
  });

  it('accepts the production aiJobId-only link, exports deleted-page audits, and preserves all non-target state', async () => {
    const args = commandArgs();
    const before = await preservedState();
    const result = await executeNpcTombstone(firstClient, args, { now: () => appliedAt });

    expect(result.status).toBe('applied');
    expect(result.operationKey).toBe(buildTombstoneOperationIdentity(args).operationKey);
    expect(lstatSync(artifactPath(args)).mode & 0o777).toBe(0o600);
    const verified = await readVerifiedTombstoneExport(artifactPath(args), cryptoContext);
    expect(verified.bytes).toEqual(Buffer.from(`${canonicalJson(verified.envelope)}\n`));
    expect(verified.payload.snapshot.pages).toHaveLength(4);
    expect(verified.payload.snapshot.job).toMatchObject({ id: jobId, copySubmissionId: null });
    expect(verified.payload.snapshot.audits.map((audit) => audit.id)).toEqual([
      `${prefix}-audit-current-page`,
      `${prefix}-audit-deleted-page-object`,
      `${prefix}-audit-deleted-page-string`,
      `${prefix}-audit-report-existing`,
      `${prefix}-audit-submission-existing`,
    ]);
    expect(canonicalJson(verified.payload)).not.toContain('encrypted-but-excluded');
    expect(canonicalJson(verified.payload)).not.toContain(`${prefix}-audit-unrelated`);

    const target = await targetState();
    expect(target).toMatchObject({
      status: 'UNAVAILABLE',
      unavailableReason: NPC_TOMBSTONE_REASON,
      unavailableAt: appliedAt,
    });
    expect(target.pages).toHaveLength(4);
    expect(target.pages.every((page) =>
      page.status === 'UNAVAILABLE' &&
      page.unavailableReason === NPC_TOMBSTONE_REASON &&
      page.unavailableAt?.getTime() === appliedAt.getTime())).toBe(true);
    expect(await preservedState()).toEqual(before);

    const audit = await firstClient.npcAuditLog.findUniqueOrThrow({
      where: { id: buildTombstoneOperationIdentity(args).auditId },
    });
    expect(audit).toMatchObject({
      action: NPC_TOMBSTONE_AUDIT_ACTION,
      actorId,
      actorRole: 'ADMIN',
      entityType: 'CopySubmission',
      entityId: submissionId,
      reportId,
      createdAt: appliedAt,
    });
    expect(audit.details).toMatchObject({
      artifactChecksumSha256: verified.artifactChecksumSha256,
      snapshotHmacSha256: verified.payload.snapshot.snapshotHmacSha256,
      idempotenceProofHmacSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it.each([
    ['raw traversal', 'NPC_TOMBSTONE_EXPORT_PATH_INVALID'],
    ['permissive root', 'NPC_TOMBSTONE_EXPORT_PARENT_PERMISSIONS'],
    ['symbolic root', 'NPC_TOMBSTONE_EXPORT_SYMLINK'],
    ['repository scope', 'NPC_TOMBSTONE_EXPORT_SCOPE_INVALID'],
  ])('enforces artifact scope inside the service: %s', async (variant, code) => {
    let requestedRoot = exportRoot;
    let repositoryDirectory: string | null = null;
    if (variant === 'raw traversal') {
      requestedRoot = `${exportRoot}/safe/../escape`;
    } else if (variant === 'permissive root') {
      chmodSync(exportRoot, 0o750);
    } else if (variant === 'symbolic root') {
      requestedRoot = join(temporaryRoot, 'linked-artifacts');
      symlinkSync(exportRoot, requestedRoot, 'dir');
    } else {
      repositoryDirectory = join(process.cwd(), `.npc-tombstone-scope-${process.pid}`);
      mkdirSync(repositoryDirectory, { mode: 0o700 });
      requestedRoot = repositoryDirectory;
    }
    try {
      await expect(executeNpcTombstone(firstClient, commandArgs({ exportRoot: requestedRoot })))
        .rejects.toMatchObject({ code });
      await expectTargetUntouched();
    } finally {
      chmodSync(exportRoot, 0o700);
      if (repositoryDirectory) rmSync(repositoryDirectory, { recursive: true, force: true });
    }
  });

  it('never overwrites a canonical artifact and performs zero DB mutation on verification failure', async () => {
    const args = commandArgs();
    const sentinel = Buffer.from('{"not":"an authenticated artifact"}\n');
    writeFileSync(artifactPath(args), sentinel, { mode: 0o600 });
    await expect(executeNpcTombstone(firstClient, args, { now: () => appliedAt }))
      .rejects.toMatchObject({ code: 'NPC_TOMBSTONE_EXPORT_INVALID' });
    expect(readFileSync(artifactPath(args))).toEqual(sentinel);
    await expectTargetUntouched();
  });

  it.each([
    ['3 pages', 'NPC_TOMBSTONE_PAGE_COUNT_MISMATCH'],
    ['5 pages', 'NPC_TOMBSTONE_PAGE_COUNT_MISMATCH'],
    ['report id', 'NPC_TOMBSTONE_REPORT_ID_MISMATCH'],
    ['report status', 'NPC_TOMBSTONE_REPORT_STATUS_MISMATCH'],
    ['report visibility', 'NPC_TOMBSTONE_REPORT_VISIBILITY_MISMATCH'],
    ['submission status', 'NPC_TOMBSTONE_SUBMISSION_STATUS_MISMATCH'],
    ['contradictory job', 'NPC_TOMBSTONE_JOB_LINK_MISMATCH'],
  ])('exports before exact refusal for %s and rolls DB back', async (variant, code) => {
    const overrides: Partial<TombstoneArguments> = {};
    if (variant === '3 pages') {
      await firstClient.copyPage.delete({ where: { id: `${prefix}-page-4` } });
    } else if (variant === '5 pages') {
      await firstClient.copyPage.create({
        data: {
          id: `${prefix}-page-6`, submissionId, pageNumber: 6,
          documentType: 'STUDENT_COPY', originalFilePath: `${submissionId}/page-6.pdf`,
        },
      });
    } else if (variant === 'report id') {
      overrides.expectedReportId = `${prefix}-other-report`;
    } else if (variant === 'report status') {
      overrides.expectedReportStatus = 'VALIDATED';
    } else if (variant === 'report visibility') {
      overrides.expectedReportVisibility = 'COACH_AND_STUDENT';
    } else if (variant === 'submission status') {
      overrides.expectedInitialStatus = 'ARCHIVED';
    } else {
      await firstClient.$executeRaw`
        UPDATE "ai_processing_jobs"
        SET "copySubmissionId" = ${`${prefix}-witness-1`}
        WHERE "id" = ${jobId}
      `;
    }
    const args = commandArgs(overrides);
    const before = await preservedState();
    await expect(executeNpcTombstone(firstClient, args, { now: () => appliedAt }))
      .rejects.toMatchObject({ code });
    expect(existsSync(artifactPath(args))).toBe(true);
    await expectTargetUntouched(variant === '3 pages' ? 3 : variant === '5 pages' ? 5 : 4);
    expect(await preservedState()).toEqual(before);
  });

  it.each([
    ['missing', 'NPC_TOMBSTONE_ACTOR_NOT_FOUND'],
    ['inactive', 'NPC_TOMBSTONE_ACTOR_INACTIVE'],
    ['role mismatch', 'NPC_TOMBSTONE_ACTOR_ROLE_MISMATCH'],
    ['merged', 'NPC_TOMBSTONE_ACTOR_INACTIVE'],
  ])('requires an active matching authorized actor: %s', async (variant, code) => {
    const overrides: Partial<TombstoneArguments> = {};
    if (variant === 'missing') {
      overrides.actorId = `${prefix}-missing-admin`;
    } else if (variant === 'inactive') {
      await firstClient.user.update({ where: { id: actorId }, data: { activatedAt: null } });
    } else if (variant === 'role mismatch') {
      await firstClient.user.update({ where: { id: actorId }, data: { role: 'ASSISTANTE' } });
    } else {
      await firstClient.user.update({
        where: { id: actorId },
        data: { mergedAt: new Date(), mergedIntoUserId: `${prefix}-parent-user` },
      });
    }
    const args = commandArgs(overrides);
    await expect(executeNpcTombstone(firstClient, args, { now: () => appliedAt }))
      .rejects.toMatchObject({ code });
    expect(existsSync(artifactPath(args))).toBe(true);
    await expectTargetUntouched();
  });

  it.each(['other-flow', 'malformed-entity-type'])(
    'refuses any pre-existing unavailable audit before first apply: %s',
    async (variant) => {
      await firstClient.npcAuditLog.create({
        data: {
          id: `${prefix}-preexisting-${variant}`,
          action: variant === 'other-flow' ? 'MARK_SUBMISSION_UNAVAILABLE' : NPC_TOMBSTONE_AUDIT_ACTION,
          actorId,
          actorRole: 'ADMIN',
          entityType: variant === 'other-flow' ? 'CopySubmission' : 'MalformedEntityType',
          entityId: submissionId,
          details: { retained: true },
        },
      });
      const args = commandArgs();
      await expect(executeNpcTombstone(firstClient, args, { now: () => appliedAt }))
        .rejects.toMatchObject({ code: 'NPC_TOMBSTONE_PREEXISTING_AUDIT' });
      expect(existsSync(artifactPath(args))).toBe(true);
      await expectTargetUntouched(4, variant === 'malformed-entity-type' ? 1 : 0);
    },
  );

  it('keeps the authenticated artifact after DB rollback and resumes only against the exact locked snapshot', async () => {
    const args = commandArgs();
    await firstClient.$executeRawUnsafe(`
      ALTER TABLE "npc_audit_logs"
      ADD CONSTRAINT "npc_tombstone_real_reject_command_audit"
      CHECK ("action" <> '${NPC_TOMBSTONE_AUDIT_ACTION}')
    `);
    try {
      await expect(executeNpcTombstone(firstClient, args, { now: () => appliedAt }))
        .rejects.toMatchObject({ code: 'NPC_TOMBSTONE_DATABASE_FAILURE' });
    } finally {
      await firstClient.$executeRawUnsafe(`
        ALTER TABLE "npc_audit_logs"
        DROP CONSTRAINT "npc_tombstone_real_reject_command_audit"
      `);
    }
    expect(existsSync(artifactPath(args))).toBe(true);
    await expectTargetUntouched();

    await firstClient.copySubmission.update({
      where: { id: submissionId },
      data: { title: 'Changed after authenticated export' },
    });
    await expect(executeNpcTombstone(firstClient, args, { now: () => new Date() }))
      .rejects.toMatchObject({ code: 'NPC_TOMBSTONE_SNAPSHOT_MISMATCH' });
    await firstClient.copySubmission.update({
      where: { id: submissionId },
      data: { title: 'Copie transactionnelle NPC' },
    });
    // updatedAt is also authenticated, so a restored business value is still a
    // different locked snapshot and must remain refused.
    await expect(executeNpcTombstone(firstClient, args, { now: () => new Date() }))
      .rejects.toMatchObject({ code: 'NPC_TOMBSTONE_SNAPSHOT_MISMATCH' });
  });

  it('requires the canonical artifact and exact keyed audit proof for idempotence', async () => {
    const variants = [
      'missing-artifact',
      'artifact-corruption',
      'audit-checksum-corruption',
      'audit-snapshot-hmac-corruption',
      'audit-proof-corruption',
      'audit-entity-type-corruption',
      'extra-unavailable-audit',
    ] as const;
    for (const variant of variants) {
      await cleanupNpcRealFixture(firstClient, prefix);
      await seedFixture();
      const args = commandArgs();
      await executeNpcTombstone(firstClient, args, { now: () => appliedAt });
      const identity = buildTombstoneOperationIdentity(args);
      if (variant === 'missing-artifact') {
        rmSync(artifactPath(args));
      } else if (variant === 'artifact-corruption') {
        const bytes = readFileSync(artifactPath(args));
        bytes[Math.floor(bytes.length / 2)] ^= 1;
        writeFileSync(artifactPath(args), bytes, { mode: 0o600 });
      } else if (variant === 'audit-entity-type-corruption') {
        await firstClient.npcAuditLog.update({
          where: { id: identity.auditId },
          data: { entityType: 'MalformedEntityType' },
        });
      } else if (variant === 'extra-unavailable-audit') {
        await firstClient.npcAuditLog.create({
          data: {
            id: `${prefix}-surplus-unavailable`,
            action: 'MARK_SUBMISSION_UNAVAILABLE',
            actorId,
            actorRole: 'ADMIN',
            entityType: 'MalformedEntityType',
            entityId: submissionId,
          },
        });
      } else {
        const audit = await firstClient.npcAuditLog.findUniqueOrThrow({ where: { id: identity.auditId } });
        const field = variant === 'audit-checksum-corruption'
          ? 'artifactChecksumSha256'
          : variant === 'audit-snapshot-hmac-corruption'
            ? 'snapshotHmacSha256'
            : 'idempotenceProofHmacSha256';
        await firstClient.npcAuditLog.update({
          where: { id: identity.auditId },
          data: { details: { ...(audit.details as Prisma.JsonObject), [field]: 'a'.repeat(64) } },
        });
      }
      await expect(executeNpcTombstone(secondClient, args, { now: () => new Date() }))
        .rejects.toMatchObject({
          code: variant === 'missing-artifact'
            ? 'NPC_TOMBSTONE_ARTIFACT_REQUIRED'
            : variant === 'artifact-corruption'
              ? expect.stringMatching(/^NPC_TOMBSTONE_EXPORT_/)
              : 'NPC_TOMBSTONE_IDEMPOTENCE_INVALID',
        });
      rmSync(artifactPath(args), { force: true });
    }
  });

  it('serializes concurrent invocations onto one canonical artifact and one audit', async () => {
    const args = commandArgs();
    const results = await Promise.all([
      executeNpcTombstone(firstClient, args, { now: () => appliedAt }),
      executeNpcTombstone(secondClient, args, { now: () => appliedAt }),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual(['already-applied', 'applied']);
    expect(existsSync(artifactPath(args))).toBe(true);
    await expect(firstClient.npcAuditLog.count({
      where: { action: NPC_TOMBSTONE_AUDIT_ACTION, entityId: submissionId },
    })).resolves.toBe(1);
  });

  it('runs the exact silent npm child contract without emitting manifest values', async () => {
    const args = commandArgs();
    const requestFile = join(temporaryRoot, 'request.json');
    const manifest = {
      version: 1,
      submissionId,
      expectedInitialStatus: args.expectedInitialStatus,
      expectedPageCount: 4,
      expectedReportId: reportId,
      expectedReportStatus: args.expectedReportStatus,
      expectedReportVisibility: args.expectedReportVisibility,
      reasonCode: NPC_TOMBSTONE_REASON_CODE,
      actorId,
      actorRole: 'ADMIN',
    };
    writeFileSync(requestFile, JSON.stringify(manifest), { mode: 0o600 });
    chmodSync(requestFile, 0o600);

    const child = spawnSync(
      'npm',
      ['--silent', 'run', 'npc:tombstone', '--', '--submission-id', submissionId],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          NPC_TOMBSTONE_REQUEST_FILE: requestFile,
          NPC_TOMBSTONE_EXPORT_ROOT: exportRoot,
        },
      },
    );
    expect(child.status).toBe(0);
    expect(child.stdout).toMatch(/^NPC_TOMBSTONE_APPLIED operation=[a-f0-9]{64}\n$/);
    const output = `${child.stdout}${child.stderr}`;
    for (const hidden of [
      requestFile,
      exportRoot,
      submissionId,
      reportId,
      actorId,
      NPC_TOMBSTONE_REASON_CODE,
      NPC_TOMBSTONE_REASON,
      databaseUrl,
    ]) {
      expect(output).not.toContain(hidden);
    }
    expect(existsSync(artifactPath(args))).toBe(true);
  });
});
