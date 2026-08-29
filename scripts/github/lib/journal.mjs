import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Append-only, local-only, never a live mutation. Every field named here
// is a hash or a status token — never a settings value or secret.
export function appendJournalEntry(journalPath, entry) {
  mkdirSync(dirname(journalPath), { recursive: true, mode: 0o700 });
  const line = `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`;
  appendFileSync(journalPath, line, { mode: 0o600 });
  return line;
}

export function newJournalEntry({
  operation,
  prestateSha256,
  intendedDiff,
  apiOperationAttempted,
  poststateSha256 = null,
  rollback = 'NOT_ATTEMPTED',
  outcome,
}) {
  if (!['SUCCESS', 'FAILED', 'DRY_RUN'].includes(outcome)) {
    throw new Error(`JOURNAL_INVALID_OUTCOME: ${outcome}`);
  }
  if (!['NOT_ATTEMPTED', 'SUCCEEDED', 'FAILED'].includes(rollback)) {
    throw new Error(`JOURNAL_INVALID_ROLLBACK_STATE: ${rollback}`);
  }
  return {
    operation,
    prestateSha256,
    intendedDiff,
    apiOperationAttempted,
    poststateSha256,
    rollback,
    outcome,
  };
}
