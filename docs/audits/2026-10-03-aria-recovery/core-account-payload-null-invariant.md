# Account handoff SQL NULL invariant

2026-10-04. NOT_READY. No production operation.

A PostgreSQL CHECK accepts SQL UNKNOWN. The required schemaVersion JSON key
could be present with null and make the 0024 payload predicate UNKNOWN.
Four other null fields were already rejected. Real RED proof 1791153340:
1 failed / 21 passed. No proof or recipient was printed by the assertions.

Migration 0024 remains immutable. Forward migration
0025_core_v2_account_email_payload_fail_closed wraps the complete existing
predicate in COALESCE(..., false). It removes no row, column or table; valid
legacy ARIA and encrypted handoff jobs retain their accepted shapes. Invalid
historical rows block validation and roll back the entire transaction.
Migration SHA-256: `d4f1a65b6db22fcbd1af8baad2cd089b77539fa23ff9ca60226202751c4fa52a`.
No backfill or historical data rewrite is needed for valid rows.
Lock timeout 5 seconds; statement timeout 60 seconds. Real production volume
and lock duration remain a staging/operator gate, not a synthetic proof.

Proof 1791153537: old Core schema 23/native ARIA rows preserved; interrupted
0024 transaction rolls back its enum; expansion only to 24 remains refused by
the feature preflight; interrupted 0025 transaction rolls back its constraint;
current 25 migrations and repeated deploy succeed; empty Core bootstrap also
succeeds. Eight account/HTTP/destination suites, 78 tests pass. Source identity
was stable during the run; source manifests identify HEAD plus precommit hashes.

Canonical command:
`python3 scripts/db/rehearse-stage-decision-migration.py --old-ref 43058877aa13d2e4ff793b951d5aceb7c2a13dbb --include-core-account-handoff --include-core-account-foundations`

The feature schema preflight checks completed immutable migration checksums,
enum and validated constraint before runtime scheduling. Text inspection of
the constraint is a structural guard, not a full SQL equivalence proof.
Rollback uses an application compatible with additive schemas. A compatible
handoff consumer or a drained, qualified backlog is required; reverting to
an application that ignores these jobs is not a proved recovery plan.
No down migration or deletion is authorized.
