/**
 * Raw SQL Fallback Monitor
 *
 * Tracks failures of raw SQL operations used as temporary fallbacks
 * before Prisma typed fields are available post-migration.
 *
 * Observable via:
 *   - getRawSqlFailureCount() in health-check endpoints
 *   - Console logs with count in each error message
 *   - Sentry (if installed) via captureException in catch blocks
 *
 * @module core/raw-sql-monitor
 */

// ─── In-memory failure counter (resets on process restart) ──────────────────
let _rawSqlFailureCount = 0;

/**
 * Increment the raw SQL failure counter.
 * Called from try/catch blocks in assessment submit route.
 */
export function incrementRawSqlFailure(): number {
  _rawSqlFailureCount++;
  return _rawSqlFailureCount;
}

/**
 * Get the current raw SQL failure count.
 * Useful for health-check or admin monitoring endpoints.
 */
export function getRawSqlFailureCount(): number {
  return _rawSqlFailureCount;
}

/**
 * Reset the counter (useful for tests).
 */
export function resetRawSqlFailureCount(): void {
  _rawSqlFailureCount = 0;
}
