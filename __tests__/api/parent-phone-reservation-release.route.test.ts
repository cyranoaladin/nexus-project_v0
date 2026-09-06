jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: { $transaction: jest.fn() } }));
jest.mock('@/lib/csrf', () => ({ checkCsrf: jest.fn().mockReturnValue(null) }));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/auth/parent-phone', () => {
  const actual = jest.requireActual('@/lib/auth/parent-phone');
  return { ...actual, releaseExpiredParentPhoneReservation: jest.fn() };
});
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { checkCsrf } from '@/lib/csrf';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { ParentPhoneError, releaseExpiredParentPhoneReservation } from '@/lib/auth/parent-phone';
import { POST } from '@/app/api/assistante/parents/[parentId]/phone-reservation/release/route';
import { NextRequest, NextResponse } from 'next/server';
const tx = {};
const context = { params: Promise.resolve({ parentId: 'parent-user-id' }) };
const request = (body: unknown = { expectedPhoneVersion: 2 }) => new NextRequest('http://localhost/api/assistante/parents/parent-user-id/phone-reservation/release', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => {
  jest.clearAllMocks();
  (auth as jest.Mock).mockResolvedValue({ user: { id: 'staff-user-id', role: 'ASSISTANTE' } });
  (checkCsrf as jest.Mock).mockReturnValue(null);
  (guardSensitiveRateLimit as jest.Mock).mockResolvedValue(null);
  (releaseExpiredParentPhoneReservation as jest.Mock).mockResolvedValue(true);
  (prisma.$transaction as jest.Mock).mockImplementation(action => action(tx));
});
it.each([null, { user: { id: 'x', role: 'PARENT' } }, { user: { id: 'x', role: 'COACH' } }, { user: { id: 'x', role: 'ELEVE' } }])('refuses non-staff without querying the reservation', async session => {
  (auth as jest.Mock).mockResolvedValue(session);
  expect((await POST(request(), context)).status).toBe(404);
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
it.each(['ASSISTANTE', 'ADMIN'])('lets %s explicitly release only the versioned user reservation', async role => {
  (auth as jest.Mock).mockResolvedValue({ user: { id: 'staff-user-id', role } });
  const response = await POST(request(), context);
  expect(response.status).toBe(200); expect(await response.json()).toEqual({ released: true });
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(releaseExpiredParentPhoneReservation).toHaveBeenCalledWith(tx, 'parent-user-id', expect.any(Date), 2);
  expect(guardSensitiveRateLimit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ identity: 'staff-user-id', resource: 'parent-user-id' }));
});
it('rejects CSRF and rate-limited writes before entering the transaction', async () => {
  (checkCsrf as jest.Mock).mockReturnValue(NextResponse.json({}, { status: 403 }));
  expect((await POST(request(), context)).status).toBe(403);
  (checkCsrf as jest.Mock).mockReturnValue(null);
  (guardSensitiveRateLimit as jest.Mock).mockResolvedValue(NextResponse.json({}, { status: 429 }));
  expect((await POST(request(), context)).status).toBe(429);
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
it.each([{}, { expectedPhoneVersion: -1 }, { expectedPhoneVersion: 1.5 }, { expectedPhoneVersion: 2, parentId: 'other' }])('requires strict expected version input %#', async body => {
  expect((await POST(request(body), context)).status).toBe(400);
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
it('reports a live, active or verified reservation as a recoverable conflict', async () => {
  (releaseExpiredParentPhoneReservation as jest.Mock).mockResolvedValue(false);
  const response = await POST(request(), context);
  expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ code: 'RESERVATION_NOT_RELEASABLE' });
});
it('reports a concurrent reservation change without exposing data', async () => {
  (releaseExpiredParentPhoneReservation as jest.Mock).mockRejectedValue(new ParentPhoneError('PHONE_IDENTITY_CHANGED'));
  const response = await POST(request(), context);
  expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ code: 'PHONE_IDENTITY_CHANGED' });
});
