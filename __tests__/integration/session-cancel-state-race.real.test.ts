/** @jest-environment node */
jest.unmock('@/lib/prisma');
jest.mock('@/lib/guards', () => ({ requireAnyRole: jest.fn(), isErrorResponse: jest.fn().mockReturnValue(false) }));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn().mockResolvedValue(null) }));
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnyRole } from '@/lib/guards';
import { POST } from '@/app/api/sessions/cancel/route';
import { assertDisposablePostgresUrl } from '../helpers/disposable-postgres';

const studentId = randomUUID();
const coachId = randomUUID();
const otherId = randomUUID();
const bookings: string[] = [];
beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  await prisma.user.createMany({ data: [
    { id: studentId, email: `${studentId}@example.test`, role: 'ELEVE' },
    { id: coachId, email: `${coachId}@example.test`, role: 'COACH' },
    { id: otherId, email: `${otherId}@example.test`, role: 'ELEVE' },
  ] });
});
afterAll(async () => {
  await prisma.sessionBooking.deleteMany({ where: { id: { in: bookings } } });
  await prisma.user.deleteMany({ where: { id: { in: [studentId, coachId, otherId] } } });
  await prisma.$disconnect();
});

test.each(['completed', 'student-reassigned', 'coach-reassigned'] as const)('a committed %s between read and cancellation is preserved', async (fault) => {
  const booking = await prisma.sessionBooking.create({ data: { studentId, coachId, subject: 'MATHEMATIQUES', title: 'Synthetic cancellation race', scheduledDate: new Date('2099-01-01T00:00:00Z'), startTime: '10:00', endTime: '11:00', duration: 60 } });
  bookings.push(booking.id);
  (requireAnyRole as jest.Mock).mockResolvedValue({ user: { id: fault === 'coach-reassigned' ? coachId : studentId, role: fault === 'coach-reassigned' ? 'COACH' : 'ELEVE' } });
  let readDone!: () => void;
  let release!: () => void;
  const read = new Promise<void>(resolve => { readDone = resolve; });
  const held = new Promise<void>(resolve => { release = resolve; });
  const original = prisma.sessionBooking.findUnique.bind(prisma.sessionBooking);
  const spy = jest.spyOn(prisma.sessionBooking, 'findUnique').mockImplementationOnce(args => original(args).then(async row => {
    readDone();
    await held;
    return row;
  }) as ReturnType<typeof prisma.sessionBooking.findUnique>);
  const responsePromise = POST(new NextRequest('http://localhost:3000/api/sessions/cancel', { method: 'POST', body: JSON.stringify({ sessionId: booking.id, reason: 'Synthetic request' }) }));
  try {
    await read;
    const mutation = fault === 'completed' ? { status: 'COMPLETED' as const } : fault === 'student-reassigned' ? { studentId: otherId } : { coachId: otherId };
    await prisma.sessionBooking.update({ where: { id: booking.id }, data: mutation });
    release();
    const response = await responsePromise;
    expect(response.status).toBe(409);
    const current = await original({ where: { id: booking.id } });
    expect(current?.status === (fault === 'completed' ? 'COMPLETED' : 'SCHEDULED')).toBe(true);
    expect(current?.cancelledAt === null).toBe(true);
  } finally {
    release();
    await responsePromise;
    spy.mockRestore();
    await prisma.sessionBooking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } });
  }
});
