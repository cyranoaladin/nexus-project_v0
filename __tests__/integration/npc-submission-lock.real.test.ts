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
});
