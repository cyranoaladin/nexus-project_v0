-- Migration: Fix Payment.userId FK to match Prisma schema (SetNull)
-- The 20260214_fix_cascade_constraints migration incorrectly set CASCADE.
-- The Prisma schema defines onDelete: SetNull to preserve payment history.

-- Make userId nullable (required for SET NULL)
ALTER TABLE "payments" ALTER COLUMN "userId" DROP NOT NULL;

-- Fix Payment.userId - Change from CASCADE to SET NULL (align with schema)
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_userId_fkey";
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
