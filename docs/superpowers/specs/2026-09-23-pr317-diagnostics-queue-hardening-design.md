# PR #317 — Diagnostics Queue Hardening Design

## Context

PR #317 exposes an operational staff queue for candidat-libre diagnostic submissions. The current implementation loads every submission in Node, treats superseded versions as actionable, exposes the shared public-user payload, and uses an id cursor that can silently restart at page one.

## Decisions

### One canonical current submission

The operational queue contains at most one submission per assignment: the highest-version submission whose status is not `REJECTED`. This is the same rule already used by the candidate and staff diagnostic screens. A shared pure contract (`CURRENT_USABLE_DIAGNOSTIC_SUBMISSION_STATUSES`, `isUsableDiagnosticSubmission`, and an in-memory selector) is reused by those screens and parameterizes the SQL predicate; SQL/in-memory parity is tested. Rejected rows remain historical/audit records and do not replace the last usable submission. Historical versions remain available on dossier/detail surfaces only.

The queue state continues to be projected by `projectDiagnosticQueueState`; the SQL query reproduces that projection once for filtering and ordering, and future counters reuse the same query semantics.

### Bounded PostgreSQL query

Use a Core v2 repository query built from parameterized Prisma SQL:

1. select the latest non-rejected submission per assignment with `DISTINCT ON (assignment_id)` ordered by version descending;
2. join only candidate identity, instrument, processing, and latest draft status/activity;
3. project queue state and sort rank in SQL;
4. apply the requested filter;
5. apply keyset predicates;
6. order by state rank, last activity, and submission id;
7. fetch `limit + 1` rows.

The exact order is `stateRank ASC, lastActivityAt ASC, submissionId ASC`; the after-cursor predicate is the matching lexicographic disjunction. No projection table and no unused `totalCount` scan are added. Anchor validation and page selection execute from one repeatable-read snapshot (or one statement).

### Stable opaque cursor

The cursor is a versioned opaque base64url payload containing filter identity and the complete sort key: state rank, last activity timestamp, and submission id. Invalid syntax is a validation error. A cursor whose anchor no longer belongs to the same filtered list produces `listChanged: true` (or the equivalent `staleCursor` contract) and a fresh first page. The client replaces its list in that case and always deduplicates by `submissionId` before committing state.

### PII minimization

Add `queueCandidateSelect` and return the flat shape `candidate: { id: studentId, firstName, lastName }`. The queue payload never contains `user.id`, email, phone, account/activation fields, or User timestamps. Academic content remains unreachable from the query.

### E2E proof

A real Playwright flow logs in as ADMIN, opens Diagnostics candidat libre, verifies that only v2 of a two-version assignment is actionable, applies “Action requise”, opens the row, and reaches the canonical detail route. The assertion also verifies that confidential academic fields and unnecessary PII are absent from the list response/UI.

## Error handling

- malformed cursor: HTTP 400 through the normal Core v2 validation envelope;
- stale/incompatible cursor: successful response with explicit replacement signal;
- no current usable submission: assignment absent from the operational queue;
- historical/rejected versions: never actionable from the queue.

## Verification

Use strict red-green-refactor for current-submission selection, cursor behavior, payload shape, DB bounding, client merge behavior, and E2E. Finish with targeted tests, Core v2 suite, typecheck, lint, architecture guards, Playwright, and the PR CI matrix.
