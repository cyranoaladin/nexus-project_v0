import { Prisma, type JobOutbox, type PrismaClient } from '@prisma/client';

export type AriaRecoveryClaimDatabase = Pick<PrismaClient, '$transaction'>;

export async function claimAriaTurnRecoveryJobs(
  database: AriaRecoveryClaimDatabase,
  input: Readonly<{
    limit: number;
    owner: string;
    now: Date;
    leaseExpiresAt: Date;
  }>,
): Promise<readonly JobOutbox[]> {
  return database.$transaction(async (transaction) => {
    const jobs = await transaction.$queryRaw<JobOutbox[]>(Prisma.sql`
      SELECT *
      FROM "canonical_job_outbox"
      WHERE "jobType" = 'RECOVER_ARIA_TURN'::"CanonicalJobType"
        AND "aggregateType" = 'AriaConversationTurn'
        AND "availableAt" <= ${input.now}
        AND (
          "status" IN (
            'PENDING'::"CanonicalOutboxStatus",
            'RETRY_SCHEDULED'::"CanonicalOutboxStatus"
          )
          OR (
            "status" = 'LEASED'::"CanonicalOutboxStatus"
            AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" <= ${input.now})
          )
        )
      ORDER BY "availableAt" ASC, "createdAt" ASC, id ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${input.limit}
    `);
    for (const job of jobs) {
      await transaction.jobOutbox.update({
        where: { id: job.id },
        data: {
          status: 'LEASED',
          leaseOwner: input.owner,
          leaseExpiresAt: input.leaseExpiresAt,
        },
      });
    }
    return Object.freeze(jobs);
  });
}
