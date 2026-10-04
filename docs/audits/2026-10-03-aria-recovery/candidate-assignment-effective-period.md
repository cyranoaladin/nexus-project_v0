# Candidate diagnostic access respects the coach assignment period

Read-only security review found that both candidate access helpers required
ACTIVE but ignored startsAt and endsAt. A future or expired assignment therefore
authorized a minor's detailed profile or diagnostic. This is a P1 access defect.

A real PostgreSQL suite reproduces four failures: future and expired assignments
for both the student profile and diagnostic. Eight existing-period/status cases
pass. The suite uses explicit synthetic roots, guarded disposable storage and
the canonical cleanup; it does not mock the assignment query.

Both helpers now reuse the existing assessment/bilan activeAssignmentClause:
ACTIVE, startsAt <= the captured clock, and endsAt null or >= that clock.
The inclusive boundaries preserve that established contract. A server-only
optional clock argument allows deterministic tests; no client timestamp is used.
After correction, all 12 real PostgreSQL cases and 10 existing ownership unit
cases pass. Typecheck and targeted ESLint pass. A second read-only review finds
the refusal before detailed includes intact; it does not replace executed tests.
Refused accesses must never perform a detailed include query. The detailed
diagnostic remains bound to the authorized student's identifiers.

This correction retains existing role and Core parent-authority checks. It does
not claim to migrate coach ownership into Core or qualify cross-database writes.
No schema migration or production data change is involved.

Rollback is an ordinary commit revert. Final exact-SHA CI remains required.
