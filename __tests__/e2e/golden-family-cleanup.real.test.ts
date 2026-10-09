/** @jest-environment node */
jest.unmock('@/lib/prisma');
jest.mock('@/lib/guards', () => ({ requireAnyRole: jest.fn(), isErrorResponse: jest.fn().mockReturnValue(false) }));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn().mockResolvedValue(null) }));
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import { prisma as routeDatabase } from '@/lib/prisma';
import { requireAnyRole } from '@/lib/guards';
import { POST } from '@/app/api/sessions/cancel/route';
import { cleanupGoldenFamily, disconnectGoldenFamilyPrisma, prisma } from '@/e2e/helpers/golden-family';
import { assertDisposableE2eDatabase } from '@/e2e/helpers/disposable-database';
beforeAll(() => assertDisposableE2eDatabase(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || ''));
afterAll(async () => { await Promise.all([disconnectGoldenFamilyPrisma(), routeDatabase.$disconnect()]); });
async function users() {
  const digest = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
  const student = await prisma.user.create({ data: { email: `${randomUUID()}@example.test`, role: 'ELEVE', password: digest, activatedAt: new Date(), sessionVersion: 3 } });
  const coach = await prisma.user.create({ data: { email: `${randomUUID()}@example.test`, role: 'COACH', password: digest, activatedAt: new Date(), sessionVersion: 3 } });
  return { student, coach };
}
test('real audited fixture revokes credentials once and preserves immutable booking history', async () => {
  const { student, coach } = await users();
  const booking = await prisma.sessionBooking.create({ data: { studentId: student.id, coachId: coach.id, subject: 'MATHEMATIQUES', title: 'Synthetic retained fixture', scheduledDate: new Date('2099-01-01T00:00:00Z'), startTime: '10:00', endTime: '11:00', duration: 60 } });
  (requireAnyRole as jest.Mock).mockResolvedValue({ user: { id: student.id, role: 'ELEVE' } });
  expect((await POST(new NextRequest('http://localhost:3000/api/sessions/cancel', { method: 'POST', headers: { 'Idempotency-Key': randomUUID() }, body: JSON.stringify({ sessionId: booking.id, reason: 'Synthetic retained history' }) }))).status).toBe(200);
  const scope = { childAUserId: student.id, coach1UserId: coach.id };
  expect(await cleanupGoldenFamily(scope)).toBe('AUDIT_RETAINED');
  const retired = await prisma.user.findMany({ where: { id: { in: [student.id, coach.id] } } });
  expect(retired.length).toBe(2);
  expect(retired.every(user => user.password === null && user.activatedAt === null && user.activationToken === null && user.sessionVersion === 4)).toBe(true);
  expect(await prisma.sessionBooking.count({ where: { id: booking.id } })).toBe(1);
  expect(await prisma.sessionBookingCancellationAudit.count({ where: { sessionBookingId: booking.id } })).toBe(1);
  expect(await cleanupGoldenFamily(scope)).toBe('AUDIT_RETAINED');
  expect((await prisma.user.findMany({ where: { id: { in: [student.id, coach.id] } } })).every(user => user.sessionVersion === 4)).toBe(true);
});
test('unaudited fixture cleanup still deletes only its owned users', async () => {
  const { student, coach } = await users();
  const outsider = await prisma.user.create({ data: { email: `${randomUUID()}@example.test`, role: 'ELEVE' } });
  expect(await cleanupGoldenFamily({ childAUserId: student.id, coach1UserId: coach.id })).toBe('DELETED');
  expect(await prisma.user.count({ where: { id: { in: [student.id, coach.id] } } })).toBe(0);
  expect(await prisma.user.count({ where: { id: outsider.id } })).toBe(1);
});
