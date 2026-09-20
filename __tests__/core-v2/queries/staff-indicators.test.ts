/**
 * Jalon B operational indicators (go-live mission — "SORTIR DU CYCLE
 * D'ATTENTE ET LIVRER LE PILOTAGE OPÉRATIONNEL"): the counter and the list
 * for each indicator are asserted against the SAME server-side definition,
 * never against a total merely observed on a loaded page. Both indicators
 * are exercised as full loops: an item appears, an authorized actor acts on
 * it through the canonical service, and the item disappears from a
 * server-re-read list/counter — never an optimistic client-side removal.
 */
import type { PrismaClient } from '@/core-v2/generated/client';
import { CoreV2DomainError } from '@/lib/core-v2/errors';
import {
  approveEnrollment,
  assignCoach,
  createAnnualEnrollment,
  createHousehold,
  createStudent,
  endCoachAssignment,
  setCoachCapability,
  setCourseEnrollments,
  withdrawEnrollment,
} from '@/lib/core-v2/services';
import type { ServiceContext } from '@/lib/core-v2/services/context';
import {
  listPendingEnrollments,
  listUnassignedCourseEnrollments,
} from '@/lib/core-v2/queries/staff';
import { seedAcademicYear, seedCoach, setupServiceHarness } from '../helpers/service-harness';

const h = setupServiceHarness();

async function seedStudent(client: PrismaClient, ctx: ServiceContext, label: string) {
  const { household } = await createHousehold(client, ctx, {
    parent: { firstName: `P${label}`, lastName: 'Synthetic', email: `parent-${label}@synthetic.test` },
  });
  const { student } = await createStudent(client, ctx, {
    householdId: household.id,
    student: { firstName: `S${label}`, lastName: 'Synthetic' },
  });
  return { household, student };
}

describe('Indicator A — pedagogical enrollments pending validation', () => {
  test('counts and lists only PENDING enrollments in the CURRENT year, excluding other statuses and other years', async () => {
    const { client } = h;
    const ctx = h.ctx(h.assistante);
    const current = await seedAcademicYear(client, 2026, 'CURRENT');
    const upcoming = await seedAcademicYear(client, 2027, 'UPCOMING');

    const { student: pendingStudent } = await seedStudent(client, ctx, 'pending');
    const pending = await createAnnualEnrollment(client, ctx, {
      studentId: pendingStudent.id,
      academicYearId: current.id,
      academicMap: { gradeLevel: 'SECONDE' },
    });

    const { student: activeStudent } = await seedStudent(client, ctx, 'active');
    const active = await createAnnualEnrollment(client, ctx, {
      studentId: activeStudent.id,
      academicYearId: current.id,
      academicMap: { gradeLevel: 'SECONDE' },
    });
    await approveEnrollment(client, ctx, active.id);

    const { student: withdrawnStudent } = await seedStudent(client, ctx, 'withdrawn');
    const withdrawn = await createAnnualEnrollment(client, ctx, {
      studentId: withdrawnStudent.id,
      academicYearId: current.id,
      academicMap: { gradeLevel: 'SECONDE' },
    });
    await withdrawEnrollment(client, ctx, withdrawn.id);

    const { student: upcomingStudent } = await seedStudent(client, ctx, 'upcoming');
    await createAnnualEnrollment(client, ctx, {
      studentId: upcomingStudent.id,
      academicYearId: upcoming.id,
      academicMap: { gradeLevel: 'SECONDE' },
    });

    const page = await listPendingEnrollments(client, ctx, { limit: 20 });
    expect(page.totalCount).toBe(1);
    expect(page.items.map((i) => i.id)).toEqual([pending.id]);
    expect(page.items[0]!.student.id).toBe(pendingStudent.id);
  });

  test('the counter and the list never disagree across pages, and the cursor terminates', async () => {
    const { client } = h;
    const ctx = h.ctx();
    const year = await seedAcademicYear(client, 2026, 'CURRENT');
    for (const label of ['a', 'b', 'c']) {
      const { student } = await seedStudent(client, ctx, label);
      await createAnnualEnrollment(client, ctx, { studentId: student.id, academicYearId: year.id, academicMap: { gradeLevel: 'SECONDE' } });
    }

    const seen = new Set<string>();
    let cursor: string | undefined;
    let pages = 0;
    for (;;) {
      const page = await listPendingEnrollments(client, ctx, { limit: 1, cursor });
      expect(page.totalCount).toBe(3);
      for (const item of page.items) seen.add(item.id);
      pages += 1;
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
      expect(pages).toBeLessThan(10); // guards against an infinite loop if the cursor never terminates
    }
    expect(pages).toBe(3);
    expect(seen.size).toBe(3);
  });

  test('loop A: a PENDING enrollment appears, ASSISTANTE approves it through the canonical service, it disappears from a server re-read', async () => {
    const { client } = h;
    const ctx = h.ctx(h.assistante);
    const year = await seedAcademicYear(client, 2026, 'CURRENT');
    const { student } = await seedStudent(client, ctx, 'loop-a');
    const enrollment = await createAnnualEnrollment(client, ctx, {
      studentId: student.id,
      academicYearId: year.id,
      academicMap: { gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE' },
    });

    const before = await listPendingEnrollments(client, ctx, { limit: 20 });
    expect(before.totalCount).toBe(1);
    expect(before.items.map((i) => i.id)).toContain(enrollment.id);

    await approveEnrollment(client, ctx, enrollment.id);

    const after = await listPendingEnrollments(client, ctx, { limit: 20 });
    expect(after.totalCount).toBe(0);
    expect(after.items.map((i) => i.id)).not.toContain(enrollment.id);
  });

  test('a double-click (concurrent approval) is refused on the second call, not silently accepted twice', async () => {
    const { client } = h;
    const ctx = h.ctx();
    const year = await seedAcademicYear(client, 2026, 'CURRENT');
    const { student } = await seedStudent(client, ctx, 'dbl');
    const enrollment = await createAnnualEnrollment(client, ctx, { studentId: student.id, academicYearId: year.id, academicMap: { gradeLevel: 'SECONDE' } });

    const [first, second] = await Promise.allSettled([
      approveEnrollment(client, ctx, enrollment.id),
      approveEnrollment(client, ctx, enrollment.id),
    ]);
    const outcomes = [first, second];
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.find((o) => o.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(CoreV2DomainError);
    expect((rejected.reason as CoreV2DomainError).code).toBe('INVALID_STATE');
  });

  test.each(['COACH', 'PARENT', 'ELEVE'] as const)('%s cannot read the pending-enrollments indicator', async (role) => {
    const { client } = h;
    const user = await client.user.create({ data: { role, email: `${role.toLowerCase()}-indicator@synthetic.test`, accountStatus: 'ACTIVE' } });
    const ctx = h.ctx({ userId: user.id, role });
    await expect(listPendingEnrollments(client, ctx, { limit: 20 })).rejects.toBeInstanceOf(CoreV2DomainError);
    await expect(listPendingEnrollments(client, ctx, { limit: 20 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('Indicator B — course enrollments needing a coach assignment', () => {
  async function seedActiveEnrollmentWithCourses(
    client: PrismaClient,
    ctx: ServiceContext,
    yearId: string,
    label: string,
    courses: readonly { courseKey: string; kind: 'SPECIALTY' | 'OPTION' }[],
  ) {
    const { student } = await seedStudent(client, ctx, label);
    const enrollment = await createAnnualEnrollment(client, ctx, { studentId: student.id, academicYearId: yearId, academicMap: { gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE' } });
    await approveEnrollment(client, ctx, enrollment.id);
    await setCourseEnrollments(client, ctx, { enrollmentId: enrollment.id, courses });
    return { student, enrollment };
  }

  test('a course enrollment with no ACTIVE assignment is counted and listed; an already-covered one is excluded', async () => {
    const { client } = h;
    const ctx = h.ctx(h.assistante);
    const year = await seedAcademicYear(client, 2026, 'CURRENT');
    const { coachId } = await seedCoach(client, 'coach-b1@synthetic.test');
    await setCoachCapability(client, ctx, { coachId, courseKey: 'maths-premiere', granted: true });

    const { enrollment } = await seedActiveEnrollmentWithCourses(client, ctx, year.id, 'covered-and-not', [
      { courseKey: 'maths-premiere', kind: 'SPECIALTY' },
      { courseKey: 'anglais-premiere', kind: 'OPTION' },
    ]);
    await assignCoach(client, ctx, { coachId, enrollmentId: enrollment.id, courseKey: 'maths-premiere' });

    const page = await listUnassignedCourseEnrollments(client, ctx, { limit: 20 });
    expect(page.totalCount).toBe(1);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]!.courseKey).toBe('anglais-premiere');
    expect(page.items[0]!.enrollment.id).toBe(enrollment.id);
  });

  test('excludes a course enrollment whose parent enrollment is PENDING (not yet on the live roster)', async () => {
    const { client } = h;
    const ctx = h.ctx();
    const year = await seedAcademicYear(client, 2026, 'CURRENT');
    const { student } = await seedStudent(client, ctx, 'still-pending');
    const enrollment = await createAnnualEnrollment(client, ctx, { studentId: student.id, academicYearId: year.id, academicMap: { gradeLevel: 'SECONDE' } });
    // PENDING enrollments cannot carry course choices yet in this contract only because
    // setCourseEnrollments permits PENDING too — force the scenario explicitly to prove
    // the indicator, not the write path, is what excludes it.
    await setCourseEnrollments(client, ctx, { enrollmentId: enrollment.id, courses: [{ courseKey: 'francais-seconde', kind: 'OPTION' }] });

    const page = await listUnassignedCourseEnrollments(client, ctx, { limit: 20 });
    expect(page.totalCount).toBe(0);
  });

  test('excludes a course enrollment whose academic year is not CURRENT', async () => {
    const { client } = h;
    const ctx = h.ctx();
    // Enroll and approve while the year is still CURRENT (the real write path
    // forbids creating an enrollment into an already-CLOSED year), then close
    // the year afterward — exactly the lifecycle closeAcademicYear produces.
    const year = await seedAcademicYear(client, 2024, 'CURRENT');
    await seedActiveEnrollmentWithCourses(client, ctx, year.id, 'old-year', [{ courseKey: 'philo-terminale', kind: 'OPTION' }]);
    await client.academicYear.update({ where: { id: year.id }, data: { status: 'CLOSED' } });

    const page = await listUnassignedCourseEnrollments(client, ctx, { limit: 20 });
    expect(page.totalCount).toBe(0);
  });

  test('ending a coach assignment makes the course reappear as needing one', async () => {
    const { client } = h;
    const ctx = h.ctx();
    const year = await seedAcademicYear(client, 2026, 'CURRENT');
    const { coachId } = await seedCoach(client, 'coach-b2@synthetic.test');
    await setCoachCapability(client, ctx, { coachId, courseKey: 'maths-premiere', granted: true });
    const { enrollment } = await seedActiveEnrollmentWithCourses(client, ctx, year.id, 'end-and-reappear', [{ courseKey: 'maths-premiere', kind: 'SPECIALTY' }]);
    const assignment = await assignCoach(client, ctx, { coachId, enrollmentId: enrollment.id, courseKey: 'maths-premiere' });
    expect((await listUnassignedCourseEnrollments(client, ctx, { limit: 20 })).totalCount).toBe(0);

    await endCoachAssignment(client, ctx, assignment.id);
    const page = await listUnassignedCourseEnrollments(client, ctx, { limit: 20 });
    expect(page.totalCount).toBe(1);
    expect(page.items[0]!.courseKey).toBe('maths-premiere');
  });

  test('the counter and the list never disagree across pages, with multiple students each contributing a row', async () => {
    const { client } = h;
    const ctx = h.ctx();
    const year = await seedAcademicYear(client, 2026, 'CURRENT');
    for (const label of ['m1', 'm2', 'm3']) {
      await seedActiveEnrollmentWithCourses(client, ctx, year.id, label, [{ courseKey: `cours-${label}`, kind: 'OPTION' }]);
    }

    const seen = new Set<string>();
    let cursor: string | undefined;
    let pages = 0;
    for (;;) {
      const page = await listUnassignedCourseEnrollments(client, ctx, { limit: 1, cursor });
      expect(page.totalCount).toBe(3);
      for (const item of page.items) seen.add(item.id);
      pages += 1;
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
      expect(pages).toBeLessThan(10);
    }
    expect(pages).toBe(3);
    expect(seen.size).toBe(3);
  });

  test('loop B: an unassigned course appears, an eligible coach is assigned through the canonical service, it disappears from a server re-read', async () => {
    const { client } = h;
    const ctx = h.ctx(h.assistante);
    const year = await seedAcademicYear(client, 2026, 'CURRENT');
    const { coachId } = await seedCoach(client, 'coach-loop-b@synthetic.test');
    await setCoachCapability(client, ctx, { coachId, courseKey: 'maths-premiere', granted: true });
    const { enrollment } = await seedActiveEnrollmentWithCourses(client, ctx, year.id, 'loop-b', [{ courseKey: 'maths-premiere', kind: 'SPECIALTY' }]);

    const before = await listUnassignedCourseEnrollments(client, ctx, { limit: 20 });
    expect(before.totalCount).toBe(1);

    await assignCoach(client, ctx, { coachId, enrollmentId: enrollment.id, courseKey: 'maths-premiere' });

    const after = await listUnassignedCourseEnrollments(client, ctx, { limit: 20 });
    expect(after.totalCount).toBe(0);
  });

  test('assigning a coach without the matching capability is refused server-side — the config loop enforces at write time, not only in a dropdown', async () => {
    const { client } = h;
    const ctx = h.ctx();
    const year = await seedAcademicYear(client, 2026, 'CURRENT');
    const { coachId } = await seedCoach(client, 'coach-no-cap@synthetic.test');
    const { enrollment } = await seedActiveEnrollmentWithCourses(client, ctx, year.id, 'refused-case', [{ courseKey: 'maths-premiere', kind: 'SPECIALTY' }]);

    await expect(assignCoach(client, ctx, { coachId, enrollmentId: enrollment.id, courseKey: 'maths-premiere' })).rejects.toMatchObject({ code: 'INVALID_STATE' });
    expect((await listUnassignedCourseEnrollments(client, ctx, { limit: 20 })).totalCount).toBe(1);
  });

  test.each(['COACH', 'PARENT', 'ELEVE'] as const)('%s cannot read the unassigned-course indicator', async (role) => {
    const { client } = h;
    const user = await client.user.create({ data: { role, email: `${role.toLowerCase()}-indicator-b@synthetic.test`, accountStatus: 'ACTIVE' } });
    const ctx = h.ctx({ userId: user.id, role });
    await expect(listUnassignedCourseEnrollments(client, ctx, { limit: 20 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
