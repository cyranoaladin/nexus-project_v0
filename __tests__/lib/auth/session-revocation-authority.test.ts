/**
 * validateSessionToken re-checks a token against the store named by its
 * `authority` claim only.
 */
jest.mock('@/lib/core-v2/auth/authority', () => ({ validateCoreV2Session: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: {} }));

import type { JWT } from 'next-auth/jwt';
import { validateSessionToken, type SessionDatabase } from '@/lib/auth/session-revocation';

function database(user: { id: string; role: string; activatedAt: Date | null; sessionVersion: number } | null) {
  const findUnique = jest.fn().mockResolvedValue(user);
  return { db: { user: { findUnique, update: jest.fn() } } as unknown as SessionDatabase, findUnique };
}

const base: JWT = { id: 'u1', role: 'PARENT', sessionVersion: 2 } as JWT;

test('CORE_V2 token: validated by the Core v2 validator only; Core v1 is never queried', async () => {
  const coreV2 = jest.fn().mockResolvedValue(true);
  const { db, findUnique } = database({ id: 'u1', role: 'PARENT', activatedAt: new Date(), sessionVersion: 2 });
  const token = { ...base, authority: 'CORE_V2' } as JWT;
  expect(await validateSessionToken(token, db, { coreV2 })).toBe(token);
  expect(coreV2).toHaveBeenCalledWith({ userId: 'u1', role: 'PARENT', sessionVersion: 2 });
  expect(findUnique).not.toHaveBeenCalled();
});

test('CORE_V2 token refused or validator failure → null (fail closed, no Core v1 fallback)', async () => {
  const { db, findUnique } = database({ id: 'u1', role: 'PARENT', activatedAt: new Date(), sessionVersion: 2 });
  expect(await validateSessionToken({ ...base, authority: 'CORE_V2' } as JWT, db, { coreV2: jest.fn().mockResolvedValue(false) })).toBeNull();
  expect(await validateSessionToken({ ...base, authority: 'CORE_V2' } as JWT, db, { coreV2: jest.fn().mockRejectedValue(new Error('down')) })).toBeNull();
  expect(findUnique).not.toHaveBeenCalled();
});

test('V1 token and legacy token without the claim: Core v1 path, Core v2 never consulted', async () => {
  const coreV2 = jest.fn();
  const { db, findUnique } = database({ id: 'u1', role: 'PARENT', activatedAt: new Date(), sessionVersion: 2 });
  expect(await validateSessionToken({ ...base, authority: 'V1' } as JWT, db, { coreV2 })).toMatchObject({ id: 'u1' });
  expect(await validateSessionToken(base, db, { coreV2 })).toMatchObject({ id: 'u1' });
  expect(findUnique).toHaveBeenCalledTimes(2);
  expect(coreV2).not.toHaveBeenCalled();
  const stale = database({ id: 'u1', role: 'PARENT', activatedAt: new Date(), sessionVersion: 3 });
  expect(await validateSessionToken({ ...base, authority: 'V1' } as JWT, stale.db, { coreV2 })).toBeNull();
});
