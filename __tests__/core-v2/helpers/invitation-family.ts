import type { PrismaClient } from '@/core-v2/generated/client';

/** Authoritative synthetic relationships for tests of the subsequent account lifecycle. */
export async function seedInvitationFamilyScope(client: PrismaClient, adminId: string, parentId: string): Promise<void> {
  let membership = await client.householdParent.findUnique({ where: { userId: parentId } });
  if (!membership) {
    const household = await client.household.create({ data: {} });
    membership = await client.householdParent.create({ data: { householdId: household.id, userId: parentId } });
  }
  await client.householdParent.update({ where: { id: membership.id }, data: {
    verificationStatus: 'VERIFIED', revokedAt: null, verifiedAt: new Date(), verifiedById: adminId,
    verificationEvidenceDigest: 'b'.repeat(64), revision: 1,
  } });
  const child = await client.user.create({ data: { role: 'ELEVE', accountStatus: 'ACTIVE' } });
  const student = await client.student.create({ data: { householdId: membership.householdId, userId: child.id } });
  const year = await client.academicYear.upsert({ where: { startYear: 2026 }, update: {}, create: {
    startYear: 2026, startsAt: new Date('2026-09-01T00:00:00Z'), endsAt: new Date('2027-08-01T00:00:00Z'), status: 'CURRENT',
  } });
  await client.studentAcademicYearEnrollment.create({ data: { studentId: student.id, academicYearId: year.id,
    gradeLevel: 'PREMIERE', status: 'ACTIVE', approvedAt: new Date(), approvedById: adminId } });
}
