-- CreateEnum for Assessment Status
CREATE TYPE "AssessmentStatus" AS ENUM ('PENDING', 'SCORING', 'GENERATING', 'COMPLETED', 'FAILED');

-- CreateTable Assessment
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "publicShareId" TEXT NOT NULL,
    
    -- Subject and Grade
    "subject" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    
    -- Student Information
    "studentEmail" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "studentPhone" TEXT,
    "studentMetadata" JSONB,
    
    -- Assessment Data
    "answers" JSONB NOT NULL,
    "duration" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    
    -- Scoring Results
    "scoringResult" JSONB,
    "globalScore" DOUBLE PRECISION,
    "confidenceIndex" DOUBLE PRECISION,
    
    -- Analysis Results
    "analysisJson" JSONB,
    "studentMarkdown" TEXT,
    "parentsMarkdown" TEXT,
    "nexusMarkdown" TEXT,
    
    -- Status and Pipeline
    "status" "AssessmentStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    
    -- Error Tracking
    "errorCode" TEXT,
    "errorDetails" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    
    -- Metadata
    "userAgent" TEXT,
    "ipAddress" TEXT,
    
    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assessments_publicShareId_key" ON "assessments"("publicShareId");
CREATE INDEX "assessments_subject_grade_idx" ON "assessments"("subject", "grade");
CREATE INDEX "assessments_studentEmail_idx" ON "assessments"("studentEmail");
CREATE INDEX "assessments_status_idx" ON "assessments"("status");
CREATE INDEX "assessments_createdAt_idx" ON "assessments"("createdAt");
