import { AiJobStatus, AiJobType, Prisma, type PrismaClient } from '@prisma/client';
import { markPedagogicalDiagnosisFailed } from './submission-finalization';
import { NPC_INTERACTIVE_TRANSACTION_OPTIONS } from '../../lib/npc/transaction';

type JobTransactionHost = Pick<PrismaClient, '$transaction'>;

const TERMINAL_JOB_STATUSES = new Set<AiJobStatus>([
  AiJobStatus.COMPLETED,
  AiJobStatus.FAILED,
  AiJobStatus.CANCELLED,
]);

export async function recordNpcJobFailure({
  prisma,
  jobId,
  errorMessage,
}: {
  prisma: JobTransactionHost;
  jobId: string;
  errorMessage: string;
}): Promise<'terminal-preserved' | 'retrying' | 'failed'> {
  const result = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "ai_processing_jobs"
      WHERE "id" = ${jobId}
      FOR UPDATE
    `);
    if (rows.length === 0) return null;

    const job = await tx.aiProcessingJob.findUnique({
      where: { id: jobId },
      select: {
        status: true,
        retryCount: true,
        maxRetries: true,
        type: true,
        inputData: true,
      },
    });
    if (!job) return null;
    if (TERMINAL_JOB_STATUSES.has(job.status)) {
      return { kind: 'terminal-preserved' as const };
    }

    if (job.retryCount < job.maxRetries) {
      const nextRetryAt = new Date(
        Date.now() + Math.pow(2, job.retryCount) * 60_000,
      );
      await tx.aiProcessingJob.update({
        where: { id: jobId },
        data: {
          status: AiJobStatus.RETRYING,
          retryCount: { increment: 1 },
          nextRetryAt,
          errorMessage: errorMessage.slice(0, 1000),
        },
      });
      return { kind: 'retrying' as const };
    }

    await tx.aiProcessingJob.update({
      where: { id: jobId },
      data: {
        status: AiJobStatus.FAILED,
        errorMessage: errorMessage.slice(0, 1000),
        completedAt: new Date(),
      },
    });
    return {
      kind: 'failed' as const,
      type: job.type,
      inputData: job.inputData,
    };
  }, NPC_INTERACTIVE_TRANSACTION_OPTIONS);

  if (!result) return 'failed';
  if (result.kind === 'terminal-preserved') return result.kind;
  if (result.kind === 'retrying') return result.kind;

  if (result.type === AiJobType.PEDAGOGICAL_DIAGNOSIS) {
    const parsedInput =
      typeof result.inputData === 'string'
        ? JSON.parse(result.inputData)
        : result.inputData;
    const { submissionId } = (parsedInput ?? {}) as { submissionId?: string };
    if (submissionId) {
      await markPedagogicalDiagnosisFailed(prisma, submissionId);
    }
  }
  return 'failed';
}
