/**
 * §U/§V — one credential authority per identity, decided from Core v2 alone,
 * against a real Core v2 database.
 */
import { disconnectCoreV2Client } from '@/lib/core-v2/client';
import {
  CoreV2AuthorityUnavailableError,
  authenticateCoreV2,
  isCoreV2AuthConfigured,
  resolveCredentialAuthority,
  validateCoreV2Session,
} from '@/lib/core-v2/auth/authority';
import { activateAccount, createHousehold, inspectInvitation, inviteAccount, suspendAccount } from '@/lib/core-v2/services';
import { setupServiceHarness } from '../helpers/service-harness';

const h = setupServiceHarness();
const PW = { first: 'change_me_authority_1', wrong: 'change_me_authority_x' } as const;

async function activatedParent(email: string) {
  const { parent } = await createHousehold(h.client, h.ctx(), { parent: { firstName: 'Auth', lastName: 'Synthetic', email } });
  const issued = await inviteAccount(h.client, h.ctx(), parent.id);
  await activateAccount(h.client, { rawToken: issued.rawToken, password: PW.first });
  return parent;
}

describe('credential authority resolution', () => {
  test('no Core v2 row → V1; a Core v2 row (any case variant of the e-mail) → CORE_V2', async () => {
    expect(isCoreV2AuthConfigured()).toBe(true);
    expect(await resolveCredentialAuthority('nobody@example.com')).toBe('V1');
    await activatedParent('authority@example.com');
    expect(await resolveCredentialAuthority('Authority@Example.COM')).toBe('CORE_V2');
  });

  test('Core v2 not configured → every identity is V1 (explicit deployment state, not a per-user fallback)', async () => {
    const saved = process.env.CORE_V2_DATABASE_URL;
    await activatedParent('configured@example.com');
    await disconnectCoreV2Client();
    delete process.env.CORE_V2_DATABASE_URL;
    try {
      expect(isCoreV2AuthConfigured()).toBe(false);
      expect(await resolveCredentialAuthority('configured@example.com')).toBe('V1');
    } finally {
      process.env.CORE_V2_DATABASE_URL = saved;
      await disconnectCoreV2Client();
    }
  });

  test('Core v2 configured but unreachable → fails closed, never silently V1', async () => {
    const saved = process.env.CORE_V2_DATABASE_URL;
    await disconnectCoreV2Client();
    process.env.CORE_V2_DATABASE_URL = `postgresql://postgres:${'unused'}@127.0.0.1:1/does_not_exist`;
    try {
      await expect(resolveCredentialAuthority('anyone@example.com')).rejects.toBeInstanceOf(CoreV2AuthorityUnavailableError);
    } finally {
      await disconnectCoreV2Client();
      process.env.CORE_V2_DATABASE_URL = saved;
    }
  });
});

describe('Core v2 authentication and session validity', () => {
  test('correct password on an ACTIVE account → identity claims; wrong password / pending account → null', async () => {
    const parent = await activatedParent('login@example.com');
    const ok = await authenticateCoreV2('LOGIN@example.com', PW.first);
    expect(ok).toMatchObject({ id: parent.id, email: 'login@example.com', role: 'PARENT', firstName: 'Auth', lastName: 'Synthetic' });
    expect(typeof ok?.sessionVersion).toBe('number');
    expect(await authenticateCoreV2('login@example.com', PW.wrong)).toBeNull();

    const { parent: pending } = await createHousehold(h.client, h.ctx(), { parent: { firstName: 'P', lastName: 'Q', email: 'pending@example.com' } });
    expect(await authenticateCoreV2('pending@example.com', PW.first)).toBeNull();
    expect(pending.accountStatus).toBe('PENDING_ACTIVATION');
  });

  test('session claims stay valid until suspension bumps the version; a role mismatch is invalid', async () => {
    const parent = await activatedParent('session@example.com');
    const claims = (await authenticateCoreV2('session@example.com', PW.first))!;
    expect(await validateCoreV2Session({ userId: claims.userId, role: claims.role, sessionVersion: claims.sessionVersion })).toBe(true);
    expect(await validateCoreV2Session({ userId: claims.userId, role: 'ADMIN', sessionVersion: claims.sessionVersion })).toBe(false);
    await suspendAccount(h.client, h.ctx(h.admin), parent.id);
    expect(await validateCoreV2Session({ userId: claims.userId, role: claims.role, sessionVersion: claims.sessionVersion })).toBe(false);
  });

  test('inspectInvitation previews an open invitation without consuming it, and null otherwise', async () => {
    const { parent } = await createHousehold(h.client, h.ctx(), { parent: { firstName: 'Look', lastName: 'Only', email: 'look@example.com' } });
    const issued = await inviteAccount(h.client, h.ctx(), parent.id);
    expect(await inspectInvitation(h.client, issued.rawToken)).toEqual({ email: 'look@example.com', role: 'PARENT', firstName: 'Look' });
    expect(await inspectInvitation(h.client, issued.rawToken)).not.toBeNull(); // not consumed by the preview
    expect(await inspectInvitation(h.client, 'A'.repeat(43))).toBeNull();
    await activateAccount(h.client, { rawToken: issued.rawToken, password: PW.first });
    expect(await inspectInvitation(h.client, issued.rawToken)).toBeNull();
  });
});
