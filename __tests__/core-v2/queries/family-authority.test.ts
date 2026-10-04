import { setupServiceHarness } from '../helpers/service-harness';
import { readCoreFamilyAuthorityWithClient } from '@/lib/core-v2/queries/family-authority';
import { verifyHouseholdParent, revokeHouseholdParent } from '@/lib/core-v2/services/household-verification';

const h = setupServiceHarness();

async function family(verified = true) {
  const household = await h.client.household.create({
    data: { parents: { create: { userId: h.parentActor.userId, isPrimaryContact: true } } },
  });
  const child = await h.client.user.create({ data: { role: 'ELEVE', accountStatus: 'ACTIVE' } });
  const student = await h.client.student.create({ data: { userId: child.id, householdId: household.id } });
  if (verified) {
    await verifyHouseholdParent(h.client, h.ctx(), {
      householdId: household.id, parentUserId: h.parentActor.userId,
      expectedRevision: 0, evidenceDigest: 'a'.repeat(64),
    });
  }
  return { household, student };
}

test('a complete verified membership grants the exactly mapped child', async () => {
  const { student } = await family();
  expect(await readCoreFamilyAuthorityWithClient(h.client, h.parentActor.userId, [student]))
    .toEqual({ parentOwned: true, students: [{ id: student.id, owned: true, allowed: true }] });
});

test('a revoked membership immediately refuses the same child without deleting identity', async () => {
  const { household, student } = await family();
  await revokeHouseholdParent(h.client, h.ctx(), {
    householdId: household.id, parentUserId: h.parentActor.userId, expectedRevision: 1,
  });
  expect(await readCoreFamilyAuthorityWithClient(h.client, h.parentActor.userId, [student]))
    .toEqual({ parentOwned: true, students: [{ id: student.id, owned: true, allowed: false }] });
});

test('a pending membership never authorizes the historical child', async () => {
  const { student } = await family(false);
  expect((await readCoreFamilyAuthorityWithClient(h.client, h.parentActor.userId, [student])).students[0].allowed).toBe(false);
});

test('a parent absent from Core cannot use a legacy relation to a Core child', async () => {
  const { student } = await family();
  expect(await readCoreFamilyAuthorityWithClient(h.client, 'synthetic-v1-only-parent', [student]))
    .toEqual({ parentOwned: false, students: [{ id: student.id, owned: true, allowed: false }] });
});

test.each(['id', 'userId'] as const)('both identity mappings are mandatory: mismatched %s is refused', async (field) => {
  const { student } = await family();
  const identity = { id: student.id, userId: student.userId, [field]: 'synthetic-unmapped-identity' };
  expect(await readCoreFamilyAuthorityWithClient(h.client, h.parentActor.userId, [identity]))
    .toEqual({ parentOwned: true, students: [{ id: identity.id, owned: true, allowed: false }] });
});

test('a Core credential without a student profile remains Core-owned and refused', async () => {
  await family();
  const child = await h.client.user.create({ data: { role: 'ELEVE', accountStatus: 'ACTIVE' } });
  const identity = { id: 'synthetic-missing-profile', userId: child.id };
  expect(await readCoreFamilyAuthorityWithClient(h.client, h.parentActor.userId, [identity]))
    .toEqual({ parentOwned: true, students: [{ id: identity.id, owned: true, allowed: false }] });
});

test('a completely unmigrated identity is distinguished from a missing Core profile', async () => {
  const identity = { id: 'synthetic-legacy-student', userId: 'synthetic-legacy-user' };
  expect(await readCoreFamilyAuthorityWithClient(h.client, 'synthetic-legacy-parent', [identity]))
    .toEqual({ parentOwned: false, students: [{ id: identity.id, owned: false, allowed: false }] });
});

test.each(['SUSPENDED', 'DISABLED'] as const)('a %s Core parent has no family access', async accountStatus => {
  const { student } = await family();
  await h.client.user.update({ where: { id: h.parentActor.userId }, data: { accountStatus } });
  expect((await readCoreFamilyAuthorityWithClient(h.client, h.parentActor.userId, [student])).students[0].allowed).toBe(false);
});

test('a Core account with a non-parent role is refused even with a verified membership', async () => {
  const { student } = await family();
  await h.client.user.update({ where: { id: h.parentActor.userId }, data: { role: 'COACH' } });
  expect((await readCoreFamilyAuthorityWithClient(h.client, h.parentActor.userId, [student])).students[0].allowed).toBe(false);
});

test('bulk results preserve order and deny an exactly mapped child from a different household', async () => {
  const { student } = await family();
  const otherHousehold = await h.client.household.create({ data: {} });
  const otherUser = await h.client.user.create({ data: { role: 'ELEVE', accountStatus: 'ACTIVE' } });
  const otherStudent = await h.client.student.create({ data: { userId: otherUser.id, householdId: otherHousehold.id } });
  expect((await readCoreFamilyAuthorityWithClient(h.client, h.parentActor.userId, [otherStudent, student])).students)
    .toEqual([
      { id: otherStudent.id, owned: true, allowed: false },
      { id: student.id, owned: true, allowed: true },
    ]);
});

test('verified second responsible adults see the household without inventing per-child ownership', async () => {
  const { household, student } = await family();
  const second = await h.client.user.create({ data: { role: 'PARENT', accountStatus: 'ACTIVE' } });
  await h.client.householdParent.create({ data: { householdId: household.id, userId: second.id } });
  await verifyHouseholdParent(h.client, h.ctx(), {
    householdId: household.id, parentUserId: second.id, expectedRevision: 0, evidenceDigest: 'b'.repeat(64),
  });
  expect((await readCoreFamilyAuthorityWithClient(h.client, second.id, [student])).students[0].allowed).toBe(true);
});
