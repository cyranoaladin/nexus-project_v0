# Production migration checksum provenance — `20260425113000_add_maths_progress_track`

**Status:** investigated and explained (read-only forensics + rehearsals). Not fixed by editing
the migration file — doing so is proven to break fresh-database bootstrap (see below). **Not a
current production-deploy blocker** (empirically proven below). No valid single-command
remediation exists for an already-successfully-applied migration (also empirically proven below,
correcting an earlier draft of this document) — closing this cleanly requires a future schema-freeze
baseline, tracked as a separate, deliberately-deferred effort (see "Long-term strategy").

```
ROOT_CAUSE               = FILE_EDITED_AFTER_APPLY
CURRENT_DEPLOY_BLOCKER   = NO
HISTORICAL_PROVENANCE_DRIFT = YES
```

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

## Why `prisma migrate resolve --applied` does NOT fix this (correcting an earlier draft)

An earlier version of this document recommended `prisma migrate resolve --applied
20260425113000_add_maths_progress_track` as a one-time owner-executed reconciliation. **That
recommendation was wrong and has been removed.** `migrate resolve` is documented for recovering a
migration stuck in a *failed* state (or for baselining a *brand-new, never-recorded* migration
name) — it explicitly refuses to touch a migration that is already recorded as successfully
applied, which is exactly this one's state.

Verified empirically, on this repo's exact pinned Prisma version, against a disposable database
carrying a genuinely `finished_at`-set, non-rolled-back migration:

```
$ prisma --version
prisma                  : 6.19.3
@prisma/client          : 6.19.3

$ prisma migrate resolve --applied 0001_core_v2_baseline
Error: P3008

The migration `0001_core_v2_baseline` is already recorded as applied in the database.
```

Exit code 1. The database row was confirmed byte-for-byte unchanged afterward (same checksum,
same `finished_at`, still no `rolled_back_at`) — the command is a clean no-op refusal, not a
silent partial mutation. **There is no single supported Prisma command that reconciles a checksum
drift on an already-successful migration.** This is a real limitation of the tool, not a gap in
this investigation.

`MIGRATE_RESOLVE_SUCCESSFUL_TEST_RESULT = REFUSED (P3008), zero mutation, reproduced on this
repo's exact pinned Prisma version (6.19.3)`.

## Long-term strategy (rehearsed, not yet implemented)

Because no valid single-command fix exists for the already-applied migration, and because ARIA's
Core v1 migrations are still actively landing (a schema freeze is not yet in effect), the durable
fix is deferred. Three options were considered; only Option B was empirically rehearsed, since it
is Prisma's own officially-documented pattern for exactly this class of problem ("baselining an
existing database").

| Option | Description | Verdict |
|---|---|---|
| **A** — leave as-is | Keep the current 111+-migration history, keep this one documented, known drift. | Safe today (proven non-blocking), but the drift persists indefinitely and every future full audit re-discovers it. |
| **B** — baseline/squash after freeze | Generate one fresh migration representing the frozen schema state; mark it applied via `migrate resolve --applied` (a *new*, never-recorded name — the case that command *is* built for); retire the old migration folders from the live directory (git history keeps them). | **Rehearsed and empirically proven working, fully additive, zero data/schema mutation.** See below. |
| **C** — other supported mechanism | No other officially-supported Prisma mechanism was found for this specific situation (checksum drift on a successful, non-failed migration) beyond A/B. | Not pursued further. |

**Option B rehearsal** (disposable databases only, nothing touched in production):
1. Applied the current 5-migration Core v2 history to a scratch database (simulating "existing
   production, already past all its migrations").
2. Generated a single fresh migration via `prisma migrate diff --from-empty --to-schema-datamodel
   <schema> --script` — the exact schema state, as one file.
3. Ran `prisma migrate resolve --applied <new-baseline-name>` against the *same* scratch
   database — **succeeded** ("Migration 0001_baseline marked as applied"), because this is a
   brand-new migration name, never previously recorded (the opposite case from the refused test
   above).
4. `prisma migrate status` → up to date. `prisma migrate diff` against the live database → empty
   migration (zero drift).
5. Inspected `_prisma_migrations` directly: **all prior history rows remain untouched** — baselining
   is purely additive at the ledger level, it does not delete or rewrite any existing row.

```
MIGRATION_HISTORY_FINAL_STRATEGY = OPTION_B (baseline/squash after schema freeze), rehearsed and
                                    proven on disposable databases; not yet implemented
SCHEMA_FREEZE_PREREQUISITE       = YES — ARIA's Core v1 migrations are still actively landing
                                    (e.g. PR #231 same day this was rehearsed); implementing now
                                    would immediately re-drift
PROD_WRITE_REQUIRED              = YES — the actual cutover step (`migrate resolve --applied` on
                                    the new baseline, against real production) needs write access
                                    this mission's SSH authorization does not grant; owner-executed
REHEARSAL_STATUS                 = COMPLETE — mechanism proven safe (additive, zero data/schema
                                    mutation, zero risk to existing rows) on disposable copies only
```

## Status of this finding as a go-live gate

`PROD_MIGRATION_CHECKSUM_MISMATCH = 1` remains factually true and remains a **final
production-readiness gate** — it is not being waved away as a false problem, and it is not
resolved by any command available today. It is, however, **empirically confirmed not to block any
current or near-term `prisma migrate deploy`**, so it does not need to hold up this PR or any other
in-flight work. It closes only via the Option B baseline, after an explicit schema freeze the
owner calls.
