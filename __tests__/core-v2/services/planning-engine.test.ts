/**
 * Planning engine (§AK) against a real Core v2 database: recurrence
 * materialization bounded by the academic year, DST-correct instants,
 * exceptions (cancel / reschedule one occurrence), future-only series change
 * and cancellation, the deterministic double-booking pre-check, the database
 * exclusion constraint under a real race, the participant-projection
 * trigger, and authorization.
 */
import {
  assignCoach,
  cancelOccurrence,
  cancelPlanningSeries,
  changePlanningSeries,
  createPlanningSeries,
  createServiceContext,
  rescheduleOccurrence,
} from '@/lib/core-v2/services';
import { LIVE_BOOKING_STATUSES } from '@/lib/core-v2/services/planning';
import { listBookings, listOwnCoachBookings, listOwnHouseholdBookings, listOwnStudentBookings } from '@/lib/core-v2/queries/planning';
import { isCoreV2DomainError } from '@/lib/core-v2/errors';
import { holdOpenTransaction, seedAcademicYear, seedCoach, setupServiceHarness, waitForLockWaiter } from '../helpers/service-harness';

const h = setupServiceHarness();

async function expectDomainError(promise: Promise<unknown>, code: string): Promise<Record<string, unknown> | undefined> {
  try {
    await promise;
  } catch (error) {
    if (isCoreV2DomainError(error) && error.code === code) return error.details;
    throw error;
  }
  throw new Error(`Expected a ${code} domain error.`);
}

/** One family with one student enrolled (ACTIVE) in the 2026 year, one capable coach, one assignment. */
async function seedPlanningContext(options: { startYear?: number; coachEmail?: string; studentEmail?: string } = {}) {
  const startYear = options.startYear ?? 2026;
  const year = (await h.client.academicYear.findFirst({ where: { startYear } })) ?? (await seedAcademicYear(h.client, startYear));
  const parent = await h.client.user.create({ data: { role: 'PARENT', email: `parent-${Math.random().toString(36).slice(2)}@synthetic.test`, firstName: 'Amel', accountStatus: 'ACTIVE' } });
  const household = await h.client.household.create({ data: { parents: { create: { userId: parent.id, isPrimaryContact: true } } } });
  const studentUser = await h.client.user.create({ data: { role: 'ELEVE', email: options.studentEmail ?? `student-${Math.random().toString(36).slice(2)}@synthetic.test`, firstName: 'Yasmine', accountStatus: 'ACTIVE' } });
  const student = await h.client.student.create({ data: { userId: studentUser.id, householdId: household.id } });
  const enrollment = await h.client.studentAcademicYearEnrollment.create({
    data: { studentId: student.id, academicYearId: year.id, status: 'ACTIVE', gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE' },
  });
  await h.client.studentCourseEnrollment.createMany({
    data: [
      { academicYearEnrollmentId: enrollment.id, courseKey: 'maths-premiere', kind: 'SPECIALTY' },
      { academicYearEnrollmentId: enrollment.id, courseKey: 'physique-premiere', kind: 'SPECIALTY' },
    ],
  });
  const coach = await seedCoach(h.client, options.coachEmail ?? `coach-${Math.random().toString(36).slice(2)}@synthetic.test`);
  await h.client.coachCourseCapability.create({ data: { coachId: coach.coachId, courseKey: 'maths-premiere' } });
  const assignment = await assignCoach(h.client, h.ctx(), { coachId: coach.coachId, enrollmentId: enrollment.id, courseKey: 'maths-premiere' });
  return { year, parent, household, studentUser, student, enrollment, coach, assignment };
}

const weeklyTuesday = (assignmentId: string, extra: Record<string, unknown> = {}) => ({
  assignmentId,
  startDate: new Date('2026-09-15'),
  localStartTime: '18:00',
  localEndTime: '19:00',
  recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU',
  modality: 'ONLINE' as const,
  ...extra,
});

describe('materialization', () => {
  test('an open-ended weekly rule is materialized up to the academic year end; instants follow the zone (Europe/Paris DST)', async () => {
    const c = await seedPlanningContext();
    const series = await createPlanningSeries(h.client, h.ctx(), weeklyTuesday(c.assignment.id));
    const bookings = await h.client.sessionBooking.findMany({ where: { planningSeriesId: series.id }, orderBy: { startsAt: 'asc' } });
    // Tuesdays from 2026-09-15 to 2027-07-13 inclusive = 44.
    expect(series.occurrenceCount).toBe(44);
    expect(bookings).toHaveLength(44);
    expect(bookings[0]!.startsAt.toISOString()).toBe('2026-09-15T16:00:00.000Z'); // CEST, UTC+2
    const winter = bookings.find((b) => b.startsAt.toISOString().startsWith('2026-12-15'))!;
    expect(winter.startsAt.toISOString()).toBe('2026-12-15T17:00:00.000Z'); // CET, UTC+1
    const spring = bookings.find((b) => b.startsAt.toISOString().startsWith('2027-03-30'))!;
    expect(spring.startsAt.toISOString()).toBe('2027-03-30T16:00:00.000Z'); // back to CEST after 2027-03-28
    expect(bookings.every((b) => b.coachId === c.coach.coachId && b.studentId === c.student.id && b.status === 'SCHEDULED')).toBe(true);
    expect(bookings[bookings.length - 1]!.startsAt.toISOString()).toBe('2027-07-13T16:00:00.000Z');
    expect(new Set(bookings.map((b) => b.occurrenceKey)).size).toBe(44);
  });

  test('COUNT and UNTIL bound the rule; a rule with no occurrence before the horizon is refused', async () => {
    const c = await seedPlanningContext();
    const counted = await createPlanningSeries(h.client, h.ctx(), weeklyTuesday(c.assignment.id, { recurrenceCount: 3 }));
    expect(counted.occurrenceCount).toBe(3);
    const c2 = await seedPlanningContext();
    const until = await createPlanningSeries(h.client, h.ctx(), weeklyTuesday(c2.assignment.id, { recurrenceUntil: new Date('2026-09-29') }));
    expect(until.occurrenceCount).toBe(3);
    const c3 = await seedPlanningContext();
    await expectDomainError(
      createPlanningSeries(h.client, h.ctx(), weeklyTuesday(c3.assignment.id, { startDate: new Date('2027-08-01') })),
      'VALIDATION',
    );
    expect(await h.client.planningSeries.count({ where: { assignmentId: c3.assignment.id } })).toBe(0); // transaction rolled back
  });

  test('planning requires PLANNING_MANAGE and an ACTIVE assignment', async () => {
    const c = await seedPlanningContext();
    await expectDomainError(createPlanningSeries(h.client, h.ctx(h.parentActor), weeklyTuesday(c.assignment.id)), 'FORBIDDEN');
    await expectDomainError(
      createPlanningSeries(h.client, createServiceContext({ userId: c.coach.user.id, role: 'COACH' }), weeklyTuesday(c.assignment.id)),
      'FORBIDDEN',
    );
    await h.client.coachStudentCourseAssignment.update({ where: { id: c.assignment.id }, data: { status: 'ENDED', endsAt: new Date() } });
    await expectDomainError(createPlanningSeries(h.client, h.ctx(), weeklyTuesday(c.assignment.id)), 'INVALID_STATE');
  });
});

describe('double booking', () => {
  test('pre-check: a second series on the same coach slot is refused with the colliding occurrences listed (student differs)', async () => {
    const a = await seedPlanningContext({ coachEmail: 'shared-coach@synthetic.test' });
    await createPlanningSeries(h.client, h.ctx(), weeklyTuesday(a.assignment.id, { recurrenceCount: 4 }));
    // Same coach, another family/student.
    const b = await seedPlanningContext();
    const assignmentB = await assignCoach(h.client, h.ctx(), { coachId: a.coach.coachId, enrollmentId: b.enrollment.id, courseKey: 'maths-premiere' });
    const details = await expectDomainError(
      createPlanningSeries(h.client, h.ctx(), { ...weeklyTuesday(assignmentB.id, { recurrenceCount: 2 }), localStartTime: '18:30', localEndTime: '19:30' }),
      'CONFLICT',
    );
    expect(details).toMatchObject({ conflictCount: 2 });
    expect((details!.conflicts as Array<{ with: string; localDate: string }>)[0]).toMatchObject({ with: 'COACH', localDate: '2026-09-15' });
    expect(await h.client.planningSeries.count({ where: { assignmentId: assignmentB.id } })).toBe(0);

    // A non-overlapping slot for the same coach is fine; so is the same slot once the first series is cancelled.
    const ok = await createPlanningSeries(h.client, h.ctx(), { ...weeklyTuesday(assignmentB.id, { recurrenceCount: 2 }), localStartTime: '19:00', localEndTime: '20:00' });
    expect(ok.occurrenceCount).toBe(2);
  });

  test('pre-check: the same student with two coaches cannot be in two places', async () => {
    const c = await seedPlanningContext();
    await createPlanningSeries(h.client, h.ctx(), weeklyTuesday(c.assignment.id, { recurrenceCount: 2 }));
    const other = await seedCoach(h.client, 'other-coach@synthetic.test');
    await h.client.coachCourseCapability.create({ data: { coachId: other.coachId, courseKey: 'physique-premiere' } });
    const assignment2 = await assignCoach(h.client, h.ctx(), { coachId: other.coachId, enrollmentId: c.enrollment.id, courseKey: 'physique-premiere' });
    const details = await expectDomainError(createPlanningSeries(h.client, h.ctx(), weeklyTuesday(assignment2.id, { recurrenceCount: 1 })), 'CONFLICT');
    expect((details!.conflicts as Array<{ with: string }>)[0]!.with).toBe('STUDENT');
  });

  test('race: two writers passing the pre-check concurrently — the database exclusion constraint lets exactly one commit', async () => {
    const a = await seedPlanningContext({ coachEmail: 'raced-coach@synthetic.test' });
    const b = await seedPlanningContext();
    const assignmentB = await assignCoach(h.client, h.ctx(), { coachId: a.coach.coachId, enrollmentId: b.enrollment.id, courseKey: 'maths-premiere' });

    // Writer 1 inserts the slot and holds its transaction open (uncommitted), so writer 2's
    // pre-check sees nothing and its INSERT must wait on the exclusion constraint.
    const held = await holdOpenTransaction(h.client, async (tx) => {
      await tx.sessionBooking.create({
        data: {
          assignmentId: a.assignment.id,
          coachId: a.coach.coachId,
          studentId: a.student.id,
          startsAt: new Date('2026-09-15T16:00:00Z'),
          endsAt: new Date('2026-09-15T17:00:00Z'),
        },
      });
    });
    const writer2 = createPlanningSeries(h.client, h.ctx(), weeklyTuesday(assignmentB.id, { recurrenceCount: 1 })).then(
      () => 'ok' as const,
      (error: unknown) => (isCoreV2DomainError(error) ? error.code : 'unexpected'),
    );
    await waitForLockWaiter(h.client);
    await held.release();
    expect(await writer2).toBe('CONFLICT');
    expect(await h.client.planningSeries.count({ where: { assignmentId: assignmentB.id } })).toBe(0);
    const live = await h.client.sessionBooking.count({ where: { coachId: a.coach.coachId, status: { in: [...LIVE_BOOKING_STATUSES] } } });
    expect(live).toBe(1);
  });

  test('the database refuses a booking whose participants disagree with its assignment (projection trigger)', async () => {
    const c = await seedPlanningContext();
    const stranger = await seedCoach(h.client, 'stranger@synthetic.test');
    await expect(
      h.client.sessionBooking.create({
        data: { assignmentId: c.assignment.id, coachId: stranger.coachId, studentId: c.student.id, startsAt: new Date('2026-10-01T10:00:00Z'), endsAt: new Date('2026-10-01T11:00:00Z') },
      }),
    ).rejects.toThrow(/do not match assignment/);
  });
});

describe('exceptions and series changes', () => {
  test('cancel one occurrence: the slot is freed, the series continues, the audit names the reason', async () => {
    const c = await seedPlanningContext();
    const series = await createPlanningSeries(h.client, h.ctx(), weeklyTuesday(c.assignment.id, { recurrenceCount: 3 }));
    const [first] = await h.client.sessionBooking.findMany({ where: { planningSeriesId: series.id }, orderBy: { startsAt: 'asc' } });
    const cancelled = await cancelOccurrence(h.client, h.ctx(), { bookingId: first!.id, reason: 'Coach indisponible' });
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelledAt).not.toBeNull();
    await expectDomainError(cancelOccurrence(h.client, h.ctx(), { bookingId: first!.id, reason: 'again' }), 'INVALID_STATE');
    expect(await h.client.sessionBooking.count({ where: { planningSeriesId: series.id, status: 'SCHEDULED' } })).toBe(2);
    const audit = await h.client.auditEvent.findFirst({ where: { subjectId: first!.id, action: 'planning.occurrence_cancelled' } });
    expect(audit?.metadata).toMatchObject({ reason: 'Coach indisponible' });
    // The freed slot can be used by another series of the same coach.
    const other = await seedPlanningContext();
    const assignment2 = await assignCoach(h.client, h.ctx(), { coachId: c.coach.coachId, enrollmentId: other.enrollment.id, courseKey: 'maths-premiere' });
    expect((await createPlanningSeries(h.client, h.ctx(), weeklyTuesday(assignment2.id, { recurrenceCount: 1 }))).occurrenceCount).toBe(1);
  });

  test('reschedule one occurrence: original → RESCHEDULED, replacement overrides it in the series zone; conflicts refused', async () => {
    const c = await seedPlanningContext();
    const series = await createPlanningSeries(h.client, h.ctx(), weeklyTuesday(c.assignment.id, { recurrenceCount: 2 }));
    const [first, second] = await h.client.sessionBooking.findMany({ where: { planningSeriesId: series.id }, orderBy: { startsAt: 'asc' } });
    // Moving onto the second occurrence's slot collides with the student herself.
    await expectDomainError(
      rescheduleOccurrence(h.client, h.ctx(), { bookingId: first!.id, localDate: '2026-09-22', localStartTime: '18:00', localEndTime: '19:00', reason: 'x' }),
      'CONFLICT',
    );
    const replacement = await rescheduleOccurrence(h.client, h.ctx(), { bookingId: first!.id, localDate: '2026-09-17', localStartTime: '10:00', localEndTime: '11:00', reason: 'Rattrapage' });
    expect(replacement.overridesBookingId).toBe(first!.id);
    expect(replacement.planningSeriesId).toBe(series.id);
    expect(replacement.occurrenceKey).toBeNull();
    expect(replacement.startsAt.toISOString()).toBe('2026-09-17T08:00:00.000Z'); // Europe/Paris CEST
    expect((await h.client.sessionBooking.findUniqueOrThrow({ where: { id: first!.id } })).status).toBe('RESCHEDULED');
    expect(second!.status).toBe('SCHEDULED');
    await expectDomainError(
      rescheduleOccurrence(h.client, h.ctx(), { bookingId: first!.id, localDate: '2026-09-18', localStartTime: '10:00', localEndTime: '11:00', reason: 'x' }),
      'INVALID_STATE',
    );
  });

  test('a schedule change is future-only: past occurrences stay, live future ones are re-materialized under the new revision', async () => {
    const c = await seedPlanningContext();
    const series = await createPlanningSeries(h.client, h.ctx(), weeklyTuesday(c.assignment.id, { recurrenceCount: 4 }));
    // "Now" is between the 2nd and the 3rd occurrence.
    const now = () => new Date('2026-09-25T12:00:00Z');
    const changed = await changePlanningSeries(h.client, createServiceContext(h.admin, { now }), {
      seriesId: series.id,
      expectedRevision: 0,
      changes: { localStartTime: '17:00', localEndTime: '18:00' },
    });
    expect(changed.revision).toBe(1);
    const rows = await h.client.sessionBooking.findMany({ where: { planningSeriesId: series.id }, orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }] });
    const live = rows.filter((r) => r.status === 'SCHEDULED');
    const superseded = rows.filter((r) => r.status === 'CANCELLED');
    expect(live.map((r) => r.startsAt.toISOString())).toEqual([
      '2026-09-15T16:00:00.000Z', // past, untouched (18:00 CEST)
      '2026-09-22T16:00:00.000Z', // past, untouched
      '2026-09-29T15:00:00.000Z', // new time 17:00 CEST
      '2026-10-06T15:00:00.000Z',
    ]);
    expect(superseded).toHaveLength(2);
    expect(live.slice(2).every((r) => r.occurrenceKey?.includes(':r1:'))).toBe(true);
    const actions = (await h.client.auditEvent.findMany({ where: { subjectId: series.id }, orderBy: { createdAt: 'asc' } })).map((a) => a.action);
    expect(actions).toEqual(['planning.series_created', 'planning.occurrences_materialized', 'planning.series_changed', 'planning.occurrences_materialized']);
  });

  test('cancelling a series is future-only, optimistic, and final', async () => {
    const c = await seedPlanningContext();
    const series = await createPlanningSeries(h.client, h.ctx(), weeklyTuesday(c.assignment.id, { recurrenceCount: 4 }));
    const now = () => new Date('2026-09-25T12:00:00Z');
    await expectDomainError(cancelPlanningSeries(h.client, createServiceContext(h.admin, { now }), { seriesId: series.id, expectedRevision: 7 }), 'CONFLICT');
    const cancelled = await cancelPlanningSeries(h.client, createServiceContext(h.admin, { now }), { seriesId: series.id, expectedRevision: 0 });
    expect(cancelled.status).toBe('CANCELLED');
    const rows = await h.client.sessionBooking.findMany({ where: { planningSeriesId: series.id }, orderBy: { startsAt: 'asc' } });
    expect(rows.map((r) => r.status)).toEqual(['SCHEDULED', 'SCHEDULED', 'CANCELLED', 'CANCELLED']);
    await expectDomainError(changePlanningSeries(h.client, h.ctx(), { seriesId: series.id, expectedRevision: 1, changes: { localEndTime: '20:00' } }), 'INVALID_STATE');
    const audit = await h.client.auditEvent.findFirst({ where: { subjectId: series.id, action: 'planning.series_cancelled' } });
    expect(audit?.metadata).toMatchObject({ status: 'CANCELLED', cancelledOccurrences: 2 });
  });
});

describe('read scopes', () => {
  test('staff read any range; a coach, a student and a parent read only their own bookings', async () => {
    const a = await seedPlanningContext({ coachEmail: 'coach-a@synthetic.test' });
    const b = await seedPlanningContext({ coachEmail: 'coach-b@synthetic.test' });
    await createPlanningSeries(h.client, h.ctx(), weeklyTuesday(a.assignment.id, { recurrenceCount: 2 }));
    await createPlanningSeries(h.client, h.ctx(), { ...weeklyTuesday(b.assignment.id, { recurrenceCount: 2 }), localStartTime: '10:00', localEndTime: '11:00' });
    const range = { from: new Date('2026-09-01T00:00:00Z'), to: new Date('2026-10-01T00:00:00Z') };

    const staff = await listBookings(h.client, h.ctx(h.assistante), range);
    expect(staff).toHaveLength(4);
    expect(await listBookings(h.client, h.ctx(), { ...range, coachId: a.coach.coachId })).toHaveLength(2);
    await expectDomainError(listBookings(h.client, h.ctx(h.parentActor), range), 'FORBIDDEN');

    const coachA = await listOwnCoachBookings(h.client, createServiceContext({ userId: a.coach.user.id, role: 'COACH' }), range);
    expect(coachA.map((x) => x.student.id)).toEqual([a.student.id, a.student.id]);
    expect(JSON.stringify(coachA)).not.toMatch(/password|email|phone/);

    const studentB = await listOwnStudentBookings(h.client, createServiceContext({ userId: b.studentUser.id, role: 'ELEVE' }), range);
    expect(studentB.map((x) => x.coach.id)).toEqual([b.coach.coachId, b.coach.coachId]);

    const parentA = await listOwnHouseholdBookings(h.client, createServiceContext({ userId: a.parent.id, role: 'PARENT' }), range);
    expect(parentA).toHaveLength(2);
    expect(parentA.every((x) => x.student.id === a.student.id)).toBe(true);

    await expectDomainError(listOwnCoachBookings(h.client, createServiceContext({ userId: a.parent.id, role: 'PARENT' }), range), 'FORBIDDEN');
    expect(await listOwnStudentBookings(h.client, createServiceContext({ userId: h.parentActor.userId, role: 'ELEVE' }), range)).toEqual([]);
  });
});
