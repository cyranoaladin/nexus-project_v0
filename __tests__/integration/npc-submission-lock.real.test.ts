/** @jest-environment node */

import { PrismaClient, type Prisma } from '@prisma/client';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import {
  assertSubmissionAvailable,
  markSubmissionUnavailable,
  SubmissionUnavailableError,
} from '@/lib/npc/unavailable';
import { withLockedCopySubmission } from '@/lib/npc/submission-lock';
import {
  cleanupNpcRealFixture,
  createNpcRealFixture,
  deferred,
} from './npc-real-test-helpers';

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
const firstClient = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const secondClient = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const prefix = 'npc-lock-real';

type CompetingMutation = (
  tx: Prisma.TransactionClient,
  submissionId: string,
) => Promise<void>;

const mutations: Array<[string, CompetingMutation]> = [
  ['add', async (tx, submissionId) => {
    await tx.copyPage.create({
      data: {
        id: `${prefix}-added-page`,
        submissionId,
        pageNumber: 2,
        documentType: 'SUBJECT',
        originalFilePath: 'synthetic/subject.pdf',
        sizeBytes: 1,
        sha256: 'a'.repeat(64),
      },
    });
  }],
  ['delete', async (tx) => {
    await tx.copyPage.delete({ where: { id: `${prefix}-page` } });
  }],
  ['reclassify', async (tx) => {
    await tx.copyPage.update({
      where: { id: `${prefix}-page` },
      data: { documentType: 'SUBJECT' },
    });
  }],
];

describe('NPC common submission lock on PostgreSQL 15', () => {
  beforeAll(() => {
    assertDisposablePostgresUrl(databaseUrl);
  });

  beforeEach(async () => {
    await cleanupNpcRealFixture(firstClient, prefix);
    const fixture = await createNpcRealFixture(firstClient, prefix);
    await firstClient.copyPage.create({
      data: {
        id: `${prefix}-page`,
        submissionId: fixture.submissionId,
        pageNumber: 1,
        documentType: 'STUDENT_COPY',
        originalFilePath: 'synthetic/copy.pdf',
        sizeBytes: 1,
        sha256: 'b'.repeat(64),
      },
    });
  });

  afterAll(async () => {
    await cleanupNpcRealFixture(firstClient, prefix);
    await Promise.all([firstClient.$disconnect(), secondClient.$disconnect()]);
  });

  it.each(mutations)(
    'serializes tombstone against document %s and preserves the terminal state',
    async (_label, mutate) => {
      const submissionId = `${prefix}-submission`;
      const tombstoneHasLock = deferred();
      const releaseTombstone = deferred();
      let competingCallbackEntered = false;

      const tombstone = firstClient.$transaction(async (tx) =>
        withLockedCopySubmission(tx, submissionId, async (locked) => {
          expect(locked.status).toBe('UPLOADED');
          tombstoneHasLock.resolve();
          await releaseTombstone.promise;
          await markSubmissionUnavailable(tx, submissionId, {
            reason: 'SOURCE_FILE_UNAVAILABLE',
            actorId: 'npc-maintenance',
            actorRole: 'SYSTEM',
            affectedPageIds: [`${prefix}-page`],
          });
        }),
      );

      await tombstoneHasLock.promise;
      const competing = secondClient.$transaction(async (tx) =>
        withLockedCopySubmission(tx, submissionId, async (locked) => {
          competingCallbackEntered = true;
          assertSubmissionAvailable(locked);
          await mutate(tx, submissionId);
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 75));
      expect(competingCallbackEntered).toBe(false);
      releaseTombstone.resolve();

      await tombstone;
      await expect(competing).rejects.toBeInstanceOf(SubmissionUnavailableError);

      const finalSubmission = await firstClient.copySubmission.findUniqueOrThrow({
        where: { id: submissionId },
        include: { pages: { orderBy: { pageNumber: 'asc' } } },
      });
      expect(finalSubmission.status).toBe('UNAVAILABLE');
      expect(finalSubmission.unavailableReason).toBe('SOURCE_FILE_UNAVAILABLE');
      expect(finalSubmission.pages).toHaveLength(1);
      expect(finalSubmission.pages[0]).toMatchObject({
        id: `${prefix}-page`,
        documentType: 'STUDENT_COPY',
        status: 'UNAVAILABLE',
        unavailableReason: 'SOURCE_FILE_UNAVAILABLE',
      });
    },
  );

  it('atomically tombstones only affected pages, preserves the report, and writes one exact audit', async () => {
    const submissionId = `${prefix}-submission`;
    const studentId = `${prefix}-student`;
    const reason = 'SOURCE_FILE_UNAVAILABLE_EXACT';
    const affectedPageIds = [`${prefix}-page`, `${prefix}-page-2`];
    let tombstonedAt: Date | undefined;

    await firstClient.copyPage.createMany({
      data: [
        {
          id: affectedPageIds[1],
          submissionId,
          pageNumber: 2,
          documentType: 'SUBJECT',
          originalFilePath: 'synthetic/subject.pdf',
          sizeBytes: 1,
          sha256: 'c'.repeat(64),
        },
        {
          id: `${prefix}-page-unaffected`,
          submissionId,
          pageNumber: 3,
          documentType: 'SUPPORTING_DOCUMENT',
          originalFilePath: 'synthetic/witness.pdf',
          sizeBytes: 1,
          sha256: 'd'.repeat(64),
        },
      ],
    });
    await firstClient.copySubmission.create({
      data: {
        id: `${prefix}-submission-witness`,
        studentId,
        subject: 'MATHEMATIQUES',
        title: 'Soumission témoin',
        status: 'ARCHIVED',
        pages: {
          create: {
            id: `${prefix}-witness-page`,
            pageNumber: 1,
            documentType: 'STUDENT_COPY',
            originalFilePath: 'synthetic/other-copy.pdf',
            sizeBytes: 1,
            sha256: 'e'.repeat(64),
          },
        },
      },
    });
    await firstClient.pedagogicalReport.create({
      data: {
        id: `${prefix}-report`,
        copySubmissionId: submissionId,
        studentId,
        status: 'VALIDATED',
        visibility: 'COACH_AND_STUDENT',
        diagnostic: { version: 'existing-report' },
        strengths: ['Analyse'],
        weaknesses: ['Calcul'],
        coachNotes: 'Rapport à préserver exactement',
      },
    });

    const reportBefore = await firstClient.pedagogicalReport.findUniqueOrThrow({
      where: { id: `${prefix}-report` },
    });
    const unaffectedPageBefore = await firstClient.copyPage.findUniqueOrThrow({
      where: { id: `${prefix}-page-unaffected` },
    });
    const witnessBefore = await firstClient.copySubmission.findUniqueOrThrow({
      where: { id: `${prefix}-submission-witness` },
      include: { pages: true },
    });

    await firstClient.$transaction(async (tx) =>
      withLockedCopySubmission(tx, submissionId, async () => {
        const result = await markSubmissionUnavailable(tx, submissionId, {
          reason,
          actorId: `${prefix}-maintenance`,
          actorRole: 'SYSTEM',
          affectedPageIds: [...affectedPageIds, affectedPageIds[0]],
          integrityIssueCodes: [
            'ORIGINAL_FILE_UNAVAILABLE',
            'ORIGINAL_FILE_UNAVAILABLE',
          ],
        });
        tombstonedAt = result.unavailableAt;
      }),
    );

    const finalSubmission = await firstClient.copySubmission.findUniqueOrThrow({
      where: { id: submissionId },
      include: { pages: { orderBy: { pageNumber: 'asc' } } },
    });
    expect(tombstonedAt).toBeInstanceOf(Date);
    expect(finalSubmission.status).toBe('UNAVAILABLE');
    expect(finalSubmission.unavailableReason).toBe(reason);
    expect(finalSubmission.unavailableAt?.getTime()).toBe(tombstonedAt!.getTime());
    const affectedPages = finalSubmission.pages.filter((page) =>
      affectedPageIds.includes(page.id),
    );
    expect(affectedPages).toHaveLength(2);
    for (const affectedPage of affectedPages) {
      expect(affectedPage.status).toBe('UNAVAILABLE');
      expect(affectedPage.unavailableReason).toBe(reason);
      expect(affectedPage.unavailableAt?.getTime()).toBe(tombstonedAt!.getTime());
    }

    await expect(firstClient.copyPage.findUniqueOrThrow({
      where: { id: unaffectedPageBefore.id },
    })).resolves.toEqual(unaffectedPageBefore);
    await expect(firstClient.copySubmission.findUniqueOrThrow({
      where: { id: witnessBefore.id },
      include: { pages: true },
    })).resolves.toEqual(witnessBefore);
    await expect(firstClient.pedagogicalReport.findUniqueOrThrow({
      where: { id: reportBefore.id },
    })).resolves.toEqual(reportBefore);

    const audits = await firstClient.npcAuditLog.findMany({
      where: {
        action: 'MARK_SUBMISSION_UNAVAILABLE',
        entityId: submissionId,
      },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorId: `${prefix}-maintenance`,
      actorRole: 'SYSTEM',
      action: 'MARK_SUBMISSION_UNAVAILABLE',
      entityType: 'CopySubmission',
      entityId: submissionId,
      reportId: null,
    });
    expect(audits[0].details).toEqual({
      reason,
      affectedPageIds,
      integrityIssueCodes: ['ORIGINAL_FILE_UNAVAILABLE'],
    });
  });

  it('rolls the whole tombstone back when the audit insert violates a database constraint', async () => {
    const submissionId = `${prefix}-submission`;
    const rejectedActorId = `${prefix}-rejected-by-test-constraint`;

    await firstClient.$executeRaw`
      ALTER TABLE "npc_audit_logs"
      ADD CONSTRAINT "npc_audit_test_reject_actor"
      CHECK ("actorId" <> 'npc-lock-real-rejected-by-test-constraint')
    `;

    try {
      await expect(firstClient.$transaction(async (tx) =>
        withLockedCopySubmission(tx, submissionId, async () => {
          await markSubmissionUnavailable(tx, submissionId, {
            reason: 'MUST_ROLL_BACK',
            actorId: rejectedActorId,
            actorRole: 'SYSTEM',
            affectedPageIds: [`${prefix}-page`],
          });
        }),
      )).rejects.toThrow();
    } finally {
      await firstClient.$executeRaw`
        ALTER TABLE "npc_audit_logs"
        DROP CONSTRAINT "npc_audit_test_reject_actor"
      `;
    }

    await expect(firstClient.copySubmission.findUniqueOrThrow({
      where: { id: submissionId },
      select: { status: true, unavailableReason: true, unavailableAt: true },
    })).resolves.toEqual({
      status: 'UPLOADED',
      unavailableReason: null,
      unavailableAt: null,
    });
    await expect(firstClient.copyPage.findUniqueOrThrow({
      where: { id: `${prefix}-page` },
      select: { status: true, unavailableReason: true, unavailableAt: true },
    })).resolves.toEqual({
      status: 'UPLOADED',
      unavailableReason: null,
      unavailableAt: null,
    });
    await expect(firstClient.npcAuditLog.count({
      where: { entityId: submissionId },
    })).resolves.toBe(0);
  });
});
