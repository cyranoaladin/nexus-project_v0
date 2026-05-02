-- Migration: Add EAF Preparation Report Lifecycle Fields
-- Description: Add status, completionRatio, validatedAt, validatedBy fields
-- to support the coach report validation workflow
-- Created: 2026-05-02

-- Add lifecycle fields to eaf_preparation_reports table
-- Using IF NOT EXISTS for idempotency in case of partial migration

-- status: DRAFT (default), VALIDATED, or other workflow states
ALTER TABLE "eaf_preparation_reports" 
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'DRAFT';

-- completionRatio: 0-100 percentage of filled fields
ALTER TABLE "eaf_preparation_reports" 
ADD COLUMN IF NOT EXISTS "completionRatio" INTEGER NOT NULL DEFAULT 0;

-- validatedAt: timestamp when report was validated by coach
ALTER TABLE "eaf_preparation_reports" 
ADD COLUMN IF NOT EXISTS "validatedAt" TIMESTAMP(3);

-- validatedBy: coachId who validated the report (for audit trail)
ALTER TABLE "eaf_preparation_reports" 
ADD COLUMN IF NOT EXISTS "validatedBy" TEXT;

-- Note: These fields align with the EafPreparationReport model in schema.prisma
-- status          String    @default("DRAFT")
-- completionRatio Int       @default(0)
-- validatedAt     DateTime?
-- validatedBy     String?
