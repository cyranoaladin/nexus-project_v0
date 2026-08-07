-- PostgreSQL migration. Non appliquée automatiquement.
-- À tester sur un clone anonymisé de la base avant tout déploiement (voir invariant #1).
CREATE TYPE "CandidateDiagnosticStatus" AS ENUM (
  'DRAFT', 'ACTIVE', 'WAITING_PARENT', 'WAITING_RETENTION',
  'SUBMITTED', 'IN_REVIEW', 'REVIEWED', 'CLOSED', 'CANCELLED'
);
CREATE TYPE "CandidateDiagnosticModuleStatus" AS ENUM (
  'LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'SUBMITTED',
  'AUTO_SCORED', 'NEEDS_REVIEW', 'REVIEWED'
);
CREATE TYPE "CandidateDiagnosticDocumentStatus" AS ENUM (
  'UPLOADED', 'ACCEPTED', 'REJECTED', 'NEEDS_REPLACEMENT'
);
CREATE TYPE "CandidateDiagnosticActorRole" AS ENUM (
  'ELEVE', 'PARENT', 'COACH', 'ADMIN', 'SYSTEM'
);

CREATE TABLE "candidate_diagnostics" (
  "id" TEXT NOT NULL,
  "diagnosticKey" TEXT NOT NULL,
  "definitionVersion" TEXT NOT NULL,
  "targetSession" INTEGER NOT NULL,
  "status" "CandidateDiagnosticStatus" NOT NULL DEFAULT 'DRAFT',
  "studentId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "studentConsentAt" TIMESTAMP(3),
  "parentConsentAt" TIMESTAMP(3),
  "parentSubmittedAt" TIMESTAMP(3),
  "retentionDueAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "synthesis" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "candidate_diagnostics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "candidate_diagnostic_modules" (
  "id" TEXT NOT NULL,
  "diagnosticId" TEXT NOT NULL,
  "moduleKey" TEXT NOT NULL,
  "audience" TEXT NOT NULL,
  "status" "CandidateDiagnosticModuleStatus" NOT NULL DEFAULT 'LOCKED',
  "answers" JSONB,
  "currentQuestionIndex" INTEGER NOT NULL DEFAULT 0,
  "elapsedMs" INTEGER NOT NULL DEFAULT 0,
  "integrity" JSONB,
  "autoScore" JSONB,
  "manualScore" JSONB,
  "reviewSummary" TEXT,
  "definitionSnapshot" JSONB NOT NULL,
  "lastMutationId" TEXT,
  "availableAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "candidate_diagnostic_modules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "candidate_diagnostic_documents" (
  "id" TEXT NOT NULL,
  "diagnosticId" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "originalName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "status" "CandidateDiagnosticDocumentStatus" NOT NULL DEFAULT 'UPLOADED',
  "reviewNote" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "clientMutationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "candidate_diagnostic_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "candidate_diagnostic_audit_logs" (
  "id" TEXT NOT NULL,
  "diagnosticId" TEXT NOT NULL,
  "actorId" TEXT,
  "actorRole" "CandidateDiagnosticActorRole" NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "requestId" TEXT,
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "candidate_diagnostic_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "candidate_diagnostics_studentId_diagnosticKey_targetSession_key"
  ON "candidate_diagnostics"("studentId", "diagnosticKey", "targetSession");
CREATE INDEX "candidate_diagnostics_studentId_status_idx" ON "candidate_diagnostics"("studentId", "status");
CREATE INDEX "candidate_diagnostics_status_updatedAt_idx" ON "candidate_diagnostics"("status", "updatedAt");
CREATE UNIQUE INDEX "candidate_diagnostic_modules_diagnosticId_moduleKey_key"
  ON "candidate_diagnostic_modules"("diagnosticId", "moduleKey");
CREATE INDEX "candidate_diagnostic_modules_diagnosticId_status_idx"
  ON "candidate_diagnostic_modules"("diagnosticId", "status");
CREATE UNIQUE INDEX "candidate_diagnostic_documents_diag_mutation_key"
  ON "candidate_diagnostic_documents"("diagnosticId", "clientMutationId");
CREATE INDEX "candidate_diagnostic_documents_diagnosticId_category_idx"
  ON "candidate_diagnostic_documents"("diagnosticId", "category");
CREATE INDEX "candidate_diagnostic_documents_sha256_idx" ON "candidate_diagnostic_documents"("sha256");
CREATE INDEX "candidate_diagnostic_audit_logs_diagnosticId_createdAt_idx"
  ON "candidate_diagnostic_audit_logs"("diagnosticId", "createdAt");
CREATE INDEX "candidate_diagnostic_audit_logs_actorId_createdAt_idx"
  ON "candidate_diagnostic_audit_logs"("actorId", "createdAt");

ALTER TABLE "candidate_diagnostics" ADD CONSTRAINT "candidate_diagnostics_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_diagnostics" ADD CONSTRAINT "candidate_diagnostics_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_diagnostic_modules" ADD CONSTRAINT "candidate_diagnostic_modules_diagnosticId_fkey"
  FOREIGN KEY ("diagnosticId") REFERENCES "candidate_diagnostics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_diagnostic_documents" ADD CONSTRAINT "candidate_diagnostic_documents_diagnosticId_fkey"
  FOREIGN KEY ("diagnosticId") REFERENCES "candidate_diagnostics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_diagnostic_documents" ADD CONSTRAINT "candidate_diagnostic_documents_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_diagnostic_audit_logs" ADD CONSTRAINT "candidate_diagnostic_audit_logs_diagnosticId_fkey"
  FOREIGN KEY ("diagnosticId") REFERENCES "candidate_diagnostics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_diagnostic_audit_logs" ADD CONSTRAINT "candidate_diagnostic_audit_logs_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
