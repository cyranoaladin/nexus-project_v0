import { createHash } from 'node:crypto';
import {
  activateAccount, confirmPasswordReset, createHousehold, inspectPasswordReset,
  inviteAccount, requestPasswordReset,
} from '@/lib/core-v2/services';
import { setupServiceHarness } from '../helpers/service-harness';

const crypto = jest.requireActual<typeof import('node:crypto')>('node:crypto');
const h = setupServiceHarness();
const password = 'change_me_token_contract';

async function parent() {
  return (await createHousehold(h.client, h.ctx(), {
    parent: { firstName: 'Synthetic', lastName: 'Parent', email: 'token-contract@example.test' },
  })).parent;
}

test.each(['ACTIVATION', 'PASSWORD_RESET'] as const)(
  '%s verifier uses 32 CSPRNG bytes and stores only its digest in identity/audit records', async purpose => {
    const user = await parent();
    if (purpose === 'PASSWORD_RESET') {
      const initial = await inviteAccount(h.client, h.ctx(), user.id);
      await activateAccount(h.client, { rawToken: initial.rawToken, password });
    }
    const entropy = jest.spyOn(crypto, 'randomBytes');
    try {
      const issued = purpose === 'ACTIVATION'
        ? await inviteAccount(h.client, h.ctx(), user.id)
        : await requestPasswordReset(h.client, { email: user.email! });
      if (!issued) throw new Error('SYNTHETIC_ACCOUNT_NOT_ELIGIBLE');
      expect(entropy).toHaveBeenCalledWith(32);
      expect(issued.rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(issued.rawToken, 'base64url')).toHaveLength(32);
      const invitation = await h.client.invitation.findFirstOrThrow({ where: { userId: user.id, purpose } });
      expect(invitation.tokenHash).toBe(createHash('sha256').update(issued.rawToken).digest('hex'));
      expect(invitation.tokenHash).not.toBe(issued.rawToken);
      const records = {
        invitation,
        user: await h.client.user.findUniqueOrThrow({ where: { id: user.id } }),
        audit: await h.client.auditEvent.findMany(),
      };
      expect(JSON.stringify(records)).not.toContain(issued.rawToken);
    } finally {
      entropy.mockRestore();
    }
  },
);

test('two confirmations of the same reset produce one credential rotation and one audit', async () => {
  const user = await parent();
  const invitation = await inviteAccount(h.client, h.ctx(), user.id);
  const active = await activateAccount(h.client, { rawToken: invitation.rawToken, password });
  const reset = await requestPasswordReset(h.client, { email: user.email! });
  if (!reset) throw new Error('SYNTHETIC_ACCOUNT_NOT_ELIGIBLE');
  const results = await Promise.allSettled([
    confirmPasswordReset(h.client, { rawToken: reset.rawToken, newPassword: 'change_me_reset_first' }),
    confirmPasswordReset(h.client, { rawToken: reset.rawToken, newPassword: 'change_me_reset_second' }),
  ]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
  expect(await h.client.user.findUniqueOrThrow({ where: { id: user.id } }))
    .toMatchObject({ sessionVersion: active.sessionVersion + 1 });
  expect(await h.client.auditEvent.count({ where: { subjectId: user.id, action: 'account.password_reset' } })).toBe(1);
  expect(await inspectPasswordReset(h.client, reset.rawToken)).toBe(false);
});

test('a reset is already expired at its exact UTC expiry instant', async () => {
  const user = await parent();
  const invitation = await inviteAccount(h.client, h.ctx(), user.id);
  const active = await activateAccount(h.client, { rawToken: invitation.rawToken, password });
  const reset = await requestPasswordReset(h.client, { email: user.email! }, {
    now: () => new Date('2026-10-03T08:00:00.000Z'),
  });
  if (!reset) throw new Error('SYNTHETIC_ACCOUNT_NOT_ELIGIBLE');
  expect(await inspectPasswordReset(h.client, reset.rawToken, () => reset.expiresAt)).toBe(false);
  await expect(confirmPasswordReset(h.client, {
    rawToken: reset.rawToken, newPassword: 'change_me_expired_reset',
  }, { now: () => reset.expiresAt })).rejects.toMatchObject({ code: 'INVALID_STATE' });
  expect(await h.client.user.findUniqueOrThrow({ where: { id: user.id } }))
    .toMatchObject({ password: active.password, sessionVersion: active.sessionVersion });
  expect(await h.client.auditEvent.count({ where: { subjectId: user.id, action: 'account.password_reset' } })).toBe(0);
});
