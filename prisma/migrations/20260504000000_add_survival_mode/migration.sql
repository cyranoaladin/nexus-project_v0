-- Mode Survie STMG: human-activated tactical dashboard for high-difficulty students.

ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "survivalMode" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "survivalModeReason" TEXT,
  ADD COLUMN IF NOT EXISTS "survivalModeBy" TEXT,
  ADD COLUMN IF NOT EXISTS "survivalModeAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "survival_progress" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "examDate" TIMESTAMP(3) NOT NULL,
  "reflexesState" JSONB NOT NULL,
  "phrasesState" JSONB NOT NULL,
  "qcmAttempts" INTEGER NOT NULL DEFAULT 0,
  "qcmCorrect" INTEGER NOT NULL DEFAULT 0,
  "rituals" JSONB NOT NULL,
  "notePotentielle" DOUBLE PRECISION,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "survival_progress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "survival_attempts" (
  "id" TEXT NOT NULL,
  "progressId" TEXT NOT NULL,
  "itemType" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "correctAnswer" TEXT NOT NULL,
  "givenAnswer" TEXT NOT NULL,
  "isCorrect" BOOLEAN NOT NULL,
  "timeSpentSec" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "survival_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "survival_progress_studentId_key" ON "survival_progress"("studentId");
CREATE INDEX IF NOT EXISTS "survival_progress_studentId_idx" ON "survival_progress"("studentId");
CREATE INDEX IF NOT EXISTS "survival_attempts_progressId_itemType_idx" ON "survival_attempts"("progressId", "itemType");

ALTER TABLE "survival_progress"
  ADD CONSTRAINT "survival_progress_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "survival_attempts"
  ADD CONSTRAINT "survival_attempts_progressId_fkey"
  FOREIGN KEY ("progressId") REFERENCES "survival_progress"("id") ON DELETE CASCADE ON UPDATE CASCADE;
