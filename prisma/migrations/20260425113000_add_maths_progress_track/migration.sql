-- Phase 3: separate maths progression by academic track (EDS / STMG)

ALTER TABLE "maths_progress"
    ADD COLUMN "track" "AcademicTrack" NOT NULL DEFAULT 'EDS_GENERALE';

DROP INDEX IF EXISTS "maths_progress_userId_level_key";

CREATE UNIQUE INDEX "maths_progress_userId_level_track_key"
    ON "maths_progress"("userId", "level", "track");

CREATE INDEX "maths_progress_track_idx"
    ON "maths_progress"("track");
