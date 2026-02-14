/**
 * PII-safe logging utilities.
 *
 * Never log personal data (names, emails, phones, addresses).
 * Log only: IDs, counts, statuses, hashes, timestamps.
 */

import { createHash } from 'crypto';

/**
 * Hash a string for safe logging (first 8 chars of SHA-256).
 */
export function hashPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 8);
}

/**
 * Build a safe log summary from a diagnostic submission.
 * No PII exposed — only structural metadata.
 */
export function safeSubmissionLog(body: Record<string, unknown>): string {
  const identity = body.identity as Record<string, string> | undefined;
  const competencies = body.competencies as Record<string, unknown[]> | undefined;
  const examPrep = body.examPrep as Record<string, unknown> | undefined;

  const parts: string[] = [];

  if (identity?.email) {
    parts.push(`email_hash=${hashPII(identity.email)}`);
  }
  if (identity?.firstName && identity?.lastName) {
    parts.push(`name_hash=${hashPII(`${identity.firstName}${identity.lastName}`)}`);
  }

  if (competencies) {
    const domainCounts = Object.entries(competencies)
      .map(([k, v]) => `${k}:${Array.isArray(v) ? v.length : 0}`)
      .join(',');
    parts.push(`domains={${domainCounts}}`);
  }

  if (examPrep) {
    const miniTest = examPrep.miniTest as Record<string, unknown> | undefined;
    if (miniTest) {
      parts.push(`miniTest=${miniTest.score}/${miniTest.completedInTime ? 'ok' : 'timeout'}`);
    }
  }

  parts.push(`version=${body.version || 'unknown'}`);
  parts.push(`ts=${new Date().toISOString()}`);

  return parts.join(' | ');
}

/**
 * Build a safe log line for a diagnostic pipeline event.
 */
export function safeDiagnosticLog(
  event: string,
  diagnosticId: string,
  extra?: Record<string, string | number | boolean>
): string {
  const parts = [`[DIAG] ${event} id=${diagnosticId}`];
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      parts.push(`${k}=${v}`);
    }
  }
  return parts.join(' | ');
}
