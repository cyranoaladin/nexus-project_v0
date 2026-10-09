# Stage decision authority at commit

October 4, 2026. Source before this lot: `e824c5f42`.

The route's role check protected the observed HTTP call, but the exported service
did not check the canonical actor before its transaction. A read-only review
confirmed no current ARIA caller; this is not reported as a demonstrated public
impersonation exploit. Four properly reproduced RED cases covered Core/missing
authority, absent V1 actor, insufficient role and a merged identity. An initial
empty-array Jest fixture incorrectly triggered done-callback semantics; it was
corrected before counting these four causal failures.

The legacy mutation now requires an explicit V1 authority. No Core identity may
borrow a V1 mirror's permissions, and an old session without a known authority
must authenticate again. Before retry lookup or CAS, the service locks and reads
the V1 User with parameterized SELECT FOR SHARE and checks canonical reservation
update permission and absence of a merge tombstone. The unique-conflict recovery
also rechecks authorization in a transaction. There is no invented active-state
field: User V1 has no accountStatus, and activatedAt primarily concerns pupils.

The lock orders authorization before lead mutation and blocks concurrent role
updates/deletion until the transaction ends. A real PostgreSQL test holds a role
revocation open, observes the service waiting on FOR SHARE, commits revocation and
verifies refusal with the lead unchanged. Another test confirms retry refusal
after role revocation, including an already-successful command. The absent actor
is rejected before writing. The former absent-actor audit test would no longer
reach an FK: it now exercises the same rollback invariant through an explicit
synthetic direct-writer transaction and requires P2003, preserving the proof of
rollback instead of relabelling an authorization refusal as an FK test.

Five targeted suites passed 53 tests, including all 26 decision cases. Two real
PostgreSQL suites passed ten tests in
`.artifacts/recovery/stage-lead-decision-green-1791148919`, after synthetic
old-schema encrypted restore and migration replay. Targeted lint, final typecheck
and diff-check passed. No migration or production operation was added.

This V1 transaction is not a distributed authorization lock across Core/V1 stores.
Core actors are refused on this legacy mutation; a coordinated canonical Core
workflow remains necessary. Staging, writer quiescence, production backup/restore,
TLS, retention, exact-head CI and human review remain separate gates.
