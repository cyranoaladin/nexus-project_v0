import { CopySubmissionStatus } from '@prisma/client';
import { assertSubmissionAvailable } from './unavailable';

export const NPC_INVENTORY_FROZEN_CONFLICT = {
  error: 'Submission document inventory is frozen',
  code: 'NPC_SUBMISSION_INVENTORY_FROZEN',
} as const;

export class SubmissionInventoryFrozenError extends Error {
  readonly code = NPC_INVENTORY_FROZEN_CONFLICT.code;

  constructor() {
    super(NPC_INVENTORY_FROZEN_CONFLICT.error);
    this.name = 'SubmissionInventoryFrozenError';
  }
}

const FROZEN_STATUSES = new Set<string>([
  CopySubmissionStatus.QUEUED_FOR_ANALYSIS,
  CopySubmissionStatus.ANALYZING,
  CopySubmissionStatus.COMPLETED,
  CopySubmissionStatus.ARCHIVED,
]);

export function assertSubmissionInventoryMutable(submission: {
  status: string;
}): void {
  assertSubmissionAvailable(submission);
  if (FROZEN_STATUSES.has(submission.status)) {
    throw new SubmissionInventoryFrozenError();
  }
}
