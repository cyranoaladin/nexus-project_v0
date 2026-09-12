# Core v1 → Core v2 migration — runbook (go-live §AP / §AQ / §AR)

The migrator is `scripts/core-v2/migrate-to-core-v2.ts` (library in `scripts/core-v2/migration/`). It reads Core v1 **read-only** (one `SET TRANSACTION READ ONLY` transaction — PostgreSQL refuses any write), writes **only** Core v2, migrates **only** the students named in an owner approval file, is **deterministic** (same source + approval + `--migrated-at` → same rows and hashes), **idempotent** (rerun → `UNCHANGED`), and leaves a **manifest** with one line per object considered.

## Inputs

| Input | Source | Notes |
|---|---|---|
| `DATABASE_URL` | Core v1 database (production clone or production at cutover) | Read only at the database level. A read-only role is still recommended for defence in depth. |
| `CORE_V2_DATABASE_URL` | Core v2 target | Must be empty, or contain only rows written by a previous run of the same plan (`TARGET_HAS_FOREIGN_ROWS` otherwise). Needs `btree_gist` (postgres contrib). |
| `CORE_V2_ORGANIZATION_TIMEZONE`, `CORE_V2_INVITATION_TTL_HOURS`, `CORE_V2_PASSWORD_RESET_TTL_MINUTES` | configuration | Fail-closed, no defaults. |
| `--approval=<file.json>` | **Owner** | `{ schoolYear, academicYear: { startYear, startsAt, endsAt }, approvedStudentIds: [...Core v1 Student.id], approvedBy, approvedAt }`. Ids only — no names, no contact data. Digest recorded in the manifest. Produced from `generate-roster-candidates.ts` output **by a human decision**; `OWNER_REVIEW_REQUIRED` rows are never auto-approved. |
| `--actor=<userId>` | Owner | An ADMIN present in the plan (staff are migrated like everyone else, same ids). Audit rows and `approvedById` carry this id. |
| `--migrated-at=<ISO>` | Operator | The declared cutover instant: `approvedAt` of enrollments, and the boundary between Core v1 history (not migrated) and Core v2 future occurrences. Fixed per run so reruns are stable. |
| `--out=<manifest.json>` | Operator | Always written, even on anomalies. |
| `--execute` | Operator | Absent = dry run (no write at all). |

## What migrates / what does not

See `MigrationPolicy` in `scripts/core-v2/migration/types.ts` (tested). In short: approved students with their households, parents, ACTIVE year enrollment, human/seed course enrollments; the coaches they need with capabilities derived from **verified** assignment scopes; assignments **rebuilt** one per course key; ACTIVE planning series still ahead of `migratedAt`, materialized by the Core v2 planning engine. Not migrated: legacy backfill course enrollments and ambiguous/unresolved assignment scopes (owner review), billing (stays in Core v1, keyed on the preserved `Student.id`), legacy sessions, past bookings. Never-activated family accounts arrive `PENDING_ACTIVATION` without a password and receive a Core v2 invitation.

## Manifest

`objects[]`: `{ entity, sourceId, targetId, transformVersion, hash, result, reason?, warnings[] }` with `result ∈ CREATED | UNCHANGED | UPDATED | SKIPPED | REJECTED | PLANNED` (the last only in dry run). `reconciliation`: `UNKNOWN`, `SILENT_DROPPED`, `DUPLICATE_TARGET`, `UNMAPPED_APPROVED` — all must be 0. `anomalies[]` lists any non-zero counter. Exit code 2 when anomalies or any `REJECTED` exist — review the reasons (`EMAIL_CI_DUPLICATE`, `COURSE_NOT_ENROLLED`, `PLANNING_CONFLICT`…), fix the source or the approval, rerun.

## Rehearsal sequence (§AR)

1. **Empty Core v2** — `prisma migrate deploy --schema=core-v2/prisma/schema.prisma` on a fresh database; `npx jest --config jest.core-v2.config.js` green.
2. **Synthetic approved roster** — `__tests__/integration/core-v2-migrator.real.test.ts` (CI job "Real DB Integration"): dry run, execute, idempotent rerun, UPDATED on source change, DB-enforced read-only source, foreign-rows refusal.
3. **Sanitized production clone as source** (owner-provided clone; never production): dry run → review `REJECTED`/`SKIPPED` reasons with the owner → execute into a disposable Core v2 → run the golden E2E and the staff workspace against it.
4. **Final proposed real-roster manifest** — dry run against the frozen source with the signed approval file; the manifest (no PII: ids and reasons only) is the artefact the owner signs off.
5. **Rollback** — before cutover the Core v2 database is disposable: drop and recreate it, `migrate deploy`, rerun. Core v1 is never modified by the migrator, so there is nothing to restore on the source side. After cutover, rollback is the release rollback (code + `CORE_V2_DATABASE_URL` unset → every identity is V1 again, explicit state).

## Cutover day

1. Schema freeze confirmed with the ARIA owner (§AS); final Core v1 backup + checksum.
2. `--execute` with the signed approval; keep the manifest with the release evidence.
3. Invitations for `PENDING_ACTIVATION` accounts are sent by staff from Familles (one per account, audited) — the migrator never sends mail.
4. Canary accounts (§BB) sign in before the public announcement.
