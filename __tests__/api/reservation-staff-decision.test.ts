/** @jest-environment node */
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => {
  const db = { stageReservation: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    stageReservationDecisionAudit: { findUnique: jest.fn(), create: jest.fn() } };
  return { prisma: { ...db, $transaction: jest.fn(async (callback: (tx: typeof db) => Promise<unknown>) => callback(db)) } };
});
jest.mock('@/lib/email', () => ({ sendStageBankTransferConfirmation: jest.fn() }));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn(async () => null) }));
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PATCH } from '@/app/api/reservation/route';
const requestId = '40b201c3-8c22-4fda-a310-dd6771618dba';
const invoke = (action = 'reject', overrides: Record<string, unknown> = {}) => PATCH(new NextRequest('http://localhost:3000/api/reservation',
  { method: 'PATCH', body: JSON.stringify({ reservationId: 'synthetic-reservation', action, requestId, ...overrides }) }));
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(prisma.stageReservationDecisionAudit.findUnique).mockReset();
  jest.mocked(prisma.stageReservationDecisionAudit.create).mockReset();
  jest.mocked(prisma.stageReservation.findUnique).mockReset();
  jest.mocked(prisma.stageReservation.updateMany).mockReset();
  jest.mocked(auth).mockResolvedValue({ user: { id: 'synthetic-admin', role: 'ADMIN' } } as never);
  jest.mocked(prisma.stageReservation.findUnique).mockResolvedValue({ id: 'synthetic-reservation', status: 'PENDING', stageId: null,
    studentId: null, paymentStatus: null, paymentRef: null, richStatus: null, confirmedAt: null, activationToken: null, activationTokenExpiresAt: null } as never);
  jest.mocked(prisma.stageReservation.updateMany).mockResolvedValue({ count: 1 });
  jest.mocked(prisma.stageReservationDecisionAudit.findUnique).mockResolvedValue(null);
});
test('secretaire cannot validate a financial decision without a PAYMENT mutation permission', async () => {
  jest.mocked(auth).mockResolvedValue({ user: { id: 'synthetic-assistant', role: 'ASSISTANTE' } } as never);
  expect((await invoke('approve')).status).toBe(403);
  expect(prisma.stageReservation.findUnique).not.toHaveBeenCalled();
});
test('legacy approval cannot claim an activation or reconciliation without canonical workflows', async () => {
  expect((await invoke('approve')).status).toBe(409);
  expect(prisma.stageReservation.update).not.toHaveBeenCalled();
  expect(prisma.stageReservation.updateMany).not.toHaveBeenCalled();
});
test('requires a command identity before a staff mutation', async () => {
  expect((await invoke('reject', { requestId: undefined })).status).toBe(400);
  expect(prisma.stageReservation.findUnique).not.toHaveBeenCalled();
});
test('cancels an unlinked pending lead with one CAS instead of an unguarded update', async () => {
  expect((await invoke()).status).toBe(200);
  expect(prisma.stageReservation.update).not.toHaveBeenCalled();
  expect(prisma.stageReservation.updateMany).toHaveBeenCalledTimes(1);
  expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  expect(prisma.stageReservationDecisionAudit.create).toHaveBeenCalledTimes(1);
});
test('a lost decision race cannot claim cancellation', async () => {
  jest.mocked(prisma.stageReservation.updateMany).mockResolvedValue({ count: 0 });
  expect((await invoke()).status).toBe(409);
});
test.each([{ stageId: 'linked-stage' }, { studentId: 'linked-student' }, { paymentStatus: 'COMPLETED' }])('cannot cancel a committed business object as a simple lead: %j', async extra => {
  jest.mocked(prisma.stageReservation.findUnique).mockResolvedValue({ id: 'synthetic-reservation', status: 'PENDING', stageId: null,
    studentId: null, paymentStatus: null, paymentRef: null, richStatus: null, confirmedAt: null, activationToken: null, activationTokenExpiresAt: null, ...extra } as never);
  expect((await invoke()).status).toBe(409);
  expect(prisma.stageReservation.updateMany).not.toHaveBeenCalled();
});
test('a simultaneous retry observes the winning command after its CAS loses', async () => {
  jest.mocked(prisma.stageReservation.updateMany).mockResolvedValue({ count: 0 });
  jest.mocked(prisma.stageReservationDecisionAudit.findUnique).mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ reservationId: 'synthetic-reservation' } as never);
  expect((await invoke()).status).toBe(200);
  expect(prisma.stageReservationDecisionAudit.create).not.toHaveBeenCalled();
});
test('reusing a command identity for another lead cannot mutate it', async () => {
  jest.mocked(prisma.stageReservationDecisionAudit.findUnique).mockResolvedValueOnce({ reservationId: 'another-synthetic-lead' } as never);
  expect((await invoke()).status).toBe(409);
  expect(prisma.stageReservation.findUnique).not.toHaveBeenCalled();
});
test('an audit failure cannot be acknowledged as a successful decision', async () => {
  jest.mocked(prisma.stageReservationDecisionAudit.create).mockRejectedValueOnce(new Error('synthetic driver failure'));
  const response = await invoke();
  expect(response.status).toBe(503);
  expect((await response.json()).error).toBe('Décision indisponible.');
  expect(response.headers.get('cache-control')).toContain('no-store');
});
test.each([{ richStatus: 'CONFIRMED' }, { confirmedAt: new Date('2026-01-01T00:00:00Z') },
  { activationToken: 'synthetic-stored-digest' }, { activationTokenExpiresAt: new Date('2099-01-01T00:00:00Z') }])
('a historical admission/activation marker is not an uncommitted lead: %j', async extra => {
  jest.mocked(prisma.stageReservation.findUnique).mockResolvedValue({ id: 'synthetic-reservation', status: 'PENDING',
    stageId: null, studentId: null, paymentStatus: null, paymentRef: null, richStatus: null, confirmedAt: null, activationToken: null, activationTokenExpiresAt: null, ...extra } as never);
  expect((await invoke()).status).toBe(409);
  expect(prisma.stageReservation.updateMany).not.toHaveBeenCalled();
});
test.each(['PARENT', 'ELEVE', 'COACH'])('role %s cannot access staff decisions', async role => {
  jest.mocked(auth).mockResolvedValue({ user: { id: 'synthetic-outsider', role } } as never);
  expect((await invoke()).status).toBe(403);
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
test('bounds actual decision bodies before database access', async () => {
  const response = await PATCH(new NextRequest('http://localhost:3000/api/reservation', { method: 'PATCH',
    body: JSON.stringify({ reservationId: 'synthetic-reservation', action: 'reject', requestId, padding: 'x'.repeat(4096) }) }));
  expect(response.status).toBe(413);
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
test('cross-origin production decisions are denied before database access', async () => {
  const previous = process.env.NODE_ENV;
  Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true, configurable: true });
  process.env.NEXTAUTH_URL = 'https://nexusreussite.academy';
  try {
    const response = await PATCH(new NextRequest('https://nexusreussite.academy/api/reservation', { method: 'PATCH',
      headers: { Origin: 'https://untrusted.invalid' }, body: JSON.stringify({ reservationId: 'synthetic-reservation', action: 'reject', requestId }) }));
    expect(response.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toContain('no-store');
  } finally { Object.defineProperty(process.env, 'NODE_ENV', { value: previous, writable: true, configurable: true }); }
});
test('declining a pending legacy lead synchronizes both status projections', async () => {
  jest.mocked(prisma.stageReservation.findUnique).mockResolvedValue({ id: 'synthetic-reservation', status: 'PENDING', stageId: null,
    studentId: null, paymentStatus: null, paymentRef: null, richStatus: 'PENDING', confirmedAt: null,
    activationToken: null, activationTokenExpiresAt: null } as never);
  expect((await invoke()).status).toBe(200);
  expect(jest.mocked(prisma.stageReservation.updateMany).mock.calls[0][0].data).toMatchObject({ status: 'CANCELLED', richStatus: 'CANCELLED' });
});
test('retry recognizes its winning audit even when the lead is already cancelled in both projections', async () => {
  jest.mocked(prisma.stageReservationDecisionAudit.findUnique).mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ reservationId: 'synthetic-reservation' } as never);
  jest.mocked(prisma.stageReservation.findUnique).mockResolvedValue({ id: 'synthetic-reservation', status: 'CANCELLED',
    richStatus: 'CANCELLED', stageId: null, studentId: null, paymentStatus: null, paymentRef: null,
    confirmedAt: null, activationToken: null, activationTokenExpiresAt: null } as never);
  expect((await invoke()).status).toBe(200);
  expect(prisma.stageReservation.updateMany).not.toHaveBeenCalled();
  expect(prisma.stageReservationDecisionAudit.create).not.toHaveBeenCalled();
});
