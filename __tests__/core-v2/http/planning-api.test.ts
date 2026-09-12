/**
 * Planning HTTP surface (§AK) against a real Core v2 database: staff range
 * reads with bounded windows, occurrence cancel/reschedule and series cancel
 * through the routes (envelope + taxonomy), and the self-service planning
 * reads for coach / student / parent scoped by the actor.
 */
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));

import { auth } from '@/auth';
import { NO_PARAMS } from '@/lib/core-v2/http/staff-route';
import { assignCoach, createPlanningSeries } from '@/lib/core-v2/services';
import { seedAcademicYear, seedCoach, setupServiceHarness } from '../helpers/service-harness';
import * as bookings from '@/app/api/v2/staff/planning/bookings/route';
import * as cancelBooking from '@/app/api/v2/staff/planning/bookings/[id]/cancel/route';
import * as rescheduleBooking from '@/app/api/v2/staff/planning/bookings/[id]/reschedule/route';
import * as cancelSeries from '@/app/api/v2/staff/planning/series/[id]/cancel/route';
import * as coachPlanning from '@/app/api/v2/coach/planning/route';
import * as studentPlanning from '@/app/api/v2/student/planning/route';
import * as parentPlanning from '@/app/api/v2/parent/planning/route';

const h = setupServiceHarness();
const mockedAuth = auth as unknown as jest.Mock;

function signInAs(user: { id: string; role: string } | null) {
  mockedAuth.mockResolvedValue(user ? { user: { id: user.id, role: user.role, email: 'x@synthetic.test' }, expires: '2099-01-01' } : null);
}

function req(method: string, path: string, body?: unknown) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
async function json(response: Response) {
  return { status: response.status, body: await response.json() };
}

async function seed() {
  const year = await seedAcademicYear(h.client, 2026);
  const parent = await h.client.user.create({ data: { role: 'PARENT', email: 'amel@synthetic.test', firstName: 'Amel', accountStatus: 'ACTIVE' } });
  const household = await h.client.household.create({ data: { parents: { create: { userId: parent.id, isPrimaryContact: true } } } });
  const studentUser = await h.client.user.create({ data: { role: 'ELEVE', email: 'yasmine@synthetic.test', firstName: 'Yasmine', accountStatus: 'ACTIVE' } });
  const student = await h.client.student.create({ data: { userId: studentUser.id, householdId: household.id } });
  const enrollment = await h.client.studentAcademicYearEnrollment.create({
    data: { studentId: student.id, academicYearId: year.id, status: 'ACTIVE', gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE' },
  });
  await h.client.studentCourseEnrollment.create({ data: { academicYearEnrollmentId: enrollment.id, courseKey: 'maths-premiere', kind: 'SPECIALTY' } });
  const coach = await seedCoach(h.client, 'coach@synthetic.test');
  await h.client.coachCourseCapability.create({ data: { coachId: coach.coachId, courseKey: 'maths-premiere' } });
  const assignment = await assignCoach(h.client, h.ctx(), { coachId: coach.coachId, enrollmentId: enrollment.id, courseKey: 'maths-premiere' });
  const series = await createPlanningSeries(h.client, h.ctx(), {
    assignmentId: assignment.id,
    startDate: new Date('2026-09-15'),
    localStartTime: '18:00',
    localEndTime: '19:00',
    recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU',
    recurrenceCount: 3,
    modality: 'ONLINE',
  });
  return { parent, studentUser, student, coach, assignment, series };
}

const RANGE = 'from=2026-09-01T00:00:00Z&to=2026-10-01T00:00:00Z';

beforeEach(() => signInAs({ id: h.assistante.userId, role: 'ASSISTANTE' }));

describe('staff planning routes', () => {
  test('range read: bounded window, filters, envelope; oversized or inverted ranges are 400', async () => {
    const s = await seed();
    const all = await json(await bookings.GET(req('GET', `/api/v2/staff/planning/bookings?${RANGE}`), NO_PARAMS));
    expect(all.status).toBe(200);
    expect(all.body.data).toHaveLength(3);
    expect(all.body.data[0]).toMatchObject({ status: 'SCHEDULED', courseKey: 'maths-premiere', coach: { id: s.coach.coachId }, student: { id: s.student.id } });
    expect(JSON.stringify(all.body)).not.toMatch(/"password"|sessionVersion|@synthetic\.test/);
    const filtered = await json(await bookings.GET(req('GET', `/api/v2/staff/planning/bookings?${RANGE}&coachId=nobody`), NO_PARAMS));
    expect(filtered.body.data).toHaveLength(0);
    expect((await json(await bookings.GET(req('GET', '/api/v2/staff/planning/bookings?from=2026-01-01&to=2026-12-31'), NO_PARAMS))).status).toBe(400);
    expect((await json(await bookings.GET(req('GET', '/api/v2/staff/planning/bookings?from=2026-10-01&to=2026-09-01'), NO_PARAMS))).status).toBe(400);
    signInAs({ id: s.parent.id, role: 'PARENT' });
    expect((await json(await bookings.GET(req('GET', `/api/v2/staff/planning/bookings?${RANGE}`), NO_PARAMS))).status).toBe(403);
  });

  test('cancel and reschedule one occurrence, then cancel the series (future-only, optimistic)', async () => {
    const s = await seed();
    const list = (await json(await bookings.GET(req('GET', `/api/v2/staff/planning/bookings?${RANGE}`), NO_PARAMS))).body.data as Array<{ id: string }>;

    const cancelled = await json(await cancelBooking.POST(req('POST', '/x', { reason: 'Coach indisponible' }), params(list[0]!.id)));
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');
    expect((await json(await cancelBooking.POST(req('POST', '/x', { reason: 'again' }), params(list[0]!.id)))).status).toBe(409);
    expect((await json(await cancelBooking.POST(req('POST', '/x', {}), params(list[1]!.id)))).status).toBe(400);

    const collide = await json(await rescheduleBooking.POST(req('POST', '/x', { localDate: '2026-09-29', localStartTime: '18:00', localEndTime: '19:00', reason: 'x' }), params(list[1]!.id)));
    expect(collide.status).toBe(409);
    expect(collide.body.error.details.conflicts[0]).toMatchObject({ with: 'COACH' });
    const moved = await json(await rescheduleBooking.POST(req('POST', '/x', { localDate: '2026-09-24', localStartTime: '10:00', localEndTime: '11:00', reason: 'Rattrapage' }), params(list[1]!.id)));
    expect(moved.status).toBe(201);
    expect(moved.body.data).toMatchObject({ overridesBookingId: list[1]!.id, status: 'SCHEDULED' });

    const stale = await json(await cancelSeries.POST(req('POST', '/x', { expectedRevision: 5 }), params(s.series.id)));
    expect(stale.status).toBe(409);
    const done = await json(await cancelSeries.POST(req('POST', '/x', { expectedRevision: 0 }), params(s.series.id)));
    expect(done.status).toBe(200);
    expect(done.body.data.status).toBe('CANCELLED');
    const after = (await json(await bookings.GET(req('GET', `/api/v2/staff/planning/bookings?${RANGE}`), NO_PARAMS))).body.data as Array<{ status: string }>;
    expect(after.map((b) => b.status).sort()).toEqual(['CANCELLED', 'CANCELLED', 'CANCELLED', 'RESCHEDULED']);
  });
});

describe('self-service planning routes', () => {
  test('coach, student and parent read their own bookings; roles cannot cross; ranges are validated', async () => {
    const s = await seed();
    signInAs({ id: s.coach.user.id, role: 'COACH' });
    const coach = await json(await coachPlanning.GET(req('GET', `/api/v2/coach/planning?${RANGE}`), NO_PARAMS));
    expect(coach.status).toBe(200);
    expect(coach.body.data).toHaveLength(3);
    expect(coach.body.data[0].student).toMatchObject({ id: s.student.id, user: { firstName: 'Yasmine' } });
    expect(JSON.stringify(coach.body)).not.toMatch(/@synthetic\.test|phone/);
    expect((await json(await studentPlanning.GET(req('GET', `/api/v2/student/planning?${RANGE}`), NO_PARAMS))).status).toBe(403);

    signInAs({ id: s.studentUser.id, role: 'ELEVE' });
    const student = await json(await studentPlanning.GET(req('GET', `/api/v2/student/planning?${RANGE}`), NO_PARAMS));
    expect(student.body.data).toHaveLength(3);
    expect(student.body.data[0].coach).toMatchObject({ id: s.coach.coachId });
    expect((await json(await coachPlanning.GET(req('GET', `/api/v2/coach/planning?${RANGE}`), NO_PARAMS))).status).toBe(403);

    signInAs({ id: s.parent.id, role: 'PARENT' });
    const parent = await json(await parentPlanning.GET(req('GET', `/api/v2/parent/planning?${RANGE}`), NO_PARAMS));
    expect(parent.body.data).toHaveLength(3);
    expect((await json(await parentPlanning.GET(req('GET', '/api/v2/parent/planning?from=2026-01-01&to=2027-01-01'), NO_PARAMS))).status).toBe(400);

    signInAs({ id: h.parentActor.userId, role: 'PARENT' }); // a parent without a household sees nothing, not an error
    expect((await json(await parentPlanning.GET(req('GET', `/api/v2/parent/planning?${RANGE}`), NO_PARAMS))).body.data).toEqual([]);
    signInAs(null);
    expect((await json(await coachPlanning.GET(req('GET', `/api/v2/coach/planning?${RANGE}`), NO_PARAMS))).status).toBe(401);
  });
});
