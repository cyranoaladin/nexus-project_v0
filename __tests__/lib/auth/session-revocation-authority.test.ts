/**
 * validateSessionToken re-checks a token against the store that owns the
 * identity NOW, under the rollout mode (landing mission §§7/9): the token's
 * `authority` claim is a hint, the current authority assignment wins.
 */
jest.mock('@/lib/core-v2/auth/authority', () => ({ validateCoreV2Session: jest.fn(), isIdentityOwnedByCoreV2: jest.fn(), getAuthRolloutMode: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: {} }));

import type { JWT } from 'next-auth/jwt';
import { validateSessionToken, type SessionDatabase, type SessionValidators } from '@/lib/auth/session-revocation';

function database(user: { id: string; role: string; activatedAt: Date | null; sessionVersion: number } | null) {
  const findUnique = jest.fn().mockResolvedValue(user);
  return { db: { user: { findUnique, update: jest.fn() } } as unknown as SessionDatabase, findUnique };
}
function validators(over: Partial<{ coreV2: unknown; owned: unknown; mode: string | Error }> = {}): SessionValidators & { coreV2: jest.Mock; ownedByCoreV2: jest.Mock } {
  const coreV2 = jest.fn().mockResolvedValue(over.coreV2 ?? true);
  const ownedByCoreV2 = jest.fn().mockResolvedValue(over.owned ?? false);
  const mode = over.mode instanceof Error ? jest.fn(() => { throw over.mode; }) : jest.fn(() => (over.mode ?? 'HYBRID') as 'HYBRID');
  return { coreV2, ownedByCoreV2, mode } as never;
}

const base: JWT = { id: 'u1', role: 'PARENT', sessionVersion: 2 } as JWT;
const live = { id: 'u1', role: 'PARENT', activatedAt: new Date(), sessionVersion: 2 };

describe('HYBRID', () => {
  test('CORE_V2 token: validated by the Core v2 validator only; Core v1 is never queried', async () => {
    const v = validators();
    const { db, findUnique } = database(live);
    const token = { ...base, authority: 'CORE_V2' } as JWT;
    expect(await validateSessionToken(token, db, v)).toBe(token);
    expect(v.coreV2).toHaveBeenCalledWith({ userId: 'u1', role: 'PARENT', sessionVersion: 2 });
    expect(findUnique).not.toHaveBeenCalled();
  });

  test('CORE_V2 token refused or validator failure → null (fail closed, no Core v1 fallback)', async () => {
    const { db, findUnique } = database(live);
    expect(await validateSessionToken({ ...base, authority: 'CORE_V2' } as JWT, db, validators({ coreV2: false }))).toBeNull();
    const down = validators();
    down.coreV2.mockRejectedValue(new Error('down'));
    expect(await validateSessionToken({ ...base, authority: 'CORE_V2' } as JWT, db, down)).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  test('V1 token and legacy claim-less token of a NOT-migrated identity: Core v1 path', async () => {
    const v = validators({ owned: false });
    const { db, findUnique } = database(live);
    expect(await validateSessionToken({ ...base, authority: 'V1' } as JWT, db, v)).toMatchObject({ id: 'u1' });
    expect(await validateSessionToken(base, db, v)).toMatchObject({ id: 'u1' });
    expect(findUnique).toHaveBeenCalledTimes(2);
    expect(v.coreV2).not.toHaveBeenCalled();
    const stale = database({ ...live, sessionVersion: 3 });
    expect(await validateSessionToken({ ...base, authority: 'V1' } as JWT, stale.db, v)).toBeNull();
  });

  test('§9: a V1 / legacy token of an identity Core v2 now owns is rejected — the pre-migration session does not survive', async () => {
    const v = validators({ owned: true });
    const { db, findUnique } = database(live);
    expect(await validateSessionToken({ ...base, authority: 'V1' } as JWT, db, v)).toBeNull();
    expect(await validateSessionToken(base, db, v)).toBeNull();
    expect(findUnique).not.toHaveBeenCalled(); // Core v1 is not even asked
    // …and the same human's fresh Core v2 token is accepted.
    expect(await validateSessionToken({ ...base, authority: 'CORE_V2' } as JWT, db, v)).toMatchObject({ id: 'u1' });
  });

  test('ownership check unavailable (Core v2 down) → null, never a Core v1 answer', async () => {
    const v = validators();
    v.ownedByCoreV2.mockRejectedValue(new Error('down'));
    const { db, findUnique } = database(live);
    expect(await validateSessionToken({ ...base, authority: 'V1' } as JWT, db, v)).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });
});

describe('V2_ONLY', () => {
  test('every non-CORE_V2 token is rejected without touching Core v1; CORE_V2 tokens validate in Core v2', async () => {
    const v = validators({ mode: 'V2_ONLY' });
    const { db, findUnique } = database(live);
    expect(await validateSessionToken({ ...base, authority: 'V1' } as JWT, db, v)).toBeNull();
    expect(await validateSessionToken(base, db, v)).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
    expect(await validateSessionToken({ ...base, authority: 'CORE_V2' } as JWT, db, v)).toMatchObject({ id: 'u1' });
  });
});

describe('V1_ONLY', () => {
  test('CORE_V2 tokens are rejected (Core v2 auth disabled on purpose); V1 tokens validate in Core v1 without ownership lookup', async () => {
    const v = validators({ mode: 'V1_ONLY' });
    const { db } = database(live);
    expect(await validateSessionToken({ ...base, authority: 'CORE_V2' } as JWT, db, v)).toBeNull();
    expect(v.coreV2).not.toHaveBeenCalled();
    expect(await validateSessionToken({ ...base, authority: 'V1' } as JWT, db, v)).toMatchObject({ id: 'u1' });
    expect(v.ownedByCoreV2).not.toHaveBeenCalled();
  });
});

test('an unconfigured / invalid rollout mode rejects every token', async () => {
  const v = validators({ mode: new Error('CORE_V2_AUTH_MODE must be one of …') });
  const { db } = database(live);
  expect(await validateSessionToken({ ...base, authority: 'V1' } as JWT, db, v)).toBeNull();
  expect(await validateSessionToken({ ...base, authority: 'CORE_V2' } as JWT, db, v)).toBeNull();
});

test('legacy or malformed JWTs (no id, no role, no version) must reauthenticate', async () => {
  const v = validators();
  const { db } = database(live);
  expect(await validateSessionToken({ role: 'PARENT', sessionVersion: 1 } as JWT, db, v)).toBeNull();
  expect(await validateSessionToken({ id: 'u1', role: 'PARENT' } as JWT, db, v)).toBeNull();
});
