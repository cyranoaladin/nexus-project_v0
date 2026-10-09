/** @jest-environment node */
jest.unmock('@/lib/prisma');
jest.mock('@/lib/guards', () => ({ requireAnyRole: jest.fn(), isErrorResponse: jest.fn().mockReturnValue(false) }));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn().mockResolvedValue(null) }));
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnyRole } from '@/lib/guards';
import { POST } from '@/app/api/sessions/cancel/route';
import { DELETE, PUT } from '@/app/api/assistante/planning/series/[seriesId]/route';
import { cancelSeriesOccurrences } from '@/lib/planning/cancel-series-occurrences';
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

async function seriesFixture() {
  const parentUser = await prisma.user.create({ data: { email: `${randomUUID()}@example.test`, role: 'PARENT' } });
  const parent = await prisma.parentProfile.create({ data: { userId: parentUser.id } });
  const studentUser = await prisma.user.create({ data: { email: `${randomUUID()}@example.test`, role: 'ELEVE' } });
  const coachUser = await prisma.user.create({ data: { email: `${randomUUID()}@example.test`, role: 'COACH' } });
  const student = await prisma.student.create({ data: { userId: studentUser.id, parentId: parent.id, gradeLevel: 'PREMIERE' } });
  const coach = await prisma.coachProfile.create({ data: { userId: coachUser.id, pseudonym: randomUUID(), subjects: ['MATHEMATIQUES'] } });
  const assignment = await prisma.coachStudentAssignment.create({ data: { studentId: student.id, coachId: coach.id } });
  await prisma.studentAcademicEnrollment.create({ data: { studentId: student.id, courseKey: 'eds-maths-premiere', kind: 'SPECIALTY', source: 'ADMIN' } });
  await prisma.coachStudentAssignment.update({ where: { id: assignment.id }, data: { courseScopeState: 'STAFF_VERIFIED', academicCourseKeys: ['eds-maths-premiere'], subjects: ['MATHEMATIQUES'] } });
  await prisma.coachAvailability.createMany({ data: Array.from({ length: 7 }, (_, dayOfWeek) => ({ coachId: coachUser.id, dayOfWeek, startTime: '08:00', endTime: '18:00', isAvailable: true, isRecurring: true })) });
  const series = await prisma.planningSeries.create({ data: {
    studentProfileId: student.id, coachProfileId: coach.id, assignmentId: assignment.id,
    academicCourseKey: 'eds-maths-premiere', startDate: new Date('2099-01-01T00:00:00Z'),
    localStartTime: '10:00', localEndTime: '11:00', recurrenceRule: 'FREQ=WEEKLY', modality: 'ONLINE', createdById: parentUser.id,
  } });
  const rows = [];
  for (const [startTime, endTime] of [['10:00','11:00'], ['11:00','12:00']]) {
    rows.push(await prisma.sessionBooking.create({ data: {
      studentId: studentUser.id, coachId: coachUser.id, planningSeriesId: series.id, subject: 'MATHEMATIQUES',
      title: 'Synthetic series', scheduledDate: new Date('2099-01-01T00:00:00Z'), startTime, endTime, duration: 60, coachNotes: notes,
    } }));
  }
  return { series, rows };
}
const seriesInput = (seriesId: string, motive = 'Synthetic series reason') => ({
  seriesId, boundary: new Date('2098-01-01T00:00:00Z'), actorUserId: 'synthetic-core-only-staff',
  actorRole: 'ASSISTANTE', action: 'SERIES_CANCELLED' as const, reason: motive,
});

test('bulk cancellation preserves notes and audits each changed occurrence, including a Core-only actor', async () => {
  const { series, rows } = await seriesFixture();
  expect(await prisma.$transaction(tx => cancelSeriesOccurrences(tx, seriesInput(series.id)))).toBe(2);
  for (const row of rows) {
    const changed = await prisma.sessionBooking.findUniqueOrThrow({ where: { id: row.id } });
    expect(changed.status).toBe('CANCELLED');
    expect(changed.coachNotes === notes).toBe(true);
    expect(await prisma.sessionBookingCancellationAudit.count({ where: { sessionBookingId: row.id, action: 'SERIES_CANCELLED' } })).toBe(1);
  }
  expect(await prisma.$transaction(tx => cancelSeriesOccurrences(tx, seriesInput(series.id)))).toBe(0);
});

test('bulk audit failure on a later occurrence rolls back earlier writes and events', async () => {
  const { series, rows } = await seriesFixture();
  await prisma.$executeRaw`CREATE FUNCTION nexus_fixture_bulk_audit_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reason = 'SYNTHETIC_BULK_AUDIT_FAULT' AND EXISTS (SELECT 1 FROM session_booking_cancellation_audits WHERE reason = 'SYNTHETIC_BULK_AUDIT_FAULT') THEN RAISE EXCEPTION 'SYNTHETIC_BULK_AUDIT_FAULT'; END IF; RETURN NEW; END; $$`;
  try {
    await prisma.$executeRaw`CREATE TRIGGER nexus_fixture_bulk_audit_fault BEFORE INSERT ON session_booking_cancellation_audits FOR EACH ROW EXECUTE FUNCTION nexus_fixture_bulk_audit_fault()`;
    try {
      await expect(prisma.$transaction(tx => cancelSeriesOccurrences(tx, seriesInput(series.id, 'SYNTHETIC_BULK_AUDIT_FAULT')))).rejects.toThrow();
      expect(await prisma.sessionBookingCancellationAudit.count({ where: { sessionBookingId: { in: rows.map(row => row.id) } } })).toBe(0);
      for (const row of rows) {
        const current = await prisma.sessionBooking.findUniqueOrThrow({ where: { id: row.id } });
        expect(current.status).toBe('SCHEDULED'); expect(current.coachNotes === notes).toBe(true);
      }
    } finally { await prisma.$executeRaw`DROP TRIGGER nexus_fixture_bulk_audit_fault ON session_booking_cancellation_audits`; }
  } finally { await prisma.$executeRaw`DROP FUNCTION nexus_fixture_bulk_audit_fault()`; }
});

function seriesRequest(method: string, payload: unknown) {
  return new NextRequest('http://localhost:3000/api/assistante/planning/series/synthetic', { method, body: JSON.stringify(payload) });
}
const revisionBody = { expectedRevision: 0, startDate: '2099-01-02', localStartTime: '10:00', localEndTime: '11:00', duration: 60, title: 'Synthetic revision', modality: 'ONLINE' };
test('an actual PUT after DELETE cannot recreate a cancelled series', async () => {
  const { series } = await seriesFixture();
  (requireAnyRole as jest.Mock).mockResolvedValue({ user: { id: 'synthetic-core-only-staff', role: 'ASSISTANTE' } });
  const params = { params: Promise.resolve({ seriesId: series.id }) };
  expect((await DELETE(seriesRequest('DELETE', { reason }), params)).status).toBe(200);
  expect((await PUT(seriesRequest('PUT', revisionBody), params)).status).toBe(409);
  expect(await prisma.sessionBooking.count({ where: { planningSeriesId: series.id, status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] } } })).toBe(0);
});

test('actual concurrent DELETE and PUT finish without resurrecting the cancelled series', async () => {
  const { series } = await seriesFixture();
  (requireAnyRole as jest.Mock).mockResolvedValue({ user: { id: 'synthetic-core-only-staff', role: 'ASSISTANTE' } });
  const params = { params: Promise.resolve({ seriesId: series.id }) };
  const responses = await Promise.all([DELETE(seriesRequest('DELETE', { reason }), params), PUT(seriesRequest('PUT', revisionBody), params)]);
  expect(responses[0].status).toBe(200);
  expect([200, 409]).toContain(responses[1].status);
  expect((await prisma.planningSeries.findUniqueOrThrow({ where: { id: series.id } })).status).toBe('CANCELLED');
  expect(await prisma.sessionBooking.count({ where: { planningSeriesId: series.id, status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] } } })).toBe(0);
});

test('actual active-series revision audits replaced occurrences and keeps their notes', async () => {
  const { series, rows } = await seriesFixture();
  (requireAnyRole as jest.Mock).mockResolvedValue({ user: { id: 'synthetic-core-only-staff', role: 'ASSISTANTE' } });
  const response = await PUT(seriesRequest('PUT', revisionBody), { params: Promise.resolve({ seriesId: series.id }) });
  expect(response.status).toBe(200);
  expect(await prisma.sessionBookingCancellationAudit.count({ where: { sessionBookingId: { in: rows.map(row => row.id) }, action: 'SERIES_REVISED' } })).toBe(2);
  for (const row of rows) expect((await prisma.sessionBooking.findUniqueOrThrow({ where: { id: row.id } })).coachNotes === notes).toBe(true);
  expect(await prisma.sessionBooking.count({ where: { planningSeriesId: series.id, status: 'SCHEDULED' } })).toBe(1);
});
