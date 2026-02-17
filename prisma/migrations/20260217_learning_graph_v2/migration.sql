-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: Learning Graph v2
-- Date: 2026-02-17
-- Provider: PostgreSQL 15+ (tested on PostgreSQL 15-alpine via Docker)
-- Prisma provider: postgresql (prisma/schema.prisma → provider = "postgresql")
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- DESCRIPTION:
--   Add SSN normalization, Learning Graph tables (DomainScore, SkillScore,
--   ProgressionHistory, ProjectionHistory), Assessment→Student FK,
--   versioning fields, and UAI support.
--
-- PREREQUISITES:
--   1. PostgreSQL 15+ running and accessible
--   2. Tables "assessments" and "students" must already exist (from prior migrations)
--   3. Prisma migration table "_prisma_migrations" must be up to date
--   4. Backup recommended: pg_dump -Fc nexus_prod > pre_lgv2_backup.dump
--
-- SAFETY:
--   All changes are ADDITIVE (new nullable columns, new tables).
--   No existing columns are modified or dropped. No data loss.
--
-- RISK ASSESSMENT:
--   - ALTER TABLE "assessments" ADD COLUMN: non-blocking on Postgres (nullable, no default)
--   - CREATE INDEX: standard B-tree, non-blocking for small tables (<100k rows)
--   - FK constraints: validated at creation, may briefly lock if table is large
--   - DO $$ blocks: idempotent (IF NOT EXISTS guards on all constraints)
--
-- ROLLBACK (minimal — execute in reverse order if needed):
--   DROP TABLE IF EXISTS "projection_history" CASCADE;
--   DROP TABLE IF EXISTS "progression_history" CASCADE;
--   DROP TABLE IF EXISTS "skill_scores" CASCADE;
--   DROP TABLE IF EXISTS "domain_scores" CASCADE;
--   DROP INDEX IF EXISTS "assessments_ssn_idx";
--   DROP INDEX IF EXISTS "assessments_studentId_idx";
--   ALTER TABLE "assessments" DROP CONSTRAINT IF EXISTS "assessments_studentId_fkey";
--   ALTER TABLE "assessments" DROP COLUMN IF EXISTS "engineVersion";
--   ALTER TABLE "assessments" DROP COLUMN IF EXISTS "assessmentVersion";
--   ALTER TABLE "assessments" DROP COLUMN IF EXISTS "uai";
--   ALTER TABLE "assessments" DROP COLUMN IF EXISTS "ssn";
--   ALTER TABLE "assessments" DROP COLUMN IF EXISTS "studentId";
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Assessment: Add new columns ─────────────────────────────────────────

-- Optional FK to Student (linked post-registration, null for anonymous assessments)
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "studentId" TEXT;

-- Score Standardisé Nexus (SSN) — normalized by cohort (z-score projection 0-100)
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "ssn" DOUBLE PRECISION;

-- Unified Academic Index (multi-discipline composite)
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "uai" DOUBLE PRECISION;

-- Versioning — track which question bank and scoring engine were used
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "assessmentVersion" TEXT;
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "engineVersion" TEXT;

-- ─── 2. Assessment: Add indexes ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "assessments_studentId_idx" ON "assessments"("studentId");
CREATE INDEX IF NOT EXISTS "assessments_ssn_idx" ON "assessments"("ssn");

-- ─── 3. Assessment: Add FK constraint ───────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'assessments_studentId_fkey'
    AND table_name = 'assessments'
  ) THEN
    ALTER TABLE "assessments"
      ADD CONSTRAINT "assessments_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "students"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── 4. Create DomainScore table ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "domain_scores" (
  "id" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "domain_scores_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "domain_scores_assessmentId_idx" ON "domain_scores"("assessmentId");
CREATE INDEX IF NOT EXISTS "domain_scores_domain_idx" ON "domain_scores"("domain");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'domain_scores_assessmentId_fkey'
    AND table_name = 'domain_scores'
  ) THEN
    ALTER TABLE "domain_scores"
      ADD CONSTRAINT "domain_scores_assessmentId_fkey"
      FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── 5. Create SkillScore table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "skill_scores" (
  "id" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "skillTag" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "skill_scores_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "skill_scores_assessmentId_idx" ON "skill_scores"("assessmentId");
CREATE INDEX IF NOT EXISTS "skill_scores_skillTag_idx" ON "skill_scores"("skillTag");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'skill_scores_assessmentId_fkey'
    AND table_name = 'skill_scores'
  ) THEN
    ALTER TABLE "skill_scores"
      ADD CONSTRAINT "skill_scores_assessmentId_fkey"
      FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── 6. Create ProgressionHistory table ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS "progression_history" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "ssn" DOUBLE PRECISION NOT NULL,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "progression_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "progression_history_studentId_date_idx" ON "progression_history"("studentId", "date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'progression_history_studentId_fkey'
    AND table_name = 'progression_history'
  ) THEN
    ALTER TABLE "progression_history"
      ADD CONSTRAINT "progression_history_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "students"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── 7. Create ProjectionHistory table ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS "projection_history" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "ssnProjected" DOUBLE PRECISION NOT NULL,
  "confidenceIndex" DOUBLE PRECISION NOT NULL,
  "modelVersion" TEXT NOT NULL,
  "inputSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "projection_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "projection_history_studentId_createdAt_idx" ON "projection_history"("studentId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'projection_history_studentId_fkey'
    AND table_name = 'projection_history'
  ) THEN
    ALTER TABLE "projection_history"
      ADD CONSTRAINT "projection_history_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "students"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
