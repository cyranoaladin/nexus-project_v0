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
  confirmPasswordReset,
  inspectPasswordReset,
  requestPasswordReset,
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

  test('overlong activation input leaves the single-use invitation available', async () => {
    const parent = await pendingParent();
    const issued = await inviteAccount(h.client, h.ctx(), parent.id);
    await expect(activateAccount(h.client, {
      rawToken: issued.rawToken, password: 'é'.repeat(37),
    })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(await h.client.invitation.findUniqueOrThrow({ where: { id: issued.invitation.id } }))
      .toMatchObject({ consumedAt: null });
    expect(await h.client.user.findUniqueOrThrow({ where: { id: parent.id } }))
      .toMatchObject({ accountStatus: 'PENDING_ACTIVATION', password: null });
    expect(await activateAccount(h.client, { rawToken: issued.rawToken, password: PW.first }))
      .toMatchObject({ accountStatus: 'ACTIVE' });
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
    const { sessionVersion } = await changePassword(client, h.ctx({ userId: user.id, role: user.role }), { currentPassword: PW.initial, newPassword: PW.changed });
    expect(sessionVersion).toBe(user.sessionVersion + 1);
    expect(await isSessionStillValid(client, claims)).toBe(false);
    expect(await verifyCredentials(client, { email: 'parent@example.com', password: PW.initial })).toBeNull();
    expect(await verifyCredentials(client, { email: 'parent@example.com', password: PW.changed })).toMatchObject({ sessionVersion });
    expect(await auditTrail(client, user.id)).toContain('account.password_changed');
  });

  test.each([
    ['ASCII beyond bcrypt boundary', 'change_' + 'x'.repeat(66)],
    ['UTF-8 beyond bcrypt boundary', 'é'.repeat(37)],
  ])('refuses %s without modifying credentials, sessions or audit', async (_label, newPassword) => {
    const user = await activeParent();
    const beforeAudit = await auditTrail(h.client, user.id);
    await expect(changePassword(h.client, h.ctx({ userId: user.id, role: user.role }), { currentPassword: PW.initial, newPassword }))
      .rejects.toMatchObject({ code: 'VALIDATION' });
    const after = await h.client.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.password).toBe(user.password);
    expect(after.sessionVersion).toBe(user.sessionVersion);
    expect(await auditTrail(h.client, user.id)).toEqual(beforeAudit);
  });

  test.each([
    ['ASCII at bcrypt boundary', 'change_' + 'x'.repeat(65)],
    ['UTF-8 at bcrypt boundary', 'é'.repeat(36)],
  ])('accepts %s without truncation', async (_label, newPassword) => {
    const user = await activeParent();
    const result = await changePassword(h.client, h.ctx({ userId: user.id, role: user.role }), { currentPassword: PW.initial, newPassword });
    const after = await h.client.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(result.sessionVersion).toBe(user.sessionVersion + 1);
    expect(await bcrypt.compare(newPassword, after.password as string)).toBe(true);
  });

  test('overlong reset input preserves the token, password and session version', async () => {
    const user = await activeParent();
    const issued = await requestPasswordReset(h.client, { email: 'parent@example.com' });
    expect(issued).not.toBeNull();
    if (issued === null) throw new Error('Synthetic active account did not receive a reset token.');
    await expect(confirmPasswordReset(h.client, {
      rawToken: issued.rawToken, newPassword: 'change_' + 'x'.repeat(66),
    })).rejects.toMatchObject({ code: 'VALIDATION' });
    const after = await h.client.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.password).toBe(user.password);
    expect(after.sessionVersion).toBe(user.sessionVersion);
    expect(await inspectPasswordReset(h.client, issued.rawToken)).toBe(true);
    await expect(confirmPasswordReset(h.client, { rawToken: issued.rawToken, newPassword: PW.changed }))
      .resolves.toMatchObject({ sessionVersion: user.sessionVersion + 1 });
  });

  test('wrong current password cannot change an active account or revoke its sessions', async () => {
    const user = await activeParent();
    const input = { currentPassword: 'change_me_wrong', newPassword: PW.changed };
    await expect(changePassword(h.client, h.ctx({ userId: user.id, role: user.role }), input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const after = await h.client.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.password).toBe(user.password);
    expect(after.sessionVersion).toBe(user.sessionVersion);
    expect(await auditTrail(h.client, user.id)).not.toContain('account.password_changed');
  });

  test('simultaneous password changes using the same current password have one winner', async () => {
    const user = await activeParent();
    const results = await Promise.allSettled([
      changePassword(h.client, h.ctx({ userId: user.id, role: user.role }), { currentPassword: PW.initial, newPassword: PW.changed }),
      changePassword(h.client, h.ctx({ userId: user.id, role: user.role }), { currentPassword: PW.initial, newPassword: PW.second }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const after = await h.client.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.sessionVersion).toBe(user.sessionVersion + 1);
    expect((await auditTrail(h.client, user.id)).filter((action) => action === 'account.password_changed'))
      .toHaveLength(1);
  });

  test('password change revokes every outstanding reset token atomically', async () => {
    const user = await activeParent();
    const reset = await requestPasswordReset(h.client, { email: 'parent@example.com' });
    if (!reset) throw new Error('Synthetic reset token missing.');
    await changePassword(h.client, h.ctx({ userId: user.id, role: user.role }), {
      currentPassword: PW.initial, newPassword: PW.changed,
    });
    expect(await inspectPasswordReset(h.client, reset.rawToken)).toBe(false);
    await expect(confirmPasswordReset(h.client, { rawToken: reset.rawToken, newPassword: PW.second }))
      .rejects.toMatchObject({ code: 'INVALID_STATE' });
  });

  test('reset and self-service change cannot both overwrite the same old credential', async () => {
    const user = await activeParent();
    const reset = await requestPasswordReset(h.client, { email: 'parent@example.com' });
    if (!reset) throw new Error('Synthetic reset token missing.');
    const results = await Promise.allSettled([
      changePassword(h.client, h.ctx({ userId: user.id, role: user.role }), {
        currentPassword: PW.initial, newPassword: PW.changed,
      }),
      confirmPasswordReset(h.client, { rawToken: reset.rawToken, newPassword: PW.second }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await h.client.user.findUniqueOrThrow({ where: { id: user.id } })).sessionVersion)
      .toBe(user.sessionVersion + 1);
  });

  test('audit failure rolls back credentials, sessions and reset-token revocation', async () => {
    const user = await activeParent();
    const reset = await requestPasswordReset(h.client, { email: 'parent@example.com' });
    if (!reset) throw new Error('Synthetic reset token missing.');
    try {
      await h.client.$executeRaw`CREATE FUNCTION recovery_test_password_audit_failure() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          IF NEW.action = 'account.password_changed' THEN
            RAISE EXCEPTION 'SYNTHETIC_AUDIT_UNAVAILABLE';
          END IF;
          RETURN NEW;
        END; $$`;
      await h.client.$executeRaw`CREATE TRIGGER recovery_test_password_audit_failure
        BEFORE INSERT ON audit_events FOR EACH ROW
        EXECUTE FUNCTION recovery_test_password_audit_failure()`;
      await expect(changePassword(h.client, h.ctx({ userId: user.id, role: user.role }), {
        currentPassword: PW.initial, newPassword: PW.changed,
      })).rejects.toThrow('SYNTHETIC_AUDIT_UNAVAILABLE');
    } finally {
      await h.client.$executeRaw`DROP TRIGGER IF EXISTS recovery_test_password_audit_failure ON audit_events`;
      await h.client.$executeRaw`DROP FUNCTION IF EXISTS recovery_test_password_audit_failure()`;
    }
    const after = await h.client.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.password).toBe(user.password);
    expect(after.sessionVersion).toBe(user.sessionVersion);
    expect(await inspectPasswordReset(h.client, reset.rawToken)).toBe(true);
    expect(await auditTrail(h.client, user.id)).not.toContain('account.password_changed');
  });

  test('a stale role cannot authorize a password change even with the correct password', async () => {
    const user = await activeParent();
    await expect(changePassword(h.client, h.ctx({ userId: user.id, role: 'COACH' }), {
      currentPassword: PW.initial, newPassword: PW.changed,
    })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const after = await h.client.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.password).toBe(user.password);
    expect(after.sessionVersion).toBe(user.sessionVersion);
  });

  test('role changed while a session is live invalidates that session', async () => {
    const { client } = h;
    const user = await activeParent();
    const claims = { userId: user.id, role: user.role, sessionVersion: user.sessionVersion };
    await client.user.update({ where: { id: user.id }, data: { role: 'COACH' } });
    expect(await isSessionStillValid(client, claims)).toBe(false);
  });
});
