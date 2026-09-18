/**
 * The golden staff workflow (§AF) executed end to end through the canonical
 * services against a real Core v2 database, with the audit trail asserted at
 * every step, plus the RBAC boundary between ADMIN and ASSISTANTE (§Y).
 */
import { CoreV2DomainError } from '@/lib/core-v2/errors';
import {
  approveEnrollment,
  assignCoach,
  attachExistingParent,
  changePlanningSeries,
  closeAcademicYear,
  correctParentContact,
  correctStudentIdentity,
  createAcademicYear,
  createAnnualEnrollment,
  createHousehold,
  createParent,
  createPlanningSeries,
  createStudent,
  endCoachAssignment,
  inviteAccount,
  setAcademicMap,
  setCoachCapability,
  setCourseEnrollments,
  setCurrentAcademicYear,
  setPrimaryContact,
  suspendAccount,
  withdrawEnrollment,
} from '@/lib/core-v2/services';
import { academicYearDates } from '../helpers/fixtures';
import { auditTrail, seedCoach, setupServiceHarness } from '../helpers/service-harness';

const h = setupServiceHarness();

async function expectDomainError(promise: Promise<unknown>, code: CoreV2DomainError['code']) {
  await expect(promise).rejects.toBeInstanceOf(CoreV2DomainError);
  await promise.catch((error: CoreV2DomainError) => expect(error.code).toBe(code));
}

describe('Golden staff workflow through canonical services', () => {
  test('search family → household → parent → student → enrollment → map → courses → coach → planning → invitation', async () => {
    const { client } = h;
    const ctx = h.ctx(h.assistante);

    // Academic year lifecycle (configured dates, no hardcoded calendar).
    const year = await createAcademicYear(client, ctx, { startYear: 2026, ...academicYearDates(2026) });
    expect(year.status).toBe('UPCOMING');
    const current = await setCurrentAcademicYear(client, ctx, year.id);
    expect(current.status).toBe('CURRENT');
    expect(await auditTrail(client, year.id)).toEqual(['academic_year.created', 'academic_year.status_changed']);

    // Household with its first parent (new account, PENDING_ACTIVATION, normalized contact).
    const { household, parent } = await createHousehold(client, ctx, {
      parent: { firstName: 'Amel', lastName: 'Synthetic', email: '  Amel.Synthetic@Example.COM ', phone: '+216 20 000 001' },
    });
    expect(parent.email).toBe('amel.synthetic@example.com');
    expect(parent.phone).toBe('20000001');
    expect(parent.accountStatus).toBe('PENDING_ACTIVATION');
    expect(await auditTrail(client, household.id)).toEqual(['household.created']);

    // Second parent, then attach an existing PARENT account, then switch primary contact.
    const { parent: parent2 } = await createParent(client, ctx, {
      householdId: household.id,
      parent: { firstName: 'Karim', lastName: 'Synthetic', email: 'karim@example.com' },
    });
    const existing = await client.user.create({ data: { role: 'PARENT', email: 'grand@example.com' } });
    await attachExistingParent(client, ctx, { householdId: household.id, parentUserId: existing.id });
    await setPrimaryContact(client, ctx, { householdId: household.id, parentUserId: parent2.id });
    const members = await client.householdParent.findMany({ where: { householdId: household.id } });
    expect(members).toHaveLength(3);
    expect(members.filter((m) => m.isPrimaryContact).map((m) => m.userId)).toEqual([parent2.id]);

    // Student inside the household.
    const { student, user: studentUser } = await createStudent(client, ctx, {
      householdId: household.id,
      student: { firstName: 'Yasmine', lastName: 'Synthetic', email: 'yasmine@example.com' },
    });
    expect(studentUser.role).toBe('ELEVE');
    expect(student.householdId).toBe(household.id);

    // Annual enrollment: PENDING until approved; approval is explicit.
    const enrollment = await createAnnualEnrollment(client, ctx, {
      studentId: student.id,
      academicYearId: year.id,
      academicMap: { gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE' },
    });
    expect(enrollment.status).toBe('PENDING');
    const approved = await approveEnrollment(client, ctx, enrollment.id);
    expect(approved.status).toBe('ACTIVE');
    expect(approved.approvedById).toBe(h.assistante.userId);

    // Level/track correction within the year bumps academicRevision.
    const corrected = await setAcademicMap(client, ctx, {
      enrollmentId: enrollment.id,
      academicMap: { gradeLevel: 'PREMIERE', academicTrack: 'STMG', stmgPathway: 'MERCATIQUE' },
    });
    expect(corrected.academicRevision).toBe(1);

    // Course choices, then coach capability + assignment, then planning.
    const courses = await setCourseEnrollments(client, ctx, {
      enrollmentId: enrollment.id,
      courses: [
        { courseKey: 'maths-premiere', kind: 'SPECIALTY' },
        { courseKey: 'anglais-premiere', kind: 'OPTION' },
      ],
    });
    expect(courses.map((c) => c.courseKey)).toEqual(['anglais-premiere', 'maths-premiere']);

    const { coachId } = await seedCoach(client, 'coach@synthetic.test');
    await setCoachCapability(client, ctx, { coachId, courseKey: 'maths-premiere', granted: true });
    const assignment = await assignCoach(client, ctx, { coachId, enrollmentId: enrollment.id, courseKey: 'maths-premiere' });
    expect(assignment.status).toBe('ACTIVE');

    const series = await createPlanningSeries(client, ctx, {
      assignmentId: assignment.id,
      startDate: new Date('2026-09-15'),
      localStartTime: '18:00',
      localEndTime: '19:00',
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU',
      modality: 'ONLINE',
    });
    expect(series.timezone).toBe(process.env.CORE_V2_ORGANIZATION_TIMEZONE);
    const changed = await changePlanningSeries(client, ctx, {
      seriesId: series.id,
      expectedRevision: 0,
      changes: { localEndTime: '19:30' },
    });
    expect(changed.revision).toBe(1);
    await expectDomainError(
      changePlanningSeries(client, ctx, { seriesId: series.id, expectedRevision: 0, changes: { localEndTime: '20:00' } }),
      'CONFLICT',
    );

    // Invitation for the parent account.
    const issued = await inviteAccount(client, ctx, parent.id);
    expect(issued.rawToken.length).toBeGreaterThanOrEqual(40);
    expect(issued.invitation.tokenHash).not.toContain(issued.rawToken);
    expect(await auditTrail(client, issued.invitation.id)).toEqual(['account.invited']);

    // Corrections are audited by field name only — never by value.
    await correctParentContact(client, ctx, { parentUserId: parent.id, changes: { phone: '+216 20 000 002' } });
    await correctStudentIdentity(client, ctx, { studentId: student.id, changes: { lastName: 'Synthetic-Corrected' } });
    const parentAudit = await client.auditEvent.findFirst({ where: { subjectId: parent.id, action: 'parent.contact_corrected' } });
    expect(parentAudit?.metadata).toEqual({ fields: ['phone'] });
    expect(JSON.stringify(parentAudit?.metadata)).not.toContain('20000002');

    // Course removal is blocked while an ACTIVE assignment uses it; ending the assignment unblocks it.
    await expectDomainError(
      setCourseEnrollments(client, ctx, { enrollmentId: enrollment.id, courses: [{ courseKey: 'anglais-premiere', kind: 'OPTION' }] }),
      'INVALID_STATE',
    );
    await endCoachAssignment(client, ctx, assignment.id);
    expect((await client.planningSeries.findUniqueOrThrow({ where: { id: series.id } })).status).toBe('ENDED');
    await setCourseEnrollments(client, ctx, { enrollmentId: enrollment.id, courses: [{ courseKey: 'anglais-premiere', kind: 'OPTION' }] });

    // Withdrawal, then closing the year.
    const withdrawn = await withdrawEnrollment(client, ctx, enrollment.id);
    expect(withdrawn.status).toBe('WITHDRAWN');
    await expectDomainError(withdrawEnrollment(client, ctx, enrollment.id), 'INVALID_STATE');
    expect((await closeAcademicYear(client, ctx, year.id)).status).toBe('CLOSED');

    // Every sensitive mutation left an audit row with the actor and the correlation id.
    const allAudit = await client.auditEvent.findMany();
    expect(allAudit.every((row) => row.actorUserId === h.assistante.userId && row.correlationId === ctx.correlationId)).toBe(true);
    expect(new Set(allAudit.map((r) => r.action))).toEqual(
      new Set([
        'academic_year.created',
        'academic_year.status_changed',
        'parent.created',
        'household.created',
        'household.parent_attached',
        'household.primary_contact_changed',
        'student.created',
        'enrollment.created',
        'enrollment.approved',
        'enrollment.academic_map_changed',
        'enrollment.courses_changed',
        'coach.capability_granted',
        'coach.assigned',
        'planning.series_created',
        'planning.occurrences_materialized',
        'planning.series_changed',
        'account.invited',
        'parent.contact_corrected',
        'student.identity_corrected',
        'coach.assignment_ended',
        'enrollment.withdrawn',
      ]),
    );
  });

  test('a new enrollment into a CLOSED year is refused; approval of a non-PENDING enrollment is refused', async () => {
    const { client } = h;
    const ctx = h.ctx();
    const year = await createAcademicYear(client, ctx, { startYear: 2025, ...academicYearDates(2025) });
    await setCurrentAcademicYear(client, ctx, year.id);
    const { household } = await createHousehold(client, ctx, { parent: { firstName: 'A', lastName: 'B', email: 'ab@example.com' } });
    const { student } = await createStudent(client, ctx, { householdId: household.id, student: { firstName: 'C', lastName: 'D' } });
    const enrollment = await createAnnualEnrollment(client, ctx, {
      studentId: student.id,
      academicYearId: year.id,
      academicMap: { gradeLevel: 'SECONDE' },
    });
    await approveEnrollment(client, ctx, enrollment.id);
    await expectDomainError(approveEnrollment(client, ctx, enrollment.id), 'INVALID_STATE');
    await closeAcademicYear(client, ctx, year.id);
    const { student: student2 } = await createStudent(client, ctx, { householdId: household.id, student: { firstName: 'E', lastName: 'F' } });
    await expectDomainError(
      createAnnualEnrollment(client, ctx, { studentId: student2.id, academicYearId: year.id, academicMap: { gradeLevel: 'SECONDE' } }),
      'INVALID_STATE',
    );
  });

  test('validation refuses malformed input with a typed VALIDATION error, before touching the database', async () => {
    const { client } = h;
    const ctx = h.ctx();
    await expectDomainError(createAcademicYear(client, ctx, { startYear: 2026, startsAt: new Date('2027-01-01'), endsAt: new Date('2027-06-01') }), 'VALIDATION');
    await expectDomainError(createHousehold(client, ctx, { parent: { firstName: '', lastName: 'X', email: 'not-an-email' } }), 'VALIDATION');
    await expectDomainError(createHousehold(client, ctx, { parent: { firstName: 'X', lastName: 'Y', email: 'x@y.io', phone: 'abc' } }), 'VALIDATION');
    expect(await client.household.count()).toBe(0);
    expect(await client.auditEvent.count()).toBe(0);
  });
});

describe('RBAC boundary (§Y) — ADMIN vs ASSISTANTE vs non-staff', () => {
  test('ASSISTANTE is denied the explicit ADMIN-only operations, ADMIN is not', async () => {
    const { client } = h;
    const target = await client.user.create({ data: { role: 'PARENT', email: 'target@example.com', accountStatus: 'ACTIVE' } });
    await expectDomainError(suspendAccount(client, h.ctx(h.assistante), target.id), 'FORBIDDEN');
    expect((await suspendAccount(client, h.ctx(h.admin), target.id)).accountStatus).toBe('SUSPENDED');
  });

  test('a PARENT actor is denied every back-office service and leaves no trace', async () => {
    const { client } = h;
    const ctx = h.ctx(h.parentActor);
    await expectDomainError(createHousehold(client, ctx, { parent: { firstName: 'A', lastName: 'B', email: 'p@example.com' } }), 'FORBIDDEN');
    await expectDomainError(createAcademicYear(client, ctx, { startYear: 2026, ...academicYearDates(2026) }), 'FORBIDDEN');
    expect(await client.household.count()).toBe(0);
    expect(await client.auditEvent.count()).toBe(0);
  });
});
