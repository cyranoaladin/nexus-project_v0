/**
 * §U/§V/§W/§X — account lifecycle, invitation lifecycle, credential check and
 * session revocation, against a real Core v2 database.
 */
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { CoreV2DomainError } from '@/lib/core-v2/errors';
import {
  activateAccount,
  changePassword,
  createHousehold,
  disableAccount,
  inviteAccount,
  isSessionStillValid,
  reactivateAccount,
  resendInvitation,
  suspendAccount,
  verifyCredentials,
} from '@/lib/core-v2/services';
import { auditTrail, setupServiceHarness } from '../helpers/service-harness';

const h = setupServiceHarness();

// Synthetic fixture passwords (change_ prefix = documented placeholder form for the versioned-credential guard).
const PW = {
  first: 'change_me_first',
  second: 'change_me_second',
  third: 'change_me_third',
  long: 'change_me_long_enough',
  initial: 'change_me_initial',
  changed: 'change_me_changed',
} as const;

async function pendingParent(email = 'parent@example.com') {
  const { parent } = await createHousehold(h.client, h.ctx(), { parent: { firstName: 'A', lastName: 'B', email } });
  return parent;
}

describe('Invitation → activation', () => {
  test('invite issues a hashed, single-use token; activation is atomic and sets ACTIVE + password', async () => {
    const { client } = h;
    const parent = await pendingParent();
    const issued = await inviteAccount(client, h.ctx(), parent.id);
    expect(issued.invitation.tokenHash).toBe(createHash('sha256').update(issued.rawToken).digest('hex'));
    expect(issued.email).toBe('parent@example.com');

    const activated = await activateAccount(client, { rawToken: issued.rawToken, password: PW.first });
    expect(activated.accountStatus).toBe('ACTIVE');
    expect(activated.activatedAt).not.toBeNull();
    expect(await bcrypt.compare(PW.first, activated.password as string)).toBe(true);
    expect(await auditTrail(client, parent.id)).toEqual(['parent.created', 'account.activated']);

    // Replay of the same token is refused, and the account is untouched.
    await expect(activateAccount(client, { rawToken: issued.rawToken, password: PW.second })).rejects.toMatchObject({ code: 'INVALID_STATE' });
    const again = await client.user.findUniqueOrThrow({ where: { id: parent.id } });
    expect(again.password).toBe(activated.password);
  });

  test('inviting an already-invited account requires resend; resend revokes the prior token', async () => {
    const { client } = h;
    const parent = await pendingParent();
    const first = await inviteAccount(client, h.ctx(), parent.id);
    await expect(inviteAccount(client, h.ctx(), parent.id)).rejects.toMatchObject({ code: 'INVALID_STATE' });
    const second = await resendInvitation(client, h.ctx(), parent.id);
    expect(second.rawToken).not.toBe(first.rawToken);
    await expect(activateAccount(client, { rawToken: first.rawToken, password: PW.third })).rejects.toMatchObject({ code: 'INVALID_STATE' });
    expect((await activateAccount(client, { rawToken: second.rawToken, password: PW.third })).accountStatus).toBe('ACTIVE');
  });

  test('an expired invitation is refused; an unknown token is refused with the same error family', async () => {
    const { client } = h;
    const parent = await pendingParent();
    const issued = await inviteAccount(client, h.ctx(), parent.id);
    const afterExpiry = new Date(issued.invitation.expiresAt.getTime() + 1);
    await expect(activateAccount(client, { rawToken: issued.rawToken, password: PW.third }, { now: () => afterExpiry })).rejects.toMatchObject({ code: 'INVALID_STATE' });
    await expect(activateAccount(client, { rawToken: 'A'.repeat(43), password: PW.third })).rejects.toBeInstanceOf(CoreV2DomainError);
    expect((await client.user.findUniqueOrThrow({ where: { id: parent.id } })).accountStatus).toBe('PENDING_ACTIVATION');
  });

  test('an ACTIVE account cannot be (re)invited; a weak password is refused before any write', async () => {
    const { client } = h;
    const parent = await pendingParent();
    const issued = await inviteAccount(client, h.ctx(), parent.id);
    await expect(activateAccount(client, { rawToken: issued.rawToken, password: 'short' })).rejects.toMatchObject({ code: 'VALIDATION' });
    await activateAccount(client, { rawToken: issued.rawToken, password: PW.long });
    await expect(resendInvitation(client, h.ctx(), parent.id)).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });
});

describe('Login / suspension / revocation', () => {
  async function activeParent() {
    const parent = await pendingParent();
    const issued = await inviteAccount(h.client, h.ctx(), parent.id);
    await activateAccount(h.client, { rawToken: issued.rawToken, password: PW.initial });
    return h.client.user.findUniqueOrThrow({ where: { id: parent.id } });
  }

  test('verifyCredentials: case-variant email logs in; wrong password, unknown email, PENDING account all yield null', async () => {
    const { client } = h;
    const user = await activeParent();
    const ok = await verifyCredentials(client, { email: 'PARENT@Example.com', password: PW.initial });
    expect(ok).toEqual({ userId: user.id, role: 'PARENT', sessionVersion: user.sessionVersion });
    expect(await verifyCredentials(client, { email: 'parent@example.com', password: 'wrong' })).toBeNull();
    expect(await verifyCredentials(client, { email: 'nobody@example.com', password: PW.initial })).toBeNull();
    expect(await verifyCredentials(client, { email: 'not an email', password: 'x' })).toBeNull();
    const pending = await pendingParent('pending@example.com');
    await client.user.update({ where: { id: pending.id }, data: { password: await bcrypt.hash(PW.initial, 4) } });
    expect(await verifyCredentials(client, { email: 'pending@example.com', password: PW.initial })).toBeNull();
  });

  test('suspend revokes live sessions and blocks login; reactivate restores login but not the old session', async () => {
    const { client } = h;
    const user = await activeParent();
    const claims = { userId: user.id, role: user.role, sessionVersion: user.sessionVersion };
    expect(await isSessionStillValid(client, claims)).toBe(true);

    const suspended = await suspendAccount(client, h.ctx(h.admin), user.id);
    expect(suspended.accountStatus).toBe('SUSPENDED');
    expect(suspended.sessionVersion).toBe(user.sessionVersion + 1);
    expect(await isSessionStillValid(client, claims)).toBe(false);
    expect(await verifyCredentials(client, { email: 'parent@example.com', password: PW.initial })).toBeNull();
    await expect(suspendAccount(client, h.ctx(h.admin), user.id)).rejects.toMatchObject({ code: 'INVALID_STATE' });

    const reactivated = await reactivateAccount(client, h.ctx(h.admin), user.id);
    expect(reactivated.accountStatus).toBe('ACTIVE');
    expect(await isSessionStillValid(client, claims)).toBe(false);
    expect(await verifyCredentials(client, { email: 'parent@example.com', password: PW.initial })).toMatchObject({ sessionVersion: user.sessionVersion + 1 });
    expect(await auditTrail(client, user.id)).toEqual(['parent.created', 'account.activated', 'account.suspended', 'account.reactivated']);
  });

  test('disable is terminal: revokes sessions and open invitations, refuses activation and reactivation', async () => {
    const { client } = h;
    const parent = await pendingParent();
    const issued = await inviteAccount(client, h.ctx(), parent.id);
    const disabled = await disableAccount(client, h.ctx(h.admin), parent.id);
    expect(disabled.accountStatus).toBe('DISABLED');
    await expect(activateAccount(client, { rawToken: issued.rawToken, password: PW.long })).rejects.toMatchObject({ code: 'INVALID_STATE' });
    await expect(reactivateAccount(client, h.ctx(h.admin), parent.id)).rejects.toMatchObject({ code: 'INVALID_STATE' });
    expect(await client.invitation.count({ where: { userId: parent.id, revokedAt: null } })).toBe(0);
  });

  test('an admin cannot suspend or disable their own account', async () => {
    const { client } = h;
    await expect(suspendAccount(client, h.ctx(h.admin), h.admin.userId)).rejects.toMatchObject({ code: 'INVALID_STATE' });
    await expect(disableAccount(client, h.ctx(h.admin), h.admin.userId)).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });

  test('changePassword vs live session: the old session version is invalid immediately, new credentials work', async () => {
    const { client } = h;
    const user = await activeParent();
    const claims = { userId: user.id, role: user.role, sessionVersion: user.sessionVersion };
    const { sessionVersion } = await changePassword(client, { userId: user.id, newPassword: PW.changed });
    expect(sessionVersion).toBe(user.sessionVersion + 1);
    expect(await isSessionStillValid(client, claims)).toBe(false);
    expect(await verifyCredentials(client, { email: 'parent@example.com', password: PW.initial })).toBeNull();
    expect(await verifyCredentials(client, { email: 'parent@example.com', password: PW.changed })).toMatchObject({ sessionVersion });
    expect(await auditTrail(client, user.id)).toContain('account.password_changed');
  });

  test('role changed while a session is live invalidates that session', async () => {
    const { client } = h;
    const user = await activeParent();
    const claims = { userId: user.id, role: user.role, sessionVersion: user.sessionVersion };
    await client.user.update({ where: { id: user.id }, data: { role: 'COACH' } });
    expect(await isSessionStillValid(client, claims)).toBe(false);
  });
});
