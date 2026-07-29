import 'server-only';

import { randomUUID } from 'crypto';

import type { PrismaClient } from '@prisma/client';

import {
  appendBilanRequestEvent,
  type BilanRequestEventClient,
} from '@/lib/bilans/requests/events';
import { hashBilanToken } from '@/lib/bilans/requests/tokens';

type BilanMagicAuthPrisma = Pick<PrismaClient, '$transaction'>;

export type SafeBilanParentUser = Readonly<{
  id: string;
  email: string;
  role: 'PARENT';
  firstName?: string;
  lastName?: string;
}>;

type ConsumeBilanMagicLinkInput = Readonly<{
  prisma: BilanMagicAuthPrisma;
  rawToken: unknown;
  now?: Date;
}>;

function isRetryableTransactionConflict(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'P2034';
}

async function consumeInTransaction(
  prisma: BilanMagicAuthPrisma,
  tokenHash: string,
  now: Date,
): Promise<SafeBilanParentUser | null> {
  return prisma.$transaction(async (transaction) => {
    const magicLink = await transaction.bilanMagicLink.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        requestId: true,
        parentUserId: true,
        expiresAt: true,
        consumedAt: true,
        revokedAt: true,
        parentUser: {
          select: {
            id: true,
            email: true,
            role: true,
            firstName: true,
            lastName: true,
            activatedAt: true,
          },
        },
        request: {
          select: {
            id: true,
            parentUserId: true,
            studentId: true,
            accountVerificationState: true,
          },
        },
      },
    });

    if (
      !magicLink
      || !magicLink.parentUserId
      || !magicLink.parentUser
      || magicLink.parentUser.role !== 'PARENT'
      || magicLink.requestId !== magicLink.request.id
      || magicLink.request.parentUserId !== magicLink.parentUserId
      || magicLink.request.accountVerificationState !== 'VERIFICATION_PENDING'
      || magicLink.consumedAt !== null
      || magicLink.revokedAt !== null
      || !Number.isFinite(magicLink.expiresAt.getTime())
      || magicLink.expiresAt.getTime() <= now.getTime()
    ) {
      return null;
    }

    const familyLink = magicLink.request.studentId
      ? await transaction.parentStudentLink.findFirst({
        where: {
          parentUserId: magicLink.parentUserId,
          studentId: magicLink.request.studentId,
        },
        select: {
          id: true,
          state: true,
          expiresAt: true,
          revokedAt: true,
        },
      })
      : null;

    if (
      magicLink.request.studentId
      && (
        !familyLink
        || familyLink.state !== 'PENDING_PARENT_CONSENT'
        || familyLink.revokedAt !== null
        || (familyLink.expiresAt !== null
          && (
            !Number.isFinite(familyLink.expiresAt.getTime())
            || familyLink.expiresAt.getTime() <= now.getTime()
          ))
      )
    ) {
      return null;
    }

    const consumed = await transaction.bilanMagicLink.updateMany({
      where: {
        id: magicLink.id,
        tokenHash,
        requestId: magicLink.requestId,
        parentUserId: magicLink.parentUserId,
        consumedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) return null;

    await transaction.user.updateMany({
      where: {
        id: magicLink.parentUserId,
        role: 'PARENT',
        activatedAt: null,
      },
      data: { activatedAt: now },
    });

    const verifiedRequest = await transaction.bilanRequest.updateMany({
      where: {
        id: magicLink.requestId,
        parentUserId: magicLink.parentUserId,
        accountVerificationState: 'VERIFICATION_PENDING',
      },
      data: {
        accountVerificationState: 'VERIFIED',
        lastActivityAt: now,
      },
    });
    if (verifiedRequest.count !== 1) {
      throw new Error('Bilan magic-link request ownership changed');
    }

    if (magicLink.request.studentId && familyLink) {
      const verifiedFamily = await transaction.parentStudentLink.updateMany({
        where: {
          id: familyLink.id,
          parentUserId: magicLink.parentUserId,
          studentId: magicLink.request.studentId,
          state: 'PENDING_PARENT_CONSENT',
          revokedAt: null,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        },
        data: {
          state: 'VERIFIED',
          consentedAt: now,
          verifiedAt: now,
        },
      });
      if (verifiedFamily.count !== 1) {
        throw new Error('Bilan magic-link family ownership changed');
      }
    }

    await appendBilanRequestEvent(
      transaction as unknown as BilanRequestEventClient,
      {
        requestId: magicLink.requestId,
        type: 'ACCOUNT_VERIFIED',
        actor: 'PARENT_FLOW',
        correlationId: randomUUID(),
        payload: { methodCode: 'MAGIC_LINK' },
      },
      { now },
    );

    return {
      id: magicLink.parentUser.id,
      email: magicLink.parentUser.email,
      role: 'PARENT',
      ...(magicLink.parentUser.firstName
        ? { firstName: magicLink.parentUser.firstName }
        : {}),
      ...(magicLink.parentUser.lastName
        ? { lastName: magicLink.parentUser.lastName }
        : {}),
    };
  }, {
    isolationLevel: 'Serializable',
  });
}

export async function consumeBilanMagicLink(
  input: ConsumeBilanMagicLinkInput,
): Promise<SafeBilanParentUser | null> {
  const now = input.now ?? new Date();
  if (!Number.isFinite(now.getTime())) return null;

  let tokenHash: string;
  try {
    tokenHash = hashBilanToken(input.rawToken as string);
  } catch {
    return null;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await consumeInTransaction(input.prisma, tokenHash, now);
    } catch (error) {
      if (!isRetryableTransactionConflict(error) || attempt === 2) {
        throw error;
      }
    }
  }

  return null;
}
