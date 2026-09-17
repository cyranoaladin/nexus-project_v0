/**
 * authorizeCredentials routes an identity to exactly one store under the
 * rollout mode (go-live §U/§V, landing mission §§7–8): CORE_V2 identities
 * never touch the Core v1 user table, V1 identities never touch Core v2, a
 * migrated human has no Core v1 path by phone, and a missing/unreachable
 * Core v2 in HYBRID/V2_ONLY refuses instead of downgrading.
 */
jest.mock('@/lib/core-v2/auth/authority', () => ({
  resolveCredentialAuthority: jest.fn(),
  authenticateCoreV2: jest.fn(),
  authenticateCoreV2ByUserId: jest.fn(),
  authenticateCoreV2ByPhone: jest.fn(),
  isIdentityOwnedByCoreV2: jest.fn(),
  getAuthRolloutMode: jest.fn(),
}));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: jest.fn(), findMany: jest.fn() } } }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn() } }));

import bcrypt from 'bcryptjs';
import {
  authenticateCoreV2,
  authenticateCoreV2ByPhone,
  authenticateCoreV2ByUserId,
  getAuthRolloutMode,
  isIdentityOwnedByCoreV2,
  resolveCredentialAuthority,
} from '@/lib/core-v2/auth/authority';
import { authorizeCredentials } from '@/lib/auth/credentials-authorize';
import { prisma } from '@/lib/prisma';

const resolve = resolveCredentialAuthority as jest.Mock;
const authenticate = authenticateCoreV2 as jest.Mock;
const authenticateById = authenticateCoreV2ByUserId as jest.Mock;
const authenticateByPhone = authenticateCoreV2ByPhone as jest.Mock;
const owned = isIdentityOwnedByCoreV2 as jest.Mock;
const mode = getAuthRolloutMode as jest.Mock;
const findUnique = prisma.user.findUnique as jest.Mock;
const findMany = prisma.user.findMany as jest.Mock;
const PW = 'change_me_unit_pw';
const coreV2Identity = { id: 'u1', userId: 'u1', email: 'a@example.com', role: 'PARENT', firstName: 'A', lastName: 'B', sessionVersion: 3 };

beforeEach(() => {
  for (const m of [resolve, authenticate, authenticateById, authenticateByPhone, owned, mode, findUnique, findMany]) m.mockReset();
  mode.mockReturnValue('HYBRID');
});

async function v1Parent(extra: Record<string, unknown> = {}) {
  return {
    id: 'v1', email: 'v@example.com', role: 'PARENT', firstName: 'V', lastName: 'One', password: await bcrypt.hash(PW, 4),
    activatedAt: new Date(), sessionVersion: 7, mergedIntoUserId: null, parentPhoneState: 'VERIFIED', phoneVerifiedAt: new Date(), ...extra,
  };
}

describe('HYBRID', () => {
  test('CORE_V2 e-mail identity: verified in Core v2 only, claims carry authority CORE_V2, Core v1 is never read', async () => {
    resolve.mockResolvedValue('CORE_V2');
    authenticate.mockResolvedValue(coreV2Identity);
    const result = await authorizeCredentials({ identifier: 'A@Example.com', password: PW });
    expect(result).toMatchObject({ id: 'u1', role: 'PARENT', sessionVersion: 3, authority: 'CORE_V2' });
    expect(authenticate).toHaveBeenCalledWith('a@example.com', PW);
    expect(findUnique).not.toHaveBeenCalled();
  });

  test('CORE_V2 identity with a wrong password → null, no Core v1 fallback', async () => {
    resolve.mockResolvedValue('CORE_V2');
    authenticate.mockResolvedValue(null);
    expect(await authorizeCredentials({ identifier: 'a@example.com', password: PW })).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  test('V1 e-mail identity: Core v1 path unchanged, claims carry authority V1, Core v2 never authenticates', async () => {
    resolve.mockResolvedValue('V1');
    findUnique.mockResolvedValue({ ...(await v1Parent()), role: 'ASSISTANTE' });
    const result = await authorizeCredentials({ identifier: 'v@example.com', password: PW });
    expect(result).toMatchObject({ id: 'v1', role: 'ASSISTANTE', sessionVersion: 7, authority: 'V1' });
    expect(authenticate).not.toHaveBeenCalled();
  });

  test('§8: a phone-resolved identity that Core v2 owns is authenticated in Core v2 ONLY (option A) — the Core v1 hash is never compared', async () => {
    findMany.mockResolvedValue([await v1Parent({ password: await bcrypt.hash('change_me_stale_v1_password', 4) })]);
    owned.mockResolvedValue(true);
    authenticateById.mockResolvedValue({ ...coreV2Identity, id: 'v1', userId: 'v1', email: 'v@example.com' });
    const result = await authorizeCredentials({ identifier: '+216 20 000 001', password: PW });
    expect(result).toMatchObject({ id: 'v1', authority: 'CORE_V2' });
    expect(authenticateById).toHaveBeenCalledWith('v1', PW);
    // The stale Core v1 password would have matched nothing; with a wrong Core v2 password the login is refused, no v1 retry.
    authenticateById.mockResolvedValue(null);
    expect(await authorizeCredentials({ identifier: '+216 20 000 001', password: 'change_me_stale_v1_password' })).toBeNull();
  });

  test('phone identity not owned by Core v2: Core v1 path with authority V1', async () => {
    findMany.mockResolvedValue([await v1Parent()]);
    owned.mockResolvedValue(false);
    const result = await authorizeCredentials({ identifier: '+216 20 000 001', password: PW });
    expect(result).toMatchObject({ id: 'v1', authority: 'V1' });
    expect(authenticateById).not.toHaveBeenCalled();
  });

  test('ambiguous or unverified phone → null before any authority lookup', async () => {
    findMany.mockResolvedValue([await v1Parent(), await v1Parent({ id: 'v2' })]);
    expect(await authorizeCredentials({ identifier: '+216 20 000 001', password: PW })).toBeNull();
    expect(owned).not.toHaveBeenCalled();
  });

  test('Core v2 unavailable → the refusal propagates (fail closed), Core v1 is not consulted', async () => {
    resolve.mockRejectedValue(new Error('Core v2 is required by HYBRID and unavailable'));
    await expect(authorizeCredentials({ identifier: 'a@example.com', password: PW })).rejects.toThrow(/unavailable/);
    expect(findUnique).not.toHaveBeenCalled();
  });
});

describe('V2_ONLY', () => {
  beforeEach(() => mode.mockReturnValue('V2_ONLY'));

  test('e-mail and phone are both authenticated in Core v2; Core v1 is never read', async () => {
    authenticate.mockResolvedValue(coreV2Identity);
    expect(await authorizeCredentials({ identifier: 'a@example.com', password: PW })).toMatchObject({ authority: 'CORE_V2' });
    authenticateByPhone.mockResolvedValue(coreV2Identity);
    expect(await authorizeCredentials({ identifier: '+216 20 000 001', password: PW })).toMatchObject({ authority: 'CORE_V2' });
    expect(authenticateByPhone).toHaveBeenCalledWith('20000001', PW); // Core v1's normalized national form, re-normalized by Core v2 itself
    expect(findUnique).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
  });
});

describe('V1_ONLY', () => {
  beforeEach(() => mode.mockReturnValue('V1_ONLY'));

  test('Core v2 is never consulted; Core v1 authenticates e-mail and phone as before', async () => {
    findUnique.mockResolvedValue({ ...(await v1Parent()), role: 'ASSISTANTE' });
    expect(await authorizeCredentials({ identifier: 'v@example.com', password: PW })).toMatchObject({ authority: 'V1' });
    findMany.mockResolvedValue([await v1Parent()]);
    expect(await authorizeCredentials({ identifier: '+216 20 000 001', password: PW })).toMatchObject({ authority: 'V1' });
    expect(resolve).not.toHaveBeenCalled();
    expect(owned).not.toHaveBeenCalled();
    expect(authenticate).not.toHaveBeenCalled();
  });
});

test('an unconfigured rollout mode refuses every login', async () => {
  mode.mockImplementation(() => { throw new Error('CORE_V2_AUTH_MODE must be one of …'); });
  await expect(authorizeCredentials({ identifier: 'a@example.com', password: PW })).rejects.toThrow(/CORE_V2_AUTH_MODE/);
});
