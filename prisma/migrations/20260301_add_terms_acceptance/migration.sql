-- AlterTable: Add terms acceptance audit fields to payments table
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "termsVersion" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "termsAcceptedIp" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "immediateExecution" BOOLEAN NOT NULL DEFAULT false;
