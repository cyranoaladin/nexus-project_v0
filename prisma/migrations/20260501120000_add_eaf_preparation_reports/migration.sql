-- Migration: Add EAF Preparation Reports table
-- Description: Generic EAF preparation reports that coaches can fill for their assigned students
-- Separate from StageBilan (stage-specific) and Bilan (canonical assessment)

-- Create the eaf_preparation_reports table
CREATE TABLE "eaf_preparation_reports" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    
    -- EAF rubrics (text fields)
    "linearReading" TEXT,
    "workPresentation" TEXT,
    "interview" TEXT,
    "oralExpression" TEXT,
    "writingMethod" TEXT,
    "languageMastery" TEXT,
    "literaryCulture" TEXT,
    "strengths" TEXT,
    "areasToImprove" TEXT,
    "nextSessionGoals" TEXT,
    "coachFreeComment" TEXT,
    
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eaf_preparation_reports_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "eaf_preparation_reports_studentId_coachId_key" UNIQUE ("studentId", "coachId")
);

-- Add foreign key constraints
ALTER TABLE "eaf_preparation_reports" ADD CONSTRAINT "eaf_preparation_reports_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "eaf_preparation_reports" ADD CONSTRAINT "eaf_preparation_reports_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coach_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX "eaf_preparation_reports_coachId_idx" ON "eaf_preparation_reports"("coachId");
CREATE INDEX "eaf_preparation_reports_studentId_idx" ON "eaf_preparation_reports"("studentId");

-- Add relation fields to students table (for Prisma)
-- Note: This is a logical relation, no actual column needed in the table
-- Prisma will handle this through the schema definition

-- Add relation fields to coach_profiles table (for Prisma)
-- Note: This is a logical relation, no actual column needed in the table
-- Prisma will handle this through the schema definition
