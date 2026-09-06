import { Prisma, type PrismaClient } from '@prisma/client';
import { TOMBSTONE } from './anonymisation';

export type PhonePrivacyDatabase = Pick<PrismaClient, '$transaction'>;

/** Called by the canonical anonymisation executor for every user proposal.
 * The challenge rows must survive: their existence is an email-trust boundary.
 * A leased provider call must settle before erasure can be reported complete.
 */
export async function anonymiseParentPhoneCarriers(database: PhonePrivacyDatabase, input: {
  userIds: readonly string[]; challengeIds: readonly string[]; now: Date;
}): Promise<{ challengesAnonymised: number; outboxAnonymised: number }> {
  const userIds = [...new Set(input.userIds)].sort();
  if (!userIds.length) {
    if (input.challengeIds.length) throw new Error('PHONE_CHALLENGE_SCOPE_MISMATCH');
    return { challengesAnonymised: 0, outboxAnonymised: 0 };
  }
  return database.$transaction(async tx => {
    if (input.challengeIds.length) {
      const challenges = await tx.parentPhoneChallenge.findMany({
        where: { id: { in: [...new Set(input.challengeIds)] } }, select: { id: true, userId: true },
      });
      if (challenges.length !== new Set(input.challengeIds).size || challenges.some(c => !userIds.includes(c.userId))) {
        throw new Error('PHONE_CHALLENGE_SCOPE_MISMATCH');
      }
    }
    // Same user-first lock order as issuance. Once erased, the canonical phone
    // is null, so no later issuance can enqueue a fresh identity invitation.
    const users = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "users" WHERE "id" IN (${Prisma.join(userIds)}) ORDER BY "id" FOR UPDATE
    `);
    if (users.length !== userIds.length) throw new Error('PHONE_PRIVACY_USER_NOT_FOUND');
    const jobs = await tx.$queryRaw<Array<{ id: string; status: string; leaseOwner: string | null }>>(Prisma.sql`
      SELECT "id", "status", "leaseOwner" FROM "canonical_job_outbox"
      WHERE "jobType" = 'WHATSAPP_SEND' AND "aggregateType" = 'USER'
        AND "aggregateId" IN (${Prisma.join(userIds)}) ORDER BY "id" FOR UPDATE
    `);
    if (jobs.some(job => job.status === 'LEASED' || job.leaseOwner !== null)) throw new Error('WHATSAPP_SEND_IN_PROGRESS');
    await tx.user.updateMany({ where: { id: { in: userIds } }, data: {
      phoneNormalized: null, parentPhoneState: 'NONE', phoneVerifiedAt: null, emailVerifiedAt: null,
      parentPhoneVersion: { increment: 1 }, sessionVersion: { increment: 1 },
      activationToken: null, activationExpiry: null, password: null,
    } });
    await tx.parentPhoneChallenge.updateMany({
      where: { userId: { in: userIds }, revokedAt: null }, data: { revokedAt: input.now },
    });
    const challenges = await tx.parentPhoneChallenge.updateMany({
      where: { userId: { in: userIds } }, data: { phoneNormalized: TOMBSTONE },
    });
    const where = { jobType: 'WHATSAPP_SEND' as const, aggregateType: 'USER', aggregateId: { in: userIds } };
    await tx.jobOutbox.updateMany({ where: { ...where, status: { in: ['PENDING', 'RETRY_SCHEDULED'] } }, data: { status: 'CANCELLED' } });
    const outbox = await tx.jobOutbox.updateMany({ where, data: {
      payload: { anonymised: true }, leaseOwner: null, leaseExpiresAt: null, lastError: null,
    } });
    return { challengesAnonymised: challenges.count, outboxAnonymised: outbox.count };
  });
}
