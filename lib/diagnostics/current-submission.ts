/**
 * Canonical definition of the current usable diagnostic submission.
 *
 * Rejected rows are immutable audit evidence, never an operational copy.
 * Among usable rows, the greatest assignment-local version is current.
 * Keep this contract framework-agnostic so server repositories and client
 * read models cannot drift into separate definitions.
 */
export const CURRENT_DIAGNOSTIC_SUBMISSION_STATUSES = ['RECEIVED', 'READABLE', 'ANALYZED'] as const;

export type CurrentDiagnosticSubmissionStatus = (typeof CURRENT_DIAGNOSTIC_SUBMISSION_STATUSES)[number];

export interface DiagnosticSubmissionVersion {
  readonly version: number;
  readonly status: CurrentDiagnosticSubmissionStatus | 'REJECTED';
}

const CURRENT_STATUS_SET: ReadonlySet<string> = new Set(CURRENT_DIAGNOSTIC_SUBMISSION_STATUSES);

export function isUsableDiagnosticSubmission<T extends { readonly status: string }>(
  submission: T,
): submission is T & { readonly status: CurrentDiagnosticSubmissionStatus } {
  return CURRENT_STATUS_SET.has(submission.status);
}

export function selectCurrentDiagnosticSubmission<T extends DiagnosticSubmissionVersion>(
  submissions: readonly T[],
): T | null {
  let current: T | null = null;
  for (const submission of submissions) {
    if (!isUsableDiagnosticSubmission(submission)) continue;
    if (!current || submission.version > current.version) current = submission;
  }
  return current;
}
