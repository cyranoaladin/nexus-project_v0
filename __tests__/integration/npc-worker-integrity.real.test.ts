/** @jest-environment node */

import { createHash } from 'node:crypto';
import { chmodSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { writeNpcStorageFileAtomic } from '@/lib/npc/storage-root';
import { withLockedCopySubmission } from '@/lib/npc/submission-lock';
import { markSubmissionUnavailable } from '@/lib/npc/unavailable';
import {
  finalizePedagogicalDiagnosis,
  markPedagogicalDiagnosisFailed,
  persistVisionOcrResult,
  validateSubmissionBeforeDiagnosis,
} from '@/services/npc-worker/submission-finalization';
import {
  cleanupNpcRealFixture,
  createNpcRealFixture,
  deferred,
} from './npc-real-test-helpers';

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
const firstClient = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const secondClient = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const prefix = 'npc-worker-real';
const sourcePath = 'npcworker/submission/page_1/copy.pdf';
const sourceBytes = Buffer.from('intact-student-copy');
let temporaryDirectory: string;
let storageRoot: string;

async function createIntactSubmission() {
  const fixture = await createNpcRealFixture(firstClient, prefix);
  await writeNpcStorageFileAtomic(sourcePath, sourceBytes, sourceBytes.length);
  await firstClient.copySubmission.update({
    where: { id: fixture.submissionId },
    data: {
      status: 'ANALYZING',
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
    await Promise.all([firstClient.$disconnect(), secondClient.$disconnect()]);
  });

  it('marks broken sources unavailable before diagnosis starts', async () => {
    const fixture = await createNpcRealFixture(firstClient, prefix);
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

    const result = await validateSubmissionBeforeDiagnosis(
      firstClient,
      fixture.submissionId,
    );

    expect(result.ok).toBe(false);
    const submission = await firstClient.copySubmission.findUniqueOrThrow({
      where: { id: fixture.submissionId },
      include: { pages: true, report: true },
    });
    expect(submission.status).toBe('UNAVAILABLE');
    expect(submission.pages[0].status).toBe('UNAVAILABLE');
    expect(submission.report).toBeNull();
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
      jobId: `${prefix}-missing-mirror-job`,
      diagnosticOutput: { strengths: ['Raisonnement'], weaknesses: [] },
    });

    expect(result).toEqual({
      ok: false,
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
    await new Promise((resolve) => setTimeout(resolve, 75));
    expect(await firstClient.pedagogicalReport.count({
      where: { copySubmissionId: fixture.submissionId },
    })).toBe(0);

    releaseDeletion.resolve();
    await deletion;
    await expect(finalization).resolves.toMatchObject({ ok: false });

    const finalSubmission = await firstClient.copySubmission.findUniqueOrThrow({
      where: { id: fixture.submissionId },
      include: { report: true },
    });
    expect(finalSubmission.status).toBe('UNAVAILABLE');
    expect(finalSubmission.report).toBeNull();
  });

  it('lets completion win before a waiting deletion and keeps the completed sources immutable', async () => {
    const fixture = await createIntactSubmission();
    const deletionTransactionStarted = deferred();
    const allowDeletionToLock = deferred();

    const deletion = firstClient.$transaction(async (tx) => {
      deletionTransactionStarted.resolve();
      await allowDeletionToLock.promise;
      return withLockedCopySubmission(tx, fixture.submissionId, async (locked) => {
        if (locked.status === 'COMPLETED') {
          throw new Error('NPC_COMPLETED_SUBMISSION_IMMUTABLE');
        }
        await tx.copyPage.delete({ where: { id: `${prefix}-page` } });
      });
    });

    await deletionTransactionStarted.promise;
    await expect(finalizePedagogicalDiagnosis({
      prisma: secondClient,
      submissionId: fixture.submissionId,
      jobId: `${prefix}-job`,
      diagnosticOutput: { strengths: ['Raisonnement'], weaknesses: [] },
    })).resolves.toMatchObject({ ok: true, reportId: expect.any(String) });

    allowDeletionToLock.resolve();
    await expect(deletion).rejects.toThrow('NPC_COMPLETED_SUBMISSION_IMMUTABLE');

    const finalSubmission = await firstClient.copySubmission.findUniqueOrThrow({
      where: { id: fixture.submissionId },
      include: { pages: true, report: true },
    });
    expect(finalSubmission.status).toBe('COMPLETED');
    expect(finalSubmission.pages).toHaveLength(1);
    expect(finalSubmission.report).not.toBeNull();
  });

  it('does not let an in-flight OCR completion revive a page after tombstoning', async () => {
    const fixture = await createIntactSubmission();
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
      submissionId: fixture.submissionId,
      pageId: `${prefix}-page`,
      text: 'Résultat arrivé trop tard',
    });
    await new Promise((resolve) => setTimeout(resolve, 75));
    releaseTombstone.resolve();

    await tombstone;
    await expect(ocrCompletion).resolves.toBe('unavailable');
    await expect(firstClient.copyPage.findUniqueOrThrow({
      where: { id: `${prefix}-page` },
      select: { status: true, ocrText: true },
    })).resolves.toEqual({ status: 'UNAVAILABLE', ocrText: null });
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
