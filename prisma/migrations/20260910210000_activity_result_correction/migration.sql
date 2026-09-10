-- Additive only: real AI-driven correction of an ARIA Practice attempt
-- (ARIA P2b). No existing column, row, or constraint is changed.

-- CreateEnum
CREATE TYPE "ActivityOutcome" AS ENUM ('CORRECT', 'PARTIALLY_CORRECT', 'INCORRECT');

-- CreateEnum
CREATE TYPE "CorrectionAuthor" AS ENUM ('ARIA_MODEL');

-- AlterEnum
ALTER TYPE "ActivityAttemptStatus" ADD VALUE 'CORRECTED';

-- CreateTable
CREATE TABLE "aria_activity_results" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "outcome" "ActivityOutcome" NOT NULL,
    "feedback" JSONB NOT NULL,
    "correctedBy" "CorrectionAuthor" NOT NULL DEFAULT 'ARIA_MODEL',
    "correctedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aria_activity_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aria_activity_results_attemptId_key" ON "aria_activity_results"("attemptId");

-- AddForeignKey
ALTER TABLE "aria_activity_results" ADD CONSTRAINT "aria_activity_results_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "aria_activity_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
