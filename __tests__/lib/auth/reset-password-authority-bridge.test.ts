/**
 * The Core v1 reset route delegates CORE_V2 identities to the bridge and
 * never touches the v1 row for them; V1 identities keep the existing flow.
 * Pure unit test: both stores are mocked.
 */
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/password-reset-authority', () => ({ requestPasswordResetByAuthority: jest.fn() }));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn(async () => null) }));
jest.mock('@/lib/email/outbox-scheduler', () => ({ kickEmailOutboxDrain: jest.fn() }));
jest.mock('@/lib/email/outbox', () => ({ enqueueEmailIntent: jest.fn(async () => ({ messageId: 'm' })) }));
jest.mock('@/lib/prisma', () => {
  const user = { findUnique: jest.fn(), update: jest.fn() };
  const prisma = { user, $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({ user })) };
  return { prisma };
});

import { requestPasswordResetByAuthority } from '@/lib/auth/password-reset-authority';
import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/auth/reset-password/route';

const bridge = requestPasswordResetByAuthority as unknown as jest.Mock;
const findUnique = (prisma as unknown as { user: { findUnique: jest.Mock } }).user.findUnique;

function request(email: string) {
  return new NextRequest('http://localhost:3000/api/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify({ email }),
  });
}

beforeEach(() => {
  bridge.mockReset();
  findUnique.mockReset();
});

test('CORE_V2 identity: the bridge issues the reset and the Core v1 row is never consulted; the answer is the generic success', async () => {
  bridge.mockResolvedValue('CORE_V2_ISSUED');
  const response = await POST(request('Amel@Example.test'));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ success: true });
  expect(bridge).toHaveBeenCalledWith('amel@example.test');
  expect(findUnique).not.toHaveBeenCalled();
});

test('ineligible Core v2 account: same generic success, still no v1 lookup (no second authority)', async () => {
  bridge.mockResolvedValue('CORE_V2_NOT_ELIGIBLE');
  const response = await POST(request('pending@example.test'));
  expect(response.status).toBe(200);
  expect(findUnique).not.toHaveBeenCalled();
});

test('V1 identity: the Core v1 flow runs (row looked up)', async () => {
  bridge.mockResolvedValue('V1');
  findUnique.mockResolvedValue(null);
  const response = await POST(request('legacy@example.test'));
  expect(response.status).toBe(200);
  expect(findUnique).toHaveBeenCalledTimes(1);
});
