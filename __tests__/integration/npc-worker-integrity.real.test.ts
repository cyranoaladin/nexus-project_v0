/** @jest-environment node */

import { createHash } from 'node:crypto';
import { chmodSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { writeNpcStorageFileAtomic } from '@/lib/npc/storage-root';
import { withLockedCopySubmission } from '@/lib/npc/submission-lock';
import {
  assertSubmissionInventoryMutable,
  SubmissionInventoryFrozenError,
} from '@/lib/npc/submission-inventory';
import { markSubmissionUnavailable } from '@/lib/npc/unavailable';
import {
  finalizePedagogicalDiagnosis,
  markPedagogicalDiagnosisFailed,
  persistVisionOcrResult,
  validateSubmissionBeforeDiagnosis,
} from '@/services/npc-worker/submission-finalization';
import { recordNpcJobFailure } from '@/services/npc-worker/job-outcomes';
import {
  cleanupNpcRealFixture,
  createNpcRealFixture,
  databaseUrlWithApplicationName,
  deferred,
  waitForBlockedPostgresClient,
} from './npc-real-test-helpers';

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
const firstClient = new PrismaClient({ datasources: { db: { url: databaseUrlWithApplicationName(databaseUrl, 'npc-worker-first') } } });
const secondClient = new PrismaClient({ datasources: { db: { url: databaseUrlWithApplicationName(databaseUrl, 'npc-worker-second') } } });
const thirdClient = new PrismaClient({ datasources: { db: { url: databaseUrlWithApplicationName(databaseUrl, 'npc-worker-third') } } });
const prefix = 'npc-worker-real';
const sourcePath = 'npcworker/submission/page_1/copy.pdf';
const sourceBytes = Buffer.from('intact-student-copy');
let temporaryDirectory: string;
let storageRoot: string;

async function createIntactSubmission({
  jobId = `${prefix}-job`,
  jobStatus = 'PROCESSING' as const,
  submissionStatus = 'ANALYZING' as const,
} = {}) {
  const fixture = await createNpcRealFixture(firstClient, prefix);
  await writeNpcStorageFileAtomic(sourcePath, sourceBytes, sourceBytes.length);
  await firstClient.aiProcessingJob.create({
    data: {
      id: jobId,
      type: 'PEDAGOGICAL_DIAGNOSIS',
      status: jobStatus,
      copySubmissionId: fixture.submissionId,
      inputData: { submissionId: fixture.submissionId },
      retryCount: 0,
      maxRetries: 3,
    },
  });
  await firstClient.copySubmission.update({
    where: { id: fixture.submissionId },
    data: {
      status: submissionStatus,
      aiJobId: jobId,
      storedFilePath: sourcePath,
      fileSizeBytes: sourceBytes.length,
      mimeType: 'application/pdf',
    },
  });
  await firstClient.copyPage.create({
    data: {
      id: `${prefix}-page`,
      submissionId: fixture.submissionId,
      pageNumber: 1,
      documentType: 'STUDENT_COPY',
      originalFilePath: sourcePath,
      originalFilename: 'copy.pdf',
      mimeType: 'application/pdf',
      sizeBytes: sourceBytes.length,
      sha256: createHash('sha256').update(sourceBytes).digest('hex'),
    },
  });
  return fixture;
}

describe('NPC worker integrity gate on PostgreSQL 15', () => {
  beforeAll(() => {
    assertDisposablePostgresUrl(databaseUrl);
  });

  beforeEach(async () => {
    await cleanupNpcRealFixture(firstClient, prefix);
    temporaryDirectory = mkdtempSync(join(tmpdir(), 'npc-worker-integrity-'));
    storageRoot = join(temporaryDirectory, 'shared');
    mkdirSync(storageRoot, { mode: 0o750 });
    process.env.NPC_STORAGE_ROOT = storageRoot;
  });

  afterEach(() => {
    chmodSync(storageRoot, 0o750);
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  afterAll(async () => {
    await cleanupNpcRealFixture(firstClient, prefix);
    await Promise.all([
      firstClient.$disconnect(),
      secondClient.$disconnect(),
      thirdClient.$disconnect(),
    ]);
  });

  it('marks broken sources unavailable before diagnosis starts', async () => {
    const fixture = await createNpcRealFixture(firstClient, prefix);
    const jobId = `${prefix}-broken-job`;
    await firstClient.aiProcessingJob.create({
      data: {
        id: jobId,
        type: 'PEDAGOGICAL_DIAGNOSIS',
        status: 'PROCESSING',
        copySubmissionId: fixture.submissionId,
        inputData: { submissionId: fixture.submissionId },
      },
    });
    await firstClient.copySubmission.update({
      where: { id: fixture.submissionId },
      data: { status: 'ANALYZING', aiJobId: jobId },
    });
    await firstClient.copyPage.create({
      data: {
        id: `${prefix}-page`,
        submissionId: fixture.submissionId,
        pageNumber: 1,
        documentType: 'STUDENT_COPY',
        originalFilePath: 'missing/source.pdf',
        sizeBytes: 10,
        sha256: 'c'.repeat(64),
      },
    });

    const result = await validateSubmissionBeforeDiagnosis({
      prisma: firstClient,
      submissionId: fixture.submissionId,
      jobId,
    });

    expect(result).toMatchObject({
      kind: 'terminal',
      jobStatus: 'FAILED',
      errorCode: 'NPC_SOURCE_INTEGRITY_FAILED',
    });
    const submission = await firstClient.copySubmission.findUniqueOrThrow({
      where: { id: fixture.submissionId },
      include: { pages: true, report: true },
    });
    expect(submission.status).toBe('UNAVAILABLE');
    expect(submission.pages[0].status).toBe('UNAVAILABLE');
    expect(submission.report).toBeNull();
    await expect(firstClient.aiProcessingJob.findUniqueOrThrow({
      where: { id: jobId },
      select: {
        status: true,
        retryCount: true,
        nextRetryAt: true,
        errorMessage: true,
      },
    })).resolves.toEqual({
      status: 'FAILED',
      retryCount: 0,
      nextRetryAt: null,
      errorMessage: 'NPC_SOURCE_INTEGRITY_FAILED',
    });

    await expect(recordNpcJobFailure({
      prisma: firstClient,
      jobId,
      errorMessage: 'late generic handler',
    })).resolves.toBe('terminal-preserved');
    await expect(firstClient.aiProcessingJob.findUniqueOrThrow({
      where: { id: jobId },
      select: { status: true, retryCount: true, nextRetryAt: true },
    })).resolves.toEqual({
      status: 'FAILED',
      retryCount: 0,
      nextRetryAt: null,
    });
  });

  it.each([
    ['null', null],
    ['empty', ''],
  ])('never completes a submission whose student-copy mirror is %s', async (
    _label,
    storedFilePath,
  ) => {
    const fixture = await createIntactSubmission();
    await firstClient.copySubmission.update({
      where: { id: fixture.submissionId },
      data: { storedFilePath },
    });

    const result = await finalizePedagogicalDiagnosis({
      prisma: firstClient,
      submissionId: fixture.submissionId,
      jobId: `${prefix}-job`,
      diagnosticOutput: { strengths: ['Raisonnement'], weaknesses: [] },
    });

    expect(result).toMatchObject({
      kind: 'terminal',
      jobStatus: 'FAILED',
      errorCode: 'NPC_SOURCE_INTEGRITY_FAILED',
      issues: [{ code: 'STORED_FILE_MIRROR_MISMATCH' }],
    });
    await expect(firstClient.copySubmission.findUniqueOrThrow({
      where: { id: fixture.submissionId },
      include: { report: true },
    })).resolves.toMatchObject({
      status: 'UNAVAILABLE',
      report: null,
    });
  });

  it('serializes final integrity and completion against deletion, never producing a report from deleted sources', async () => {
    const fixture = await createIntactSubmission();
    const deletionHasLock = deferred();
    const releaseDeletion = deferred();

    const deletion = firstClient.$transaction(async (tx) =>
      withLockedCopySubmission(tx, fixture.submissionId, async () => {
        deletionHasLock.resolve();
        await releaseDeletion.promise;
        await tx.copyPage.delete({ where: { id: `${prefix}-page` } });
        await tx.copySubmission.update({
          where: { id: fixture.submissionId },
          data: {
            storedFilePath: null,
            fileSizeBytes: null,
            mimeType: null,
            status: 'PENDING_UPLOAD',
          },
        });
      }),
    );

    await deletionHasLock.promise;
    const finalization = finalizePedagogicalDiagnosis({
      prisma: secondClient,
      submissionId: fixture.submissionId,
      jobId: `${prefix}-job`,
      diagnosticOutput: { strengths: ['Raisonnement'], weaknesses: [] },
    });
    await waitForBlockedPostgresClient(firstClient, 'npc-worker-second');
    expect(await firstClient.pedagogicalReport.count({
      where: { copySubmissionId: fixture.submissionId },
    })).toBe(0);

    releaseDeletion.resolve();
    await deletion;
    await expect(finalization).resolves.toMatchObject({
      kind: 'terminal',
      jobStatus: 'FAILED',
      errorCode: 'NPC_SOURCE_INTEGRITY_FAILED',
    });

    const finalSubmission = await firstClient.copySubmission.findUniqueOrThrow({
      where: { id: fixture.submissionId },
      include: { report: true },
    });
    expect(finalSubmission.status).toBe('UNAVAILABLE');
    expect(finalSubmission.report).toBeNull();
  });

  it('lets completion win before a waiting deletion and keeps the completed sources immutable', async () => {
    const fixture = await createIntactSubmission();
    const jobBlockerHasLock = deferred();
    const releaseJobBlocker = deferred();
    const jobBlocker = firstClient.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "ai_processing_jobs"
        WHERE "id" = ${`${prefix}-job`}
        FOR UPDATE
      `;
      jobBlockerHasLock.resolve();
      await releaseJobBlocker.promise;
    });

    await jobBlockerHasLock.promise;
    const finalization = finalizePedagogicalDiagnosis({
      prisma: secondClient,
      submissionId: fixture.submissionId,
      jobId: `${prefix}-job`,
      diagnosticOutput: { strengths: ['Raisonnement'], weaknesses: [] },
    });
    await waitForBlockedPostgresClient(firstClient, 'npc-worker-second');

    const deletion = thirdClient.$transaction(async (tx) =>
      withLockedCopySubmission(tx, fixture.submissionId, async (locked) => {
        assertSubmissionInventoryMutable(locked);
        await tx.copyPage.delete({ where: { id: `${prefix}-page` } });
      }),
    );
    await waitForBlockedPostgresClient(firstClient, 'npc-worker-third');
    releaseJobBlocker.resolve();

    await jobBlocker;
    await expect(finalization).resolves.toMatchObject({
      kind: 'completed',
      idempotent: false,
      reportId: expect.any(String),
    });
    await expect(deletion).rejects.toBeInstanceOf(
      SubmissionInventoryFrozenError,
    );

    const finalSubmission = await firstClient.copySubmission.findUniqueOrThrow({
      where: { id: fixture.submissionId },
      include: { pages: true, report: true },
    });
    expect(finalSubmission.status).toBe('COMPLETED');
    expect(finalSubmission.pages).toHaveLength(1);
    expect(finalSubmission.report).not.toBeNull();
    await expect(firstClient.aiProcessingJob.findUniqueOrThrow({
      where: { id: `${prefix}-job` },
      select: { status: true },
    })).resolves.toEqual({ status: 'COMPLETED' });
  });

  it('is idempotent after a lost acknowledgement and never creates a second report', async () => {
    const fixture = await createIntactSubmission();
    const args = {
      prisma: firstClient,
      submissionId: fixture.submissionId,
      jobId: `${prefix}-job`,
      diagnosticOutput: { strengths: ['Raisonnement'], weaknesses: [] },
    };

    const first = await finalizePedagogicalDiagnosis(args);
    expect(first).toMatchObject({
      kind: 'completed',
      idempotent: false,
      reportId: expect.any(String),
    });
    if (first.kind !== 'completed') {
      throw new Error('Expected completed finalization');
    }
    const second = await finalizePedagogicalDiagnosis(args);
    expect(second).toEqual({
      kind: 'completed',
      idempotent: true,
      reportId: first.reportId,
    });

    await expect(firstClient.pedagogicalReport.count({
      where: { copySubmissionId: fixture.submissionId },
    })).resolves.toBe(1);
    await expect(firstClient.npcAuditLog.count({
      where: {
        action: 'COMPLETE_PEDAGOGICAL_DIAGNOSIS',
        entityId: fixture.submissionId,
      },
    })).resolves.toBe(1);
    await expect(markPedagogicalDiagnosisFailed(
      firstClient,
      fixture.submissionId,
    )).resolves.toBe('completed');
    await expect(firstClient.copySubmission.findUniqueOrThrow({
      where: { id: fixture.submissionId },
      select: { status: true },
    })).resolves.toEqual({ status: 'COMPLETED' });
  });

  it('fails a mismatched job terminally without mutating the analyzing submission', async () => {
    const fixture = await createIntactSubmission();
    const mismatchedJobId = `${prefix}-mismatched-job`;
    await firstClient.aiProcessingJob.create({
      data: {
        id: mismatchedJobId,
        type: 'PEDAGOGICAL_DIAGNOSIS',
        status: 'PROCESSING',
        inputData: { submissionId: fixture.submissionId },
      },
    });

    await expect(finalizePedagogicalDiagnosis({
      prisma: firstClient,
      submissionId: fixture.submissionId,
      jobId: mismatchedJobId,
      diagnosticOutput: { strengths: [], weaknesses: [] },
    })).resolves.toMatchObject({
      kind: 'terminal',
      jobStatus: 'FAILED',
      errorCode: 'NPC_JOB_BINDING_MISMATCH',
    });

    await expect(firstClient.copySubmission.findUniqueOrThrow({
      where: { id: fixture.submissionId },
      include: { report: true },
    })).resolves.toMatchObject({ status: 'ANALYZING', report: null });
    await expect(firstClient.aiProcessingJob.findUniqueOrThrow({
      where: { id: mismatchedJobId },
      select: { status: true, retryCount: true, nextRetryAt: true },
    })).resolves.toEqual({
      status: 'FAILED',
      retryCount: 0,
      nextRetryAt: null,
    });
  });

  it('rolls back terminal job failure when the submission failure state cannot be stored', async () => {
    const fixture = await createIntactSubmission();
    const jobId = `${prefix}-job`;
    await firstClient.aiProcessingJob.update({
      where: { id: jobId },
      data: { retryCount: 3, maxRetries: 3 },
    });
    await firstClient.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS "npc_worker_reject_analysis_failed" ON "copy_submissions"',
    );
    await firstClient.$executeRawUnsafe(
      'DROP FUNCTION IF EXISTS "npc_worker_reject_analysis_failed"()',
    );
    await firstClient.$executeRawUnsafe(`
      CREATE FUNCTION "npc_worker_reject_analysis_failed"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW."status" = 'ANALYSIS_FAILED' THEN
          RAISE EXCEPTION 'NPC_TEST_REJECT_ANALYSIS_FAILED';
        END IF;
        RETURN NEW;
      END $$
    `);
    await firstClient.$executeRawUnsafe(`
      CREATE TRIGGER "npc_worker_reject_analysis_failed"
      BEFORE UPDATE ON "copy_submissions"
      FOR EACH ROW EXECUTE FUNCTION "npc_worker_reject_analysis_failed"()
    `);

    try {
      await expect(recordNpcJobFailure({
        prisma: firstClient,
        jobId,
        errorMessage: 'terminal diagnosis failure',
      })).rejects.toThrow('NPC_TEST_REJECT_ANALYSIS_FAILED');

      await expect(firstClient.aiProcessingJob.findUniqueOrThrow({
        where: { id: jobId },
        select: {
          status: true,
          retryCount: true,
          errorMessage: true,
          completedAt: true,
        },
      })).resolves.toEqual({
        status: 'PROCESSING',
        retryCount: 3,
        errorMessage: null,
        completedAt: null,
      });
      await expect(firstClient.copySubmission.findUniqueOrThrow({
        where: { id: fixture.submissionId },
        select: { status: true },
      })).resolves.toEqual({ status: 'ANALYZING' });
    } finally {
      await firstClient.$executeRawUnsafe(
        'DROP TRIGGER IF EXISTS "npc_worker_reject_analysis_failed" ON "copy_submissions"',
      );
      await firstClient.$executeRawUnsafe(
        'DROP FUNCTION IF EXISTS "npc_worker_reject_analysis_failed"()',
      );
    }
  });

  it('terminalizes an unbound legacy job without failing a submission bound to another job', async () => {
    const fixture = await createIntactSubmission();
    const activeJobId = `${prefix}-job`;
    const legacyJobId = `${prefix}-legacy-job`;
    await firstClient.aiProcessingJob.create({
      data: {
        id: legacyJobId,
        type: 'PEDAGOGICAL_DIAGNOSIS',
        status: 'PROCESSING',
        inputData: { submissionId: fixture.submissionId },
        retryCount: 3,
        maxRetries: 3,
      },
    });

    await expect(recordNpcJobFailure({
      prisma: firstClient,
      jobId: legacyJobId,
      errorMessage: 'stale legacy failure',
    })).resolves.toBe('failed');

    await expect(firstClient.aiProcessingJob.findUniqueOrThrow({
      where: { id: legacyJobId },
      select: { status: true, errorMessage: true },
    })).resolves.toEqual({
      status: 'FAILED',
      errorMessage: 'stale legacy failure',
    });
    await expect(firstClient.copySubmission.findUniqueOrThrow({
      where: { id: fixture.submissionId },
      select: { status: true, aiJobId: true },
    })).resolves.toEqual({
      status: 'ANALYZING',
      aiJobId: activeJobId,
    });
    await expect(firstClient.aiProcessingJob.findUniqueOrThrow({
      where: { id: activeJobId },
      select: { status: true, errorMessage: true },
    })).resolves.toEqual({ status: 'PROCESSING', errorMessage: null });
  });

  it.each([
    {
      label: 'retryable',
      retryCount: 0,
      expectedResult: 'retrying',
      expectedStatus: 'RETRYING',
      expectedRetryCount: 1,
    },
    {
      label: 'exhausted',
      retryCount: 1,
      expectedResult: 'failed',
      expectedStatus: 'FAILED',
      expectedRetryCount: 1,
    },
  ] as const)(
    'handles malformed legacy input as a job-only $label failure',
    async ({
      label,
      retryCount,
      expectedResult,
      expectedStatus,
      expectedRetryCount,
    }) => {
      const jobId = `${prefix}-malformed-${label}-job`;
      await firstClient.aiProcessingJob.create({
        data: {
          id: jobId,
          type: 'PEDAGOGICAL_DIAGNOSIS',
          status: 'PROCESSING',
          inputData: '{malformed-json',
          retryCount,
          maxRetries: 1,
        },
      });

      await expect(recordNpcJobFailure({
        prisma: firstClient,
        jobId,
        errorMessage: `malformed ${label} failure`,
      })).resolves.toBe(expectedResult);

      const job = await firstClient.aiProcessingJob.findUniqueOrThrow({
        where: { id: jobId },
        select: {
          status: true,
          retryCount: true,
          errorMessage: true,
          completedAt: true,
        },
      });
      expect(job).toMatchObject({
        status: expectedStatus,
        retryCount: expectedRetryCount,
        errorMessage: `malformed ${label} failure`,
      });
      if (expectedStatus === 'FAILED') {
        expect(job.completedAt).toBeInstanceOf(Date);
      } else {
        expect(job.completedAt).toBeNull();
      }
    },
  );

  it('fails contradictory completed-without-report state without changing the submission', async () => {
    const fixture = await createIntactSubmission();
    await firstClient.copySubmission.update({
      where: { id: fixture.submissionId },
      data: { status: 'COMPLETED' },
    });

    await expect(finalizePedagogicalDiagnosis({
      prisma: firstClient,
      submissionId: fixture.submissionId,
      jobId: `${prefix}-job`,
      diagnosticOutput: { strengths: [], weaknesses: [] },
    })).resolves.toMatchObject({
      kind: 'terminal',
      jobStatus: 'FAILED',
      errorCode: 'NPC_FINALIZATION_STATE_CONFLICT',
    });

    await expect(firstClient.copySubmission.findUniqueOrThrow({
      where: { id: fixture.submissionId },
      include: { report: true },
    })).resolves.toMatchObject({ status: 'COMPLETED', report: null });
  });

  it('does not let an in-flight OCR completion revive a page after tombstoning', async () => {
    const fixture = await createIntactSubmission();
    const ocrJobId = `${prefix}-ocr-job`;
    await firstClient.aiProcessingJob.create({
      data: {
        id: ocrJobId,
        type: 'VISION_OCR',
        status: 'PROCESSING',
        inputData: {
          submissionId: fixture.submissionId,
          pageId: `${prefix}-page`,
        },
      },
    });
    const tombstoneHasLock = deferred();
    const releaseTombstone = deferred();

    const tombstone = firstClient.$transaction(async (tx) =>
      withLockedCopySubmission(tx, fixture.submissionId, async () => {
        tombstoneHasLock.resolve();
        await releaseTombstone.promise;
        await markSubmissionUnavailable(tx, fixture.submissionId, {
          reason: 'SOURCE_FILE_UNAVAILABLE',
          actorId: 'npc-maintenance',
          actorRole: 'SYSTEM',
          affectedPageIds: [`${prefix}-page`],
        });
      }),
    );

    await tombstoneHasLock.promise;
    const ocrCompletion = persistVisionOcrResult({
      prisma: secondClient,
      jobId: ocrJobId,
      submissionId: fixture.submissionId,
      pageId: `${prefix}-page`,
      text: 'Résultat arrivé trop tard',
    });
    await waitForBlockedPostgresClient(firstClient, 'npc-worker-second');
    releaseTombstone.resolve();

    await tombstone;
    await expect(ocrCompletion).resolves.toEqual({
      kind: 'terminal',
      jobStatus: 'CANCELLED',
      errorCode: 'NPC_SUBMISSION_UNAVAILABLE',
    });
    await expect(firstClient.copyPage.findUniqueOrThrow({
      where: { id: `${prefix}-page` },
      select: { status: true, ocrText: true },
    })).resolves.toEqual({ status: 'UNAVAILABLE', ocrText: null });
    await expect(firstClient.aiProcessingJob.findUniqueOrThrow({
      where: { id: ocrJobId },
      select: {
        status: true,
        retryCount: true,
        nextRetryAt: true,
        errorMessage: true,
      },
    })).resolves.toEqual({
      status: 'CANCELLED',
      retryCount: 0,
      nextRetryAt: null,
      errorMessage: 'NPC_SUBMISSION_UNAVAILABLE',
    });
    await expect(recordNpcJobFailure({
      prisma: firstClient,
      jobId: ocrJobId,
      errorMessage: 'late generic handler',
    })).resolves.toBe('terminal-preserved');
  });

  it('atomically completes the OCR job with its page update and preserves it from generic failure', async () => {
    const fixture = await createIntactSubmission();
    const ocrJobId = `${prefix}-ocr-success-job`;
    await firstClient.aiProcessingJob.create({
      data: {
        id: ocrJobId,
        type: 'VISION_OCR',
        status: 'PROCESSING',
        inputData: {
          submissionId: fixture.submissionId,
          pageId: `${prefix}-page`,
        },
      },
    });

    await expect(persistVisionOcrResult({
      prisma: firstClient,
      jobId: ocrJobId,
      submissionId: fixture.submissionId,
      pageId: `${prefix}-page`,
      text: 'Résultat OCR intact',
    })).resolves.toEqual({ kind: 'updated' });
    await expect(firstClient.aiProcessingJob.findUniqueOrThrow({
      where: { id: ocrJobId },
      select: { status: true, retryCount: true, nextRetryAt: true },
    })).resolves.toEqual({
      status: 'COMPLETED',
      retryCount: 0,
      nextRetryAt: null,
    });
    await expect(recordNpcJobFailure({
      prisma: firstClient,
      jobId: ocrJobId,
      errorMessage: 'late generic handler',
    })).resolves.toBe('terminal-preserved');
  });

  it('does not overwrite UNAVAILABLE with ANALYSIS_FAILED during generic failure handling', async () => {
    const fixture = await createNpcRealFixture(firstClient, prefix);
    await firstClient.copySubmission.update({
      where: { id: fixture.submissionId },
      data: {
        status: 'UNAVAILABLE',
        unavailableReason: 'SOURCE_FILE_UNAVAILABLE',
        unavailableAt: new Date(),
      },
    });

    await markPedagogicalDiagnosisFailed(firstClient, fixture.submissionId);

    await expect(firstClient.copySubmission.findUniqueOrThrow({
      where: { id: fixture.submissionId },
      select: { status: true },
    })).resolves.toEqual({ status: 'UNAVAILABLE' });
  });
});
