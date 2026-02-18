-- Migration: Add missing tables (diagnostics, stage_reservations, invoices, invoice_items,
-- invoice_sequences, trajectories, invoice_access_tokens) and missing enums.
--
-- These models were defined in schema.prisma but never had a migration generated.

-- ─── 1. Create missing enums ─────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InvoicePaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'KONNECT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TrajectoryStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. Create diagnostics table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "diagnostics" (
    "id" TEXT NOT NULL,
    "publicShareId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "definitionKey" TEXT,
    "definitionVersion" TEXT,
    "promptVersion" TEXT,
    "modelUsed" TEXT,
    "ragUsed" BOOLEAN NOT NULL DEFAULT false,
    "ragCollections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "studentFirstName" TEXT NOT NULL,
    "studentLastName" TEXT NOT NULL,
    "studentEmail" TEXT NOT NULL,
    "studentPhone" TEXT,
    "establishment" TEXT,
    "teacherName" TEXT,
    "mathAverage" TEXT,
    "specialtyAverage" TEXT,
    "bacBlancResult" TEXT,
    "classRanking" TEXT,
    "data" JSONB,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "analysisResult" TEXT,
    "actionPlan" TEXT,
    "analysisJson" JSONB,
    "studentMarkdown" TEXT,
    "parentsMarkdown" TEXT,
    "nexusMarkdown" TEXT,
    "errorCode" TEXT,
    "errorDetails" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnostics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "diagnostics_publicShareId_key" ON "diagnostics"("publicShareId");
CREATE INDEX IF NOT EXISTS "diagnostics_type_status_idx" ON "diagnostics"("type", "status");
CREATE INDEX IF NOT EXISTS "diagnostics_studentEmail_idx" ON "diagnostics"("studentEmail");
CREATE INDEX IF NOT EXISTS "diagnostics_publicShareId_idx" ON "diagnostics"("publicShareId");
CREATE INDEX IF NOT EXISTS "diagnostics_definitionKey_status_idx" ON "diagnostics"("definitionKey", "status");

-- ─── 3. Create stage_reservations table ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS "stage_reservations" (
    "id" TEXT NOT NULL,
    "parentName" TEXT NOT NULL,
    "studentName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "classe" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "academyTitle" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scoringResult" JSONB,
    "telegramSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stage_reservations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "stage_reservations_email_academyId_key" ON "stage_reservations"("email", "academyId");
CREATE INDEX IF NOT EXISTS "stage_reservations_status_idx" ON "stage_reservations"("status");
CREATE INDEX IF NOT EXISTS "stage_reservations_academyId_idx" ON "stage_reservations"("academyId");

-- ─── 4. Create invoices table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "invoices" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerAddress" TEXT,
    "customerId" TEXT,
    "issuerName" TEXT NOT NULL DEFAULT 'M&M Academy',
    "issuerAddress" TEXT NOT NULL DEFAULT 'Résidence Narjess 2, Bloc D, Appt 12, Raoued 2056, Ariana, Tunisie',
    "issuerMF" TEXT NOT NULL DEFAULT '1XXXXXX/X/A/M/000',
    "issuerRNE" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "discountTotal" INTEGER NOT NULL DEFAULT 0,
    "taxTotal" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "taxRegime" TEXT NOT NULL DEFAULT 'TVA_NON_APPLICABLE',
    "paymentMethod" "InvoicePaymentMethod",
    "paymentDetails" JSONB,
    "paidAt" TIMESTAMP(3),
    "paidAmount" INTEGER,
    "paymentReference" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "pdfPath" TEXT,
    "pdfUrl" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "notes" TEXT,
    "events" JSONB NOT NULL DEFAULT '[]',
    "beneficiaryUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "invoices_number_key" ON "invoices"("number");
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices"("status");
CREATE INDEX IF NOT EXISTS "invoices_customerEmail_idx" ON "invoices"("customerEmail");
CREATE INDEX IF NOT EXISTS "invoices_issuedAt_idx" ON "invoices"("issuedAt");
CREATE INDEX IF NOT EXISTS "invoices_createdByUserId_idx" ON "invoices"("createdByUserId");

-- ─── 5. Create invoice_items table ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "productCode" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");

-- Foreign key: invoice_items → invoices
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── 6. Create invoice_sequences table ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "invoice_sequences" (
    "id" TEXT NOT NULL,
    "yearMonth" INTEGER NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_sequences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "invoice_sequences_yearMonth_key" ON "invoice_sequences"("yearMonth");

-- ─── 7. Create trajectories table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "trajectories" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetScore" INTEGER,
    "horizon" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "TrajectoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "milestones" JSONB NOT NULL DEFAULT '[]',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trajectories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "trajectories_studentId_status_idx" ON "trajectories"("studentId", "status");

-- Foreign key: trajectories → students
ALTER TABLE "trajectories" ADD CONSTRAINT "trajectories_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── 8. Create invoice_access_tokens table ────────────────────────────────────

CREATE TABLE IF NOT EXISTS "invoice_access_tokens" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "invoice_access_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "invoice_access_tokens_tokenHash_key" ON "invoice_access_tokens"("tokenHash");
CREATE INDEX IF NOT EXISTS "invoice_access_tokens_invoiceId_idx" ON "invoice_access_tokens"("invoiceId");

-- Foreign key: invoice_access_tokens → invoices
ALTER TABLE "invoice_access_tokens" ADD CONSTRAINT "invoice_access_tokens_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── 9. Add FK for entitlements → invoices (if not already present) ───────────

DO $$ BEGIN
  ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_sourceInvoiceId_fkey"
      FOREIGN KEY ("sourceInvoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
