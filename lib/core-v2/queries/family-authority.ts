import type { PrismaClient } from '@/core-v2/generated/client';
import { Prisma, requireCoreV2Client } from '../client';
import { getAuthRolloutMode } from '../auth/rollout';
import { subjectHasRole } from '../rbac';

export { getAuthRolloutMode as getFamilyAuthorityMode };

export interface FamilyStudentIdentity {
  readonly id: string;
  readonly userId: string;
}

export interface CoreFamilyAuthority {
  readonly parentOwned: boolean;
  readonly students: readonly {
    readonly id: string;
    readonly owned: boolean;
    readonly allowed: boolean;
  }[];
}

/** Minimal authorization facts from one Core snapshot; no pedagogical/financial data. */
export async function readCoreFamilyAuthorityWithClient(
  client: PrismaClient,
  parentUserId: string,
  identities: readonly FamilyStudentIdentity[],
): Promise<CoreFamilyAuthority> {
  return client.$transaction(async (tx) => {
    const parent = await tx.user.findUnique({
      where: { id: parentUserId },
      select: {
        id: true, role: true, accountStatus: true,
        householdParent: { select: {
          householdId: true, verificationStatus: true, verifiedAt: true,
          verifiedById: true, verificationEvidenceDigest: true, revokedAt: true,
        } },
      },
    });
    const userIds = [...new Set(identities.map(identity => identity.userId))];
    const studentIds = [...new Set(identities.map(identity => identity.id))];
    const users = await tx.user.findMany({ where: { id: { in: userIds } }, select: { id: true } });
    const students = await tx.student.findMany({
      where: { OR: [{ id: { in: studentIds } }, { userId: { in: userIds } }] },
      select: { id: true, userId: true, householdId: true },
    });
    const usersById = new Set(users.map(user => user.id));
    const studentsById = new Map(students.map(student => [student.id, student]));
    const studentsByUserId = new Map(students.map(student => [student.userId, student]));
    const membership = parent?.householdParent;
    const verified = parent !== null && subjectHasRole(parent, 'PARENT') && parent.accountStatus === 'ACTIVE'
      && membership?.verificationStatus === 'VERIFIED'
      && membership.verifiedAt !== null && membership.verifiedById !== null
      && membership.verificationEvidenceDigest !== null
      && /^[a-f0-9]{64}$/.test(membership.verificationEvidenceDigest)
      && membership.revokedAt === null;
    return {
      parentOwned: parent !== null,
      students: identities.map(identity => {
        const byId = studentsById.get(identity.id);
        const byUserId = studentsByUserId.get(identity.userId);
        const owned = usersById.has(identity.userId) || byId !== undefined || byUserId !== undefined;
        return {
          id: identity.id,
          owned,
          allowed: Boolean(verified && byId && byUserId
            && byId.id === byUserId.id && byId.userId === identity.userId
            && byId.householdId === membership?.householdId),
        };
      }),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function readCoreFamilyAuthority(
  parentUserId: string,
  identities: readonly FamilyStudentIdentity[],
): Promise<CoreFamilyAuthority> {
  const client = await requireCoreV2Client();
  return readCoreFamilyAuthorityWithClient(client, parentUserId, identities);
}
