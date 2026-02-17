-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "EntitlementStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: Add activation columns to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activationToken" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activationExpiry" TIMESTAMP(3);

-- CreateTable: entitlements
CREATE TABLE IF NOT EXISTS "entitlements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "EntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "sourceInvoiceId" TEXT,
    "metadata" JSONB,
    "suspendedAt" TIMESTAMP(3),
    "suspendReason" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "entitlements_userId_status_idx" ON "entitlements"("userId", "status");
CREATE INDEX IF NOT EXISTS "entitlements_productCode_idx" ON "entitlements"("productCode");
CREATE INDEX IF NOT EXISTS "entitlements_sourceInvoiceId_idx" ON "entitlements"("sourceInvoiceId");

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
