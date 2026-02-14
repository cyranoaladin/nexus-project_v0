-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('PENDING', 'SCORING', 'GENERATING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "publicShareId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "studentEmail" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "studentPhone" TEXT,
    "studentMetadata" JSONB,
    "answers" JSONB NOT NULL,
    "duration" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "scoringResult" JSONB,
    "globalScore" DOUBLE PRECISION,
    "confidenceIndex" DOUBLE PRECISION,
    "analysisJson" JSONB,
    "studentMarkdown" TEXT,
    "parentsMarkdown" TEXT,
    "nexusMarkdown" TEXT,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorDetails" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assessments_publicShareId_key" ON "assessments"("publicShareId");

-- CreateIndex
CREATE INDEX "assessments_subject_grade_idx" ON "assessments"("subject", "grade");

-- CreateIndex
CREATE INDEX "assessments_studentEmail_idx" ON "assessments"("studentEmail");

-- CreateIndex
CREATE INDEX "assessments_status_idx" ON "assessments"("status");

-- CreateIndex
CREATE INDEX "assessments_createdAt_idx" ON "assessments"("createdAt");
