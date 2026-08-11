import {
  AiJobStatus,
  AiJobType,
  CopySubmissionStatus,
  Prisma,
  type PrismaClient,
} from '@prisma/client';
import {
  withLockedCopySubmission,
  type LockedCopySubmission,
} from '../../lib/npc/submission-lock';
import { NPC_INTERACTIVE_TRANSACTION_OPTIONS } from '../../lib/npc/transaction';

type JobTransactionHost = Pick<PrismaClient, '$transaction'>;

const TERMINAL_JOB_STATUSES = new Set<AiJobStatus>([
  AiJobStatus.COMPLETED,
  AiJobStatus.FAILED,
  AiJobStatus.CANCELLED,
]);

type FailureResult = 'terminal-preserved' | 'retrying' | 'failed';

function diagnosisSubmissionId(job: {
  type: AiJobType;
  copySubmissionId: string | null;
  inputData: Prisma.JsonValue | null;
}): string | null {
  if (job.type !== AiJobType.PEDAGOGICAL_DIAGNOSIS) return null;
  if (job.copySubmissionId) return job.copySubmissionId;
  const parsedInput =
    typeof job.inputData === 'string'
      ? JSON.parse(job.inputData)
      : job.inputData;
  const { submissionId } = (parsedInput ?? {}) as { submissionId?: unknown };
  return typeof submissionId === 'string' && submissionId ? submissionId : null;
}

async function recordFailureUnderJobLock({
  tx,
  jobId,
  errorMessage,
  lockedSubmission,
}: {
  tx: Prisma.TransactionClient;
  jobId: string;
  errorMessage: string;
  lockedSubmission?: LockedCopySubmission;
}): Promise<FailureResult | null> {
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
      copySubmissionId: true,
      inputData: true,
    },
  });
  if (!job) return null;
  if (TERMINAL_JOB_STATUSES.has(job.status)) return 'terminal-preserved';

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
    return 'retrying';
  }

  await tx.aiProcessingJob.update({
    where: { id: jobId },
    data: {
      status: AiJobStatus.FAILED,
      errorMessage: errorMessage.slice(0, 1000),
      completedAt: new Date(),
    },
  });

  if (job.type === AiJobType.PEDAGOGICAL_DIAGNOSIS && lockedSubmission) {
    if (diagnosisSubmissionId(job) !== lockedSubmission.id) {
      throw new Error(
        'NPC diagnosis job submission changed while recording failure',
      );
    }
    if (
      lockedSubmission.status !== CopySubmissionStatus.UNAVAILABLE &&
      lockedSubmission.status !== CopySubmissionStatus.COMPLETED
    ) {
      await tx.copySubmission.update({
        where: { id: lockedSubmission.id },
        data: { status: CopySubmissionStatus.ANALYSIS_FAILED },
      });
    }
  }
  return 'failed';
}

export async function recordNpcJobFailure({
  prisma,
  jobId,
  errorMessage,
}: {
  prisma: JobTransactionHost;
  jobId: string;
  errorMessage: string;
}): Promise<FailureResult> {
  const result = await prisma.$transaction(async (tx) => {
    const candidate = await tx.aiProcessingJob.findUnique({
      where: { id: jobId },
      select: {
        type: true,
        copySubmissionId: true,
        inputData: true,
      },
    });
    if (!candidate) return null;
    const submissionId = diagnosisSubmissionId(candidate);
    if (!submissionId) {
      return recordFailureUnderJobLock({ tx, jobId, errorMessage });
    }
    return withLockedCopySubmission(tx, submissionId, (lockedSubmission) =>
      recordFailureUnderJobLock({
        tx,
        jobId,
        errorMessage,
        lockedSubmission,
      }),
    );
  }, NPC_INTERACTIVE_TRANSACTION_OPTIONS);

  if (!result) return 'failed';
  return result;
}
