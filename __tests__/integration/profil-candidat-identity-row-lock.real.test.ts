jest.unmock('@/lib/prisma');

import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { validateProfilCandidatIdentity } from '@/lib/quotes/profil-candidat.server';

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
const disposableDatabase = databaseUrl.includes('127.0.0.1:5434/nexus_disposable_test');
const describeWithDisposablePostgres = disposableDatabase ? describe : describe.skip;
const validator = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const writer = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

describeWithDisposablePostgres('candidate identity row locks against ordinary PostgreSQL writers', () => {
  jest.setTimeout(20_000);

  afterAll(async () => {
    await Promise.all([validator.$disconnect(), writer.$disconnect()]);
  });

  test('Student reassignment waits for identity validation transaction commit', async () => {
    const nonce = randomUUID();
    const firstParentUser = await validator.user.create({
      data: { email: `identity-parent-a-${nonce}@example.test`, role: 'PARENT', firstName: 'Parent A' },
    });
    const secondParentUser = await validator.user.create({
      data: { email: `identity-parent-b-${nonce}@example.test`, role: 'PARENT', firstName: 'Parent B' },
    });
    const studentUser = await validator.user.create({
      data: { email: `identity-student-${nonce}@example.test`, role: 'ELEVE', firstName: 'Student' },
    });
    const firstParent = await validator.parentProfile.create({ data: { userId: firstParentUser.id } });
    const secondParent = await validator.parentProfile.create({ data: { userId: secondParentUser.id } });
    const student = await validator.student.create({
      data: { userId: studentUser.id, parentId: firstParent.id, gradeLevel: 'TERMINALE' },
    });
    const lead = await validator.contactLead.create({
      data: { name: 'Parent A', email: firstParentUser.email! },
    });
    const validationReachedHold = deferred();
    const releaseValidation = deferred();
    let reassignment: Promise<unknown> | undefined;

    try {
      const validation = validator.$transaction(async (transaction) => {
        const result = await validateProfilCandidatIdentity(transaction, {
          contactLeadId: lead.id,
          studentId: student.id,
        });
        validationReachedHold.resolve();
        await releaseValidation.promise;
        return result;
      });
      await validationReachedHold.promise;

      let writerSettled = false;
      reassignment = writer.student.update({
        where: { id: student.id },
        data: { parentId: secondParent.id },
      }).finally(() => { writerSettled = true; });

      await pause(250);
      expect(writerSettled).toBe(false);

      releaseValidation.resolve();
      await expect(validation).resolves.toEqual({ ok: true });
      await expect(reassignment).resolves.toMatchObject({ parentId: secondParent.id });
    } finally {
      releaseValidation.resolve();
      if (reassignment) await reassignment.catch(() => undefined);
      await validator.student.deleteMany({ where: { id: student.id } });
      await validator.contactLead.deleteMany({ where: { id: lead.id } });
      await validator.parentProfile.deleteMany({ where: { id: { in: [firstParent.id, secondParent.id] } } });
      await validator.user.deleteMany({ where: { id: { in: [firstParentUser.id, secondParentUser.id, studentUser.id] } } });
    }
  });
});
