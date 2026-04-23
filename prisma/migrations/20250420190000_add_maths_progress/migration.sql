-- Migration: add_maths_progress
-- Created: 2025-04-20
-- F16/F17: Separate Maths progression for Première and Terminale levels

-- Create MathsLevel enum
CREATE TYPE "MathsLevel" AS ENUM ('PREMIERE', 'TERMINALE');

-- Create MathsProgress table
CREATE TABLE "MathsProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" "MathsLevel" NOT NULL,
    "completedChapters" TEXT[],
    "masteredChapters" TEXT[],
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "quizScore" INTEGER,
    "comboCount" INTEGER NOT NULL DEFAULT 0,
    "bestCombo" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "streakFreezes" INTEGER NOT NULL DEFAULT 0,
    "lastActivityDate" TEXT,
    "dailyChallenge" JSONB,
    "exerciseResults" JSONB,
    "hintUsage" JSONB,
    "badges" TEXT[],
    "srsQueue" JSONB,
    "diagnosticResults" JSONB,
    "timePerChapter" JSONB,
    "formulaireViewed" BOOLEAN NOT NULL DEFAULT false,
    "grandOralSeen" INTEGER NOT NULL DEFAULT 0,
    "labArchimedeOpened" BOOLEAN NOT NULL DEFAULT false,
    "eulerMaxSteps" INTEGER NOT NULL DEFAULT 0,
    "newtonBestIterations" INTEGER,
    "printedFiche" BOOLEAN NOT NULL DEFAULT false,
    "errorTags" JSONB,
    "hintPenaltyXp" INTEGER,
    "bacChecklistCompletions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MathsProgress_pkey" PRIMARY KEY ("id")
);

-- Create unique index for composite key [userId, level]
CREATE UNIQUE INDEX "MathsProgress_userId_level_key" ON "MathsProgress"("userId", "level");

-- Create index on userId for faster lookups
CREATE INDEX "MathsProgress_userId_idx" ON "MathsProgress"("userId");

-- Add foreign key constraint to User table
ALTER TABLE "MathsProgress" ADD CONSTRAINT "MathsProgress_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
