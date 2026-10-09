# Invoice state concurrency fence

## Date and cause
2026-10-04, Africa/Tunis. PATCH read a scoped invoice, validated its status, then updated only by ID. Two callers reading the same state could both commit conflicting paid/cancel or duplicate sent transitions. The terminal transaction did not itself reject a stale original status.

## Correction
Both first terminal update and non-terminal update include the original status in their SQL predicate. PostgreSQL decides the winner. The final events write occurs inside the winner’s existing row-locking transaction. Only P2025 with modelName Invoice maps to an opaque 409 conflict; unrelated failures remain errors. A subsequent retry already at the target retains the existing no-op contract. No permission, state transition or amount rule is loosened. No migration.

## Evidence
Real PostgreSQL RED: three failed, one independent-invoice scenario passed. Deterministic read barrier gives both requests the same source snapshot; no arbitrary delay. GREEN: four concurrency cases pass, including terminal side-effect executed once, token revocation and retry no-op. Combined PostgreSQL run: three suites, 12 tests pass (state transition, requester ownership and atomic email queue). 129 migrations from empty DB, replay without pending migration; additive predecessor fixture still passes. Instances are owned, loopback-only/tmpfs and stopped. Logs are private and later campaigns use distinct per-run directories.

A strengthened token fixture initially omitted required createdByUserId: one failed, 11 passed. It was corrected to the synthetic actor and the combined suite renewed; this was not a product race. Unit financial campaign: 28 suites, 375 pass. Targeted lint and typecheck pass.

## Limits
Legacy JSON events are not a substitute for the required immutable append-only financial audit of every mutation. Full provider payment reconciliation and all writers still need qualification. A separate client import/build regression is under correction; this local invariant alone does not make the release ready.
