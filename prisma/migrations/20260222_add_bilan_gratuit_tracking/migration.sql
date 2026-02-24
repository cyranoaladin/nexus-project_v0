-- AlterTable
ALTER TABLE "parent_profiles" ADD COLUMN IF NOT EXISTS "bilanGratuitCompletedAt" TIMESTAMP(3);
ALTER TABLE "parent_profiles" ADD COLUMN IF NOT EXISTS "bilanGratuitDismissedAt" TIMESTAMP(3);
