-- Additive only: a new append-only ledger of observable pedagogical facts
-- (LearningEvidence), the shared substrate for future ARIA Practice,
-- Correction, Mastery and Next-Best-Action lots. No existing column, row,
-- or constraint is changed by this migration.
--
-- Distinct from the pre-existing `EvidenceItem`/`canonical_evidence_items`
-- (bilans-scoped, FK'd to ScoreSnapshot) — no shared data, no collision.

-- CreateEnum
CREATE TYPE "LearningEvidenceSource" AS ENUM ('PRACTICE_ATTEMPT', 'ASSESSMENT_RESULT', 'CONVERSATION_ASSESSMENT', 'CORRECTION_RESULT', 'TEACHER_OBSERVATION', 'COACH_FEEDBACK', 'EXAM_SIMULATION');

-- CreateTable
CREATE TABLE "aria_learning_evidence" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseKey" TEXT NOT NULL,
    "skillId" TEXT,
    "curriculumVersion" TEXT NOT NULL,
    "source" "LearningEvidenceSource" NOT NULL,
    "sourceRefId" TEXT NOT NULL,
    "outcome" JSONB NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aria_learning_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aria_learning_evidence_studentId_courseKey_skillId_idx" ON "aria_learning_evidence"("studentId", "courseKey", "skillId");

-- CreateIndex
CREATE INDEX "aria_learning_evidence_source_sourceRefId_idx" ON "aria_learning_evidence"("source", "sourceRefId");

-- AddForeignKey
ALTER TABLE "aria_learning_evidence" ADD CONSTRAINT "aria_learning_evidence_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
