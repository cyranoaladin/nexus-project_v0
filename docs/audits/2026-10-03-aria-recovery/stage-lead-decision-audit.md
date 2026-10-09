# Declining an unlinked historical stage lead

## Scope and acceptance

Source before this lot: `43058877aa13d2e4ff793b951d5aceb7c2a13dbb`.
Only authenticated staff with reservation-update permission may decline an unlinked,
unactivated, unpaid historical lead. CSRF, bounded input, staff/resource rate limits,
private response caching and a canonical UUID command key apply. A decline changes
both legacy and rich status to CANCELLED and records the transition atomically.
Concurrent retries of the same command succeed with one audit; reuse for another
lead is rejected. Paid, activated, linked and other workflow states are refused.

This endpoint does not approve a payment or activate an enrollment. Approval without
payment permission is forbidden; approval with that permission directs the caller
to canonical confirmation/reconciliation and returns a controlled conflict. New
stage-linked leads require their canonical cancellation workflow, which remains a
qualification gap. The legacy GET listing is outside this correction.

## Additive migration

`20261004214500_stage_reservation_decision_audit/migration.sql` adds one audit table,
two restrictive foreign keys, indexes, transition constraints and an append-only
trigger. No existing row is changed, no historical event is fabricated, and no
backfill is necessary. The DDL is transactional with a five-second lock timeout
and a sixty-second statement timeout. This is migration 132 in the local chain.
The account-deletion FK inventory now includes 113 matching entries.

Older application reads and inserts remain schema-compatible. An old application
could still perform its unaudited unsafe decision write: application rollback must
therefore keep that endpoint closed until a compatible version is qualified. This
document is not a proof of an operational staging rollback.

## Reproducible verification

```sh
python3 scripts/db/rehearse-stage-decision-migration.py --old-ref 43058877aa13d2e4ff793b951d5aceb7c2a13dbb
```

Prerequisites: local locked Node tooling, Docker and Python cryptography. The runner
owns an explicitly labelled, pinned pgvector container with tmpfs storage and an
ephemeral loopback port; it never accepts a production database URL.

The October 4 run in `.artifacts/recovery/stage-lead-decision-green-1791147755`
deployed the preceding 131 migrations, seeded synthetic rows, encrypted and
restored their dump in a separate disposable database, verified their hashes,
closed a PostgreSQL connection before DDL COMMIT to prove rollback, deployed the
new migration and verified unchanged old rows and replay with no pending migration.
Five real PostgreSQL tests passed, covering concurrent identical and distinct
commands, cross-lead command reuse, FK-error rollback and append-only enforcement.
The owned container was stopped after the run.

The encrypted fixture uses a key held only in process memory. It proves this
synthetic restore procedure, not durable backup custody or production RPO/RTO.
Connection interruption does not prove recovery from a failed Prisma migration
journal or a killed deployment process. Those operational gates remain open.

Six targeted suites passed: 63 tests. Targeted lint and `npm run typecheck` passed;
`git diff --check` passed. Earlier fresh-database rehearsal also passed five real
PostgreSQL tests in `stage-lead-decision-green-1791146849`.

## Defects found during qualification

RED tests exposed absent permission/CSRF/audit controls, replay races, omitted
activation markers and inconsistent legacy/rich status. Real concurrent execution
then exposed a loser reading the already-cancelled rich status before observing
the winner's audit. State checking now resolves the committed command first.
Two unsuccessful rehearsal setups (directory symlinks not followed by Prisma;
disposable database name rejected by the existing guard) were fixed in the harness,
without weakening the guard. Their private artifacts were retained.

## Remaining gates

Production backup/restore, retention approval, TLS rotation proof, exact-head CI,
human review and staging rollback remain unproved. No production migration,
notification, payment or release was performed for this lot.

## Follow-up: credential scan of the runner

The published Lint job on `28b692f60d99fc46522e6ef04bf612217f8f05d5` stopped in `security:repo`, identifying `CREDENTIALED_DATABASE_URL` at runner line 27. Its source concatenation was not a stored credential: the password was generated in process memory. The runner now constructs a structured URL with an encoded credential component instead of assembling a credential-looking literal; the scanner is unchanged. The full versioned-credential scanner now reports zero findings. The complete rehearsal was repeated successfully in `stage-lead-decision-green-1791148101`, including all five real database tests. No scanner exclusion or assignment exception was added.
