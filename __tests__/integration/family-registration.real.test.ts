jest.unmock('@/lib/prisma');
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { completeParentRegistration, loadParentRegistration } from '@/lib/families/parent-registration';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';

const PREFIX = `family-registration-${randomUUID()}-`;
let disposableVerified = false;
async function family() {
  const parent = await prisma.user.create({ data: {
    id: PREFIX + randomUUID(), role: 'PARENT', email: null, activatedAt: new Date(),
    firstName: 'Synthetic', lastName: 'Parent', parentProfile: { create: {} },
  }, include: { parentProfile: true } });
  const child = await prisma.user.create({ data: {
    id: PREFIX + randomUUID(), role: 'ELEVE', email: null, firstName: 'Synthetic', lastName: 'Child',
    student: { create: { parentId: parent.parentProfile!.id, gradeLevel: 'PREMIERE', schoolingStatus: 'INDIVIDUAL' } },
  }, include: { student: true } });
  const loaded = await loadParentRegistration(parent.id);
  return { parent, student: child.student!, input: {
    revision: loaded.revision, firstName: 'Confirmed', lastName: 'Parent',
    children: [{ studentId: child.student!.id, confirmed: true as const }], consentStudentIds: [] as string[],
  } };
}
async function cleanup() {
  await prisma.parentStudentLink.deleteMany({ where: { parentUserId: { startsWith: PREFIX } } });
  await prisma.student.deleteMany({ where: { userId: { startsWith: PREFIX } } });
  await prisma.parentProfile.deleteMany({ where: { userId: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: PREFIX } } });
}
beforeAll(() => { assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || ''); disposableVerified = true; });
afterEach(async () => { if (disposableVerified) await cleanup(); });
afterAll(async () => { if (disposableVerified) { await cleanup(); await prisma.$disconnect(); } });

it('refuses another family child even with the authenticated parent current revision', async () => {
  const own = await family(); const other = await family();
  await expect(completeParentRegistration(own.parent.id, {
    ...own.input, children: [{ studentId: other.student.id, confirmed: true }], consentStudentIds: [other.student.id],
  })).rejects.toMatchObject({ code: 'FAMILY_CHANGED' });
  expect((await prisma.user.findUniqueOrThrow({ where: { id: own.parent.id } })).registrationCompletedAt).toBeNull();
  expect(await prisma.parentStudentLink.count({ where: { parentUserId: own.parent.id } })).toBe(0);
});

it('refuses a stale revision after changing the same child school', async () => {
  const own = await family();
  await prisma.student.update({ where: { id: own.student.id }, data: { school: 'Updated synthetic school' } });
  await expect(completeParentRegistration(own.parent.id, { ...own.input, consentStudentIds: [own.student.id] })).rejects.toMatchObject({ code: 'FAMILY_CHANGED' });
  expect((await prisma.user.findUniqueOrThrow({ where: { id: own.parent.id } })).registrationCompletedAt).toBeNull();
  expect(await prisma.parentStudentLink.count({ where: { parentUserId: own.parent.id } })).toBe(0);
  expect((await loadParentRegistration(own.parent.id)).revision).not.toBe(own.input.revision);
});

it('completes a telephone-only parent without implicitly creating consent', async () => {
  const own = await family();
  const result = await completeParentRegistration(own.parent.id, own.input);
  const stored = await prisma.user.findUniqueOrThrow({ where: { id: own.parent.id } });
  expect(stored.registrationCompletedAt?.toISOString()).toBe(result.completedAt);
  expect(stored.firstName).toBe('Confirmed'); expect(stored.email).toBeNull();
  expect(await prisma.parentStudentLink.count({ where: { parentUserId: own.parent.id } })).toBe(0);
});

it('rolls back both persisted consent and parent confirmation when the transaction fails before commit', async () => {
  const own = await family();
  const failure = new Error('Synthetic failure before commit');
  // Keep the real transaction and real writes; inject only a pre-commit failure.
  const database = {
    user: prisma.user, parentStudentLink: prisma.parentStudentLink,
    $transaction: (action: (tx: Prisma.TransactionClient) => Promise<unknown>, options: { isolationLevel: Prisma.TransactionIsolationLevel }) =>
      prisma.$transaction(async tx => {
        await action(tx);
        const parent = await tx.user.findUniqueOrThrow({ where: { id: own.parent.id } });
        expect(parent.registrationCompletedAt).not.toBeNull();
        expect(parent.firstName).toBe('Confirmed');
        expect(await tx.parentStudentLink.count({ where: { parentUserId: own.parent.id, state: 'VERIFIED' } })).toBe(1);
        throw failure;
      }, options),
  };
  await expect(completeParentRegistration(own.parent.id, { ...own.input, consentStudentIds: [own.student.id] }, database as never)).rejects.toBe(failure);
  const parent = await prisma.user.findUniqueOrThrow({ where: { id: own.parent.id } });
  expect(parent.registrationCompletedAt).toBeNull(); expect(parent.firstName).toBe('Synthetic');
  expect(await prisma.parentStudentLink.count({ where: { parentUserId: own.parent.id } })).toBe(0);
});
