import type { Prisma } from '@prisma/client';

/** Phone enrollment history persists when a contact change invalidates the current
 * phone identity. A staff-entered email never becomes proof through that reset.
 * Preserve the established email policy for historical accounts without phone enrollment. */
export const emailTrustSelect = {
  emailVerifiedAt: true,
  parentPhoneState: true,
  parentPhoneChallenges: { select: { id: true }, take: 1 },
} satisfies Prisma.UserSelect;

export function hasTrustedAccountEmail(user: {
  emailVerifiedAt?: Date | null;
  parentPhoneState?: string | null;
  parentPhoneChallenges?: readonly { id: string }[];
} | null): boolean {
  if (!user) return false;
  if (user.emailVerifiedAt) return true;
  return user.parentPhoneState === 'NONE'
    && Array.isArray(user.parentPhoneChallenges)
    && user.parentPhoneChallenges.length === 0;
}

/** Rechecked by the final write after acquiring its row lock. */
export const trustedAccountEmailWhere = {
  OR: [
    { emailVerifiedAt: { not: null } },
    { parentPhoneState: 'NONE', parentPhoneChallenges: { none: {} } },
  ],
} satisfies Prisma.UserWhereInput;
