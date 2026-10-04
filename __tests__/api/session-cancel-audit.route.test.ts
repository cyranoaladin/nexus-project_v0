import { NextRequest } from 'next/server';
import { POST } from '@/app/api/sessions/cancel/route';
import { Prisma } from '@prisma/client';

jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn().mockResolvedValue({ user: { id: 'synthetic-student', role: 'ELEVE' } }),
  isErrorResponse: jest.fn().mockReturnValue(false),
}));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/middleware/logger', () => ({ createLogger: jest.fn(() => ({ info: jest.fn(), error: jest.fn(), logRequest: jest.fn() })) }));
jest.mock('@/lib/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/prisma', () => ({ prisma: {
  sessionBooking: { findUnique: jest.fn(), updateMany: jest.fn() },
  sessionBookingCancellationAudit: { create: jest.fn(), findUnique: jest.fn() },
  $transaction: jest.fn(),
} }));

type MockDatabase = {
  sessionBooking: { findUnique: jest.Mock; updateMany: jest.Mock };
  sessionBookingCancellationAudit: { create: jest.Mock; findUnique: jest.Mock };
  $transaction: jest.Mock;
};
const database = (jest.requireMock('@/lib/prisma') as { prisma: MockDatabase }).prisma;
const bookingId = 'clh1234567890abcdefghij';
const reason = 'Synthetic cancellation reason';
const commandId = '5cc6cf7e-8a6b-4284-af2a-0106b46a6e89';
function request(): NextRequest {
  return new NextRequest('http://localhost:3000/api/sessions/cancel', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': commandId },
    body: JSON.stringify({ sessionId: bookingId, reason }),
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  database.sessionBooking.findUnique.mockResolvedValue({ id: bookingId, studentId: 'synthetic-student', coachId: 'synthetic-coach', status: 'SCHEDULED', coachNotes: 'Synthetic pedagogical summary' });
  database.sessionBooking.updateMany.mockResolvedValue({ count: 1 });
  database.sessionBookingCancellationAudit.create.mockResolvedValue({ id: 'synthetic-audit' });
  database.sessionBookingCancellationAudit.findUnique.mockResolvedValue(null);
  database.$transaction.mockImplementation((operation: (tx: MockDatabase) => Promise<unknown>) => operation(database));
});

test('cancellation preserves the existing pedagogical notes', async () => {
  expect((await POST(request())).status).toBe(200);
  const argument = database.sessionBooking.updateMany.mock.calls[0][0] as { data: Record<string, unknown> };
  expect(argument.data).not.toHaveProperty('coachNotes');
});

test('a successful cancellation records the reason and actor in the same transaction', async () => {
  expect((await POST(request())).status).toBe(200);
  expect(database.$transaction).toHaveBeenCalledTimes(1);
  expect(database.sessionBookingCancellationAudit.create).toHaveBeenCalledWith({ data: expect.objectContaining({
    sessionBookingId: bookingId, actorUserId: 'synthetic-student', actorRole: 'ELEVE',
    previousStatus: 'SCHEDULED', nextStatus: 'CANCELLED', reason,
  }) });
});

test('audit persistence failure cannot be reported as a successful cancellation', async () => {
  database.sessionBookingCancellationAudit.create.mockRejectedValueOnce(new Error('SYNTHETIC_AUDIT_WRITE_FAILED'));
  expect((await POST(request())).status).toBe(500);
});

test('a lost response can replay the same command without another write or audit event', async () => {
  database.sessionBooking.findUnique.mockResolvedValue({ id: bookingId, studentId: 'synthetic-student', coachId: 'synthetic-coach', status: 'CANCELLED' });
  database.sessionBookingCancellationAudit.findUnique.mockResolvedValue({ sessionBookingId: bookingId, actorUserId: 'synthetic-student', reason, action: 'BOOKING_CANCELLED' });
  expect((await POST(request())).status).toBe(200);
  expect(database.sessionBooking.updateMany).not.toHaveBeenCalled();
  expect(database.sessionBookingCancellationAudit.create).not.toHaveBeenCalled();
});

test('a concurrent command collision is a controlled conflict rather than an opaque failure', async () => {
  database.sessionBookingCancellationAudit.create.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('SYNTHETIC_COMMAND_COLLISION', {
    code: 'P2002', clientVersion: '6.19.0', meta: { modelName: 'SessionBookingCancellationAudit', target: ['requestKey'] },
  }));
  expect((await POST(request())).status).toBe(409);
});

test('another uniqueness error remains a failure rather than a fabricated command replay', async () => {
  database.sessionBookingCancellationAudit.create.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('SYNTHETIC_UNRELATED_COLLISION', {
    code: 'P2002', clientVersion: '6.19.0', meta: { modelName: 'SessionBookingCancellationAudit', target: ['id'] },
  }));
  expect((await POST(request())).status).toBe(500);
});

test('unexpected audit errors never log their private payload or stack', async () => {
  const marker = 'SYNTHETIC_PRIVATE_CANCELLATION_PAYLOAD';
  database.sessionBookingCancellationAudit.create.mockRejectedValueOnce(new Error(marker));
  const response = await POST(request());
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain(marker);
  const log = (jest.requireMock('@/lib/logger') as { logger: { warn: jest.Mock; error: jest.Mock } }).logger;
  expect(JSON.stringify([...log.warn.mock.calls, ...log.error.mock.calls])).not.toContain(marker);
});
