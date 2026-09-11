/**
 * §AB — concurrent attempts against a real PostgreSQL Core v2 database. Each
 * case runs two conflicting operations at the same time and proves that
 * exactly one wins and the database ends in the single legal state, with the
 * loser receiving a typed domain error (never a raw driver error).
 */
import { CoreV2DomainError } from '@/lib/core-v2/errors';
import {
  approveEnrollment,
  assignCoach,
  createAnnualEnrollment,
  createHousehold,
  createParent,
  createStudent,
  resendInvitation,
  setCoachCapability,
  setCourseEnrollments,
  setCurrentAcademicYear,
  setPrimaryContact,
} from '@/lib/core-v2/services';
import { academicYearDates } from '../helpers/fixtures';
import {
  holdOpenTransaction,
  race,
  seedAcademicYear,
  seedCoach,
  setupServiceHarness,
  waitForLockWaiter,
} from '../helpers/service-harness';

const h = setupServiceHarness();

function expectTypedLoser(rejected: unknown[], codes: CoreV2DomainError['code'][]) {
  expect(rejected).toHaveLength(1);
  expect(rejected[0]).toBeInstanceOf(CoreV2DomainError);
  expect(codes).toContain((rejected[0] as CoreV2DomainError).code);
}

async function familyWithApprovedEnrollment() {
  const { client } = h;
  const ctx = h.ctx();
  const year = await seedAcademicYear(client, 2026);
  const { household } = await createHousehold(client, ctx, { parent: { firstName: 'P', lastName: 'Q', email: 'pq@example.com' } });
  const { student } = await createStudent(client, ctx, { householdId: household.id, student: { firstName: 'S', lastName: 'T' } });
  const enrollment = await createAnnualEnrollment(client, ctx, { studentId: student.id, academicYearId: year.id, academicMap: { gradeLevel: 'SECONDE' } });
  await approveEnrollment(client, ctx, enrollment.id);
  return { year, household, student, enrollment };
}

describe('§AB concurrency matrix', () => {
  test('two CURRENT academic years: a promotion racing an uncommitted promotion is refused with CONFLICT; one CURRENT row remains', async () => {
    const { client } = h;
    const a = await client.academicYear.create({ data: { startYear: 2030, ...academicYearDates(2030) } });
    const b = await client.academicYear.create({ data: { startYear: 2031, ...academicYearDates(2031) } });

    // T1 promotes `a` and stays open; T2 cannot see it, finds no CURRENT to
    // close, and blocks on the partial unique index when it promotes `b`.
    const t1 = await holdOpenTransaction(client, async (tx) => {
      await tx.academicYear.update({ where: { id: a.id }, data: { status: 'CURRENT' } });
    });
    const t2 = setCurrentAcademicYear(client, h.ctx(), b.id);
    await waitForLockWaiter(client);
    await t1.release();

    await expect(t2).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await client.academicYear.count({ where: { status: 'CURRENT' } })).toBe(1);
    expect((await client.academicYear.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('UPCOMING');
    expect(await client.auditEvent.count({ where: { subjectId: b.id } })).toBe(0); // the loser's audit rolled back with it

    // Sequential promotion (no race) is the legitimate hand-over: closes `a`, promotes `b`.
    expect((await setCurrentAcademicYear(client, h.ctx(), b.id)).status).toBe('CURRENT');
    expect((await client.academicYear.findUniqueOrThrow({ where: { id: a.id } })).status).toBe('CLOSED');
    expect(await client.academicYear.count({ where: { status: 'CURRENT' } })).toBe(1);
  });

  test('two primary contacts: exactly one primary per household after concurrent promotion', async () => {
    const { client } = h;
    const ctx = h.ctx();
    const { household, parent } = await createHousehold(client, ctx, { parent: { firstName: 'A', lastName: 'B', email: 'a@example.com' } });
    const { parent: parent2 } = await createParent(client, ctx, { householdId: household.id, parent: { firstName: 'C', lastName: 'D', email: 'c@example.com' } });
    const { fulfilled } = await race(
      () => setPrimaryContact(client, h.ctx(), { householdId: household.id, parentUserId: parent.id }),
      () => setPrimaryContact(client, h.ctx(), { householdId: household.id, parentUserId: parent2.id }),
    );
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(await client.householdParent.count({ where: { householdId: household.id, isPrimaryContact: true } })).toBe(1);
  });

  test('case-variant duplicate email: exactly one account, sequential retry is a CONFLICT', async () => {
    const { client } = h;
    const { fulfilled, rejected } = await race(
      () => createHousehold(client, h.ctx(), { parent: { firstName: 'A', lastName: 'B', email: 'Dup@Example.com' } }),
      () => createHousehold(client, h.ctx(), { parent: { firstName: 'C', lastName: 'D', email: 'dup@example.COM' } }),
    );
    expect(fulfilled).toHaveLength(1);
    expectTypedLoser(rejected, ['CONFLICT']);
    expect(await client.user.count({ where: { email: 'dup@example.com' } })).toBe(1);
    expect(await client.household.count()).toBe(1); // the loser's household was rolled back with it
    await expect(
      createHousehold(client, h.ctx(), { parent: { firstName: 'E', lastName: 'F', email: 'DUP@example.com' } }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  test('a raw writer bypassing normalization is still refused by the DB (users_email_ci_key)', async () => {
    const { client } = h;
    await client.user.create({ data: { role: 'PARENT', email: 'ci@example.com' } });
    await expect(client.user.create({ data: { role: 'PARENT', email: 'CI@EXAMPLE.COM' } })).rejects.toMatchObject({ code: 'P2002' });
  });

  test('double annual enrollment: one row', async () => {
    const { client } = h;
    const ctx = h.ctx();
    const year = await seedAcademicYear(client, 2026);
    const { household } = await createHousehold(client, ctx, { parent: { firstName: 'A', lastName: 'B', email: 'ab@example.com' } });
    const { student } = await createStudent(client, ctx, { householdId: household.id, student: { firstName: 'S', lastName: 'T' } });
    const attempt = () =>
      createAnnualEnrollment(client, h.ctx(), { studentId: student.id, academicYearId: year.id, academicMap: { gradeLevel: 'SECONDE' } });
    const { fulfilled, rejected } = await race(attempt, attempt);
    expect(fulfilled).toHaveLength(1);
    expectTypedLoser(rejected, ['CONFLICT']);
    expect(await client.studentAcademicYearEnrollment.count({ where: { studentId: student.id } })).toBe(1);
  });

  test('double approval: exactly one approval succeeds, one audit row', async () => {
    const { client } = h;
    const ctx = h.ctx();
    const year = await seedAcademicYear(client, 2026);
    const { household } = await createHousehold(client, ctx, { parent: { firstName: 'A', lastName: 'B', email: 'ab@example.com' } });
    const { student } = await createStudent(client, ctx, { householdId: household.id, student: { firstName: 'S', lastName: 'T' } });
    const enrollment = await createAnnualEnrollment(client, ctx, { studentId: student.id, academicYearId: year.id, academicMap: { gradeLevel: 'SECONDE' } });
    const { fulfilled, rejected } = await race(
      () => approveEnrollment(client, h.ctx(), enrollment.id),
      () => approveEnrollment(client, h.ctx(h.assistante), enrollment.id),
    );
    expect(fulfilled).toHaveLength(1);
    expectTypedLoser(rejected, ['INVALID_STATE']);
    expect(await client.auditEvent.count({ where: { subjectId: enrollment.id, action: 'enrollment.approved' } })).toBe(1);
  });

  test('double coach assignment: one ACTIVE row for the triple', async () => {
    const { client } = h;
    const { enrollment } = await familyWithApprovedEnrollment();
    await setCourseEnrollments(client, h.ctx(), { enrollmentId: enrollment.id, courses: [{ courseKey: 'maths-seconde', kind: 'SPECIALTY' }] });
    const { coachId } = await seedCoach(client, 'coach@synthetic.test');
    await setCoachCapability(client, h.ctx(), { coachId, courseKey: 'maths-seconde', granted: true });
    const attempt = () => assignCoach(client, h.ctx(), { coachId, enrollmentId: enrollment.id, courseKey: 'maths-seconde' });
    const { fulfilled, rejected } = await race(attempt, attempt);
    expect(fulfilled).toHaveLength(1);
    expectTypedLoser(rejected, ['CONFLICT']);
    expect(await client.coachStudentCourseAssignment.count({ where: { status: 'ACTIVE' } })).toBe(1);
  });

  test('assignment without course enrollment, without coach capability, or on a PENDING enrollment is refused', async () => {
    const { client } = h;
    const ctx = h.ctx();
    const { enrollment, household } = await familyWithApprovedEnrollment();
    const { coachId } = await seedCoach(client, 'coach@synthetic.test');
    await expect(assignCoach(client, ctx, { coachId, enrollmentId: enrollment.id, courseKey: 'maths-seconde' })).rejects.toMatchObject({ code: 'INVALID_STATE' });
    await setCourseEnrollments(client, ctx, { enrollmentId: enrollment.id, courses: [{ courseKey: 'maths-seconde', kind: 'SPECIALTY' }] });
    await expect(assignCoach(client, ctx, { coachId, enrollmentId: enrollment.id, courseKey: 'maths-seconde' })).rejects.toMatchObject({ code: 'INVALID_STATE' });
    const { student: pendingStudent } = await createStudent(client, ctx, { householdId: household.id, student: { firstName: 'U', lastName: 'V' } });
    const year = await client.academicYear.findFirstOrThrow();
    const pending = await createAnnualEnrollment(client, ctx, { studentId: pendingStudent.id, academicYearId: year.id, academicMap: { gradeLevel: 'SECONDE' } });
    await setCoachCapability(client, ctx, { coachId, courseKey: 'maths-seconde', granted: true });
    await expect(assignCoach(client, ctx, { coachId, enrollmentId: pending.id, courseKey: 'maths-seconde' })).rejects.toMatchObject({ code: 'INVALID_STATE' });
    expect(await client.coachStudentCourseAssignment.count()).toBe(0);
  });

  test('concurrent invitation resend: the resend racing an uncommitted resend is refused; exactly one open invitation survives', async () => {
    const { client } = h;
    const ctx = h.ctx();
    const { parent } = await createHousehold(client, ctx, { parent: { firstName: 'A', lastName: 'B', email: 'ab@example.com' } });
    const first = await resendInvitation(client, ctx, parent.id);

    // T1 = an in-flight resend (revoke prior + insert new) held open; T2's own
    // insert blocks on invitations_open_user_key and loses when T1 commits.
    const t1 = await holdOpenTransaction(client, async (tx) => {
      await tx.invitation.updateMany({ where: { userId: parent.id, consumedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.invitation.create({ data: { userId: parent.id, tokenHash: 'held-open-hash', expiresAt: new Date(Date.now() + 3_600_000) } });
    });
    const t2 = resendInvitation(client, h.ctx(), parent.id);
    await waitForLockWaiter(client);
    await t1.release();

    await expect(t2).rejects.toMatchObject({ code: 'CONFLICT' });
    const open = await client.invitation.findMany({ where: { userId: parent.id, consumedAt: null, revokedAt: null } });
    expect(open.map((i) => i.tokenHash)).toEqual(['held-open-hash']);
    expect((await client.invitation.findUniqueOrThrow({ where: { id: first.invitation.id } })).revokedAt).not.toBeNull();

    // A later, non-racing resend is idempotent: revokes the survivor, leaves exactly one open again.
    const third = await resendInvitation(client, h.ctx(), parent.id);
    const openAfter = await client.invitation.findMany({ where: { userId: parent.id, consumedAt: null, revokedAt: null } });
    expect(openAfter.map((i) => i.id)).toEqual([third.invitation.id]);
  });

  test('transaction rollback: a failure mid-service leaves neither partial rows nor audit rows', async () => {
    const { client } = h;
    const ctx = h.ctx();
    await client.user.create({ data: { role: 'PARENT', email: 'taken@example.com' } });
    const households = await client.household.count();
    const audits = await client.auditEvent.count();
    await expect(
      createParent(client, ctx, { householdId: 'nope', parent: { firstName: 'A', lastName: 'B', email: 'taken@example.com' } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const { household } = await createHousehold(client, ctx, { parent: { firstName: 'A', lastName: 'B', email: 'ok@example.com' } });
    await expect(
      createParent(client, ctx, { householdId: household.id, parent: { firstName: 'A', lastName: 'B', email: 'TAKEN@example.com' } }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await client.household.count()).toBe(households + 1);
    expect(await client.householdParent.count({ where: { householdId: household.id } })).toBe(1);
    expect(await client.auditEvent.count({ where: { action: 'household.parent_attached' } })).toBe(0);
    expect(await client.auditEvent.count()).toBe(audits + 2); // parent.created + household.created only
  });
});
