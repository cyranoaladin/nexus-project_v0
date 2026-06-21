-- E1: Fix maths_progress drift (migration 20260501000000 was force-marked, never executed)
-- Aligns DB with schema.prisma: backfill NULLs, SET NOT NULL, fix FK onDelete

-- Backfill any NULL values with defaults (currently 0 NULLs, but safety net)
UPDATE maths_progress SET "completedChapters" = '{}' WHERE "completedChapters" IS NULL;
UPDATE maths_progress SET "masteredChapters" = '{}' WHERE "masteredChapters" IS NULL;
UPDATE maths_progress SET "quizScore" = 0 WHERE "quizScore" IS NULL;
UPDATE maths_progress SET "dailyChallenge" = '{}' WHERE "dailyChallenge" IS NULL;
UPDATE maths_progress SET "exerciseResults" = '{}' WHERE "exerciseResults" IS NULL;
UPDATE maths_progress SET "hintUsage" = '{}' WHERE "hintUsage" IS NULL;
UPDATE maths_progress SET "badges" = '{}' WHERE "badges" IS NULL;
UPDATE maths_progress SET "srsQueue" = '{}' WHERE "srsQueue" IS NULL;

-- Set NOT NULL + defaults to match Prisma schema
ALTER TABLE maths_progress ALTER COLUMN "completedChapters" SET DEFAULT '{}';
ALTER TABLE maths_progress ALTER COLUMN "completedChapters" SET NOT NULL;

ALTER TABLE maths_progress ALTER COLUMN "masteredChapters" SET DEFAULT '{}';
ALTER TABLE maths_progress ALTER COLUMN "masteredChapters" SET NOT NULL;

ALTER TABLE maths_progress ALTER COLUMN "quizScore" SET DEFAULT 0;
ALTER TABLE maths_progress ALTER COLUMN "quizScore" SET NOT NULL;

ALTER TABLE maths_progress ALTER COLUMN "dailyChallenge" SET DEFAULT '{}';
ALTER TABLE maths_progress ALTER COLUMN "dailyChallenge" SET NOT NULL;

ALTER TABLE maths_progress ALTER COLUMN "exerciseResults" SET DEFAULT '{}';
ALTER TABLE maths_progress ALTER COLUMN "exerciseResults" SET NOT NULL;

ALTER TABLE maths_progress ALTER COLUMN "hintUsage" SET DEFAULT '{}';
ALTER TABLE maths_progress ALTER COLUMN "hintUsage" SET NOT NULL;

ALTER TABLE maths_progress ALTER COLUMN "badges" SET DEFAULT '{}';
ALTER TABLE maths_progress ALTER COLUMN "badges" SET NOT NULL;

ALTER TABLE maths_progress ALTER COLUMN "srsQueue" SET DEFAULT '{}';
ALTER TABLE maths_progress ALTER COLUMN "srsQueue" SET NOT NULL;

-- bacChecklistCompletions: DB says NOT NULL DEFAULT 0, Prisma says nullable
-- Align to Prisma: make nullable, drop default
ALTER TABLE maths_progress ALTER COLUMN "bacChecklistCompletions" DROP NOT NULL;
ALTER TABLE maths_progress ALTER COLUMN "bacChecklistCompletions" DROP DEFAULT;

-- Fix FK onDelete: RESTRICT → CASCADE (match Prisma schema)
ALTER TABLE maths_progress DROP CONSTRAINT "maths_progress_userId_fkey";
ALTER TABLE maths_progress ADD CONSTRAINT "maths_progress_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;
