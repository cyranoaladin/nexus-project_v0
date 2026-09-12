/**
 * Auth rollout mode against a real Core v2 database (landing mission §§7–10):
 * configuration decides the authority, misconfiguration fails closed, a
 * migrated identity has exactly one credential authority (e-mail AND phone),
 * and a pre-migration Core v1 session does not survive the authority switch.
 */
import type { JWT } from 'next-auth/jwt';
import { validateSessionToken, type SessionDatabase } from '@/lib/auth/session-revocation';
import {
  CoreV2AuthorityUnavailableError,
  authenticateCoreV2,
  authenticateCoreV2ByPhone,
  authenticateCoreV2ByUserId,
  getAuthRolloutMode,
  isIdentityOwnedByCoreV2,
  resolveCredentialAuthority,
  validateCoreV2Session,
} from '@/lib/core-v2/auth/authority';
import { AUTH_ROLLOUT_MODE_ENV } from '@/lib/core-v2/auth/rollout';
import { disconnectCoreV2Client } from '@/lib/core-v2/client';
import { CoreV2ConfigError } from '@/lib/core-v2/config';
import { activateAccount, createHousehold, inviteAccount, suspendAccount } from '@/lib/core-v2/services';
import { setupServiceHarness } from '../helpers/service-harness';

const h = setupServiceHarness();
const PW = 'change_me_rollout_1';

async function activatedParent(email: string, phone?: string) {
  const { parent } = await createHousehold(h.client, h.ctx(), { parent: { firstName: 'Roll', lastName: 'Out', email, phone } });
  const issued = await inviteAccount(h.client, h.ctx(), parent.id);
  await activateAccount(h.client, { rawToken: issued.rawToken, password: PW });
  return parent;
}

function withMode<T>(mode: string | undefined, run: () => Promise<T>): Promise<T> {
  const saved = process.env[AUTH_ROLLOUT_MODE_ENV];
  if (mode === undefined) delete process.env[AUTH_ROLLOUT_MODE_ENV];
  else process.env[AUTH_ROLLOUT_MODE_ENV] = mode;
  return run().finally(() => {
    process.env[AUTH_ROLLOUT_MODE_ENV] = saved;
  });
}

async function withCoreV2Url<T>(url: string | undefined, run: () => Promise<T>): Promise<T> {
  const saved = process.env.CORE_V2_DATABASE_URL;
  await disconnectCoreV2Client();
  if (url === undefined) delete process.env.CORE_V2_DATABASE_URL;
  else process.env.CORE_V2_DATABASE_URL = url;
  try {
    return await run();
  } finally {
    await disconnectCoreV2Client();
    process.env.CORE_V2_DATABASE_URL = saved;
  }
}

/** A Core v1 store stand-in for session validation: the user row as Core v1 sees it. */
function v1Database(user: { id: string; role: string; sessionVersion: number }): SessionDatabase {
  return { user: { findUnique: async () => ({ ...user, activatedAt: new Date() }), update: async () => ({ sessionVersion: user.sessionVersion + 1 }) } } as unknown as SessionDatabase;
}

describe('configuration', () => {
  test('the mode is read from configuration and has no default', async () => {
    expect(getAuthRolloutMode()).toBe('HYBRID');
    await withMode(undefined, async () => {
      expect(() => getAuthRolloutMode()).toThrow(CoreV2ConfigError);
      await expect(resolveCredentialAuthority('x@example.com')).rejects.toBeInstanceOf(CoreV2ConfigError);
    });
    await withMode('BOTH', async () => expect(() => getAuthRolloutMode()).toThrow(/must be one of/));
  });

  test('§10: HYBRID with a missing, unreachable or wrong-identity Core v2 fails closed — never V1', async () => {
    await activatedParent('hybrid@example.com');
    await withCoreV2Url(undefined, async () => {
      await expect(resolveCredentialAuthority('hybrid@example.com')).rejects.toBeInstanceOf(CoreV2AuthorityUnavailableError);
      await expect(authenticateCoreV2('hybrid@example.com', PW)).rejects.toBeInstanceOf(CoreV2AuthorityUnavailableError);
      await expect(isIdentityOwnedByCoreV2('any')).rejects.toBeInstanceOf(CoreV2AuthorityUnavailableError);
      await expect(validateCoreV2Session({ userId: 'any', role: 'PARENT', sessionVersion: 0 })).rejects.toBeInstanceOf(CoreV2AuthorityUnavailableError);
    });
    await withCoreV2Url(`postgresql://postgres:${'unused'}@127.0.0.1:1/does_not_exist`, async () => {
      await expect(resolveCredentialAuthority('hybrid@example.com')).rejects.toBeInstanceOf(CoreV2AuthorityUnavailableError);
    });
    // Wrong database identity: the Core v1 test database is a real PostgreSQL without the Core v2 marker.
    const v1Url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
    if (v1Url && v1Url !== process.env.CORE_V2_DATABASE_URL) {
      await withCoreV2Url(v1Url, async () => {
        await expect(resolveCredentialAuthority('hybrid@example.com')).rejects.toBeInstanceOf(CoreV2AuthorityUnavailableError);
      });
    }
  });

  test('§10: V2_ONLY with a missing Core v2 fails closed too; V1_ONLY never opens Core v2', async () => {
    await withMode('V2_ONLY', () =>
      withCoreV2Url(undefined, async () => {
        expect(await resolveCredentialAuthority('anyone@example.com')).toBe('CORE_V2'); // the decision needs no lookup…
        await expect(authenticateCoreV2('anyone@example.com', PW)).rejects.toBeInstanceOf(CoreV2AuthorityUnavailableError); // …the verification refuses
        await expect(isIdentityOwnedByCoreV2('any')).rejects.toBeInstanceOf(CoreV2AuthorityUnavailableError);
      }),
    );
    await withMode('V1_ONLY', () =>
      withCoreV2Url(undefined, async () => {
        expect(await resolveCredentialAuthority('anyone@example.com')).toBe('V1');
        expect(await isIdentityOwnedByCoreV2('any')).toBe(false);
      }),
    );
  });
});

describe('§8 — one credential authority per migrated identity, by e-mail and by phone', () => {
  test('a migrated parent is verified in Core v2 by id (the phone path) exactly like by e-mail; wrong password refused', async () => {
    const parent = await activatedParent('phone@example.com', '+216 20 000 002');
    expect(await isIdentityOwnedByCoreV2(parent.id)).toBe(true);
    expect(await isIdentityOwnedByCoreV2('not-migrated')).toBe(false);
    const byEmail = await authenticateCoreV2('phone@example.com', PW);
    const byId = await authenticateCoreV2ByUserId(parent.id, PW);
    expect(byId).toEqual(byEmail);
    expect(await authenticateCoreV2ByUserId(parent.id, 'change_me_wrong')).toBeNull();
    await suspendAccount(h.client, h.ctx(h.admin), parent.id);
    expect(await authenticateCoreV2ByUserId(parent.id, PW)).toBeNull();
  });

  test('V2_ONLY phone login resolves a unique ACTIVE parent in Core v2; ambiguity or no match is a refusal, never a guess', async () => {
    const a = await activatedParent('pa@example.com', '+216 20 000 003');
    expect((await authenticateCoreV2ByPhone('+216 20 000 003', PW))?.id).toBe(a.id);
    expect(await authenticateCoreV2ByPhone('+216 20 000 003', 'change_me_wrong')).toBeNull();
    expect(await authenticateCoreV2ByPhone('+216 20 000 999', PW)).toBeNull();
    expect(await authenticateCoreV2ByPhone('not a phone', PW)).toBeNull();
    await activatedParent('pb@example.com', '+216 20 000 003'); // same number, second family
    expect(await authenticateCoreV2ByPhone('+216 20 000 003', PW)).toBeNull();
  });
});

describe('§9 — a pre-migration Core v1 session does not survive the authority transition', () => {
  test('V1 login → migration (Core v2 row with the same id) → old V1 cookie rejected; new Core v2 login accepted; role change and sessionVersion revoke', async () => {
    // 1. Before migration: a Core v1 user with a live V1 token.
    const userId = 'legacy-user-1';
    const v1 = v1Database({ id: userId, role: 'PARENT', sessionVersion: 4 });
    const v1Token = { id: userId, role: 'PARENT', sessionVersion: 4, authority: 'V1' } as JWT;
    const legacyToken = { id: userId, role: 'PARENT', sessionVersion: 4 } as JWT;
    expect(await validateSessionToken(v1Token, v1)).toMatchObject({ id: userId });
    expect(await validateSessionToken(legacyToken, v1)).toMatchObject({ id: userId });

    // 2. The same human is migrated: Core v2 owns the id now.
    await h.client.user.create({ data: { id: userId, role: 'PARENT', email: 'legacy@example.com', accountStatus: 'ACTIVE', password: 'x', sessionVersion: 0 } });
    expect(await validateSessionToken(v1Token, v1)).toBeNull();
    expect(await validateSessionToken(legacyToken, v1)).toBeNull();

    // 3. A fresh Core v2 token is accepted; a role mismatch or a revoked version is not.
    const v2Token = { id: userId, role: 'PARENT', sessionVersion: 0, authority: 'CORE_V2' } as JWT;
    expect(await validateSessionToken(v2Token, v1)).toMatchObject({ id: userId, authority: 'CORE_V2' });
    expect(await validateSessionToken({ ...v2Token, role: 'ADMIN' } as JWT, v1)).toBeNull();
    await h.client.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
    expect(await validateSessionToken(v2Token, v1)).toBeNull();
    expect(await validateSessionToken({ ...v2Token, sessionVersion: 1 } as JWT, v1)).toMatchObject({ id: userId });

    // 4. V2_ONLY: the V1 token of a never-migrated user is rejected as well.
    await withMode('V2_ONLY', async () => {
      expect(await validateSessionToken({ id: 'never-migrated', role: 'PARENT', sessionVersion: 1, authority: 'V1' } as JWT, v1Database({ id: 'never-migrated', role: 'PARENT', sessionVersion: 1 }))).toBeNull();
    });
  });
});
