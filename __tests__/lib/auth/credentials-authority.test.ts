/**
 * authorizeCredentials routes an e-mail identity to exactly one store:
 * CORE_V2 identities never touch the Core v1 user table, V1 identities never
 * touch Core v2, phone identities stay V1.
 */
jest.mock('@/lib/core-v2/auth/authority', () => ({
  resolveCredentialAuthority: jest.fn(),
  authenticateCoreV2: jest.fn(),
}));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: jest.fn(), findMany: jest.fn() } } }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn() } }));

import bcrypt from 'bcryptjs';
import { authenticateCoreV2, resolveCredentialAuthority } from '@/lib/core-v2/auth/authority';
import { authorizeCredentials } from '@/lib/auth/credentials-authorize';
import { prisma } from '@/lib/prisma';

const resolve = resolveCredentialAuthority as jest.Mock;
const authenticate = authenticateCoreV2 as jest.Mock;
const findUnique = prisma.user.findUnique as jest.Mock;
const findMany = prisma.user.findMany as jest.Mock;
const PW = 'change_me_unit_pw';

beforeEach(() => {
  resolve.mockReset();
  authenticate.mockReset();
  findUnique.mockReset();
  findMany.mockReset();
});

test('CORE_V2 identity: verified in Core v2 only, claims carry authority CORE_V2, Core v1 is never read', async () => {
  resolve.mockResolvedValue('CORE_V2');
  authenticate.mockResolvedValue({ id: 'u1', userId: 'u1', email: 'a@example.com', role: 'PARENT', firstName: 'A', lastName: 'B', sessionVersion: 3 });
  const result = await authorizeCredentials({ identifier: 'A@Example.com', password: PW });
  expect(result).toEqual({ id: 'u1', email: 'a@example.com', role: 'PARENT', firstName: 'A', lastName: 'B', sessionVersion: 3, authority: 'CORE_V2' });
  expect(authenticate).toHaveBeenCalledWith('a@example.com', PW);
  expect(findUnique).not.toHaveBeenCalled();
});

test('CORE_V2 identity with a wrong password → null, no Core v1 fallback', async () => {
  resolve.mockResolvedValue('CORE_V2');
  authenticate.mockResolvedValue(null);
  expect(await authorizeCredentials({ identifier: 'a@example.com', password: PW })).toBeNull();
  expect(findUnique).not.toHaveBeenCalled();
});

test('V1 identity: Core v1 path unchanged, claims carry authority V1, Core v2 never authenticates', async () => {
  resolve.mockResolvedValue('V1');
  findUnique.mockResolvedValue({
    id: 'v1', email: 'v@example.com', role: 'ASSISTANTE', firstName: 'V', lastName: 'One',
    password: await bcrypt.hash(PW, 4), activatedAt: new Date(), sessionVersion: 7, mergedIntoUserId: null,
  });
  const result = await authorizeCredentials({ identifier: 'v@example.com', password: PW });
  expect(result).toMatchObject({ id: 'v1', role: 'ASSISTANTE', sessionVersion: 7, authority: 'V1' });
  expect(authenticate).not.toHaveBeenCalled();
});

test('phone identity stays V1 without consulting the authority resolver', async () => {
  findMany.mockResolvedValue([]);
  expect(await authorizeCredentials({ identifier: '+216 20 000 001', password: PW })).toBeNull();
  expect(resolve).not.toHaveBeenCalled();
  expect(authenticate).not.toHaveBeenCalled();
});
