import { prisma } from '@/lib/prisma';
import { authorizeParentStudentRecords, familyReadAllowed } from './student-access-authority';

/** Only stored identity facts may be read before deciding family list authority. */
export async function resolveParentStudentListAccess(parentUserId: string, parentProfileId: string): Promise<{
  readonly studentIds: readonly string[];
  readonly unavailable: boolean;
}> {
  const candidates = await prisma.student.findMany({
    where: { parentId: parentProfileId },
    select: { id: true, userId: true, parent: { select: { userId: true } } },
  });
  const decisions = await authorizeParentStudentRecords(parentUserId, candidates, 'read');
  if (decisions.some(decision => decision.status === 'AUTHORITY_UNAVAILABLE')) {
    return { studentIds: [], unavailable: true };
  }
  const allowed = new Set(decisions.filter(familyReadAllowed).map(decision => decision.id));
  return { studentIds: candidates.filter(student => allowed.has(student.id)).map(student => student.id), unavailable: false };
}
