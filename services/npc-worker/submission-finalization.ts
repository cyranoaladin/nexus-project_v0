import {
  AiJobStatus,
  CopyPageStatus,
  CopySubmissionStatus,
  PedagogicalReportStatus,
  Prisma,
  type PrismaClient,
} from '@prisma/client';
import {
  validateCopySubmissionIntegrity,
  type CopySubmissionIntegrityIssue,
  type CopySubmissionIntegrityResult,
} from '../../lib/npc/submission-integrity';
import { withLockedCopySubmission } from '../../lib/npc/submission-lock';
import { markSubmissionUnavailable } from '../../lib/npc/unavailable';
import { NPC_INTERACTIVE_TRANSACTION_OPTIONS } from '../../lib/npc/transaction';

type TransactionHost = Pick<PrismaClient, '$transaction'>;

async function lockNpcJob(
  tx: Prisma.TransactionClient,
  jobId: string,
): Promise<{ status: AiJobStatus }> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "ai_processing_jobs"
    WHERE "id" = ${jobId}
    FOR UPDATE
  `);
  if (rows.length === 0) throw new Error('NPC job not found');
  return tx.aiProcessingJob.findUniqueOrThrow({
    where: { id: jobId },
    select: { status: true },
  });
}

export type NpcJobHandlerOutcome =
  | { kind: 'proceed' }
  | { kind: 'updated' }
  | {
      kind: 'completed';
      reportId: string;
      idempotent: boolean;
    }
  | {
      kind: 'terminal';
      jobStatus: typeof AiJobStatus.FAILED | typeof AiJobStatus.CANCELLED;
      errorCode: string;
      issues?: CopySubmissionIntegrityIssue[];
    };

const integritySelection = {
  id: true,
  storedFilePath: true,
  fileSizeBytes: true,
  mimeType: true,
  pages: {
    select: {
      id: true,
      documentType: true,
      status: true,
      originalFilePath: true,
      sizeBytes: true,
      sha256: true,
      mimeType: true,
      convertedFilePaths: true,
    },
  },
} satisfies Prisma.CopySubmissionSelect;

async function verifyIntegrityUnderLock(
  tx: Prisma.TransactionClient,
  submissionId: string,
): Promise<CopySubmissionIntegrityResult> {
  const submission = await tx.copySubmission.findUniqueOrThrow({
    where: { id: submissionId },
    select: integritySelection,
  });
  return validateCopySubmissionIntegrity(submission);
}

async function tombstoneIntegrityFailure(
  tx: Prisma.TransactionClient,
  submissionId: string,
  result: CopySubmissionIntegrityResult,
): Promise<void> {
  const affectedPageIds = result.issues
    .map((issue) => issue.pageId)
    .filter((pageId): pageId is string => Boolean(pageId));
  await markSubmissionUnavailable(tx, submissionId, {
    reason: 'SOURCE_INTEGRITY_FAILED',
    actorId: 'npc-worker',
    actorRole: 'SYSTEM',
    affectedPageIds,
    integrityIssueCodes: result.issues.map((issue) => issue.code),
  });
}

async function terminalJob(
  tx: Prisma.TransactionClient,
  jobId: string,
  jobStatus: typeof AiJobStatus.FAILED | typeof AiJobStatus.CANCELLED,
  errorCode: string,
  issues?: CopySubmissionIntegrityIssue[],
): Promise<NpcJobHandlerOutcome> {
  await tx.aiProcessingJob.update({
    where: { id: jobId },
    data: {
      status: jobStatus,
      errorMessage: errorCode,
      completedAt: new Date(),
      nextRetryAt: null,
    },
  });
  return {
    kind: 'terminal',
    jobStatus,
    errorCode,
    ...(issues ? { issues } : {}),
  };
}

export async function persistVisionOcrResult({
  prisma,
  submissionId,
  pageId,
  jobId,
  text,
}: {
  prisma: TransactionHost;
  submissionId: string;
  pageId: string;
  jobId: string;
  text: string;
}): Promise<NpcJobHandlerOutcome> {
  return prisma.$transaction(async (tx) =>
    withLockedCopySubmission(tx, submissionId, async (locked) => {
      const job = await lockNpcJob(tx, jobId);
      if (locked.status === CopySubmissionStatus.UNAVAILABLE) {
        return terminalJob(
          tx,
          jobId,
          AiJobStatus.CANCELLED,
          'NPC_SUBMISSION_UNAVAILABLE',
        );
      }
      if (job.status !== AiJobStatus.PROCESSING) {
        return terminalJob(
          tx,
          jobId,
          AiJobStatus.FAILED,
          'NPC_OCR_STATE_CONFLICT',
        );
      }

      const page = await tx.copyPage.findFirst({
        where: { id: pageId, submissionId },
        select: { id: true },
      });
      if (!page) throw new Error('Copy page not found');
      await tx.copyPage.update({
        where: { id: page.id },
        data: { ocrText: text, status: CopyPageStatus.READY },
      });
      await tx.aiProcessingJob.update({
        where: { id: jobId },
        data: {
          status: AiJobStatus.COMPLETED,
          completedAt: new Date(),
          errorMessage: null,
          nextRetryAt: null,
          outputData: { text },
        },
      });
      return { kind: 'updated' as const };
    }),
    NPC_INTERACTIVE_TRANSACTION_OPTIONS,
  );
}

export async function validateSubmissionBeforeDiagnosis({
  prisma,
  submissionId,
  jobId,
}: {
  prisma: TransactionHost;
  submissionId: string;
  jobId: string;
}): Promise<NpcJobHandlerOutcome> {
  return prisma.$transaction(async (tx) =>
    withLockedCopySubmission(tx, submissionId, async (locked) => {
      const job = await lockNpcJob(tx, jobId);
      if (locked.aiJobId !== jobId) {
        return terminalJob(
          tx,
          jobId,
          AiJobStatus.FAILED,
          'NPC_JOB_BINDING_MISMATCH',
        );
      }
      if (
        locked.status === CopySubmissionStatus.COMPLETED &&
        locked.report &&
        job.status === AiJobStatus.COMPLETED
      ) {
        return {
          kind: 'completed',
          reportId: locked.report.id,
          idempotent: true,
        };
      }
      if (locked.status === CopySubmissionStatus.UNAVAILABLE) {
        return terminalJob(
          tx,
          jobId,
          AiJobStatus.FAILED,
          'NPC_SUBMISSION_UNAVAILABLE',
        );
      }
      if (
        (locked.status !== CopySubmissionStatus.QUEUED_FOR_ANALYSIS &&
          locked.status !== CopySubmissionStatus.ANALYZING) ||
        job.status !== AiJobStatus.PROCESSING
      ) {
        return terminalJob(
          tx,
          jobId,
          AiJobStatus.FAILED,
          'NPC_FINALIZATION_STATE_CONFLICT',
        );
      }

      const result = await verifyIntegrityUnderLock(tx, submissionId);
      if (!result.ok) {
        await tombstoneIntegrityFailure(tx, submissionId, result);
        return terminalJob(
          tx,
          jobId,
          AiJobStatus.FAILED,
          'NPC_SOURCE_INTEGRITY_FAILED',
          result.issues,
        );
      }
      if (locked.status === CopySubmissionStatus.QUEUED_FOR_ANALYSIS) {
        await tx.copySubmission.update({
          where: { id: submissionId },
          data: { status: CopySubmissionStatus.ANALYZING },
        });
      }
      return { kind: 'proceed' as const };
    }),
    NPC_INTERACTIVE_TRANSACTION_OPTIONS,
  );
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    if (typeof entry === 'string') return entry;
    if (entry && typeof entry === 'object') {
      const record = entry as Record<string, unknown>;
      const candidate = record.skill ?? record.description;
      if (typeof candidate === 'string') return candidate;
    }
    return JSON.stringify(entry);
  });
}

export async function finalizePedagogicalDiagnosis({
  prisma,
  submissionId,
  jobId,
  diagnosticOutput,
  tokensUsed,
  processingDurationMs,
}: {
  prisma: TransactionHost;
  submissionId: string;
  jobId: string;
  diagnosticOutput: unknown;
  tokensUsed?: number;
  processingDurationMs?: number;
}): Promise<NpcJobHandlerOutcome> {
  return prisma.$transaction(async (tx) =>
    withLockedCopySubmission(tx, submissionId, async (locked) => {
      const job = await lockNpcJob(tx, jobId);
      if (locked.aiJobId !== jobId) {
        return terminalJob(
          tx,
          jobId,
          AiJobStatus.FAILED,
          'NPC_JOB_BINDING_MISMATCH',
        );
      }
      if (
        locked.status === CopySubmissionStatus.COMPLETED &&
        locked.report &&
        job.status === AiJobStatus.COMPLETED
      ) {
        return {
          kind: 'completed',
          reportId: locked.report.id,
          idempotent: true,
        };
      }
      if (
        locked.status === CopySubmissionStatus.COMPLETED ||
        locked.status === CopySubmissionStatus.UNAVAILABLE ||
        job.status !== AiJobStatus.PROCESSING ||
        locked.report
      ) {
        return terminalJob(
          tx,
          jobId,
          AiJobStatus.FAILED,
          'NPC_FINALIZATION_STATE_CONFLICT',
        );
      }

      const integrity = await verifyIntegrityUnderLock(tx, submissionId);
      if (!integrity.ok) {
        await tombstoneIntegrityFailure(tx, submissionId, integrity);
        return terminalJob(
          tx,
          jobId,
          AiJobStatus.FAILED,
          'NPC_SOURCE_INTEGRITY_FAILED',
          integrity.issues,
        );
      }

      if (locked.status !== CopySubmissionStatus.ANALYZING) {
        return terminalJob(
          tx,
          jobId,
          AiJobStatus.FAILED,
          'NPC_FINALIZATION_STATE_CONFLICT',
        );
      }

      const diagnostic = diagnosticOutput as Record<string, unknown> | null;
      const report = await tx.pedagogicalReport.create({
        data: {
          studentId: locked.studentId,
          coachId: locked.coachId,
          copySubmissionId: locked.id,
          status: PedagogicalReportStatus.DRAFT,
          visibility: 'COACH_ONLY',
          diagnostic: diagnosticOutput as Prisma.InputJsonValue,
          strengths: stringList(diagnostic?.strengths),
          weaknesses: stringList(diagnostic?.weaknesses),
        },
      });
      await tx.copySubmission.update({
        where: { id: submissionId },
        data: { status: CopySubmissionStatus.COMPLETED },
      });
      await tx.npcAuditLog.create({
        data: {
          actorId: 'npc-worker',
          actorRole: 'SYSTEM',
          action: 'COMPLETE_PEDAGOGICAL_DIAGNOSIS',
          entityType: 'CopySubmission',
          entityId: submissionId,
          reportId: report.id,
          details: { jobId },
        },
      });
      await tx.aiProcessingJob.update({
        where: { id: jobId },
        data: {
          status: AiJobStatus.COMPLETED,
          completedAt: new Date(),
          errorMessage: null,
          nextRetryAt: null,
          outputData: diagnosticOutput as Prisma.InputJsonValue,
          tokensUsed,
          processingDurationMs,
        },
      });
      return {
        kind: 'completed',
        reportId: report.id,
        idempotent: false,
      };
    }),
    NPC_INTERACTIVE_TRANSACTION_OPTIONS,
  );
}

export async function markPedagogicalDiagnosisFailed(
  prisma: TransactionHost,
  submissionId: string,
): Promise<'unavailable' | 'completed' | 'failed'> {
  return prisma.$transaction(async (tx) =>
    withLockedCopySubmission(tx, submissionId, async (locked) => {
      if (locked.status === CopySubmissionStatus.UNAVAILABLE) {
        return 'unavailable' as const;
      }
      if (locked.status === CopySubmissionStatus.COMPLETED) {
        return 'completed' as const;
      }
      await tx.copySubmission.update({
        where: { id: submissionId },
        data: { status: CopySubmissionStatus.ANALYSIS_FAILED },
      });
      return 'failed' as const;
    }),
    NPC_INTERACTIVE_TRANSACTION_OPTIONS,
  );
}
