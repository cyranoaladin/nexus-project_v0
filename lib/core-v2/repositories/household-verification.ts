import type { Prisma } from '@/core-v2/generated/client';

/** One fail-closed predicate shared by self-service reads and recipients. */
export const verifiedHouseholdMembershipWhere = {
  verificationStatus: 'VERIFIED',
  verifiedAt: { not: null },
  verifiedById: { not: null },
  verificationEvidenceDigest: { not: null },
  revokedAt: null,
} satisfies Prisma.HouseholdParentWhereInput;
