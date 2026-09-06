jest.unmock('@/lib/prisma');
jest.mock('@/lib/guards', () => ({ requireRole: jest.fn(async () => ({ user: { id: 'identity-test-admin', role: 'ADMIN' } })), isErrorResponse: () => false }));
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PATCH } from '@/app/api/admin/users/route';
import { createActivationToken } from '@/lib/auth/activation-token';
import { completeStudentActivation } from '@/lib/services/student-activation.service';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
const PREFIX = 'contact-identity-';
let verified = false;
beforeAll(() => { assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || ''); verified = true; });
afterEach(async () => { if (verified) { await prisma.parentPhoneChallenge.deleteMany({ where: { userId: { startsWith: PREFIX } } }); await prisma.user.deleteMany({ where: { id: { startsWith: PREFIX } } }); } });
afterAll(async () => { await prisma.$disconnect(); });
async function pendingParent() {
 const token = createActivationToken('parent'); const id = PREFIX + randomUUID();
 const user = await prisma.user.create({ data: { id, role: 'PARENT', email: id+'@example.test', activationToken: token.tokenHash, activationExpiry: token.expiresAt, emailVerifiedAt: new Date(), sessionVersion: 5 } });
 return { user, token };
}
it('invalidates a previously issued email link before lookup after any parent email writer changes the address', async () => {
 const { user, token } = await pendingParent();
 const changed = await prisma.user.update({ where: { id: user.id }, data: { email: user.id+'-new@example.test' } });
 expect(changed.activationToken).toBeNull(); expect(changed.activationExpiry).toBeNull();
 expect(changed.emailVerifiedAt).toBeNull(); expect(changed.sessionVersion).toBe(6);
 expect(await completeStudentActivation(token.rawToken, 'Synthetic-contact-password-2026', 'parent')).toMatchObject({ success: false });
 expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt).toBeNull();
});
it('preserves a genuinely new token issued atomically to the new email', async () => {
 const { user, token } = await pendingParent(); const fresh = createActivationToken('parent');
 const changed = await prisma.user.update({ where: { id: user.id }, data: { email: user.id+'-new@example.test', activationToken: fresh.tokenHash, activationExpiry: fresh.expiresAt } });
 expect(changed.activationToken).toBe(fresh.tokenHash); expect(changed.activationExpiry).toEqual(fresh.expiresAt); expect(changed.sessionVersion).toBe(6);
 expect(await completeStudentActivation(token.rawToken, 'Synthetic-contact-password-2026', 'parent')).toMatchObject({ success: false });
 expect(await completeStudentActivation(fresh.rawToken, 'Synthetic-contact-password-2026', 'parent')).toMatchObject({ success: true });
 const activated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
 expect(activated.email).toBe(user.id+'-new@example.test'); expect(activated.emailVerifiedAt).not.toBeNull();
});
it('does not revoke an unchanged email or its pending activation link', async () => {
 const { user, token } = await pendingParent();
 const unchanged = await prisma.user.update({ where: { id: user.id }, data: { email: user.email } });
 expect(unchanged.activationToken).toBe(token.tokenHash); expect(unchanged.activationExpiry).toEqual(token.expiresAt); expect(unchanged.sessionVersion).toBe(5);
});
it('admin PATCH changes the phone identity atomically and revokes the old login and challenges', async () => {
 const { user } = await pendingParent();
 await prisma.user.update({ where: { id: user.id }, data: { phone: '29 88 70 01', phoneNormalized: '29887001' } });
 const verifiedParent = await prisma.user.update({ where: { id: user.id }, data: { parentPhoneState: 'VERIFIED', phoneVerifiedAt: new Date(), activatedAt: new Date() } });
 const challenge = await prisma.parentPhoneChallenge.create({ data: { userId: user.id, phoneNormalized: '29887001', phoneVersion: verifiedParent.parentPhoneVersion, purpose: 'RECOVERY', tokenHash: randomUUID(), expiresAt: new Date(Date.now()+60000) } });
 const response = await PATCH(new NextRequest('http://localhost/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: user.id, phone: '+21629887002' }) }));
 expect(response.status).toBe(200);
 const changed = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
 expect(changed.phoneNormalized).toBe('29887002'); expect(changed.phone).toBe('29 88 70 02'); expect(changed.parentPhoneState).toBe('NONE'); expect(changed.phoneVerifiedAt).toBeNull();
 expect(changed.parentPhoneVersion).toBe(verifiedParent.parentPhoneVersion+1); expect(changed.sessionVersion).toBeGreaterThan(verifiedParent.sessionVersion);
 expect((await prisma.parentPhoneChallenge.findUniqueOrThrow({ where: { id: challenge.id } })).revokedAt).not.toBeNull();
 expect(await prisma.user.findFirst({ where: { phoneNormalized: '29887001', parentPhoneState: 'VERIFIED' } })).toBeNull();
});

it('migration cutover revokes only preexisting pending parent email links and preserves family history and WhatsApp', async () => {
 const rolledBack = new Error('ROLLBACK_SYNTHETIC_CUTOVER');
 await expect(prisma.$transaction(async tx => {
  const id = PREFIX + randomUUID();
  const token = createActivationToken('parent');
  const parent = await tx.user.create({ data: { id, role: 'PARENT', email: id+'@example.test', activationToken: token.tokenHash, activationExpiry: token.expiresAt, phoneNormalized: '29887003', parentPhoneState: 'RESERVED', parentPhoneVersion: 3, sessionVersion: 8 } });
  const profile = await tx.parentProfile.create({ data: { userId: id } });
  const child = await tx.user.create({ data: { id: PREFIX+randomUUID(), role: 'ELEVE', activationToken: createActivationToken('student').tokenHash, activationExpiry: token.expiresAt } });
  const student = await tx.student.create({ data: { userId: child.id, parentId: profile.id, gradeLevel: 'TERMINALE', completedSessions: 4 } });
  const right = await tx.entitlement.create({ data: { userId: child.id, productCode: 'ARIA_ACCESS', label: 'Historical fixture' } });
  const challenge = await tx.parentPhoneChallenge.create({ data: { userId: id, phoneNormalized: parent.phoneNormalized!, phoneVersion: 3, purpose: 'ACTIVATION', tokenHash: randomUUID(), expiresAt: token.expiresAt } });
  const active = await tx.user.create({ data: { id: PREFIX+randomUUID(), role: 'PARENT', activatedAt: new Date(), activationToken: createActivationToken('parent').tokenHash, activationExpiry: token.expiresAt } });
  // Fixtures exist before executing the exact migration SQL. Roll back the
  // whole rehearsal so concurrent agents' disposable fixtures are untouched.
  const migration = readFileSync(join(process.cwd(), 'prisma/migrations/20260906130000_parent_email_activation_invalidation/migration.sql'), 'utf8');
  const boundary = migration.indexOf('$$ LANGUAGE plpgsql;') + '$$ LANGUAGE plpgsql;'.length;
  await tx.$executeRawUnsafe(migration.slice(0, boundary));
  const cutover = migration.slice(boundary).trim();
  if (cutover) await tx.$executeRawUnsafe(cutover);
  expect(await tx.user.findUniqueOrThrow({ where: { id } })).toEqual({ ...parent, activationToken: null, activationExpiry: null });
  expect(await tx.user.findUniqueOrThrow({ where: { id: child.id } })).toEqual(child);
  expect(await tx.user.findUniqueOrThrow({ where: { id: active.id } })).toEqual(active);
  expect(await tx.parentProfile.findUniqueOrThrow({ where: { id: profile.id } })).toEqual(profile);
  expect(await tx.student.findUniqueOrThrow({ where: { id: student.id } })).toEqual(student);
  expect(await tx.entitlement.findUniqueOrThrow({ where: { id: right.id } })).toEqual(right);
  expect(await tx.parentPhoneChallenge.findUniqueOrThrow({ where: { id: challenge.id } })).toEqual(challenge);
  // A new issuance after cutover is not disabled by the installed trigger.
  const reissued = createActivationToken('parent');
  expect(await tx.user.update({ where: { id }, data: { activationToken: reissued.tokenHash, activationExpiry: reissued.expiresAt } })).toMatchObject({ activationToken: reissued.tokenHash, activationExpiry: reissued.expiresAt });
  throw rolledBack;
 }, { timeout: 15000 })).rejects.toBe(rolledBack);
});
