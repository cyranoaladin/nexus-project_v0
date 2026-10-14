import type { PrismaClient, UserRole } from '@/core-v2/generated/client';
import { requireCoreV2Client, disconnectCoreV2Client } from '@/lib/core-v2/client';
import { assertInvitationScope, setInvitationScopeGrant } from '@/lib/core-v2/accounts/invitation-scope';
import { createServiceContext } from '@/lib/core-v2/services/context';
import { resetCoreV2Database } from './helpers/reset-db';
import { bootstrapTestAdmin } from './helpers/bootstrap';

const adminId = 'authoritative-test-admin';
const assistantId = 'scope-assistant';
const targetId = 'scope-student-user';
const ctx = (userId = adminId, role: UserRole = 'ADMIN') => createServiceContext({ userId, role });

describe('invitation issuer scope from authoritative relationships', () => {
  let client: PrismaClient;
  let householdId: string;
  let yearId: string;
  let studentId: string;
  beforeAll(async () => { client = await requireCoreV2Client(); });
  beforeEach(async () => {
    await resetCoreV2Database(client);
    await bootstrapTestAdmin(client);
    await client.user.createMany({ data: [
      { id: assistantId, role: 'ASSISTANTE', accountStatus: 'ACTIVE' },
      { id: 'scope-coach', role: 'COACH', accountStatus: 'ACTIVE' },
      { id: 'scope-parent', role: 'PARENT', accountStatus: 'ACTIVE' },
      { id: targetId, role: 'ELEVE', email: 'scope-student@example.test', accountStatus: 'PENDING_ACTIVATION' },
      { id: 'scope-colleague', role: 'COACH', email: 'scope-colleague@example.test', accountStatus: 'PENDING_ACTIVATION' },
    ] });
    const household = await client.household.create({ data: {} }); householdId = household.id;
    const year = await client.academicYear.create({ data: { startYear: 2026, startsAt: new Date('2026-09-01'),
      endsAt: new Date('2027-08-01'), status: 'CURRENT' } }); yearId = year.id;
    await client.householdParent.create({ data: { householdId, userId: 'scope-parent', verificationStatus: 'VERIFIED',
      verifiedAt: new Date(), verifiedById: adminId, verificationEvidenceDigest: 'b'.repeat(64), revision: 1 } });
    const student = await client.student.create({ data: { householdId, userId: targetId } }); studentId = student.id;
    await client.studentAcademicYearEnrollment.create({ data: { studentId, academicYearId: yearId,
      gradeLevel: 'PREMIERE', status: 'ACTIVE', approvedById: adminId, approvedAt: new Date() } });
  });
  afterAll(async () => { await disconnectCoreV2Client(); });
  const scope = (actor = ctx().actor, userId = targetId, operation: 'INVITE' | 'RESEND' = 'INVITE') =>
    client.$transaction(tx => assertInvitationScope(tx, actor, operation, { userId }));
  const grant = () => setInvitationScopeGrant(client, ctx(), { staffUserId: assistantId, householdId, academicYearId: yearId,
    expectedRevision: 0, active: true });

  test('ADMIN resolves family and staff exclusively from this database instance', async () => {
    const family = await scope();
    expect(family).toMatchObject({ issuerId: adminId, targetId, operation: 'INVITE',
      scopes: [{ householdId, academicYearId: yearId }] });
    expect(family.databaseIdentity).toMatch(/^[a-f0-9-]{36}$/);
    expect(await scope(ctx().actor, 'scope-colleague')).toMatchObject({ scopes: [], issuerId: adminId });
  });
  test('ASSISTANTE requires an explicit ADMIN household/year grant', async () => {
    await expect(scope(ctx(assistantId, 'ASSISTANTE').actor)).rejects.toThrow('Invitation operation unavailable.');
    await grant();
    expect(await scope(ctx(assistantId, 'ASSISTANTE').actor)).toMatchObject({ issuerId: assistantId, targetId });
    await expect(scope(ctx(assistantId, 'ASSISTANTE').actor, 'scope-colleague')).rejects.toThrow('Invitation operation unavailable.');
  });
  test.each(['COACH', 'PARENT', 'ELEVE'] as const)('%s never acquires invitation authority from relationships', async role => {
    const userId = role === 'COACH' ? 'scope-coach' : role === 'PARENT' ? 'scope-parent' : targetId;
    await expect(scope(ctx(userId, role).actor)).rejects.toThrow();
  });
  test('a forged session role cannot grant authority', async () => {
    await expect(scope(ctx(assistantId, 'ADMIN').actor)).rejects.toThrow('Invitation operation unavailable.');
    await expect(setInvitationScopeGrant(client, ctx(assistantId, 'ADMIN'), { staffUserId: assistantId,
      householdId, academicYearId: yearId, expectedRevision: 0, active: true })).rejects.toThrow();
    expect(await client.invitationScopeGrant.count()).toBe(0);
  });
  test.each(['INVITE', 'RESEND'] as const)('%s has the same generic response for absent, unlinked and foreign targets', async operation => {
    await grant();
    await client.user.create({ data: { id: 'unlinked-student', role: 'ELEVE', email: 'unlinked@example.test' } });
    const foreignHousehold = await client.household.create({ data: {} });
    await client.student.update({ where: { id: studentId }, data: { householdId: foreignHousehold.id } });
    const before = await client.auditEvent.findMany({ orderBy: { id: 'asc' } });
    for (const userId of ['absent-user', 'unlinked-student', targetId]) {
      await expect(scope(ctx(assistantId, 'ASSISTANTE').actor, userId, operation)).rejects.toThrow('Invitation operation unavailable.');
    }
    expect(await client.auditEvent.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
    expect(await client.invitation.count()).toBe(0);
    expect(await client.accountV1Provisioning.count()).toBe(0);
    expect(await client.coreV2JobOutbox.count()).toBe(0);
  });
  test.each(['membership', 'enrollment', 'year', 'issuer', 'grant'] as const)('a revoked/inactive %s closes scope', async relation => {
    await grant();
    if (relation === 'membership') await client.householdParent.update({ where: { userId: 'scope-parent' }, data: { verificationStatus: 'REVOKED', revokedAt: new Date() } });
    if (relation === 'enrollment') await client.studentAcademicYearEnrollment.updateMany({ data: { status: 'WITHDRAWN' } });
    if (relation === 'year') await client.academicYear.update({ where: { id: yearId }, data: { status: 'CLOSED' } });
    if (relation === 'issuer') await client.user.update({ where: { id: assistantId }, data: { accountStatus: 'SUSPENDED' } });
    if (relation === 'grant') await setInvitationScopeGrant(client, ctx(), { staffUserId: assistantId, householdId,
      academicYearId: yearId, expectedRevision: 1, active: false });
    await expect(scope(ctx(assistantId, 'ASSISTANTE').actor)).rejects.toThrow('Invitation operation unavailable.');
  });
  test('siblings within the same household/year form one unambiguous scope', async () => {
    await grant();
    const sibling = await client.user.create({ data: { role: 'ELEVE', accountStatus: 'ACTIVE' } });
    const student = await client.student.create({ data: { userId: sibling.id, householdId } });
    await client.studentAcademicYearEnrollment.create({ data: { studentId: student.id, academicYearId: yearId,
      gradeLevel: 'TERMINALE', status: 'ACTIVE', approvedById: adminId, approvedAt: new Date() } });
    await client.user.update({ where: { id: 'scope-parent' }, data: { accountStatus: 'PENDING_ACTIVATION', email: 'scope-parent@example.test' } });
    expect((await scope(ctx(assistantId, 'ASSISTANTE').actor, 'scope-parent')).scopes).toHaveLength(1);
  });
  test('a different academic year is not covered by an existing grant', async () => {
    await grant();
    const next = await client.academicYear.create({ data: { startYear: 2027, startsAt: new Date('2027-09-01'), endsAt: new Date('2028-08-01') } });
    await client.studentAcademicYearEnrollment.updateMany({ data: { academicYearId: next.id } });
    await expect(scope(ctx(assistantId, 'ASSISTANTE').actor)).rejects.toThrow('Invitation operation unavailable.');
  });
});
