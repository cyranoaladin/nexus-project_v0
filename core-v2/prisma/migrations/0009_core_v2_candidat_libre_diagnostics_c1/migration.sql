-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('AUTHORIZED', 'IN_REVIEW', 'UNAVAILABLE', 'ARCHIVED', 'COMPROMISED', 'DEMO_FIXTURE');

-- CreateEnum
CREATE TYPE "DiagnosticAssignmentStatus" AS ENUM ('ASSIGNED', 'SUBMITTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "DiagnosticSubmissionStatus" AS ENUM ('RECEIVED', 'READABLE', 'ANALYZED', 'REJECTED');

-- CreateTable
CREATE TABLE "diagnostic_instrument_refs" (
    "id" TEXT NOT NULL,
    "instrumentKey" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "targetSession" TEXT NOT NULL,
    "form" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "modalities" TEXT NOT NULL,
    "catalogStatus" "CatalogStatus" NOT NULL DEFAULT 'UNAVAILABLE',
    "manifestChecksum" TEXT NOT NULL,
    "manifestVersion" TEXT NOT NULL,
    "sourceCommit" TEXT,
    "attributionConditions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnostic_instrument_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_assignments" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "instrumentRefId" TEXT NOT NULL,
    "instrumentKeySnapshot" TEXT NOT NULL,
    "instrumentVersionSnapshot" TEXT NOT NULL,
    "formSnapshot" TEXT NOT NULL,
    "manifestChecksumSnapshot" TEXT NOT NULL,
    "conditionsSnapshot" TEXT,
    "studentProfileSnapshot" JSONB NOT NULL,
    "dueAt" TIMESTAMP(3),
    "modalities" TEXT,
    "reviewerId" TEXT,
    "status" "DiagnosticAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnostic_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_submissions" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" "DiagnosticSubmissionStatus" NOT NULL DEFAULT 'RECEIVED',
    "submittedById" TEXT NOT NULL,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnostic_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "diagnostic_instrument_refs_catalogStatus_idx" ON "diagnostic_instrument_refs"("catalogStatus");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_instrument_refs_instrumentKey_version_key" ON "diagnostic_instrument_refs"("instrumentKey", "version");

-- CreateIndex
CREATE INDEX "diagnostic_assignments_studentId_status_idx" ON "diagnostic_assignments"("studentId", "status");

-- CreateIndex
CREATE INDEX "diagnostic_assignments_instrumentRefId_status_idx" ON "diagnostic_assignments"("instrumentRefId", "status");

-- CreateIndex
CREATE INDEX "diagnostic_submissions_assignmentId_status_idx" ON "diagnostic_submissions"("assignmentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_submissions_assignmentId_version_key" ON "diagnostic_submissions"("assignmentId", "version");

-- AddForeignKey
ALTER TABLE "diagnostic_assignments" ADD CONSTRAINT "diagnostic_assignments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_assignments" ADD CONSTRAINT "diagnostic_assignments_instrumentRefId_fkey" FOREIGN KEY ("instrumentRefId") REFERENCES "diagnostic_instrument_refs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_assignments" ADD CONSTRAINT "diagnostic_assignments_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_assignments" ADD CONSTRAINT "diagnostic_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_submissions" ADD CONSTRAINT "diagnostic_submissions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "diagnostic_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_submissions" ADD CONSTRAINT "diagnostic_submissions_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Anti-double-click / anti-duplicate-attribution guard: never more than one
-- non-REVOKED DiagnosticAssignment for the same (studentId, instrumentRefId)
-- pair. A REVOKED row does not block re-attribution (e.g. after a catalog
-- version is compromised and the security-suspension policy is applied —
-- see DiagnosticAssignmentStatus). Same pattern as
-- coach_student_course_assignments_active_triple_key (migration 0002):
-- Prisma's schema DSL cannot express a WHERE-clause index, so this table has
-- no `@@unique` for it in core-v2/prisma/schema.prisma; this index is the
-- sole enforcement.
CREATE UNIQUE INDEX "diagnostic_assignments_active_pair_key"
  ON "diagnostic_assignments" ("studentId", "instrumentRefId")
  WHERE "status" != 'REVOKED';
