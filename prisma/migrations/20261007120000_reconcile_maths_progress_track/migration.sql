-- Forward-only reconciliation of maths_progress.track — KNOWN_BOUNDED_LEGACY_DIVERGENCE=1
--
-- Context: 20260425113000_add_maths_progress_track was applied in production with the
-- UNGUARDED 418-byte body (checksum 26c3aea41f0c83a272ee73658630b14e2229bc28295a4733da2522232a04c2d4)
-- in a historical order where public.maths_progress already existed. The Git tree carries
-- a GUARDED no-op variant (checksum f861094720e680a4a3da7bf8930d7252a6f3df2fc86f322c5029fd246acb7893)
-- so that a from-empty rebuild works (the table is only created later by 20260501000000_add_maths_progress).
-- The historical migration is NEVER edited or renamed; this forward-only migration closes the
-- divergence by asserting / converging the canonical shape of maths_progress.track.
--
-- Placed AFTER 20260501000000 (table creation) and 20260502000000 (fresh-DB column add).
-- Properties: fails closed if the table is absent; adds the column only if missing, with the
-- exact canonical definition; otherwise asserts type, nullability, default and the two indexes;
-- fails on any incompatible definition; performs NO drop / rename / destructive change;
-- transactional and idempotent (a pure no-op on an already-canonical schema).

DO $$
DECLARE
  v_type    text;
  v_notnull boolean;
  v_default text;
BEGIN
  -- (1) The table must exist — fail closed otherwise.
  IF to_regclass('public.maths_progress') IS NULL THEN
    RAISE EXCEPTION 'reconcile_maths_progress_track: table public.maths_progress is absent — refusing to reconcile (it must be created by 20260501000000_add_maths_progress before this migration runs)';
  END IF;

  -- (2) The canonical enum type must exist.
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AcademicTrack') THEN
    RAISE EXCEPTION 'reconcile_maths_progress_track: enum type "AcademicTrack" is absent';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'maths_progress' AND column_name = 'track'
  ) THEN
    -- (3) Column missing → add it with the exact canonical definition.
    ALTER TABLE "maths_progress"
      ADD COLUMN "track" "AcademicTrack" NOT NULL DEFAULT 'EDS_GENERALE';
  ELSE
    -- (4/5) Column present → assert the canonical type, nullability and default; fail closed on drift.
    SELECT t.typname, a.attnotnull, pg_get_expr(ad.adbin, ad.adrelid)
      INTO v_type, v_notnull, v_default
    FROM pg_attribute a
    JOIN pg_type t ON t.oid = a.atttypid
    LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
    WHERE a.attrelid = 'public.maths_progress'::regclass AND a.attname = 'track';

    IF v_type IS DISTINCT FROM 'AcademicTrack' THEN
      RAISE EXCEPTION 'reconcile_maths_progress_track: maths_progress.track has type % (expected "AcademicTrack")', v_type;
    END IF;
    IF v_notnull IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'reconcile_maths_progress_track: maths_progress.track must be NOT NULL';
    END IF;
    IF v_default IS DISTINCT FROM '''EDS_GENERALE''::"AcademicTrack"' THEN
      RAISE EXCEPTION 'reconcile_maths_progress_track: maths_progress.track default is % (expected ''EDS_GENERALE''::"AcademicTrack")', v_default;
    END IF;
  END IF;

  -- (6) Canonical indexes must be present — create if missing, never drop or rename.
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'maths_progress_userId_level_track_key'
  ) THEN
    CREATE UNIQUE INDEX "maths_progress_userId_level_track_key"
      ON "maths_progress" ("userId", "level", "track");
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'maths_progress_track_idx'
  ) THEN
    CREATE INDEX "maths_progress_track_idx" ON "maths_progress" ("track");
  END IF;
END $$;
