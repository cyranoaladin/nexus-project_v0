/** @jest-environment node */
jest.unmock('@/lib/prisma');

import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient, type UserRole } from '@prisma/client';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { changeV1Password } from '@/lib/auth/change-v1-password';
import { generateResetToken, verifyResetToken } from '@/lib/password-reset-token';

const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
const client = new PrismaClient({ datasources: { db: { url } } });
const oldPassword = 'change_me_before';
const newPassword = 'change_me_after';

async function identity(role: UserRole = 'PARENT') {
  const id = `password-change-${randomUUID()}`;
  return client.user.create({ data: {
    id, email: `${id}@example.test`, role, password: await bcrypt.hash(oldPassword, 12),
    activatedAt: role === 'PARENT' || role === 'ELEVE' ? new Date() : null,
  } });
}

function actor(user: { id: string; role: UserRole; sessionVersion: number }) {
  return { userId: user.id, role: user.role, sessionVersion: user.sessionVersion, authority: 'V1' as const };
}

beforeAll(() => { assertDisposablePostgresUrl(url); });
// Retain synthetic accounts and append-only audit evidence in this disposable DB.
afterAll(async () => { await client.$disconnect(); });

test.each<UserRole>(['ADMIN', 'ASSISTANTE', 'COACH', 'PARENT', 'ELEVE'])(
  '%s changes only their own credential and revokes every old session', async (role) => {
    const user = await identity(role);
    await changeV1Password(client, actor(user), { currentPassword: oldPassword, newPassword }, randomUUID());
    const changed = await client.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(changed.sessionVersion).toBe(user.sessionVersion + 1);
    expect(await bcrypt.compare(oldPassword, changed.password!)).toBe(false);
    expect(await bcrypt.compare(newPassword, changed.password!)).toBe(true);
    const audit = await client.accountSecurityEvent.findMany({ where: { userId: user.id } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ kind: 'PASSWORD_CHANGED', sessionVersion: changed.sessionVersion });
    expect(JSON.stringify(audit)).not.toContain(oldPassword);
    expect(JSON.stringify(audit)).not.toContain(newPassword);
    expect(JSON.stringify(audit)).not.toContain(changed.password!);
    expect(JSON.stringify(audit)).not.toContain(user.email!);
  },
);

test('wrong current password and an identity supplied in the body never mutate an account', async () => {
  const user = await identity();
  await expect(changeV1Password(client, actor(user), {
    currentPassword: 'change_me_wrong', newPassword,
  }, randomUUID())).rejects.toMatchObject({ code: 'FORBIDDEN' });
  await expect(changeV1Password(client, actor(user), {
    currentPassword: oldPassword, newPassword, userId: randomUUID(),
  }, randomUUID())).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(await client.user.findUniqueOrThrow({ where: { id: user.id } }))
    .toMatchObject({ password: user.password, sessionVersion: user.sessionVersion });
  expect(await client.accountSecurityEvent.count({ where: { userId: user.id } })).toBe(0);
});

test('a stale session, a changed role and a pending family account fail closed', async () => {
  const user = await identity();
  await client.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
  await expect(changeV1Password(client, actor(user), { currentPassword: oldPassword, newPassword }, randomUUID()))
    .rejects.toMatchObject({ code: 'CONFLICT' });
  const roleUser = await identity();
  await client.user.update({ where: { id: roleUser.id }, data: { role: 'ELEVE' } });
  await expect(changeV1Password(client, actor(roleUser), { currentPassword: oldPassword, newPassword }, randomUUID()))
    .rejects.toMatchObject({ code: 'FORBIDDEN' });
  const pending = await identity();
  await client.user.update({ where: { id: pending.id }, data: { activatedAt: null } });
  await expect(changeV1Password(client, actor(pending), { currentPassword: oldPassword, newPassword }, randomUUID()))
    .rejects.toMatchObject({ code: 'FORBIDDEN' });
});

test('two concurrent changes of one session version have one winner and one audit', async () => {
  const user = await identity();
  const results = await Promise.allSettled([
    changeV1Password(client, actor(user), { currentPassword: oldPassword, newPassword }, randomUUID()),
    changeV1Password(client, actor(user), { currentPassword: oldPassword, newPassword: 'change_me_other' }, randomUUID()),
  ]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  const failure = results.find(result => result.status === 'rejected');
  expect(failure).toMatchObject({ status: 'rejected', reason: { code: 'CONFLICT' } });
  expect(await client.user.findUniqueOrThrow({ where: { id: user.id } }))
    .toMatchObject({ sessionVersion: user.sessionVersion + 1 });
  expect(await client.accountSecurityEvent.count({ where: { userId: user.id } })).toBe(1);
});

test('password changes invalidate email activation fields and open recovery challenges', async () => {
  const user = await identity();
  const emailReset = generateResetToken(user.id, user.email!, user.password!);
  await client.user.update({ where: { id: user.id }, data: {
    activationToken: randomUUID(), activationExpiry: new Date(Date.now() + 60_000),
  } });
  const challenge = await client.parentPhoneChallenge.create({ data: {
    userId: user.id, tokenHash: randomUUID(), phoneNormalized: '+21699123456', phoneVersion: 0,
    purpose: 'RECOVERY', expiresAt: new Date(Date.now() + 60_000),
  } });
  await changeV1Password(client, actor(user), { currentPassword: oldPassword, newPassword }, randomUUID());
  expect(await client.user.findUniqueOrThrow({ where: { id: user.id } }))
    .toMatchObject({ activationToken: null, activationExpiry: null });
  expect((await client.parentPhoneChallenge.findUniqueOrThrow({ where: { id: challenge.id } })).revokedAt)
    .toBeInstanceOf(Date);
  const changed = await client.user.findUniqueOrThrow({ where: { id: user.id } });
  expect(verifyResetToken(emailReset, changed.password!)).toBeNull();
});

test('audit insertion failure rolls back the credential, version, activation and recovery challenge', async () => {
  const user = await identity();
  const challenge = await client.parentPhoneChallenge.create({ data: {
    userId: user.id, tokenHash: randomUUID(), phoneNormalized: '+21699123456', phoneVersion: 0,
    purpose: 'RECOVERY', expiresAt: new Date(Date.now() + 60_000),
  } });
  // This hook exists only in the positively guarded, isolated synthetic DB.
  await client.$executeRaw`CREATE FUNCTION recovery_fail_security_audit() RETURNS TRIGGER AS $$
    BEGIN RAISE EXCEPTION 'SYNTHETIC_SECURITY_AUDIT_FAILURE'; END;
    $$ LANGUAGE plpgsql`;
  await client.$executeRaw`CREATE TRIGGER recovery_fail_security_audit
    BEFORE INSERT ON account_security_events FOR EACH ROW EXECUTE FUNCTION recovery_fail_security_audit()`;
  try {
    await expect(changeV1Password(client, actor(user), { currentPassword: oldPassword, newPassword }, randomUUID()))
      .rejects.toThrow('SYNTHETIC_SECURITY_AUDIT_FAILURE');
    expect(await client.user.findUniqueOrThrow({ where: { id: user.id } }))
      .toMatchObject({ password: user.password, sessionVersion: user.sessionVersion });
    expect(await client.parentPhoneChallenge.findUniqueOrThrow({ where: { id: challenge.id } }))
      .toMatchObject({ revokedAt: null, consumedAt: null });
    expect(await client.accountSecurityEvent.count({ where: { userId: user.id } })).toBe(0);
  } finally {
    await client.$executeRaw`DROP TRIGGER recovery_fail_security_audit ON account_security_events`;
    await client.$executeRaw`DROP FUNCTION recovery_fail_security_audit()`;
  }
  await changeV1Password(client, actor(user), { currentPassword: oldPassword, newPassword }, randomUUID());
  expect(await client.accountSecurityEvent.count({ where: { userId: user.id } })).toBe(1);
});

test('database prevents audit rewriting, audit deletion and deletion of its account', async () => {
  const user = await identity();
  await changeV1Password(client, actor(user), { currentPassword: oldPassword, newPassword }, randomUUID());
  const audit = await client.accountSecurityEvent.findFirstOrThrow({ where: { userId: user.id } });
  await expect(client.accountSecurityEvent.update({ where: { id: audit.id }, data: { correlationId: randomUUID() } }))
    .rejects.toThrow('ACCOUNT_SECURITY_EVENT_IMMUTABLE');
  await expect(client.accountSecurityEvent.delete({ where: { id: audit.id } }))
    .rejects.toThrow('ACCOUNT_SECURITY_EVENT_IMMUTABLE');
  await expect(client.user.delete({ where: { id: user.id } })).rejects.toMatchObject({ code: 'P2003' });
  expect(await client.accountSecurityEvent.findUniqueOrThrow({ where: { id: audit.id } })).toEqual(audit);
});
