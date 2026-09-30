# DB-core test cleanup — post-merge timeout investigation

## Date

2026-09-30 UTC

## Contexte et preuve historique

- PR #326 head `1e68d750aaaab5dc5e77bcd322a52dc9f3c10f86` and merge `526657755919bb104a779459284042b9ee495a24` have the same Git tree `c933dc322523f912b402fc2d7c49a65e197b9148`.
- [PR Real DB Integration](https://github.com/cyranoaladin/nexus-project_v0/actions/runs/36705426209/job/109855060929): 281/281 db-core tests passed in 190.443 s.
- [Post-merge Real DB Integration](https://github.com/cyranoaladin/nexus-project_v0/actions/runs/36712224174/job/109876498062): 269/281 passed, 12 failed via two 10 s `beforeAll` timeouts; db-core took 860.819 s. The log did not isolate connection, cleanup and fixture durations. PostgreSQL checkpoint duration alone does not prove storage saturation or a cleanup root cause.
- The historical artifact upload reported no matching `*.log`; the failure exists in the job log, not a downloadable db-core log artifact.

## Defects proven in the former helper

- It inventoried 120 `public` application tables after 124 migrations, then executed one `TRUNCATE ... CASCADE` **per table**, rather than one grouped statement.
- It changed `session_replication_role` through separate pool calls, with no session-affinity guarantee.
- It swallowed individual truncate failures, then swallowed errors in a partial `deleteMany` fallback. A caller could proceed with dirty data.
- A disposable local run of the two payment suites on the original helper passed all 12 assertions in 159.666 s. The historical timeout did **not** reproduce in that isolated run.
- A red countertest against the original helper failed because `setupTestDatabase()` returned no grouped-cleanup evidence. Additional tests now exercise external FK, target guard, lock cancellation, identifiers, partitions and triggers on the same disposable server.

## Decision

Limit cleanup to catalogued non-migration tables in `public`, fail on partitions/inheritance or user `ON TRUNCATE` triggers pending explicit review, and use one quoted `TRUNCATE ... RESTART IDENTITY RESTRICT` inside a bounded transaction. Preserve migration history. PostgreSQL lock/statement timeouts cancel the SQL; Prisma's transaction boundary rolls back partial effects. No replica role, CASCADE, schema drop/recreate or suppressed fallback.

The four catalog statements each have a 1 s server-side statement limit; the single TRUNCATE has a 15 s server-side limit and a 1.5 s lock limit. Prisma waits at most 3 s for the transaction and has a 30 s transaction limit, strictly later than the aggregate SQL bounds. The relevant 10/15 s `beforeAll` hooks were retained for initial measurement, then changed locally to 35 s so Jest cannot announce a hook timeout while this bounded cleanup is still executing. This is a cancellation-order safety adjustment, not a global timeout increase or a substitute for the grouped cleanup.

## Verification pending final run

The local container is a new, unshared `pgvector/pgvector` PostgreSQL 16 instance bound to `127.0.0.1:55443`, with no volume, database `nexus_disposable_cleanup_test` and the existing 124 migrations. It is never a Preview or production database. The initial full db-core lane passed 288/288 in 223.09 s. The subsequent CI-order rehearsal ran the 52/52 non-Bilan integration tests first (15.592 s), then db-core; with an initial 7 s SQL bound, db-core failed 2/288 in 283.313 s because PostgreSQL explicitly cancelled two grouped TRUNCATE statements. One observed wait was `DataFileImmediateSync`; local swap was full. The 15 s bound was chosen only after that measurement. With that final bound, the same disposable database completed the full db-core lane at 288/288 in 241.203 s. These observations do not prove the cause of the historical post-merge slowdown, nor do they establish storage saturation on GitHub's runner. PR CI must independently qualify the final head.

The original helper ran 120 TRUNCATE commands per cleanup (plus role changes); the replacement ran one grouped TRUNCATE for the same 120 migrated application tables. With three temporary fixture tables, the real-DB countertest measured 123 tables, one cleanup statement, 7 ms inventory and 1,463 ms cleanup on its first green pass. The original two payment suites passed 12/12 in 159.666 s on the local disposable DB; after the grouped cleanup, the two payment suites plus the new countertest passed 18/18 in 77.646 s. These timings are distinct test sets and are not a claimed exact speedup ratio.

The `pg_sleep` countertest proves PostgreSQL's active-statement cancellation and no remaining active query after a timeout; it does not simulate a long-running TRUNCATE inside the helper. A separate lock test exercises the helper itself and checks that a failed cleanup leaves no delayed modification after the blocker releases.

## Scope and rollback

Only test setup/hooks, real-DB countertests and CI evidence change. No application, payment, C2, Preview, RAG or public-production behavior changes. Revert this PR to restore the former test helper if needed; no product data migration is involved.
