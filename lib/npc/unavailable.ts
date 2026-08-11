import { CopySubmissionStatus, CopyPageStatus, type Prisma } from '@prisma/client';

export const NPC_UNAVAILABLE_CONFLICT = {
  error: 'Submission unavailable',
  code: 'NPC_SUBMISSION_UNAVAILABLE',
} as const;

export class SubmissionUnavailableError extends Error {
  readonly code = NPC_UNAVAILABLE_CONFLICT.code;

  constructor() {
    super(NPC_UNAVAILABLE_CONFLICT.error);
    this.name = 'SubmissionUnavailableError';
  }
}

export function assertSubmissionAvailable(submission: { status: string }): void {
  if (submission.status === CopySubmissionStatus.UNAVAILABLE) {
    throw new SubmissionUnavailableError();
  }
}

export interface MarkSubmissionUnavailableOptions {
  reason: string;
  actorId: string;
  actorRole: string;
  affectedPageIds?: readonly string[];
  integrityIssueCodes?: readonly string[];
  unavailableAt?: Date;
}

export async function markSubmissionUnavailable(
  tx: Prisma.TransactionClient,
  submissionId: string,
  options: MarkSubmissionUnavailableOptions,
): Promise<{ unavailableAt: Date }> {
  const unavailableAt = options.unavailableAt ?? new Date();
  const affectedPageIds = [...new Set(options.affectedPageIds ?? [])];

  await tx.copySubmission.update({
    where: { id: submissionId },
    data: {
      status: CopySubmissionStatus.UNAVAILABLE,
      unavailableReason: options.reason,
      unavailableAt,
    },
  });

  if (affectedPageIds.length > 0) {
    await tx.copyPage.updateMany({
      where: {
        submissionId,
        id: { in: affectedPageIds },
      },
      data: {
        status: CopyPageStatus.UNAVAILABLE,
        unavailableReason: options.reason,
        unavailableAt,
      },
    });
  }

  await tx.npcAuditLog.create({
    data: {
      actorId: options.actorId,
      actorRole: options.actorRole,
      action: 'MARK_SUBMISSION_UNAVAILABLE',
      entityType: 'CopySubmission',
      entityId: submissionId,
      details: {
        reason: options.reason,
        affectedPageIds,
        integrityIssueCodes: [...new Set(options.integrityIssueCodes ?? [])],
      },
    },
  });

  return { unavailableAt };
}
