/** @jest-environment node */

import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PrismaClient, type Prisma } from '@prisma/client';

import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { readVerifiedTombstoneExport } from '@/lib/npc/tombstone/export';
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
        OR: [{ entityId: submissionId }, { reportId }],
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
    temporaryRoot = mkdtempSync(join(tmpdir(), 'npc-tombstone-real-'));
    exportDirectory = join(temporaryRoot, 'exports');
    sourceDirectory = join(temporaryRoot, 'sources');
    require('node:fs').mkdirSync(exportDirectory, { mode: 0o700 });
    require('node:fs').mkdirSync(sourceDirectory, { mode: 0o700 });
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

    const result = await executeNpcTombstone(firstClient, args, {
      now: () => appliedAt,
    });

    expect(result.status).toBe('applied');
    expect(result.operationKey).toBe(buildTombstoneOperationIdentity(args).operationKey);
    expect(lstatSync(args.exportFile).mode & 0o777).toBe(0o600);
    const verified = await readVerifiedTombstoneExport(args.exportFile);
    expect(verified.envelope.payload.snapshot.pages).toHaveLength(4);
    expect(verified.envelope.payload.snapshot.report).toMatchObject({
      id: reportId,
      status: 'DRAFT',
      visibility: 'COACH_ONLY',
      coachNotes: 'Rapport synthétique à préserver',
    });
    expect(verified.envelope.payload.snapshot.job).toMatchObject({ id: jobId });
    expect(verified.envelope.payload.snapshot.audits).toHaveLength(2);

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
    expect(after.audits.slice(0, 2)).toEqual(before.audits);
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

      await expect(executeNpcTombstone(firstClient, args, { now: () => appliedAt }))
        .rejects.toMatchObject({ code: expectedCode });

      expect(existsSync(args.exportFile)).toBe(true);
      expect(lstatSync(args.exportFile).mode & 0o777).toBe(0o600);
      await expect(readVerifiedTombstoneExport(args.exportFile)).resolves.toBeDefined();
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

    await expect(executeNpcTombstone(firstClient, args, { now: () => appliedAt }))
      .rejects.toMatchObject({ code: 'NPC_TOMBSTONE_EXPORT_INVALID' });

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
      await expect(executeNpcTombstone(firstClient, args, { now: () => appliedAt }))
        .rejects.toMatchObject({ code: 'NPC_TOMBSTONE_DATABASE_FAILURE' });
    } finally {
      await firstClient.$executeRawUnsafe(`
        ALTER TABLE "npc_audit_logs"
        DROP CONSTRAINT "npc_tombstone_real_reject_command_audit"
      `);
    }

    expect(existsSync(args.exportFile)).toBe(true);
    await expect(readVerifiedTombstoneExport(args.exportFile)).resolves.toBeDefined();
    await expectTargetUntouched();
    expect(await preservedState()).toEqual(before);

    const resumed = await executeNpcTombstone(firstClient, args, {
      now: () => new Date('2026-08-11T13:00:00.000Z'),
    });
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
    await expect(executeNpcTombstone(firstClient, mismatchingArgs, {
      now: () => appliedAt,
    })).rejects.toMatchObject({
      code: 'NPC_TOMBSTONE_REPORT_STATUS_MISMATCH',
    });
    await firstClient.copySubmission.update({
      where: { id: submissionId },
      data: { title: 'Changed after failed attempt' },
    });

    await expect(executeNpcTombstone(firstClient, mismatchingArgs, {
      now: () => appliedAt,
    })).rejects.toMatchObject({ code: 'NPC_TOMBSTONE_SNAPSHOT_MISMATCH' });
    await expectTargetUntouched();
  });

  it('is idempotent for the same arguments and export and creates no alternate export', async () => {
    const args = commandArgs('idempotent');
    await executeNpcTombstone(firstClient, args, { now: () => appliedAt });
    const targetAfterFirst = await targetTombstoneState();
    const auditAfterFirst = await firstClient.npcAuditLog.findMany({
      where: { action: NPC_TOMBSTONE_AUDIT_ACTION, entityId: submissionId },
    });

    await expect(executeNpcTombstone(firstClient, args, {
      now: () => new Date('2026-08-11T13:00:00.000Z'),
    })).resolves.toMatchObject({ status: 'already-applied' });
    await expect(targetTombstoneState()).resolves.toEqual(targetAfterFirst);
    await expect(firstClient.npcAuditLog.findMany({
      where: { action: NPC_TOMBSTONE_AUDIT_ACTION, entityId: submissionId },
    })).resolves.toEqual(auditAfterFirst);

    const alternateArgs = { ...args, exportFile: exportPath('alternate') };
    await expect(executeNpcTombstone(secondClient, alternateArgs, {
      now: () => new Date('2026-08-11T14:00:00.000Z'),
    })).resolves.toMatchObject({ status: 'already-applied' });
    expect(existsSync(alternateArgs.exportFile)).toBe(false);
  });

  it.each([
    'partial-page-state',
    'different-reason',
    'audit-missing',
    'audit-surplus',
    'audit-details-corrupt',
    'other-flow',
  ])('refuses non-exact idempotence for %s without writing', async (variant) => {
    const args = commandArgs(`invalid-idempotence-${variant}`);
    await executeNpcTombstone(firstClient, args, { now: () => appliedAt });
    const identity = buildTombstoneOperationIdentity(args);

    if (variant === 'partial-page-state') {
      await firstClient.copyPage.update({
        where: { id: `${prefix}-page-4` },
        data: { status: 'READY', unavailableReason: null, unavailableAt: null },
      });
    } else if (variant === 'audit-missing') {
      await firstClient.npcAuditLog.delete({ where: { id: identity.auditId } });
    } else if (variant === 'audit-surplus') {
      const audit = await firstClient.npcAuditLog.findUniqueOrThrow({
        where: { id: identity.auditId },
      });
      await firstClient.npcAuditLog.create({
        data: {
          ...audit,
          id: `${prefix}-surplus-command-audit`,
          details: audit.details as Prisma.InputJsonValue,
        },
      });
    } else if (variant === 'audit-details-corrupt') {
      const audit = await firstClient.npcAuditLog.findUniqueOrThrow({
        where: { id: identity.auditId },
      });
      await firstClient.npcAuditLog.update({
        where: { id: identity.auditId },
        data: {
          details: {
            ...(audit.details as Prisma.JsonObject),
            exportPayloadSha256: 'invalid',
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
      : variant === 'audit-details-corrupt'
        ? { ...args, exportFile: exportPath('corrupt-audit-alternate') }
        : args;
    const before = await targetTombstoneState();
    await expect(executeNpcTombstone(firstClient, attemptedArgs, {
      now: () => new Date('2026-08-11T15:00:00.000Z'),
    })).rejects.toMatchObject({ code: 'NPC_TOMBSTONE_IDEMPOTENCE_INVALID' });
    await expect(targetTombstoneState()).resolves.toEqual(before);
    if (variant === 'different-reason' || variant === 'audit-details-corrupt') {
      expect(existsSync(attemptedArgs.exportFile)).toBe(false);
    }
  });

  it('serializes two concurrent invocations into one apply, one idempotent result, one audit and one export', async () => {
    const firstArgs = commandArgs('concurrent-first');
    const secondArgs = { ...firstArgs, exportFile: exportPath('concurrent-second') };

    const results = await Promise.all([
      executeNpcTombstone(firstClient, firstArgs, { now: () => appliedAt }),
      executeNpcTombstone(secondClient, secondArgs, { now: () => appliedAt }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual(['already-applied', 'applied']);
    await expect(firstClient.npcAuditLog.count({
      where: { action: NPC_TOMBSTONE_AUDIT_ACTION, entityId: submissionId },
    })).resolves.toBe(1);
    expect([firstArgs.exportFile, secondArgs.exportFile].filter(existsSync)).toHaveLength(1);
  });
});
