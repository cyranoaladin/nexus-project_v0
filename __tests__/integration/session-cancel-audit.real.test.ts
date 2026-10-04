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
beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  await prisma.user.createMany({ data: [
    { id: studentId, email: `${studentId}@example.test`, role: 'ELEVE' },
    { id: coachId, email: `${coachId}@example.test`, role: 'COACH' },
    { id: otherId, email: `${otherId}@example.test`, role: 'ELEVE' },
  ] });
});
beforeEach(() => {
  (requireAnyRole as jest.Mock).mockResolvedValue({ user: { id: studentId, role: 'ELEVE' } });
});
// Immutable audit fixtures are retained until the owned disposable database
// is destroyed. Do not bypass audit triggers to delete this synthetic history.
afterAll(async () => { await prisma.$disconnect(); });

const notes = 'Synthetic pedagogical summary';
const reason = 'Synthetic cancellation reason';
function booking(startTime = '10:00', endTime = '11:00') {
  return prisma.sessionBooking.create({ data: {
    studentId, coachId, subject: 'MATHEMATIQUES', title: 'Synthetic cancellation audit',
    scheduledDate: new Date('2099-01-01T00:00:00Z'), startTime, endTime, duration: 60, coachNotes: notes,
  } });
}
function request(id: string, command = randomUUID(), motive = reason) {
  return new NextRequest('http://localhost:3000/api/sessions/cancel', {
    method: 'POST', headers: { 'Idempotency-Key': command },
    body: JSON.stringify({ sessionId: id, reason: motive }),
  });
}

test('notes survive and a real cancellation event contains only the cancellation reason', async () => {
  const row = await booking();
  expect((await POST(request(row.id))).status).toBe(200);
  const current = await prisma.sessionBooking.findUniqueOrThrow({ where: { id: row.id } });
  expect(current.coachNotes === notes).toBe(true);
  expect(current.status).toBe('CANCELLED');
  const events = await prisma.sessionBookingCancellationAudit.findMany({ where: { sessionBookingId: row.id } });
  expect(events).toHaveLength(1);
  expect(events[0].reason === reason && events[0].actorUserId === studentId).toBe(true);
  expect(events[0].previousStatus).toBe('SCHEDULED');
  expect(events[0].nextStatus).toBe('CANCELLED');
});

test('a database audit-insert failure rolls back the real cancellation write', async () => {
  const row = await booking('11:00', '12:00');
  await prisma.$executeRaw`CREATE FUNCTION nexus_fixture_cancel_audit_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reason = 'SYNTHETIC_AUDIT_FAULT' THEN RAISE EXCEPTION 'SYNTHETIC_AUDIT_FAULT'; END IF; RETURN NEW; END; $$`;
  try {
    await prisma.$executeRaw`CREATE TRIGGER nexus_fixture_cancel_audit_fault BEFORE INSERT ON session_booking_cancellation_audits FOR EACH ROW EXECUTE FUNCTION nexus_fixture_cancel_audit_fault()`;
    try {
      expect((await POST(request(row.id, randomUUID(), 'SYNTHETIC_AUDIT_FAULT'))).status).toBe(500);
      const current = await prisma.sessionBooking.findUniqueOrThrow({ where: { id: row.id } });
      expect(current.status).toBe('SCHEDULED');
      expect(current.cancelledAt).toBeNull();
      expect(current.coachNotes === notes).toBe(true);
      expect(await prisma.sessionBookingCancellationAudit.count({ where: { sessionBookingId: row.id } })).toBe(0);
    } finally { await prisma.$executeRaw`DROP TRIGGER nexus_fixture_cancel_audit_fault ON session_booking_cancellation_audits`; }
  } finally { await prisma.$executeRaw`DROP FUNCTION nexus_fixture_cancel_audit_fault()`; }
  // Release only this synthetic slot so later independent fixtures cannot collide.
  await prisma.sessionBooking.update({ where: { id: row.id }, data: { status: 'CANCELLED' } });
});

test('two workers using the same command produce one real audit event', async () => {
  const row = await booking('12:00', '13:00');
  const command = randomUUID();
  let reads = 0;
  let ready!: () => void;
  let release!: () => void;
  const bothRead = new Promise<void>(resolve => { ready = resolve; });
  const held = new Promise<void>(resolve => { release = resolve; });
  const original = prisma.sessionBooking.findUnique.bind(prisma.sessionBooking);
  const spy = jest.spyOn(prisma.sessionBooking, 'findUnique').mockImplementation(args => original(args).then(async value => {
    if (++reads === 2) ready();
    await held;
    return value;
  }) as ReturnType<typeof prisma.sessionBooking.findUnique>);
  const first = POST(request(row.id, command));
  const second = POST(request(row.id, command));
  try {
    await bothRead;
    release();
    expect((await Promise.all([first, second])).map(response => response.status)).toEqual([200, 200]);
    expect(await prisma.sessionBookingCancellationAudit.count({ where: { sessionBookingId: row.id } })).toBe(1);
    expect((await original({ where: { id: row.id } }))?.coachNotes === notes).toBe(true);
  } finally { release(); await Promise.allSettled([first, second]); spy.mockRestore(); }
});

test('the same command cannot be reused with a different reason', async () => {
  const row = await booking('13:00', '14:00');
  const command = randomUUID();
  expect((await POST(request(row.id, command))).status).toBe(200);
  expect((await POST(request(row.id, command, 'Synthetic different reason'))).status).toBe(409);
  expect(await prisma.sessionBookingCancellationAudit.count({ where: { sessionBookingId: row.id } })).toBe(1);
});

test('database audit events reject update and deletion', async () => {
  const row = await booking('14:00', '15:00');
  expect((await POST(request(row.id))).status).toBe(200);
  const event = await prisma.sessionBookingCancellationAudit.findFirstOrThrow({ where: { sessionBookingId: row.id } });
  await expect(prisma.sessionBookingCancellationAudit.update({ where: { id: event.id }, data: { reason: 'Synthetic rewrite attempt' } })).rejects.toThrow('SESSION_BOOKING_CANCELLATION_AUDIT_APPEND_ONLY');
  await expect(prisma.sessionBookingCancellationAudit.delete({ where: { id: event.id } })).rejects.toThrow('SESSION_BOOKING_CANCELLATION_AUDIT_APPEND_ONLY');
  expect(await prisma.sessionBookingCancellationAudit.count({ where: { sessionBookingId: row.id } })).toBe(1);
});

test('another student cannot cancel the booking or create an audit event', async () => {
  const row = await booking('15:00', '16:00');
  (requireAnyRole as jest.Mock).mockResolvedValue({ user: { id: otherId, role: 'ELEVE' } });
  expect((await POST(request(row.id))).status).toBe(403);
  expect(await prisma.sessionBookingCancellationAudit.count({ where: { sessionBookingId: row.id } })).toBe(0);
  expect((await prisma.sessionBooking.findUniqueOrThrow({ where: { id: row.id } })).coachNotes === notes).toBe(true);
});
