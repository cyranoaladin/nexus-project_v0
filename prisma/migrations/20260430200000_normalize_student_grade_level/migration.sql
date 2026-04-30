-- AlterEnum
ALTER TYPE "AcademicTrack" ADD VALUE 'COLLEGE';

-- AlterEnum
ALTER TYPE "GradeLevel" ADD VALUE 'TROISIEME';
ALTER TYPE "GradeLevel" ADD VALUE 'AUTRE';

-- AlterEnum
BEGIN;
CREATE TYPE "InvoicePaymentMethod_new" AS ENUM ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'CLICTOPAY');
ALTER TABLE "invoices" ALTER COLUMN "paymentMethod" TYPE "InvoicePaymentMethod_new" USING ("paymentMethod"::text::"InvoicePaymentMethod_new");
ALTER TYPE "InvoicePaymentMethod" RENAME TO "InvoicePaymentMethod_old";
ALTER TYPE "InvoicePaymentMethod_new" RENAME TO "InvoicePaymentMethod";
DROP TYPE "public"."InvoicePaymentMethod_old";
COMMIT;

-- AlterTable
ALTER TABLE "students" ALTER COLUMN "gradeLevel" DROP DEFAULT,
ALTER COLUMN "parentId" DROP NOT NULL;

-- DropTable
DROP TABLE IF EXISTS "student_profiles";

-- CreateTable
CREATE TABLE IF NOT EXISTS "clictopay_transactions" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "bankReference" TEXT,
    "paymentId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clictopay_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "clictopay_transactions_orderId_key" ON "clictopay_transactions"("orderId");
CREATE UNIQUE INDEX IF NOT EXISTS "clictopay_transactions_paymentId_key" ON "clictopay_transactions"("paymentId");
CREATE INDEX IF NOT EXISTS "clictopay_transactions_userId_idx" ON "clictopay_transactions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "bilans_legacyDiagnosticId_key" ON "bilans"("legacyDiagnosticId");
CREATE UNIQUE INDEX IF NOT EXISTS "bilans_legacyAssessmentId_key" ON "bilans"("legacyAssessmentId");
CREATE UNIQUE INDEX IF NOT EXISTS "bilans_legacyStageBilanId_key" ON "bilans"("legacyStageBilanId");
CREATE INDEX IF NOT EXISTS "bilans_publicShareId_idx" ON "bilans"("publicShareId");
CREATE INDEX IF NOT EXISTS "bilans_legacyDiagnosticId_idx" ON "bilans"("legacyDiagnosticId");
CREATE INDEX IF NOT EXISTS "bilans_legacyAssessmentId_idx" ON "bilans"("legacyAssessmentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payments_externalId_method_key" ON "payments"("externalId", "method");
