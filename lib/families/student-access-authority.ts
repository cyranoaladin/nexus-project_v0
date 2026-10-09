import { prisma } from '@/lib/prisma';
import {
  getFamilyAuthorityMode,
  readCoreFamilyAuthority,
} from '@/lib/core-v2/queries/family-authority';

export type FamilyAccessStatus = 'LEGACY_ALLOWED' | 'CORE_VERIFIED_READ' | 'DENIED' | 'AUTHORITY_UNAVAILABLE';
export interface FamilyStudentRecord {
  readonly id: string;
  readonly userId: string;
  readonly parent: { readonly userId: string };
}
export interface FamilyAccessDecision {
  readonly id: string;
  readonly status: FamilyAccessStatus;
}

export function familyReadAllowed(decision: FamilyAccessDecision): boolean {
  return decision.status === 'LEGACY_ALLOWED' || decision.status === 'CORE_VERIFIED_READ';
}

/** Records must be loaded server-side; never trust client-supplied ownership facts. */
export async function authorizeParentStudentRecords(
  parentUserId: string,
  students: readonly FamilyStudentRecord[],
  action: 'read' | 'mutation' = 'read',
): Promise<readonly FamilyAccessDecision[]> {
  const denied = (status: 'DENIED' | 'AUTHORITY_UNAVAILABLE') => students.map(student => ({ id: student.id, status }));
  if (!parentUserId || students.some(student => !student.id || !student.userId)) return denied('DENIED');
  if (students.length === 0) return [];
  try {
    const mode = getFamilyAuthorityMode();
    if (mode === 'V1_ONLY') {
      return students.map(student => ({
        id: student.id, status: student.parent.userId === parentUserId ? 'LEGACY_ALLOWED' : 'DENIED',
      }));
    }
    const core = await readCoreFamilyAuthority(parentUserId, students);
    const coreById = new Map(core.students.map(student => [student.id, student]));
    return students.map(student => {
      const fact = coreById.get(student.id);
      if (!fact) return { id: student.id, status: 'DENIED' };
      if (mode === 'HYBRID' && !core.parentOwned && !fact.owned) {
        return { id: student.id, status: student.parent.userId === parentUserId ? 'LEGACY_ALLOWED' : 'DENIED' };
      }
      // Cross-store writes cannot be authorized by a snapshot followed by an unrelated V1 transaction.
      return { id: student.id, status: action === 'read' && fact.allowed ? 'CORE_VERIFIED_READ' : 'DENIED' };
    });
  } catch {
    // Never propagate connection strings/driver causes or turn an outage into legacy access.
    return denied('AUTHORITY_UNAVAILABLE');
  }
}

/** ID-independent outage probe: the same Core read as a decision, carrying no student identity. */
export async function familyAuthorityAvailable(parentUserId: string): Promise<boolean> {
  try {
    if (getFamilyAuthorityMode() === 'V1_ONLY') return true;
    await readCoreFamilyAuthority(parentUserId, []);
    return true;
  } catch {
    return false;
  }
}

export async function resolveParentStudentAccess(
  parentUserId: string,
  studentId: string,
  action: 'read' | 'mutation' = 'read',
): Promise<FamilyAccessDecision> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, userId: true, parent: { select: { userId: true } } },
  });
  if (!student) {
    // An unknown ID must answer like a known one while the authority is down.
    return { id: studentId, status: await familyAuthorityAvailable(parentUserId) ? 'DENIED' : 'AUTHORITY_UNAVAILABLE' };
  }
  const decisions = await authorizeParentStudentRecords(parentUserId, [student], action);
  return decisions[0] ?? { id: studentId, status: 'DENIED' };
}
