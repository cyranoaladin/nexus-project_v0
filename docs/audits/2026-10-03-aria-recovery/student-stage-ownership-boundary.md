# Student stage reservation ownership

Date: 2026-10-04.

The shared student/cockpit builder used `studentId = currentStudent OR email = currentEmail`. The email branch admitted reservations explicitly assigned to another student and historical unlinked records. Email is contact data, not ownership authority.

Acceptance: only the explicit Student.id link authorizes a stage reservation; preserve owned reservations after an email change; leave ambiguous historical rows unchanged. The query and defensive projection now require that link before stage bilan lookups, calendar and Hub assembly.

One new builder regression failed before correction (25 existing tests passed). Four neighboring suites pass after correction: 79 tests. Two actual disposable PostgreSQL cases prove a foreign linked and an unlinked reservation sharing the email are absent, all three rows remain untouched, and changing the user's email retains the explicitly owned reservation. Full typecheck, changed-file lint, diff check and secret scan pass.

No ownership backfill, migration, price, production or frozen-worktree change. Historical unlinked reservations require controlled ownership recovery, not automatic email attribution. Complete stage booking, payment, capacity and parent authorization qualification remains open. Rollback is a normal isolated reviewed application revert.
