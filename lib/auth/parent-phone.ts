import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Prisma, ParentPhoneChallenge, User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeParentPhone } from '@/lib/contact/parent-phone';

export type ParentPhonePurpose = 'ACTIVATION' | 'RECOVERY';
type PhoneTransaction = Pick<Prisma.TransactionClient, 'user' | 'parentPhoneChallenge'>;
type PhoneDatabase = Pick<typeof prisma, 'user' | 'parentPhoneChallenge' | '$transaction'>;
export class ParentPhoneError extends Error {}
export const PARENT_PHONE_CALLBACK = '/dashboard/parent/inscription';
export const parentPhoneTokenPattern = /^(ppact_|pprst_)[A-Za-z0-9_-]{43}$/;
export function hashParentPhoneToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/** Internal only: the raw challenge must go straight into encrypted transport,
 * never into a staff-facing response. Caller must own the enclosing transaction. */
export async function issueParentPhoneChallenge(tx: PhoneTransaction, input: {
  userId: string; purpose: ParentPhonePurpose; now?: Date;
}) {
  const now = input.now ?? new Date();
  const user = await tx.user.findUnique({ where: { id: input.userId } });
  if (!user || user.role !== 'PARENT' || user.mergedIntoUserId || !user.phoneNormalized) {
    throw new ParentPhoneError('PHONE_IDENTITY_UNAVAILABLE');
  }
  if (normalizeParentPhone(user.phoneNormalized).normalized !== user.phoneNormalized) {
    throw new ParentPhoneError('PHONE_IDENTITY_INVALID');
  }
  const activation = input.purpose === 'ACTIVATION';
  if (activation && user.activatedAt !== null) throw new ParentPhoneError('PHONE_ACTIVATION_NOT_ALLOWED');
  if (!activation && (user.parentPhoneState !== 'VERIFIED' || !user.phoneVerifiedAt || !user.activatedAt)) {
    throw new ParentPhoneError('PHONE_RECOVERY_NOT_ALLOWED');
  }
  // This guarded update also serializes issuance for this user. The partial
  // database index reserves the same canonical number against other users.
  const reservation = await tx.user.updateMany({
    where: { id: user.id, role: 'PARENT', mergedIntoUserId: null,
      phoneNormalized: user.phoneNormalized, parentPhoneVersion: user.parentPhoneVersion,
      parentPhoneState: user.parentPhoneState,
      ...(activation ? { activatedAt: null } : { phoneVerifiedAt: { not: null } }),
    },
    data: activation
      ? { parentPhoneState: 'RESERVED', phoneVerifiedAt: null, activationToken: null, activationExpiry: null }
      : { parentPhoneVersion: user.parentPhoneVersion },
  });
  if (reservation.count !== 1) throw new ParentPhoneError('PHONE_IDENTITY_CHANGED');
  await tx.parentPhoneChallenge.updateMany({
    where: { userId: user.id, consumedAt: null, revokedAt: null }, data: { revokedAt: now },
  });
  const rawToken = (activation ? 'ppact_' : 'pprst_') + randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + (activation ? 72 : 1) * 60 * 60 * 1000);
  const challenge = await tx.parentPhoneChallenge.create({ data: {
    userId: user.id, tokenHash: hashParentPhoneToken(rawToken), phoneNormalized: user.phoneNormalized,
    phoneVersion: user.parentPhoneVersion, purpose: input.purpose, expiresAt,
  } });
  return { challengeId: challenge.id, rawToken, phoneNormalized: user.phoneNormalized,
    phoneVersion: user.parentPhoneVersion, purpose: input.purpose, expiresAt };
}

type ChallengeWithUser = ParentPhoneChallenge & { user: User };
export function isParentPhoneChallengeValid(challenge: ChallengeWithUser | null, rawToken: string, now: Date): challenge is ChallengeWithUser {
  if (!challenge || !parentPhoneTokenPattern.test(rawToken) || challenge.tokenHash !== hashParentPhoneToken(rawToken)
    || challenge.revokedAt || challenge.consumedAt || challenge.expiresAt <= now) return false;
  const user = challenge.user;
  if (!user || user.role !== 'PARENT' || user.mergedIntoUserId || !user.phoneNormalized
    || user.phoneNormalized !== challenge.phoneNormalized || user.parentPhoneVersion !== challenge.phoneVersion) return false;
  return challenge.purpose === 'ACTIVATION'
    ? rawToken.startsWith('ppact_') && user.parentPhoneState === 'RESERVED' && user.activatedAt === null
    : rawToken.startsWith('pprst_') && user.parentPhoneState === 'VERIFIED' && !!user.activatedAt && !!user.phoneVerifiedAt;
}

export async function verifyParentPhoneChallenge(rawToken: string, dependencies: { prisma?: PhoneDatabase; now?: Date } = {}) {
  if (!parentPhoneTokenPattern.test(rawToken)) return { valid: false as const };
  const db = dependencies.prisma ?? prisma;
  const challenge = await db.parentPhoneChallenge.findUnique({
    where: { tokenHash: hashParentPhoneToken(rawToken) }, include: { user: true },
  });
  if (!isParentPhoneChallengeValid(challenge, rawToken, dependencies.now ?? new Date())) return { valid: false as const };
  return { valid: true as const, purpose: challenge.purpose, phoneHint: `•••• ${challenge.phoneNormalized.slice(-4)}` };
}

export async function consumeParentPhoneChallenge(rawToken: string, password: string, dependencies: { prisma?: PhoneDatabase; now?: Date } = {}) {
  if (!parentPhoneTokenPattern.test(rawToken) || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) return { success: false as const };
  const db = dependencies.prisma ?? prisma;
  const now = dependencies.now ?? new Date();
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    return await db.$transaction(async tx => {
      const challenge = await tx.parentPhoneChallenge.findUnique({
        where: { tokenHash: hashParentPhoneToken(rawToken) }, include: { user: true },
      });
      if (!isParentPhoneChallengeValid(challenge, rawToken, now)) return { success: false as const };
      // Lock/update the user first: same lock ordering as issue and the trigger.
      // Any later failed challenge claim throws, rolling back this update.
      const activation = challenge.purpose === 'ACTIVATION';
      const updated = await tx.user.updateMany({
        where: { id: challenge.userId, role: 'PARENT', mergedIntoUserId: null,
          phoneNormalized: challenge.phoneNormalized, parentPhoneVersion: challenge.phoneVersion,
          parentPhoneState: activation ? 'RESERVED' : 'VERIFIED',
          ...(activation ? { activatedAt: null } : { phoneVerifiedAt: { not: null } }),
        },
        data: { password: passwordHash, parentPhoneState: 'VERIFIED', phoneVerifiedAt: now,
          ...(activation ? { activatedAt: now } : {}),
          activationToken: null, activationExpiry: null, sessionVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new ParentPhoneError('PHONE_IDENTITY_CHANGED');
      const claimed = await tx.parentPhoneChallenge.updateMany({
        where: { id: challenge.id, tokenHash: challenge.tokenHash, consumedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (claimed.count !== 1) throw new ParentPhoneError('PHONE_CHALLENGE_UNAVAILABLE');
      await tx.parentPhoneChallenge.updateMany({
        where: { userId: challenge.userId, consumedAt: null, revokedAt: null }, data: { revokedAt: now },
      });
      return { success: true as const, redirectUrl: `/auth/signin?activated=true&callbackUrl=${encodeURIComponent(PARENT_PHONE_CALLBACK)}` };
    });
  } catch (error) {
    if (error instanceof ParentPhoneError || (error as { code?: string })?.code === 'P2034') return { success: false as const };
    throw error;
  }
}

/** Explicit maintenance transition; never deletes contacts or historical challenges. */
export async function releaseExpiredParentPhoneReservation(tx: PhoneTransaction, userId: string, now = new Date()) {
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user || user.parentPhoneState !== 'RESERVED') return false;
  const locked = await tx.user.updateMany({ where: { id: userId, parentPhoneState: 'RESERVED', parentPhoneVersion: user.parentPhoneVersion }, data: { parentPhoneVersion: user.parentPhoneVersion } });
  if (locked.count !== 1) throw new ParentPhoneError('PHONE_IDENTITY_CHANGED');
  const live = await tx.parentPhoneChallenge.findFirst({ where: { userId, revokedAt: null, consumedAt: null, expiresAt: { gt: now } } });
  if (live) return false;
  const released = await tx.user.updateMany({
    where: { id: userId, parentPhoneState: 'RESERVED', parentPhoneVersion: user.parentPhoneVersion },
    data: { parentPhoneState: 'NONE', phoneVerifiedAt: null, parentPhoneVersion: { increment: 1 } },
  });
  if (released.count !== 1) throw new ParentPhoneError('PHONE_IDENTITY_CHANGED');
  await tx.parentPhoneChallenge.updateMany({ where: { userId, consumedAt: null, revokedAt: null }, data: { revokedAt: now } });
  return true;
}
