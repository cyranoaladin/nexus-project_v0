-- Phase A+B: CoachStudentAssignment — Core model for coach-student pedagogical relationships
-- Adds assignment tracking, document metadata, and visibility scopes

-- ============================================
-- 1. CREATE ENUMS (safe to create if not exists)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignmenttype') THEN
    CREATE TYPE "assignmenttype" AS ENUM ('PRIMARY', 'SECONDARY', 'STAGE', 'TEMPORARY');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignmentstatus') THEN
    CREATE TYPE "assignmentstatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ENDED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'documenttype') THEN
    CREATE TYPE "documenttype" AS ENUM ('COURS', 'EXERCICE', 'BILAN', 'CORRECTION', 'PLANNING', 'ANNEXE', 'AUTRE');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'documentvisibilityscope') THEN
    CREATE TYPE "documentvisibilityscope" AS ENUM ('STUDENT_ONLY', 'STUDENT_AND_PARENT', 'STUDENT_AND_COACH', 'STUDENT_PARENT_COACH', 'ADMIN_ONLY');
  END IF;
END $$;

-- ============================================
-- 2. CREATE CoachStudentAssignment TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS "coach_student_assignments" (
    "id"             TEXT NOT NULL,
    "coachId"        TEXT NOT NULL,
    "studentId"      TEXT NOT NULL,
    "assignedById"   TEXT,
    "assignmentType" "assignmenttype" NOT NULL DEFAULT 'PRIMARY',
    "status"         "assignmentstatus" NOT NULL DEFAULT 'ACTIVE',
    "subjects"       TEXT[] NOT NULL DEFAULT '{}',
    "notes"          TEXT,
    "startsAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt"         TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_student_assignments_pkey" PRIMARY KEY ("id")
);

-- Indexes for CoachStudentAssignment
CREATE INDEX IF NOT EXISTS "coach_student_assignments_coachId_status_idx"
    ON "coach_student_assignments" ("coachId", "status");

CREATE INDEX IF NOT EXISTS "coach_student_assignments_studentId_status_idx"
    ON "coach_student_assignments" ("studentId", "status");

CREATE INDEX IF NOT EXISTS "coach_student_assignments_assignedById_idx"
    ON "coach_student_assignments" ("assignedById");

-- Foreign keys for CoachStudentAssignment
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coach_student_assignments_coachId_fkey'
  ) THEN
    ALTER TABLE "coach_student_assignments"
      ADD CONSTRAINT "coach_student_assignments_coachId_fkey"
      FOREIGN KEY ("coachId") REFERENCES "coach_profiles"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coach_student_assignments_studentId_fkey'
  ) THEN
    ALTER TABLE "coach_student_assignments"
      ADD CONSTRAINT "coach_student_assignments_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "students"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coach_student_assignments_assignedById_fkey'
  ) THEN
    ALTER TABLE "coach_student_assignments"
      ADD CONSTRAINT "coach_student_assignments_assignedById_fkey"
      FOREIGN KEY ("assignedById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================
-- 3. UPDATE UserDocument TABLE (safe additions)
-- ============================================

-- Add new columns to user_documents with defaults (safe for existing 13 documents)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_documents' AND column_name = 'documentType') THEN
    ALTER TABLE "user_documents" ADD COLUMN "documentType" "documenttype" NOT NULL DEFAULT 'AUTRE';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_documents' AND column_name = 'visibilityScope') THEN
    ALTER TABLE "user_documents" ADD COLUMN "visibilityScope" "documentvisibilityscope" NOT NULL DEFAULT 'STUDENT_ONLY';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_documents' AND column_name = 'subject') THEN
    ALTER TABLE "user_documents" ADD COLUMN "subject" "subject";
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_documents' AND column_name = 'description') THEN
    ALTER TABLE "user_documents" ADD COLUMN "description" TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_documents' AND column_name = 'expiresAt') THEN
    ALTER TABLE "user_documents" ADD COLUMN "expiresAt" TIMESTAMP(3);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_documents' AND column_name = 'updatedAt') THEN
    ALTER TABLE "user_documents" ADD COLUMN "updatedAt" TIMESTAMP(3);
    UPDATE "user_documents" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
  END IF;
END $$;

-- Indexes for UserDocument new columns
CREATE INDEX IF NOT EXISTS "user_documents_documentType_idx" ON "user_documents" ("documentType");
CREATE INDEX IF NOT EXISTS "user_documents_visibilityScope_idx" ON "user_documents" ("visibilityScope");
CREATE INDEX IF NOT EXISTS "user_documents_subject_idx" ON "user_documents" ("subject");
CREATE INDEX IF NOT EXISTS "user_documents_expiresAt_idx" ON "user_documents" ("expiresAt");
