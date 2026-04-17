-- Additive migration: add Stage ecosystem models
-- Backward-compatible: only new tables + new nullable columns on stage_reservations

-- CreateEnum (idempotent guard)
DO $$ BEGIN
  CREATE TYPE "StageType" AS ENUM ('INTENSIF', 'SEMAINE_BLANCHE', 'BILAN', 'GRAND_ORAL', 'BAC_FRANCAIS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "StageReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'WAITLISTED', 'CANCELLED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AlterTable stage_reservations — add new nullable columns only
ALTER TABLE "stage_reservations"
  ADD COLUMN IF NOT EXISTS "activationToken" TEXT,
  ADD COLUMN IF NOT EXISTS "activationTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentRef" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentStatus" "PaymentStatus",
  ADD COLUMN IF NOT EXISTS "richStatus" "StageReservationStatus",
  ADD COLUMN IF NOT EXISTS "stageId" TEXT,
  ADD COLUMN IF NOT EXISTS "studentId" TEXT;

-- CreateTable
CREATE TABLE "stages" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "type" "StageType" NOT NULL DEFAULT 'INTENSIF',
    "subject" "Subject"[],
    "level" TEXT[],
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 12,
    "priceAmount" DECIMAL(10,2) NOT NULL,
    "priceCurrency" TEXT NOT NULL DEFAULT 'TND',
    "location" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_sessions" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" "Subject" NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "coachId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stage_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_coaches" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stage_coaches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_documents" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "stageSessionId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stage_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_bilans" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "contentEleve" TEXT NOT NULL,
    "contentParent" TEXT NOT NULL,
    "contentInterne" TEXT,
    "scoreGlobal" DOUBLE PRECISION,
    "domainScores" JSONB,
    "strengths" TEXT[],
    "areasForGrowth" TEXT[],
    "nextSteps" TEXT,
    "pdfUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stage_bilans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "stages_slug_key" ON "stages"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stages_slug_idx" ON "stages"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stages_startDate_idx" ON "stages"("startDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stage_sessions_stageId_idx" ON "stage_sessions"("stageId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stage_sessions_startAt_idx" ON "stage_sessions"("startAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "stage_coaches_stageId_coachId_key" ON "stage_coaches"("stageId", "coachId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stage_documents_stageId_idx" ON "stage_documents"("stageId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stage_documents_stageSessionId_idx" ON "stage_documents"("stageSessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stage_bilans_stageId_idx" ON "stage_bilans"("stageId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stage_bilans_studentId_idx" ON "stage_bilans"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "stage_bilans_stageId_studentId_key" ON "stage_bilans"("stageId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "stage_reservations_activationToken_key" ON "stage_reservations"("activationToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stage_reservations_stageId_idx" ON "stage_reservations"("stageId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stage_reservations_studentId_idx" ON "stage_reservations"("studentId");

-- AddForeignKey
ALTER TABLE "stage_sessions" ADD CONSTRAINT "stage_sessions_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_sessions" ADD CONSTRAINT "stage_sessions_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coach_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_coaches" ADD CONSTRAINT "stage_coaches_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_coaches" ADD CONSTRAINT "stage_coaches_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coach_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_documents" ADD CONSTRAINT "stage_documents_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_documents" ADD CONSTRAINT "stage_documents_stageSessionId_fkey" FOREIGN KEY ("stageSessionId") REFERENCES "stage_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_documents" ADD CONSTRAINT "stage_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_bilans" ADD CONSTRAINT "stage_bilans_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_bilans" ADD CONSTRAINT "stage_bilans_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_bilans" ADD CONSTRAINT "stage_bilans_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coach_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_reservations" ADD CONSTRAINT "stage_reservations_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_reservations" ADD CONSTRAINT "stage_reservations_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
