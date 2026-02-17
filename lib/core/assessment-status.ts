/**
 * Assessment Status Helpers
 *
 * Single source of truth for assessment completion status checks.
 * Used by cohort statistics, percentile computation, and any query
 * that needs to filter on "finished" assessments.
 *
 * Prisma enum AssessmentStatus: PENDING | SCORING | GENERATING | COMPLETED | FAILED
 *
 * @module core/assessment-status
 */

/**
 * All assessment statuses considered "completed" for cohort/SSN purposes.
 *
 * Currently only `COMPLETED`. If a future status (e.g. `ARCHIVED`) should
 * also count, add it here — every consumer will pick it up automatically.
 */
export const COMPLETED_STATUSES = ['COMPLETED'] as const;

/**
 * Check if an assessment status represents a completed evaluation
 * suitable for inclusion in cohort statistics and SSN normalization.
 *
 * @param status - The assessment status string
 * @returns true if the assessment should be included in cohort computations
 *
 * @example
 * ```typescript
 * if (isCompletedAssessmentStatus(assessment.status)) {
 *   // include in cohort
 * }
 * ```
 */
export function isCompletedAssessmentStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return (COMPLETED_STATUSES as readonly string[]).includes(status);
}
