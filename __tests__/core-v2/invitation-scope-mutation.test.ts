import { prisma } from '@/lib/prisma';
import { setInvitationScopeGrant } from '@/lib/core-v2/accounts/invitation-scope';
import { createAnnualEnrollment, withdrawEnrollment, attachExistingParent, requestAccountInvitation,
  closeAcademicYear, setCurrentAcademicYear, approveEnrollment } from '@/lib/core-v2/services';
import { setupV1Fixture } from './helpers/v1-provisioning-fixture';
const f = setupV1Fixture();
async function family() {
  const user = await f.coreUser('PARENT', 'scoped-mutation');
  const parent = await f.h.client.householdParent.findUniqueOrThrow({ where: { userId: user.id } });
  const student = await f.h.client.student.findFirstOrThrow({ where: { householdId: parent.householdId } });
  const enrollment = await f.h.client.studentAcademicYearEnrollment.findFirstOrThrow({ where: { studentId: student.id } });
  return { user, householdId: parent.householdId, student, enrollment };
}
const state = () => Promise.all([f.h.client.invitationScopeGrant.findMany(), f.h.client.auditEvent.count(),
  f.h.client.studentAcademicYearEnrollment.findMany(), f.h.client.householdParent.findMany()]);
describe('invitation prerequisites cannot launder another scope', () => {
  test.each(['close', 'current'] as const)('ASSISTANTE cannot %s an institutional academic year to erase an invitation scope', async operation => {
    const { enrollment } = await family();
    const upcoming = await f.h.client.academicYear.create({ data: { startYear: 2027,
      startsAt: new Date('2027-09-01'), endsAt: new Date('2028-08-01'), status: 'UPCOMING' } });
    const before = [...await state(), await f.h.client.academicYear.findMany()];
    await expect(operation === 'close'
      ? closeAcademicYear(f.h.client, f.h.ctx(f.h.assistante), enrollment.academicYearId)
      : setCurrentAcademicYear(f.h.client, f.h.ctx(f.h.assistante), upcoming.id)).rejects.toThrow();
    expect([...await state(), await f.h.client.academicYear.findMany()]).toEqual(before);
  });
  test('a historical grant never authorizes ASSISTANTE to approve in a CLOSED year', async () => {
    const { householdId, enrollment } = await family();
    await setInvitationScopeGrant(f.h.client, f.h.ctx(), { staffUserId: f.h.assistante.userId,
      householdId, academicYearId: enrollment.academicYearId, expectedRevision: 0, active: true });
    await f.h.client.studentAcademicYearEnrollment.update({ where: { id: enrollment.id }, data: { status: 'PENDING' } });
    await f.h.client.academicYear.update({ where: { id: enrollment.academicYearId }, data: { status: 'CLOSED' } });
    const before = await state();
    await expect(approveEnrollment(f.h.client, f.h.ctx(f.h.assistante), enrollment.id)).rejects.toThrow('Invitation operation unavailable.');
    expect(await state()).toEqual(before);
  });
  test('a globally suspended V1 ADMIN cannot grant a scope while Core still says ACTIVE', async () => {
    const { householdId, enrollment } = await family();
    await prisma.user.update({ where: { id: f.h.admin.userId }, data: { disabledAt: new Date() } });
    const before = await state();
    await expect(setInvitationScopeGrant(f.h.client, f.h.ctx(), { staffUserId: f.h.assistante.userId,
      householdId, academicYearId: enrollment.academicYearId, expectedRevision: 0, active: true }))
      .rejects.toThrow('Invitation operation unavailable.');
    expect(await state()).toEqual(before);
  });
  test('withdrawing another year cannot reduce the family to the issuer own grant', async () => {
    const { householdId, student, enrollment } = await family();
    const year = await f.h.client.academicYear.create({ data: { startYear: 2027,
      startsAt: new Date('2027-09-01'), endsAt: new Date('2028-08-01'), status: 'UPCOMING' } });
    const other = await f.h.client.studentAcademicYearEnrollment.create({ data: { studentId: student.id,
      academicYearId: year.id, gradeLevel: 'TERMINALE', status: 'ACTIVE', approvedById: f.h.admin.userId, approvedAt: new Date() } });
    await setInvitationScopeGrant(f.h.client, f.h.ctx(), { staffUserId: f.h.assistante.userId,
      householdId, academicYearId: enrollment.academicYearId, expectedRevision: 0, active: true });
    const before = await state();
    await expect(withdrawEnrollment(f.h.client, f.h.ctx(f.h.assistante), other.id)).rejects.toThrow('Invitation operation unavailable.');
    expect(await state()).toEqual(before);
  });
  test('creating an enrollment resolves the student household and refuses an unassigned year', async () => {
    const { student } = await family();
    const year = await f.h.client.academicYear.create({ data: { startYear: 2027,
      startsAt: new Date('2027-09-01'), endsAt: new Date('2028-08-01'), status: 'UPCOMING' } });
    const before = await state();
    await expect(createAnnualEnrollment(f.h.client, f.h.ctx(f.h.assistante), { studentId: student.id,
      academicYearId: year.id, academicMap: { gradeLevel: 'TERMINALE' } })).rejects.toThrow('Invitation operation unavailable.');
    expect(await state()).toEqual(before);
  });
  test('an assigned ASSISTANTE cannot adopt an orphan identity into its own family', async () => {
    const { householdId, enrollment } = await family();
    await setInvitationScopeGrant(f.h.client, f.h.ctx(), { staffUserId: f.h.assistante.userId,
      householdId, academicYearId: enrollment.academicYearId, expectedRevision: 0, active: true });
    const orphan = await f.h.client.user.create({ data: { role: 'PARENT', email: 'orphan@example.test', accountStatus: 'PENDING_ACTIVATION' } });
    const before = await state();
    await expect(attachExistingParent(f.h.client, f.h.ctx(f.h.assistante), { householdId, parentUserId: orphan.id }))
      .rejects.toThrow('Invitation operation unavailable.');
    expect(await state()).toEqual(before);
  });
  test('a credential-ready V1 staff issuer with no legacy activatedAt follows the canonical V1 predicate', async () => {
    const { user, householdId, enrollment } = await family();
    await setInvitationScopeGrant(f.h.client, f.h.ctx(), { staffUserId: f.h.assistante.userId,
      householdId, academicYearId: enrollment.academicYearId, expectedRevision: 0, active: true });
    await prisma.user.update({ where: { id: f.h.assistante.userId }, data: { activatedAt: null } });
    expect(await requestAccountInvitation(f.h.client, f.h.ctx(f.h.assistante), user.id)).toMatchObject({ authority: 'V1' });
    expect((await f.saga(user.id)).state).toBe('REQUESTED');
  });
});
