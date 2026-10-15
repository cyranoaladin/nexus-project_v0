import { createServiceContext, endCoachAssignment, withdrawEnrollment, createPlanningSeries, rescheduleOccurrence, changePlanningSeries, cancelOccurrence } from '@/lib/core-v2/services';
import type { PrismaClient } from '@/core-v2/generated/client';
import { loadPlanningParticipants, materializeSeriesOccurrences } from '@/lib/core-v2/services/planning';
import { getOwnCoach } from '@/lib/core-v2/queries/coach';
import { listOwnCoachBookings } from '@/lib/core-v2/queries/planning';
import { holdOpenTransaction, seedAcademicYear, seedCoach, setupServiceHarness, waitForLockWaiter } from '../helpers/service-harness';
const h = setupServiceHarness();
const at = new Date('2026-10-12T12:00:00Z');
const staff = () => createServiceContext(h.admin, { now: () => at });
const range = { from: new Date('2026-09-01'), to: new Date('2026-11-30') };
const snapshot = () => h.client.$queryRawUnsafe(`SELECT table_name, (xpath('/row/fingerprint/text()', query_to_xml(format('SELECT md5(coalesce(string_agg(row_to_json(t)::text, %L ORDER BY row_to_json(t)::text), %L)) AS fingerprint FROM %I t', '', '', table_name), false, true, '')))[1]::text AS fingerprint FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`);
async function fixture() {
  const year = await seedAcademicYear(h.client, 2026);
  const user = await h.client.user.create({ data: { role: 'ELEVE', firstName: 'Private-current-name', accountStatus: 'ACTIVE' } });
  const household = await h.client.household.create({ data: {} });
  const student = await h.client.student.create({ data: { userId: user.id, householdId: household.id } });
  const enrollment = await h.client.studentAcademicYearEnrollment.create({ data: { studentId: student.id, academicYearId: year.id,
    status: 'ACTIVE', gradeLevel: 'PREMIERE' } });
  const coach = await seedCoach(h.client, 'closure-coach@synthetic.test');
  const assignment = await h.client.coachStudentCourseAssignment.create({ data: { coachId: coach.coachId,
    academicYearEnrollmentId: enrollment.id, courseKey: 'maths-premiere', startsAt: new Date('2026-09-01') } });
  const ctx = createServiceContext({ userId: coach.user.id, role: 'COACH' }, { now: () => at });
  const series = await createPlanningSeries(h.client, staff(), { assignmentId: assignment.id, startDate: new Date('2026-10-13'),
    localStartTime: '10:00', localEndTime: '11:00', recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU', recurrenceCount: 2, modality: 'ONLINE' });
  const future = await h.client.sessionBooking.findFirstOrThrow({ where: { planningSeriesId: series.id }, orderBy: { startsAt: 'asc' } });
  const override = await h.client.sessionBooking.create({ data: { assignmentId: assignment.id, coachId: coach.coachId,
    studentId: student.id, startsAt: new Date('2026-10-15T13:00Z'), endsAt: new Date('2026-10-15T14:00Z'), planningSeriesId: null } });
  const delivered = await h.client.sessionBooking.create({ data: { assignmentId: assignment.id, coachId: coach.coachId,
    studentId: student.id, startsAt: new Date('2026-09-22T13:00Z'), endsAt: new Date('2026-09-22T14:00Z'),
    status: 'COMPLETED', completedAt: new Date('2026-09-22T14:01Z') } });
  return { year, user, student, enrollment, coach, assignment, ctx, series, future, override, delivered };
}
test.each(['create', 'change', 'resume', 'reschedule'] as const)('%s cannot reserve outside the authoritative assignment window and rolls back every table', async operation => {
  const f = await fixture();
  if (operation === 'resume') await changePlanningSeries(h.client, staff(), { seriesId: f.series.id, expectedRevision: 0, changes: { status: 'PAUSED' } });
  await h.client.coachStudentCourseAssignment.update({ where: { id: f.assignment.id }, data: { endsAt: new Date('2026-10-12T13:00Z') } });
  const before = await snapshot();
  const action = operation === 'create' ? createPlanningSeries(h.client, staff(), { assignmentId: f.assignment.id, startDate: new Date('2026-10-16'),
    localStartTime: '10:00', localEndTime: '11:00', recurrenceRule: 'FREQ=DAILY', recurrenceCount: 1, modality: 'ONLINE' })
    : operation === 'reschedule' ? rescheduleOccurrence(h.client, staff(), { bookingId: f.future.id, localDate: '2026-10-16', localStartTime: '10:00', localEndTime: '11:00', reason: 'Synthetic window' })
    : changePlanningSeries(h.client, staff(), { seriesId: f.series.id, expectedRevision: operation === 'resume' ? 1 : 0,
      changes: operation === 'resume' ? { status: 'ACTIVE' } : { localStartTime: '11:00', localEndTime: '12:00' } });
  await expect(action).rejects.toMatchObject({ code: expect.stringMatching(/INVALID_STATE|VALIDATION/) });
  expect(await snapshot()).toEqual(before);
});
test.each(['assignment-start', 'assignment-end', 'year-start', 'year-end', 'suspended-student'] as const)('reschedule rejects %s including intervals crossing the exact UTC bound', async change => {
  const f = await fixture();
  if (change === 'assignment-start') await h.client.coachStudentCourseAssignment.update({ where: { id: f.assignment.id }, data: { startsAt: new Date('2026-10-16T09:00Z') } });
  if (change === 'assignment-end') await h.client.coachStudentCourseAssignment.update({ where: { id: f.assignment.id }, data: { endsAt: new Date('2026-10-16T08:30Z') } });
  if (change === 'year-start') await h.client.academicYear.update({ where: { id: f.year.id }, data: { startsAt: new Date('2026-10-16T09:00Z') } });
  if (change === 'year-end') await h.client.academicYear.update({ where: { id: f.year.id }, data: { endsAt: new Date('2026-10-16T08:30Z') } });
  if (change === 'suspended-student') await h.client.user.update({ where: { id: f.user.id }, data: { accountStatus: 'SUSPENDED' } });
  const before = await snapshot();
  await expect(rescheduleOccurrence(h.client, staff(), { bookingId: f.future.id, localDate: '2026-10-16', localStartTime: '10:00', localEndTime: '11:00', reason: 'Synthetic bound' })).rejects.toMatchObject({ code: 'INVALID_STATE' });
  expect(await snapshot()).toEqual(before);
});
test('a future assignment accepts only complete future intervals within its exact window', async () => {
  const f = await fixture();
  await h.client.coachStudentCourseAssignment.update({ where: { id: f.assignment.id }, data: { startsAt: new Date('2026-11-01T09:00Z'), endsAt: new Date('2026-11-01T10:00Z') } });
  const series = await createPlanningSeries(h.client, staff(), { assignmentId: f.assignment.id, startDate: new Date('2026-11-01'),
    localStartTime: '10:00', localEndTime: '11:00', recurrenceRule: 'FREQ=DAILY', recurrenceCount: 3, modality: 'ONLINE' });
  expect(series.occurrenceCount).toBe(1);
  expect(await h.client.sessionBooking.findMany({ where: { planningSeriesId: series.id }, select: { startsAt: true, endsAt: true } })).toEqual([
    { startsAt: new Date('2026-11-01T09:00Z'), endsAt: new Date('2026-11-01T10:00Z') }]);
});
test.each(['within', 'crossing'] as const)('a recurrence uses its own local end day while enforcing the exact UTC %s bound', async position => {
  const f = await fixture(); const old = process.env.CORE_V2_ORGANIZATION_TIMEZONE;
  process.env.CORE_V2_ORGANIZATION_TIMEZONE = 'Africa/Tunis';
  await h.client.academicYear.update({ where: { id: f.year.id }, data: { endsAt: new Date('2027-07-15T23:30Z') } });
  const before = await snapshot();
  try {
    const action = createPlanningSeries(h.client, staff(), { assignmentId: f.assignment.id, startDate: new Date('2027-07-16'),
      localStartTime: position === 'within' ? '00:00' : '00:20', localEndTime: position === 'within' ? '00:20' : '00:40',
      recurrenceRule: 'FREQ=DAILY', recurrenceCount: 1, modality: 'ONLINE' });
    if (position === 'crossing') { await expect(action).rejects.toMatchObject({ code: 'VALIDATION' }); expect(await snapshot()).toEqual(before); }
    else { const series = await action; expect(series.occurrenceCount).toBe(1);
      expect(await h.client.sessionBooking.findMany({ where: { planningSeriesId: series.id }, select: { startsAt: true, endsAt: true } })).toEqual([
        { startsAt: new Date('2027-07-15T23:00Z'), endsAt: new Date('2027-07-15T23:20Z') }]); }
  } finally { if (old === undefined) delete process.env.CORE_V2_ORGANIZATION_TIMEZONE; else process.env.CORE_V2_ORGANIZATION_TIMEZONE = old; }
});
test.each(['cancel', 'reschedule'] as const)('%s refuses an occurrence that has already started with no mutation', async operation => {
  const f = await fixture();
  const now = createServiceContext(h.admin, { now: () => new Date(f.future.startsAt.getTime() + 1) });
  const before = await snapshot();
  await expect(operation === 'cancel' ? cancelOccurrence(h.client, now, { bookingId: f.future.id, reason: 'Synthetic started' })
    : rescheduleOccurrence(h.client, now, { bookingId: f.future.id, localDate: '2026-10-16', localStartTime: '10:00', localEndTime: '11:00', reason: 'Synthetic started' })).rejects.toMatchObject({ code: 'INVALID_STATE' });
  expect(await snapshot()).toEqual(before);
});
test('reschedule refuses a replacement in the past with no mutation', async () => {
  const f = await fixture(); const before = await snapshot();
  await expect(rescheduleOccurrence(h.client, staff(), { bookingId: f.future.id, localDate: '2026-10-12', localStartTime: '10:00', localEndTime: '11:00', reason: 'Synthetic past' })).rejects.toMatchObject({ code: 'INVALID_STATE' });
  expect(await snapshot()).toEqual(before);
});
test.each([1, 2])('the final activation check cannot hide a newly started occurrence with a fresh WHERE cutoff with COUNT=%i', async count => {
  const f = await fixture(); const before = await snapshot(); let reads = 0;
  const initial = new Date(f.future.startsAt.getTime() - 1);
  const context = createServiceContext(h.admin, { now: () => ++reads <= 4 ? initial : f.future.startsAt });
  await expect(changePlanningSeries(h.client, context, { seriesId: f.series.id, expectedRevision: 0,
    changes: { recurrenceCount: count } })).rejects.toMatchObject({ code: 'INVALID_STATE' });
  expect(reads).toBeGreaterThanOrEqual(5);
  expect(await snapshot()).toEqual(before);
});
test('the migrator materializer uses the exact instant and excludes the morning of the same day', async () => {
  const f = await fixture();
  const series = await h.client.planningSeries.create({ data: { assignmentId: f.assignment.id, timezone: 'Europe/Paris',
    startDate: new Date('2026-10-12'), localStartTime: '11:00', localEndTime: '12:00', recurrenceRule: 'FREQ=DAILY', recurrenceCount: 2,
    modality: 'ONLINE', createdById: h.admin.userId } });
  const count = await h.client.$transaction(async tx => materializeSeriesOccurrences(tx, staff(), series,
    await loadPlanningParticipants(tx, f.assignment.id)));
  expect(count).toBe(1);
  expect(await h.client.sessionBooking.count({ where: { planningSeriesId: series.id, startsAt: { lt: at } } })).toBe(0);
});
test('termination samples its cutoff after the real mutex wait and preserves a session that began during it', async () => {
  const f = await fixture(); let clock = new Date('2026-10-12T10:00Z');
  const begun = await h.client.sessionBooking.create({ data: { assignmentId: f.assignment.id, coachId: f.coach.coachId,
    studentId: f.student.id, startsAt: new Date('2026-10-12T10:02Z'), endsAt: new Date('2026-10-12T11:00Z'), status: 'IN_PROGRESS' } });
  const held = await holdOpenTransaction(h.client, async tx => { await tx.$executeRaw`SELECT pg_advisory_xact_lock(4242, 1026)`; });
  const ending = endCoachAssignment(h.client, createServiceContext(h.admin, { now: () => clock }), f.assignment.id);
  try { await waitForLockWaiter(h.client); clock = new Date('2026-10-12T10:05Z'); } finally { await held.release(); }
  expect((await ending).endsAt).toEqual(clock);
  expect(await h.client.sessionBooking.findUniqueOrThrow({ where: { id: begun.id } })).toEqual(begun);
  expect((await h.client.sessionBooking.findUniqueOrThrow({ where: { id: f.future.id } })).cancelledAt).toEqual(clock);
});
test.each(['end', 'withdraw', 'pause', 'cancel', 'change'] as const)('%s preserves a session starting exactly at the locked cutoff', async operation => {
  const f = await fixture();
  const started = await h.client.sessionBooking.update({ where: { id: f.future.id }, data: { status: 'IN_PROGRESS' } });
  const context = createServiceContext(h.admin, { now: () => started.startsAt });
  if (operation === 'end') await endCoachAssignment(h.client, context, f.assignment.id);
  else if (operation === 'withdraw') await withdrawEnrollment(h.client, context, f.enrollment.id);
  else await changePlanningSeries(h.client, context, { seriesId: f.series.id, expectedRevision: 0,
    changes: operation === 'change' ? { localStartTime: '12:00', localEndTime: '13:00' } : { status: operation === 'pause' ? 'PAUSED' : 'CANCELLED' } });
  expect(await h.client.sessionBooking.findUniqueOrThrow({ where: { id: started.id } })).toEqual(started);
  if (operation === 'change') expect(await h.client.sessionBooking.count({ where: { planningSeriesId: f.series.id,
    occurrenceKey: { contains: ':r1:2026-10-13' } } })).toBe(0);
});
test.each(['dossier', 'bookings'] as const)('%s rechecks natural assignment expiry after its final database read before publishing names', async operation => {
  const f = await fixture(); let clock = at;
  const expiry = new Date(at.getTime() + 1);
  await h.client.coachStudentCourseAssignment.update({ where: { id: f.assignment.id }, data: { endsAt: expiry } });
  // Keep one valid booking ending within the assignment, so the test cannot
  // pass merely because the occurrence window was rejected before expiry.
  await h.client.sessionBooking.update({ where: { id: f.future.id }, data: { startsAt: new Date(at.getTime() - 7200000), endsAt: new Date(at.getTime() - 3600000) } });
  const reader = h.client.$extends({ query: { coachProfile: { async findUnique({ args, query }) {
    const row = await query(args); if (operation === 'dossier') clock = expiry; return row;
  } }, sessionBooking: { async findMany({ args, query }) {
    const rows = await query(args); if (operation === 'bookings' && args.select) clock = expiry; return rows;
  } } } }) as unknown as PrismaClient;
  const context = createServiceContext({ userId: f.coach.user.id, role: 'COACH' }, { now: () => clock });
  if (operation === 'dossier') expect((await getOwnCoach(reader, context))?.assignments).toEqual([]);
  else expect(await listOwnCoachBookings(reader, context, range)).toEqual([{ kind: 'DELIVERED', id: f.delivered.id,
    status: 'COMPLETED', startsAt: f.delivered.startsAt, endsAt: f.delivered.endsAt, completedAt: f.delivered.completedAt }]);
});
test.each(['end', 'withdraw'] as const)('%s closes the dossier and cancels all future slots, including detached overrides, atomically', async operation => {
  const f = await fixture();
  if (operation === 'end') await endCoachAssignment(h.client, staff(), f.assignment.id);
  else await withdrawEnrollment(h.client, staff(), f.enrollment.id);
  expect(await h.client.coachStudentCourseAssignment.findUniqueOrThrow({ where: { id: f.assignment.id } })).toMatchObject({ status: 'ENDED', endsAt: at });
  expect(await h.client.planningSeries.findUniqueOrThrow({ where: { id: f.series.id } })).toMatchObject({ status: 'ENDED', revision: 1 });
  const cancelled = await h.client.sessionBooking.findMany({ where: { assignmentId: f.assignment.id, startsAt: { gte: at } } });
  expect(cancelled).toHaveLength(3);
  expect(cancelled.every(row => row.status === 'CANCELLED' && row.cancelledAt?.getTime() === at.getTime())).toBe(true);
  expect(await h.client.sessionBooking.findUniqueOrThrow({ where: { id: f.delivered.id } })).toEqual(f.delivered);
  expect((await getOwnCoach(h.client, f.ctx))?.assignments).toEqual([]);
});
test('a terminated assignment leaves only the personally delivered scalar record, without mutable student or enrollment data', async () => {
  const f = await fixture(); await endCoachAssignment(h.client, staff(), f.assignment.id);
  const first = await listOwnCoachBookings(h.client, f.ctx, range);
  expect(first).toEqual([{ kind: 'DELIVERED', id: f.delivered.id, status: 'COMPLETED', startsAt: f.delivered.startsAt,
    endsAt: f.delivered.endsAt, completedAt: f.delivered.completedAt }]);
  await h.client.user.update({ where: { id: f.user.id }, data: { firstName: 'Mutated-private-name' } });
  await h.client.studentAcademicYearEnrollment.update({ where: { id: f.enrollment.id }, data: { gradeLevel: 'TERMINALE' } });
  expect(await listOwnCoachBookings(h.client, f.ctx, range)).toEqual(first);
  const other = await seedCoach(h.client, 'unrelated-closure@synthetic.test');
  expect(await listOwnCoachBookings(h.client, createServiceContext({ userId: other.user.id, role: 'COACH' }), range)).toEqual([]);
});
test.each(['ended', 'future-start', 'elapsed', 'withdrawn', 'closed-year', 'suspended-student'] as const)('current coach dossier and upcoming data refuse %s authority', async change => {
  const f = await fixture();
  if (change === 'ended') await h.client.coachStudentCourseAssignment.update({ where: { id: f.assignment.id }, data: { status: 'ENDED', endsAt: at } });
  if (change === 'future-start') await h.client.coachStudentCourseAssignment.update({ where: { id: f.assignment.id }, data: { startsAt: new Date('2026-11-01') } });
  if (change === 'elapsed') await h.client.coachStudentCourseAssignment.update({ where: { id: f.assignment.id }, data: { endsAt: new Date('2026-10-01') } });
  if (change === 'withdrawn') await h.client.studentAcademicYearEnrollment.update({ where: { id: f.enrollment.id }, data: { status: 'WITHDRAWN' } });
  if (change === 'closed-year') await h.client.academicYear.update({ where: { id: f.year.id }, data: { status: 'CLOSED' } });
  if (change === 'suspended-student') await h.client.user.update({ where: { id: f.user.id }, data: { accountStatus: 'SUSPENDED' } });
  expect((await getOwnCoach(h.client, f.ctx))?.assignments).toEqual([]);
  const rows = await listOwnCoachBookings(h.client, f.ctx, range);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toHaveProperty('kind', 'DELIVERED');
});
test('rescheduling refuses an ended assignment even when a historical live booking survived', async () => {
  const f = await fixture();
  await h.client.coachStudentCourseAssignment.update({ where: { id: f.assignment.id }, data: { status: 'ENDED', endsAt: at } });
  const before = await h.client.sessionBooking.findMany({ orderBy: { id: 'asc' } });
  await expect(rescheduleOccurrence(h.client, staff(), { bookingId: f.future.id, localDate: '2026-10-16',
    localStartTime: '10:00', localEndTime: '11:00', reason: 'Synthetic closure' })).rejects.toMatchObject({ code: 'INVALID_STATE' });
  expect(await h.client.sessionBooking.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
});
test('future bookings outside the still-active assignment window do not expose student data', async () => {
  const f = await fixture();
  await h.client.coachStudentCourseAssignment.update({ where: { id: f.assignment.id }, data: { endsAt: new Date('2026-10-14') } });
  const rows = await listOwnCoachBookings(h.client, f.ctx, range);
  expect(rows.map(row => row.id).sort()).toEqual([f.delivered.id, f.future.id].sort());
});
test.each(['create', 'reschedule'] as const)('termination wins a real race against %s and cannot leave a live future slot', async operation => {
  const f = await fixture();
  const held = await holdOpenTransaction(h.client, async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(4242, 1026)`;
    await tx.$queryRaw`SELECT id FROM public.coach_student_course_assignments WHERE id = ${f.assignment.id} FOR UPDATE`;
  });
  const ending = endCoachAssignment(h.client, staff(), f.assignment.id).then(() => 'ENDED');
  const writer = (operation === 'create' ? createPlanningSeries(h.client, staff(), { assignmentId: f.assignment.id,
    startDate: new Date('2026-10-16'), localStartTime: '15:00', localEndTime: '16:00', recurrenceRule: 'FREQ=DAILY', recurrenceCount: 1, modality: 'ONLINE' })
    : rescheduleOccurrence(h.client, staff(), { bookingId: f.future.id, localDate: '2026-10-16', localStartTime: '10:00', localEndTime: '11:00', reason: 'Synthetic race' }))
    .then(() => 'WRITTEN', (error: unknown) => (error as { code?: string }).code ?? 'UNEXPECTED');
  try { await waitForLockWaiter(h.client); } finally { await held.release(); }
  expect(await ending).toBe('ENDED');
  expect(['WRITTEN', 'INVALID_STATE']).toContain(await writer);
  expect(await h.client.sessionBooking.count({ where: { assignmentId: f.assignment.id,
    startsAt: { gte: at }, status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] } } })).toBe(0);
});
