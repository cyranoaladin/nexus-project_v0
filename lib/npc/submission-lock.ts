import { Prisma, type CopySubmissionStatus } from '@prisma/client';

export interface LockedCopySubmission {
  id: string;
  studentId: string;
  coachId: string | null;
  status: CopySubmissionStatus;
  unavailableReason: string | null;
  unavailableAt: Date | null;
  storedFilePath: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
}

export class CopySubmissionNotFoundError extends Error {
  constructor() {
    super('Copy submission not found');
    this.name = 'CopySubmissionNotFoundError';
  }
}

export async function withLockedCopySubmission<T>(
  tx: Prisma.TransactionClient,
  submissionId: string,
  callback: (submission: LockedCopySubmission) => Promise<T>,
): Promise<T> {
  const lockedRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "copy_submissions"
    WHERE "id" = ${submissionId}
    FOR UPDATE
  `);

  if (lockedRows.length === 0) {
    throw new CopySubmissionNotFoundError();
  }

  const submission = await tx.copySubmission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      studentId: true,
      coachId: true,
      status: true,
      unavailableReason: true,
      unavailableAt: true,
      storedFilePath: true,
      fileSizeBytes: true,
      mimeType: true,
    },
  });

  if (!submission) {
    throw new CopySubmissionNotFoundError();
  }

  return callback(submission);
}
