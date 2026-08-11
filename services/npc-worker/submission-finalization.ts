import {
  CopyPageStatus,
  CopySubmissionStatus,
  PedagogicalReportStatus,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';
import {
  validateCopySubmissionIntegrity,
  type CopySubmissionIntegrityResult,
} from '../../lib/npc/submission-integrity';
import { withLockedCopySubmission } from '../../lib/npc/submission-lock';
import {
  markSubmissionUnavailable,
} from '../../lib/npc/unavailable';

type TransactionHost = Pick<PrismaClient, '$transaction'>;

export type SubmissionIntegrityGateResult = CopySubmissionIntegrityResult & {
  reportId?: string;
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

export async function persistVisionOcrResult({
  prisma,
  submissionId,
  pageId,
  text,
}: {
  prisma: TransactionHost;
  submissionId: string;
  pageId: string;
  text: string;
}): Promise<'updated' | 'unavailable'> {
  return prisma.$transaction(async (tx) =>
    withLockedCopySubmission(tx, submissionId, async (locked) => {
      if (locked.status === CopySubmissionStatus.UNAVAILABLE) {
        return 'unavailable' as const;
      }

      const page = await tx.copyPage.findFirst({
        where: { id: pageId, submissionId },
        select: { id: true },
      });
      if (!page) {
        throw new Error('Copy page not found');
      }
      await tx.copyPage.update({
        where: { id: page.id },
        data: {
          ocrText: text,
          status: CopyPageStatus.READY,
        },
      });
      return 'updated' as const;
    }),
  );
}

export async function validateSubmissionBeforeDiagnosis(
  prisma: TransactionHost,
  submissionId: string,
): Promise<SubmissionIntegrityGateResult> {
  return prisma.$transaction(async (tx) =>
    withLockedCopySubmission(tx, submissionId, async (locked) => {
      if (locked.status === CopySubmissionStatus.UNAVAILABLE) {
        return { ok: false, issues: [] };
      }
      const result = await verifyIntegrityUnderLock(tx, submissionId);
      if (!result.ok) {
        await tombstoneIntegrityFailure(tx, submissionId, result);
      }
      return result;
    }),
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
}: {
  prisma: TransactionHost;
  submissionId: string;
  jobId: string;
  diagnosticOutput: unknown;
}): Promise<SubmissionIntegrityGateResult> {
  return prisma.$transaction(async (tx) =>
    withLockedCopySubmission(tx, submissionId, async (locked) => {
      if (locked.status === CopySubmissionStatus.UNAVAILABLE) {
        return { ok: false, issues: [] };
      }

      const integrity = await verifyIntegrityUnderLock(tx, submissionId);
      if (!integrity.ok) {
        await tombstoneIntegrityFailure(tx, submissionId, integrity);
        return integrity;
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
      return { ...integrity, reportId: report.id };
    }),
  );
}

export async function markPedagogicalDiagnosisFailed(
  prisma: TransactionHost,
  submissionId: string,
): Promise<'unavailable' | 'failed'> {
  return prisma.$transaction(async (tx) =>
    withLockedCopySubmission(tx, submissionId, async (locked) => {
      if (locked.status === CopySubmissionStatus.UNAVAILABLE) {
        return 'unavailable' as const;
      }
      await tx.copySubmission.update({
        where: { id: submissionId },
        data: { status: CopySubmissionStatus.ANALYSIS_FAILED },
      });
      return 'failed' as const;
    }),
  );
}
