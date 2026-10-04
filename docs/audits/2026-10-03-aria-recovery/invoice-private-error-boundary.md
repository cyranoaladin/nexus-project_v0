# Invoice private exception boundary

Date: 2026-10-04.

Invoice PDF and receipt routes logged serialized exceptions including arbitrary messages/stacks. Acceptance: retain canonical client errors and operational failure signals without private exception contents.

Two synthetic private-canary regression cases failed before correction. PDF/receipt read failures now emit fixed event codes; receipt audit-append failures emit a separate fixed code. Three neighboring suites pass, 29 tests, including an asynchronous audit failure canary. Full typecheck, changed-file lint, secret scan and diff check pass. No schema/data/production change.

The receipt audit still uses an asynchronous snapshot overwrite; this commit does not qualify append-only auditing or solve concurrency. Global structured tracing and redaction remain open gates. Rollback is a normal reviewed revert, with no migration.
