-- Ensure maths_progress.track column + composite indexes exist after the
-- table has been created by 20260501000000_add_maths_progress.
-- This migration is idempotent for environments where the column already
-- exists (e.g. production where 20260425113000_add_maths_progress_track
-- was applied successfully out of order).

DO $$
BEGIN
  IF to_regclass('public.maths_progress') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'maths_progress'
        AND column_name = 'track'
    ) THEN
      ALTER TABLE "maths_progress"
        ADD COLUMN "track" "AcademicTrack" NOT NULL DEFAULT 'EDS_GENERALE';
    END IF;

    DROP INDEX IF EXISTS "maths_progress_userId_level_key";

    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'maths_progress_userId_level_track_key'
    ) THEN
      CREATE UNIQUE INDEX "maths_progress_userId_level_track_key"
        ON "maths_progress"("userId", "level", "track");
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'maths_progress_track_idx'
    ) THEN
      CREATE INDEX "maths_progress_track_idx"
        ON "maths_progress"("track");
    END IF;
  END IF;
END $$;
