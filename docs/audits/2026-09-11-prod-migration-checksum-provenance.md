# Production migration checksum provenance — `20260425113000_add_maths_progress_track`

**Status:** investigated and explained (read-only forensics + two isolated rehearsals). Not fixed
by editing the migration file — doing so is proven to break fresh-database bootstrap (see below).
Requires one production-side reconciliation command, out of scope for this PR (production write
access, owner-executed).

## Finding

`prisma/migrations/20260425113000_add_maths_progress_track/migration.sql`'s current content does
not byte-match what production recorded as applied in `_prisma_migrations.checksum`.

| Field | Value |
|---|---|
| `MIGRATION_NAME` | `20260425113000_add_maths_progress_track` |
| `DB_STORED_CHECKSUM` (production) | `26c3aea41f0c83a272ee73658630b14e2229bc28295a4733da2522232a04c2d4` |
| `CURRENT_MAIN_FILE_CHECKSUM` | `f861094720e680a4a3da7bf8930d7252a6f3df2fc86f322c5029fd246acb7893` |
| `LIVE_RELEASE_FILE_CHECKSUM` | `f861094720e680a4a3da7bf8930d7252a6f3df2fc86f322c5029fd246acb7893` (matches current main, confirmed via read-only SSH against the deployed release folder) |
| `FIRST_GIT_COMMIT_CONTAINING_MIGRATION` | `ddf0d71114ae8028ad592016e8f26c7a9b133086` (2026-04-25 09:17:46+01, "feat(api): dashboard et progression track-aware (EDS / STMG)") — checksum matches `DB_STORED_CHECKSUM` exactly |
| `LAST_GIT_COMMIT_MODIFYING_MIGRATION` (on main's ancestry) | `768d49daceea34f2e6469adc1f1860ab229a619d` (2026-04-25 10:58:57+01, "fix(ci): unblock migrations and 4 failing Jest suites") — checksum matches `CURRENT_MAIN_FILE_CHECKSUM` |
| `ROOT_CAUSE` | `FILE_EDITED_AFTER_APPLY` |

**Systematic audit scope**: all 105 successfully-applied (non-rolled-back) production migrations
were checksum-compared against current `main` — this is the **only** mismatch. Three additional
`_prisma_migrations` rows (`20260808130000_add_user_document_unavailable_reason`,
`20260824090000_add_profil_candidat`, `20260830150000_add_lva_lvb_languages`) carry
`rolled_back_at` timestamps with `finished_at IS NULL` — legitimate historical rollback records,
correctly absent from the current migrations directory, not a provenance problem.
`APPLIED_NOT_IN_MAIN = 0`.

## What actually happened (evidence, not speculation)

The file was edited ~1h40 after its first commit, same day, to make the `ALTER TABLE` guarded and
idempotent:

```diff
-ALTER TABLE "maths_progress"
-    ADD COLUMN "track" "AcademicTrack" NOT NULL DEFAULT 'EDS_GENERALE';
-...
+DO $$
+BEGIN
+  IF to_regclass('public.maths_progress') IS NOT NULL THEN
+    IF NOT EXISTS (...) THEN
+      ALTER TABLE "maths_progress" ADD COLUMN "track" ...
```

The edit commit's own sibling migration, `20260502000000_ensure_maths_progress_track_column`,
documents the reason in its own header comment: *"idempotent for environments where the column
already exists (e.g. production where `20260425113000_add_maths_progress_track` was applied
successfully out of order)"* — i.e. the guard exists because, on a **fresh** database bootstrap,
`20260425113000` (lexically before `20260501000000_add_maths_progress`, which creates the
`maths_progress` table) runs before the table exists.

Production had already applied the original, unconditional version
(`2026-04-25 21:09:20 UTC`, 8 seconds after `20260501000000` in the same deploy batch — production's
own historical apply order was not the current lexical order, most likely because these folders'
names/positions were not identical to today's at the time they were first authored) before the
idempotency guard was added to the repo. The edit was never reconciled against production's
already-recorded checksum.

## Why the file was **not** reverted to match production's checksum

Reverting `20260425113000_add_maths_progress_track/migration.sql` to the exact original bytes
(the ones matching `DB_STORED_CHECKSUM`) was tested empirically against a fresh, empty database:

```
Applying migration `20260425113000_add_maths_progress_track`
Error: P3018
Database error: ERROR: relation "maths_progress" does not exist
```

This confirms the guard is a **real, currently load-bearing fix** for CI/fresh-environment
bootstrap (`20260501000000_add_maths_progress`, which creates the table, is unconditional and
cannot itself be edited either — also already applied in production — so it cannot be made
idempotent or reordered without the same provenance problem). Reverting the file would trade one
real problem for a worse one: it would break every fresh-database bootstrap (CI, new
environments, disaster-recovery restores) going forward.

## Why this is not fixed by editing `_prisma_migrations` directly

Explicitly out of scope and not attempted: this mission's SSH access to production is
**strictly read-only** (no mutation, no deployment, no restart, no migration) — verified via
read-only queries and `pg_dump` only. An `UPDATE _prisma_migrations` or
`prisma migrate resolve` command requires write access this mission does not have and must not
use.

## Two rehearsals performed (both isolated, zero production risk)

- **REHEARSAL A** — fresh empty PostgreSQL 16 database, all 111 migrations on current `main`
  applied via `prisma migrate deploy`: **PASS** ("All migrations have been successfully
  applied.", `migrate status` → up to date).
- **REHEARSAL B** — an isolated local restore of production's real schema (`pg_dump
  --schema-only`) plus the real `_prisma_migrations` ledger (`pg_dump --data-only --table
  _prisma_migrations`) — no user data included. Restored cleanly (108/108 tables, one harmless
  SSH-banner-text parse error in the dump stream, verified not to have dropped any real
  statement). `prisma migrate status` against this isolated restore correctly reported exactly
  the 6 pending migrations that landed on `main` today (PR #228–#230, ARIA) and nothing else —
  `APPLIED_NOT_IN_MAIN = 0`, `MIGRATION_UNKNOWN = 0`. Applying those 6 pending migrations via
  `prisma migrate deploy` against a disposable clone of this isolated restore **succeeded
  cleanly** despite the known checksum drift on `20260425113000` — Prisma 6.19.3 does not
  re-validate the checksum of an already-`finished_at`-recorded migration during `deploy`/
  `status`. This means the drift, while a real provenance/audit-trail defect, **does not
  currently block production migrations** — contrary to the original, unverified assumption that
  it would.

`DESTRUCTIVE_UNPLANNED_CHANGE = 0` — every rehearsal ran against disposable local databases;
production was only ever read from (queries, `pg_dump`), never written to.

## Recommended remediation (owner action, requires production write access)

Run once, directly against production, by someone with write access:

```
npx prisma migrate resolve --applied 20260425113000_add_maths_progress_track \
  --schema=prisma/schema.prisma
```

This is the Prisma-documented mechanism for reconciling a checksum drift on an already-applied
migration without re-executing it or touching data. Not urgent per the empirical finding above
(does not block deploys), but recommended to restore full provenance-tool accuracy (e.g. a future
`prisma migrate diff` audit, or a Prisma upgrade that re-introduces stricter checksum validation).
