/** @jest-environment node */
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: { stageReservation: { findMany: jest.fn() } } }));
jest.mock('@/lib/email', () => ({ sendStageBankTransferConfirmation: jest.fn() }));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn(async () => null) }));
jest.mock('@/lib/rbac/permissions', () => {
  const actual = jest.requireActual<typeof import('@/lib/rbac/permissions')>('@/lib/rbac/permissions');
  return { ...actual, can: jest.fn(actual.can) };
});
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { can } from '@/lib/rbac/permissions';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { prisma } from '@/lib/prisma';
import { GET } from '@/app/api/reservation/route';
const invoke = (query = '') => GET(new NextRequest(`http://localhost:3000/api/reservation${query}`));
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(auth).mockResolvedValue({ user: { id: 'synthetic-staff', role: 'ADMIN' } } as never);
  jest.mocked(can).mockImplementation(jest.requireActual<typeof import('@/lib/rbac/permissions')>('@/lib/rbac/permissions').can);
  jest.mocked(guardSensitiveRateLimit).mockResolvedValue(null);
  jest.mocked(prisma.stageReservation.findMany).mockResolvedValue([]);
});
test.each([null, { user: { role: 'ADMIN' } }, { user: { id: 'synthetic-parent', role: 'PARENT' } },
  { user: { id: 'synthetic-coach', role: 'COACH' } }])('refuses a missing identity or non-staff authority before the database', async session => {
  jest.mocked(auth).mockResolvedValue(session as never);
  const response = await invoke();
  expect(response.status).toBe(403);
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(prisma.stageReservation.findMany).not.toHaveBeenCalled();
});
test('requires the finance read permission for the financial list', async () => {
  jest.mocked(can).mockImplementation((_role, _action, resource) => resource !== 'PAYMENT');
  expect((await invoke()).status).toBe(403);
  expect(prisma.stageReservation.findMany).not.toHaveBeenCalled();
});
test.each(['?status=INVALID', '?academyId=x&academyId=y', '?page=0', '?limit=101', '?page=1001', '?unknown=x', '?status=%00'])
('rejects invalid, duplicate or excessive filters: %s', async query => {
  expect((await invoke(query)).status).toBe(400);
  expect(prisma.stageReservation.findMany).not.toHaveBeenCalled();
});
test('applies validated filters and stable bounded pagination without diagnostic JSON', async () => {
  const response = await invoke('?status=PENDING&academyId=synthetic-stage&page=2&limit=20');
  expect(response.status).toBe(200);
  expect(prisma.stageReservation.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { status: 'PENDING', academyId: 'synthetic-stage' }, skip: 20, take: 21,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: expect.not.objectContaining({ scoringResult: true }),
  }));
  expect(await response.json()).toMatchObject({ success: true, count: 0, page: 2, limit: 20, hasNext: false });
  expect(response.headers.get('vary')).toContain('Authorization');
});
test('limits a staff read before the database and keeps the refusal private', async () => {
  jest.mocked(guardSensitiveRateLimit).mockResolvedValue(NextResponse.json({ error: 'Rate limited' }, { status: 429 }));
  const response = await invoke();
  expect(response.status).toBe(429);
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(prisma.stageReservation.findMany).not.toHaveBeenCalled();
});
test('does not log driver details when the list fails', async () => {
  const logger = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.mocked(prisma.stageReservation.findMany).mockRejectedValue(new Error('SYNTHETIC_PRIVATE_DRIVER_DETAIL'));
  try {
    const response = await invoke();
    expect(response.status).toBe(503);
    expect(JSON.stringify(logger.mock.calls).includes('SYNTHETIC_PRIVATE_DRIVER_DETAIL')).toBe(false);
    expect(JSON.stringify(await response.json()).includes('SYNTHETIC_PRIVATE_DRIVER_DETAIL')).toBe(false);
    expect(response.headers.get('cache-control')).toContain('no-store');
  } finally { logger.mockRestore(); }
});
