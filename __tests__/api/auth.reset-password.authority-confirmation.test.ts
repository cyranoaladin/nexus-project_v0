import { NextRequest } from 'next/server';

const mockAllowed = jest.fn();
const mockUserRead = jest.fn();
const mockUserUpdate = jest.fn();
const mockHash = jest.fn();
jest.mock('@/lib/auth/password-reset-authority', () => ({
  requestPasswordResetByAuthority: jest.fn(),
  canApplyV1CredentialProof: (...args: unknown[]) => mockAllowed(...args),
}));
jest.mock('@/lib/prisma', () => ({ prisma: { user: {
  findUnique: (...args: unknown[]) => mockUserRead(...args),
  update: (...args: unknown[]) => mockUserUpdate(...args),
} } }));
jest.mock('@/lib/password-reset-token', () => ({
  generateResetToken: jest.fn(), verifyResetToken: jest.fn(() => ({ userId: 'synthetic-parent', email: 'guardian@example.test' })),
}));
jest.mock('bcryptjs', () => ({ hash: (...args: unknown[]) => mockHash(...args) }));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn(async () => null) }));

import { POST } from '@/app/api/auth/reset-password/route';

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXTAUTH_URL = 'http://localhost:3000';
  mockUserRead.mockResolvedValue({ id: 'synthetic-parent', email: 'guardian@example.test',
    password: 'synthetic-existing-hash', sessionVersion: 2, parentPhoneState: 'NONE', emailVerifiedAt: null,
    parentPhoneChallenges: [],
  });
  mockHash.mockResolvedValue('synthetic-new-hash');
  mockUserUpdate.mockResolvedValue({ id: 'synthetic-parent' });
});
function request() {
  const payload = Buffer.from(JSON.stringify({ userId: 'synthetic-parent' })).toString('base64url');
  return new NextRequest('http://localhost:3000/api/auth/reset-password', {
    method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
    body: JSON.stringify({ token: `${payload}.synthetic-signature`, newPassword: ['synthetic', 'new', 'password'].join('-') }),
  });
}
test('an old V1 email proof cannot change a now Core-owned identity', async () => {
  mockAllowed.mockResolvedValue(false);
  const response = await POST(request());
  expect(response.status).toBe(400);
  expect(mockUserUpdate).not.toHaveBeenCalled();
  expect(mockHash).not.toHaveBeenCalled();
});
test('an unavailable authority refuses instead of falling back to the V1 mirror', async () => {
  mockAllowed.mockRejectedValue(new Error('synthetic authority unavailable'));
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(mockUserUpdate).not.toHaveBeenCalled();
  expect(mockHash).not.toHaveBeenCalled();
});
