-- Phase A+B: CoachStudentAssignment — Core model for coach-student pedagogical relationships
-- Adds assignment tracking, document metadata, and visibility scopes

-- ============================================
-- 1. CREATE ENUMS (safe to create if not exists)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssignmentType') THEN
    CREATE TYPE "AssignmentType" AS ENUM ('PRIMARY', 'SECONDARY', 'STAGE', 'TEMPORARY');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssignmentStatus') THEN
    CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ENDED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentType') THEN
    CREATE TYPE "DocumentType" AS ENUM ('COURS', 'EXERCICE', 'BILAN', 'CORRECTION', 'PLANNING', 'ANNEXE', 'AUTRE');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentVisibilityScope') THEN
    CREATE TYPE "DocumentVisibilityScope" AS ENUM ('STUDENT_ONLY', 'STUDENT_AND_PARENT', 'STUDENT_AND_COACH', 'STUDENT_PARENT_COACH', 'ADMIN_ONLY');
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
    "assignmentType" "AssignmentType" NOT NULL DEFAULT 'PRIMARY',
    "status"         "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "subjects"       "Subject"[] NOT NULL DEFAULT ARRAY[]::"Subject"[],
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

-- Partial unique index to prevent duplicate active assignments
-- A coach can only have one active assignment of each type for a given student
CREATE UNIQUE INDEX IF NOT EXISTS "coach_student_assignments_active_unique"
    ON "coach_student_assignments" ("coachId", "studentId", "assignmentType")
    WHERE "status" = 'ACTIVE';

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
    ALTER TABLE "user_documents" ADD COLUMN "documentType" "DocumentType" NOT NULL DEFAULT 'AUTRE';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_documents' AND column_name = 'visibilityScope') THEN
    ALTER TABLE "user_documents" ADD COLUMN "visibilityScope" "DocumentVisibilityScope" NOT NULL DEFAULT 'STUDENT_ONLY';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_documents' AND column_name = 'subject') THEN
    ALTER TABLE "user_documents" ADD COLUMN "subject" "Subject";
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
    UPDATE "user_documents" SET "updatedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP) WHERE "updatedAt" IS NULL;
    ALTER TABLE "user_documents" ALTER COLUMN "updatedAt" SET NOT NULL;
  END IF;
END $$;

-- Indexes for UserDocument new columns
CREATE INDEX IF NOT EXISTS "user_documents_documentType_idx" ON "user_documents" ("documentType");
CREATE INDEX IF NOT EXISTS "user_documents_visibilityScope_idx" ON "user_documents" ("visibilityScope");
CREATE INDEX IF NOT EXISTS "user_documents_subject_idx" ON "user_documents" ("subject");
CREATE INDEX IF NOT EXISTS "user_documents_expiresAt_idx" ON "user_documents" ("expiresAt");
