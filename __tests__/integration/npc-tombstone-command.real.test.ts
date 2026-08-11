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
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { PrismaClient, type Prisma } from '@prisma/client';

import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { canonicalJson, readVerifiedTombstoneExport } from '@/lib/npc/tombstone/export';
import { executeNpcTombstone } from '@/lib/npc/tombstone/service';
import {
  NPC_TOMBSTONE_AUDIT_ACTION,
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
const reason = 'SOURCE_BYTES_UNAVAILABLE_SYNTHETIC';
const appliedAt = new Date('2026-08-11T12:00:00.000Z');
const testTrustedUid = process.getuid?.() ?? 0;
const testExportSecurity = { trustedUid: testTrustedUid };

function testOptions(now: () => Date) {
  return { now, testOnlyTrustedUid: testTrustedUid };
}

let temporaryRoot: string;
let exportDirectory: string;
let sourceDirectory: string;
let submissionId: string;
let reportId: string;
let jobId: string;

function exportPath(label: string): string {
  return join(exportDirectory, `${label}.json`);
}

function commandArgs(
  label: string,
  overrides: Partial<TombstoneArguments> = {},
): TombstoneArguments {
  return {
    submissionId,
    expectedInitialStatus: 'COMPLETED',
    expectedPageCount: 4,
    expectedReportId: reportId,
    expectedReportStatus: 'DRAFT',
    expectedReportVisibility: 'COACH_ONLY',
    reason,
    actorId: `${prefix}-maintenance`,
    actorRole: 'SYSTEM',
    exportFile: exportPath(label),
    ...overrides,
  };
}

async function seedFixture(): Promise<void> {
  const fixture = await createNpcRealFixture(firstClient, prefix);
  submissionId = fixture.submissionId;
  reportId = `${prefix}-report`;
  jobId = `${prefix}-job`;

  await firstClient.aiProcessingJob.create({
    data: {
      id: jobId,
      type: 'PEDAGOGICAL_DIAGNOSIS',
      status: 'COMPLETED',
      priority: 'NORMAL',
      copySubmissionId: submissionId,
      inputData: { submissionId, synthetic: true },
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
      storedFilePath: join(sourceDirectory, 'page-1.pdf'),
      fileSizeBytes: 16,
      mimeType: 'application/pdf',
      ocrText: 'OCR synthétique conservé',
    },
  });

  for (let pageNumber = 1; pageNumber <= 4; pageNumber += 1) {
    const bytes = Buffer.from(`synthetic-page-${pageNumber}`);
    const filePath = join(sourceDirectory, `page-${pageNumber}.pdf`);
    writeFileSync(filePath, bytes, { mode: 0o600 });
    await firstClient.copyPage.create({
      data: {
        id: `${prefix}-page-${pageNumber}`,
        submissionId,
        pageNumber,
        status: 'READY',
        documentType: 'STUDENT_COPY',
        originalFilePath: filePath,
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
      rawAiOutput: { retained: true },
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
        id: `${prefix}-audit-page-existing`,
        action: 'SYNTHETIC_PAGE_REVIEW',
        actorId: `${prefix}-coach`,
        actorRole: 'COACH',
        entityType: 'CopyPage',
        entityId: `${prefix}-page-1`,
        details: { retained: 3, values: ['page-audit-secret-value'] },
      },
      {
        id: `${prefix}-audit-unrelated`,
        action: 'SYNTHETIC_UNRELATED_REVIEW',
        actorId: `${prefix}-coach`,
        actorRole: 'COACH',
        entityType: 'CopyPage',
        entityId: `${prefix}-unrelated-page`,
        details: { retained: 4 },
      },
    ],
  });

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
            originalFilePath: `synthetic/witness-${witness}.pdf`,
            sizeBytes: witness,
            sha256: String(witness + 4).repeat(64),
          },
        },
      },
    });
  }
}

async function preservedState() {
  const [report, job, witnesses, audits, sourceFiles] = await Promise.all([
    firstClient.pedagogicalReport.findUniqueOrThrow({ where: { id: reportId } }),
    firstClient.aiProcessingJob.findUniqueOrThrow({ where: { id: jobId } }),
    firstClient.copySubmission.findMany({
      where: { id: { startsWith: `${prefix}-witness-` } },
      include: { pages: { orderBy: { pageNumber: 'asc' } } },
      orderBy: { id: 'asc' },
    }),
    firstClient.npcAuditLog.findMany({
      where: {
        OR: [
          { entityId: { in: [
            submissionId,
            reportId,
            ...Array.from({ length: 4 }, (_, index) => `${prefix}-page-${index + 1}`),
          ] } },
          { reportId },
        ],
      },
      orderBy: { id: 'asc' },
    }),
    Promise.resolve(
      Array.from({ length: 4 }, (_, index) =>
        readFileSync(join(sourceDirectory, `page-${index + 1}.pdf`)),
      ),
    ),
  ]);
  return { report, job, witnesses, audits, sourceFiles };
}

async function targetTombstoneState() {
  return firstClient.copySubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { pages: { orderBy: { pageNumber: 'asc' } } },
  });
}

async function expectTargetUntouched() {
  const target = await targetTombstoneState();
  expect(target.status).toBe('COMPLETED');
  expect(target.unavailableReason).toBeNull();
  expect(target.unavailableAt).toBeNull();
  expect(target.pages).toHaveLength(4);
  for (const page of target.pages) {
    expect(page.status).toBe('READY');
    expect(page.unavailableReason).toBeNull();
    expect(page.unavailableAt).toBeNull();
  }
  await expect(firstClient.npcAuditLog.count({
    where: { action: NPC_TOMBSTONE_AUDIT_ACTION, entityId: submissionId },
  })).resolves.toBe(0);
}

describe('NPC audited tombstone command on PostgreSQL 15', () => {
  beforeAll(() => {
    assertDisposablePostgresUrl(databaseUrl);
  });

  beforeEach(async () => {
    temporaryRoot = mkdtempSync(join(homedir(), 'npc-tombstone-real-'));
    exportDirectory = join(temporaryRoot, 'exports');
    sourceDirectory = join(temporaryRoot, 'sources');
    mkdirSync(exportDirectory, { mode: 0o700 });
    mkdirSync(sourceDirectory, { mode: 0o700 });
    chmodSync(exportDirectory, 0o700);
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

  it('exports first, tombstones exactly 1+4 rows, and preserves report, job, files, witnesses and existing audits', async () => {
    const args = commandArgs('apply');
    const before = await preservedState();

    const result = await executeNpcTombstone(firstClient, args, testOptions(() => appliedAt));

    expect(result.status).toBe('applied');
    expect(result.operationKey).toBe(buildTombstoneOperationIdentity(args).operationKey);
    expect(lstatSync(args.exportFile).mode & 0o777).toBe(0o600);
    const verified = await readVerifiedTombstoneExport(args.exportFile, testExportSecurity);
    expect(verified.envelope.payload.snapshot.pages).toHaveLength(4);
    expect(verified.envelope.payload.snapshot.report).toMatchObject({
      id: reportId,
      status: 'DRAFT',
      visibility: 'COACH_ONLY',
      coachNotes: {
        redacted: true,
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        byteLength: expect.any(Number),
      },
    });
    expect(verified.envelope.payload.snapshot.job).toMatchObject({ id: jobId });
    expect(verified.envelope.payload.snapshot.audits.map((audit) => audit.id)).toEqual([
      `${prefix}-audit-page-existing`,
      `${prefix}-audit-report-existing`,
      `${prefix}-audit-submission-existing`,
    ]);
    expect(canonicalJson(verified.envelope)).not.toContain('page-audit-secret-value');
    expect(canonicalJson(verified.envelope)).not.toContain('Rapport synthétique à préserver');
    expect(canonicalJson(verified.envelope)).not.toContain('Calcul');
    expect(canonicalJson(verified.envelope)).not.toContain('Rédaction');
    expect(canonicalJson(verified.envelope)).not.toContain(`${prefix}-audit-unrelated`);

    const target = await targetTombstoneState();
    expect(target).toMatchObject({
      id: submissionId,
      status: 'UNAVAILABLE',
      unavailableReason: reason,
      unavailableAt: appliedAt,
    });
    expect(target.pages).toHaveLength(4);
    for (const page of target.pages) {
      expect(page).toMatchObject({
        status: 'UNAVAILABLE',
        unavailableReason: reason,
        unavailableAt: appliedAt,
      });
    }

    const after = await preservedState();
    expect(after.report).toEqual(before.report);
    expect(after.job).toEqual(before.job);
    expect(after.witnesses).toEqual(before.witnesses);
    expect(after.sourceFiles).toEqual(before.sourceFiles);
    expect(after.audits.filter((audit) => audit.action !== NPC_TOMBSTONE_AUDIT_ACTION)).toEqual(before.audits);
    const commandAudits = after.audits.filter((audit) => audit.action === NPC_TOMBSTONE_AUDIT_ACTION);
    expect(commandAudits).toHaveLength(1);
    expect(commandAudits[0]).toMatchObject({
      id: buildTombstoneOperationIdentity(args).auditId,
      actorId: args.actorId,
      actorRole: args.actorRole,
      entityType: 'CopySubmission',
      entityId: submissionId,
      reportId,
      createdAt: appliedAt,
    });
    expect(commandAudits[0].details).toMatchObject({
      exportPayloadSha256: verified.payloadSha256,
      snapshotSha256: verified.envelope.payload.snapshot.snapshotSha256,
      idempotenceProofSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it.each([
    ['3 pages', 'NPC_TOMBSTONE_PAGE_COUNT_MISMATCH', async (): Promise<void> => {
      await firstClient.copyPage.delete({ where: { id: `${prefix}-page-4` } });
    }],
    ['5 pages', 'NPC_TOMBSTONE_PAGE_COUNT_MISMATCH', async (): Promise<void> => {
      await firstClient.copyPage.create({
        data: {
          id: `${prefix}-page-5`,
          submissionId,
          pageNumber: 5,
          documentType: 'STUDENT_COPY',
          originalFilePath: join(sourceDirectory, 'page-5.pdf'),
          sizeBytes: 5,
          sha256: '9'.repeat(64),
        },
      });
    }],
    ['report id mismatch', 'NPC_TOMBSTONE_REPORT_ID_MISMATCH', async (): Promise<void> => undefined],
    ['report status mismatch', 'NPC_TOMBSTONE_REPORT_STATUS_MISMATCH', async (): Promise<void> => undefined],
    ['report visibility mismatch', 'NPC_TOMBSTONE_REPORT_VISIBILITY_MISMATCH', async (): Promise<void> => undefined],
    ['submission status mismatch', 'NPC_TOMBSTONE_SUBMISSION_STATUS_MISMATCH', async (): Promise<void> => undefined],
  ] as const)(
    'creates a verified export before exact refusal for %s and rolls back the database',
    async (label, expectedCode, arrange) => {
      await arrange();
      const pagesBefore = await firstClient.copyPage.findMany({
        where: { submissionId },
        orderBy: { pageNumber: 'asc' },
      });
      const before = await preservedState();
      const overrides: Partial<TombstoneArguments> =
        label === 'report id mismatch'
          ? { expectedReportId: `${prefix}-other-report` }
          : label === 'report status mismatch'
            ? { expectedReportStatus: 'VALIDATED' }
            : label === 'report visibility mismatch'
              ? { expectedReportVisibility: 'COACH_AND_STUDENT' }
              : label === 'submission status mismatch'
                ? { expectedInitialStatus: 'ARCHIVED' }
                : {};
      const args = commandArgs(label.replaceAll(' ', '-'), overrides);

      await expect(executeNpcTombstone(firstClient, args, testOptions(() => appliedAt)))
        .rejects.toMatchObject({ code: expectedCode });

      expect(existsSync(args.exportFile)).toBe(true);
      expect(lstatSync(args.exportFile).mode & 0o777).toBe(0o600);
      await expect(readVerifiedTombstoneExport(args.exportFile, testExportSecurity)).resolves.toBeDefined();
      const target = await firstClient.copySubmission.findUniqueOrThrow({
        where: { id: submissionId },
      });
      expect(target.status).toBe('COMPLETED');
      expect(target.unavailableReason).toBeNull();
      expect(target.unavailableAt).toBeNull();
      await expect(firstClient.copyPage.findMany({
        where: { submissionId },
        orderBy: { pageNumber: 'asc' },
      })).resolves.toEqual(pagesBefore);
      expect(await preservedState()).toEqual(before);
      await expect(firstClient.npcAuditLog.count({
        where: { action: NPC_TOMBSTONE_AUDIT_ACTION, entityId: submissionId },
      })).resolves.toBe(0);
    },
  );

  it('performs zero database mutation when export verification fails', async () => {
    const args = commandArgs('invalid-existing-export');
    writeFileSync(args.exportFile, '{"not":"a verified envelope"}', { mode: 0o600 });
    const before = await preservedState();

    await expect(executeNpcTombstone(firstClient, args, testOptions(() => appliedAt)))
      .rejects.toMatchObject({ code: 'NPC_TOMBSTONE_EXPORT_INVALID' });

    await expectTargetUntouched();
    expect(await preservedState()).toEqual(before);
  });

  it('rejects a hostile reason before export or database mutation', async () => {
    const args = commandArgs('hostile-reason', {
      reason: 'password=/srv/private/secret-token',
    });
    const before = await preservedState();

    await expect(executeNpcTombstone(firstClient, args, testOptions(() => appliedAt)))
      .rejects.toMatchObject({ code: 'NPC_TOMBSTONE_INVALID_REASON' });

    expect(existsSync(args.exportFile)).toBe(false);
    await expectTargetUntouched();
    expect(await preservedState()).toEqual(before);
  });

  it('rolls the database back after a post-export DB failure, leaves the export, then resumes only against the exact snapshot', async () => {
    const args = commandArgs('resume');
    const before = await preservedState();
    await firstClient.$executeRawUnsafe(`
      ALTER TABLE "npc_audit_logs"
      ADD CONSTRAINT "npc_tombstone_real_reject_command_audit"
      CHECK ("action" <> '${NPC_TOMBSTONE_AUDIT_ACTION}')
    `);

    try {
      await expect(executeNpcTombstone(firstClient, args, testOptions(() => appliedAt)))
        .rejects.toMatchObject({ code: 'NPC_TOMBSTONE_DATABASE_FAILURE' });
    } finally {
      await firstClient.$executeRawUnsafe(`
        ALTER TABLE "npc_audit_logs"
        DROP CONSTRAINT "npc_tombstone_real_reject_command_audit"
      `);
    }

    expect(existsSync(args.exportFile)).toBe(true);
    await expect(readVerifiedTombstoneExport(args.exportFile, testExportSecurity)).resolves.toBeDefined();
    await expectTargetUntouched();
    expect(await preservedState()).toEqual(before);

    const resumed = await executeNpcTombstone(firstClient, args, testOptions(
      () => new Date('2026-08-11T13:00:00.000Z'),
    ));
    expect(resumed.status).toBe('applied');
    const target = await targetTombstoneState();
    expect(target.unavailableAt).toEqual(appliedAt);
  });

  it('refuses resume when locked rows no longer match the verified export snapshot', async () => {
    const args = commandArgs('stale-resume');
    const mismatchingArgs = {
      ...args,
      expectedReportStatus: 'VALIDATED',
    } as const;
    await expect(executeNpcTombstone(firstClient, mismatchingArgs, testOptions(
      () => appliedAt,
    ))).rejects.toMatchObject({
      code: 'NPC_TOMBSTONE_REPORT_STATUS_MISMATCH',
    });
    await firstClient.copySubmission.update({
      where: { id: submissionId },
      data: { title: 'Changed after failed attempt' },
    });

    await expect(executeNpcTombstone(firstClient, mismatchingArgs, testOptions(
      () => appliedAt,
    ))).rejects.toMatchObject({ code: 'NPC_TOMBSTONE_SNAPSHOT_MISMATCH' });
    await expectTargetUntouched();
  });

  it('refuses a complete self-hashed export whose sanitized content was forged', async () => {
    const args = commandArgs('forged-resume', { expectedReportStatus: 'VALIDATED' });
    await expect(executeNpcTombstone(firstClient, args, testOptions(
      () => appliedAt,
    ))).rejects.toMatchObject({ code: 'NPC_TOMBSTONE_REPORT_STATUS_MISMATCH' });

    const envelope = JSON.parse(readFileSync(args.exportFile, 'utf8'));
    envelope.payload.snapshot.submission.title.sha256 = 'b'.repeat(64);
    const snapshotContent = { ...envelope.payload.snapshot };
    delete snapshotContent.snapshotSha256;
    envelope.payload.snapshot.snapshotSha256 = createHash('sha256')
      .update(canonicalJson(snapshotContent))
      .digest('hex');
    envelope.payloadSha256 = createHash('sha256')
      .update(canonicalJson(envelope.payload))
      .digest('hex');
    writeFileSync(args.exportFile, `${canonicalJson(envelope)}\n`, { mode: 0o600 });

    await expect(executeNpcTombstone(firstClient, args, testOptions(
      () => new Date('2026-08-11T16:00:00.000Z'),
    ))).rejects.toMatchObject({ code: 'NPC_TOMBSTONE_SNAPSHOT_MISMATCH' });
    await expectTargetUntouched();
  });

  it('is idempotent for the same arguments and export and creates no alternate export', async () => {
    const args = commandArgs('idempotent');
    await executeNpcTombstone(firstClient, args, testOptions(() => appliedAt));
    const targetAfterFirst = await targetTombstoneState();
    const auditAfterFirst = await firstClient.npcAuditLog.findMany({
      where: { action: NPC_TOMBSTONE_AUDIT_ACTION, entityId: submissionId },
    });

    await expect(executeNpcTombstone(firstClient, args, testOptions(
      () => new Date('2026-08-11T13:00:00.000Z'),
    ))).resolves.toMatchObject({ status: 'already-applied' });
    await expect(targetTombstoneState()).resolves.toEqual(targetAfterFirst);
    await expect(firstClient.npcAuditLog.findMany({
      where: { action: NPC_TOMBSTONE_AUDIT_ACTION, entityId: submissionId },
    })).resolves.toEqual(auditAfterFirst);

    const alternateArgs = { ...args, exportFile: exportPath('alternate') };
    await expect(executeNpcTombstone(secondClient, alternateArgs, testOptions(
      () => new Date('2026-08-11T14:00:00.000Z'),
    ))).resolves.toMatchObject({ status: 'already-applied' });
    expect(existsSync(alternateArgs.exportFile)).toBe(false);
  });

  it.each([
    'partial-page-state',
    'different-reason',
    'audit-missing',
    'audit-surplus',
    'audit-surplus-malformed-entity-type',
    'audit-surplus-alternate-unavailable-action',
    'audit-details-corrupt',
    'audit-export-hash-corrupt',
    'audit-snapshot-hash-corrupt',
    'audit-proof-corrupt',
    'other-flow',
  ])('refuses non-exact idempotence for %s without writing', async (variant) => {
    const args = commandArgs(`invalid-idempotence-${variant}`);
    await executeNpcTombstone(firstClient, args, testOptions(() => appliedAt));
    const identity = buildTombstoneOperationIdentity(args);

    if (variant === 'partial-page-state') {
      await firstClient.copyPage.update({
        where: { id: `${prefix}-page-4` },
        data: { status: 'READY', unavailableReason: null, unavailableAt: null },
      });
    } else if (variant === 'audit-missing') {
      await firstClient.npcAuditLog.delete({ where: { id: identity.auditId } });
    } else if (
      variant === 'audit-surplus' ||
      variant === 'audit-surplus-malformed-entity-type' ||
      variant === 'audit-surplus-alternate-unavailable-action'
    ) {
      const audit = await firstClient.npcAuditLog.findUniqueOrThrow({
        where: { id: identity.auditId },
      });
      await firstClient.npcAuditLog.create({
        data: {
          ...audit,
          id: `${prefix}-${variant}`,
          action: variant === 'audit-surplus-alternate-unavailable-action'
            ? 'MARK_SUBMISSION_UNAVAILABLE'
            : audit.action,
          entityType: variant === 'audit-surplus'
            ? audit.entityType
            : 'MalformedEntityType',
          details: audit.details as Prisma.InputJsonValue,
        },
      });
    } else if (
      variant === 'audit-details-corrupt' ||
      variant === 'audit-export-hash-corrupt' ||
      variant === 'audit-snapshot-hash-corrupt' ||
      variant === 'audit-proof-corrupt'
    ) {
      const audit = await firstClient.npcAuditLog.findUniqueOrThrow({
        where: { id: identity.auditId },
      });
      const field = variant === 'audit-snapshot-hash-corrupt'
        ? 'snapshotSha256'
        : variant === 'audit-proof-corrupt'
          ? 'idempotenceProofSha256'
          : 'exportPayloadSha256';
      await firstClient.npcAuditLog.update({
        where: { id: identity.auditId },
        data: {
          details: {
            ...(audit.details as Prisma.JsonObject),
            [field]: variant === 'audit-details-corrupt' ? 'invalid' : 'a'.repeat(64),
          },
        },
      });
    } else if (variant === 'other-flow') {
      await firstClient.npcAuditLog.delete({ where: { id: identity.auditId } });
      await firstClient.npcAuditLog.create({
        data: {
          id: `${prefix}-other-flow-audit`,
          reportId,
          action: 'MARK_SUBMISSION_UNAVAILABLE',
          actorId: args.actorId,
          actorRole: args.actorRole,
          entityType: 'CopySubmission',
          entityId: submissionId,
          details: { reason },
        },
      });
    }

    const attemptedArgs = variant === 'different-reason'
      ? { ...args, reason: 'DIFFERENT_SYNTHETIC_REASON', exportFile: exportPath('different-reason') }
      : variant.startsWith('audit-')
        ? { ...args, exportFile: exportPath('corrupt-audit-alternate') }
        : args;
    const before = await targetTombstoneState();
    await expect(executeNpcTombstone(firstClient, attemptedArgs, testOptions(
      () => new Date('2026-08-11T15:00:00.000Z'),
    ))).rejects.toMatchObject({ code: 'NPC_TOMBSTONE_IDEMPOTENCE_INVALID' });
    await expect(targetTombstoneState()).resolves.toEqual(before);
    if (variant === 'different-reason' || variant.startsWith('audit-')) {
      expect(existsSync(attemptedArgs.exportFile)).toBe(false);
    }
  });

  it('serializes two concurrent invocations into one apply, one idempotent result, one audit and one export', async () => {
    const firstArgs = commandArgs('concurrent-first');
    const secondArgs = { ...firstArgs, exportFile: exportPath('concurrent-second') };

    const results = await Promise.all([
      executeNpcTombstone(firstClient, firstArgs, testOptions(() => appliedAt)),
      executeNpcTombstone(secondClient, secondArgs, testOptions(() => appliedAt)),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual(['already-applied', 'applied']);
    await expect(firstClient.npcAuditLog.count({
      where: { action: NPC_TOMBSTONE_AUDIT_ACTION, entityId: submissionId },
    })).resolves.toBe(1);
    expect([firstArgs.exportFile, secondArgs.exportFile].filter(existsSync)).toHaveLength(1);
  });
});
