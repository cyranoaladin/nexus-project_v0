jest.unmock('@/lib/prisma');
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { issueParentPhoneChallenge, consumeParentPhoneChallenge, verifyParentPhoneChallenge, releaseExpiredParentPhoneReservation } from '@/lib/auth/parent-phone';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';

const PREFIX = 'parent-phone-contract-';
const phone = '29987654';
const password = ['Synthetic', randomUUID()].join('-');
let disposableVerified = false;
async function createParent(number = phone) {
  return prisma.user.create({ data: { id: PREFIX + randomUUID(), role: 'PARENT', email: null, phoneNormalized: number, password: null, activatedAt: null } });
}
async function issue(userId: string, purpose: 'ACTIVATION'|'RECOVERY' = 'ACTIVATION') {
  return prisma.$transaction(tx => issueParentPhoneChallenge(tx, { userId, purpose }));
}
async function cleanup() {
  await prisma.parentPhoneChallenge.deleteMany({ where: { userId: { startsWith: PREFIX } } });
  await prisma.user.updateMany({ where: { id: { startsWith: PREFIX } }, data: { mergedIntoUserId: null } });
  await prisma.user.deleteMany({ where: { id: { startsWith: PREFIX } } });
}
beforeAll(() => { assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || ''); disposableVerified = true; });
beforeEach(cleanup);
afterAll(async () => { if (disposableVerified) { await cleanup(); await prisma.$disconnect(); } });

it('keeps duplicate historical contacts but reserves only one telephone identity', async () => {
  const first = await createParent(); const other = await createParent();
  await issue(first.id);
  await expect(issue(other.id)).rejects.toMatchObject({ code: 'P2002' });
  expect((await prisma.user.findUniqueOrThrow({ where: { id: other.id } })).parentPhoneState).toBe('NONE');
  expect(await prisma.parentPhoneChallenge.count({ where: { userId: other.id } })).toBe(0);
});

it('a historical phone writer invalidates verified access, live challenge and sessions', async () => {
  const user = await createParent(); const activation = await issue(user.id);
  expect((await consumeParentPhoneChallenge(activation.rawToken, password)).success).toBe(true);
  const recovery = await issue(user.id, 'RECOVERY');
  const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  await prisma.user.update({ where: { id: user.id }, data: { phoneNormalized: '29987655' } });
  const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  expect(after.parentPhoneState).toBe('NONE'); expect(after.phoneVerifiedAt).toBeNull();
  expect(after.parentPhoneVersion).toBe(before.parentPhoneVersion + 1);
  expect(after.sessionVersion).toBe(before.sessionVersion + 1);
  expect(after.password).toBe(before.password);
  expect((await prisma.parentPhoneChallenge.findUniqueOrThrow({ where: { id: recovery.challengeId } })).revokedAt).not.toBeNull();
  expect(await verifyParentPhoneChallenge(recovery.rawToken)).toEqual({ valid: false });
});

it.each(['role', 'merge'] as const)('a %s transition revokes the pending reservation and challenge', async mode => {
  const user = await createParent(); const activation = await issue(user.id);
  const target = mode === 'merge' ? await createParent('29987656') : null;
  await prisma.user.update({ where: { id: user.id }, data: mode === 'role' ? { role: 'COACH' } : { mergedIntoUserId: target!.id } });
  const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  expect(after.parentPhoneState).toBe('NONE'); expect(after.parentPhoneVersion).toBe(1);
  expect(await verifyParentPhoneChallenge(activation.rawToken)).toEqual({ valid: false });
});

it('two concurrent consumers produce exactly one activation and one password transition', async () => {
  const user = await createParent(); const activation = await issue(user.id);
  const results = await Promise.all([
    consumeParentPhoneChallenge(activation.rawToken, password),
    consumeParentPhoneChallenge(activation.rawToken, 'Other-synthetic-password-2026'),
  ]);
  expect(results.filter(result => result.success)).toHaveLength(1);
  const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  expect(after.email).toBeNull(); expect(after.parentPhoneState).toBe('VERIFIED');
  expect(after.activatedAt).not.toBeNull(); expect(after.phoneVerifiedAt).not.toBeNull();
  expect(after.sessionVersion).toBe(1);
  expect((await prisma.parentPhoneChallenge.findUniqueOrThrow({ where: { id: activation.challengeId } })).consumedAt).not.toBeNull();
});

it('a renewal revokes the old link and an expired reservation is released without deleting contacts', async () => {
  const user = await createParent(); const old = await issue(user.id); const next = await issue(user.id);
  expect(await verifyParentPhoneChallenge(old.rawToken)).toEqual({ valid: false });
  expect((await verifyParentPhoneChallenge(next.rawToken)).valid).toBe(true);
  expect(await prisma.$transaction(tx => releaseExpiredParentPhoneReservation(tx, user.id))).toBe(false);
  await prisma.parentPhoneChallenge.update({ where: { id: next.challengeId }, data: { expiresAt: new Date(0) } });
  expect(await prisma.$transaction(tx => releaseExpiredParentPhoneReservation(tx, user.id))).toBe(true);
  const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  expect(after.phoneNormalized).toBe(phone); expect(after.parentPhoneState).toBe('NONE');
  expect(await prisma.parentPhoneChallenge.count({ where: { userId: user.id } })).toBe(2);
  expect((await prisma.parentPhoneChallenge.findUniqueOrThrow({ where: { id: next.challengeId } })).revokedAt).not.toBeNull();
});

it('changing a contact email invalidates its independent verification proof', async () => {
  const user = await createParent();
  await prisma.user.update({ where: { id: user.id }, data: { email: PREFIX + 'first@example.test' } });
  await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  await prisma.user.update({ where: { id: user.id }, data: { email: PREFIX + 'second@example.test' } });
  expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt).toBeNull();
});


it('explicit staff release frees an expired number without deleting the old family or challenge history', async () => {
  const original = await createParent();
  const profile = await prisma.parentProfile.create({ data: { userId: original.id } });
  const child = await prisma.user.create({ data: { id: PREFIX + randomUUID(), role: 'ELEVE', email: null,
    student: { create: { parentId: profile.id, gradeLevel: 'PREMIERE' } } }, include: { student: true } });
  const expired = await issue(original.id);
  await prisma.parentPhoneChallenge.update({ where: { id: expired.challengeId }, data: { expiresAt: new Date(0) } });
  const other = await createParent();
  await expect(issue(other.id)).rejects.toMatchObject({ code: 'P2002' });
  expect(await prisma.$transaction(tx => releaseExpiredParentPhoneReservation(tx, original.id, new Date(), expired.phoneVersion))).toBe(true);
  const next = await issue(other.id);
  expect((await verifyParentPhoneChallenge(next.rawToken)).valid).toBe(true);
  const preserved = await prisma.user.findUniqueOrThrow({ where: { id: original.id } });
  expect(preserved.phoneNormalized).toBe(phone); expect(preserved.parentPhoneState).toBe('NONE');
  expect((await prisma.student.findUniqueOrThrow({ where: { id: child.student!.id } })).parentId).toBe(profile.id);
  expect((await prisma.parentPhoneChallenge.findUniqueOrThrow({ where: { id: expired.challengeId } })).revokedAt).not.toBeNull();
  expect(await prisma.parentPhoneChallenge.count({ where: { userId: original.id } })).toBe(1);
});

it('a concurrent renewal is never invalidated by an expiration release after it commits', async () => {
  const parent = await createParent(); const old = await issue(parent.id);
  await prisma.parentPhoneChallenge.update({ where: { id: old.challengeId }, data: { expiresAt: new Date(0) } });
  const [renewal, release] = await Promise.allSettled([
    issue(parent.id),
    prisma.$transaction(tx => releaseExpiredParentPhoneReservation(tx, parent.id, new Date(), old.phoneVersion)),
  ]);
  if (renewal.status === 'fulfilled') {
    expect((await verifyParentPhoneChallenge(renewal.value.rawToken)).valid).toBe(true);
  } else {
    expect(release.status).toBe('fulfilled');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: parent.id } })).parentPhoneState).toBe('NONE');
  }
  expect(await verifyParentPhoneChallenge(old.rawToken)).toEqual({ valid: false });
});
