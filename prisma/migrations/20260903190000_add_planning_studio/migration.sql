-- Nexus Planning Studio : planning hebdomadaire partagé.
-- Migration strictement additive : deux nouvelles tables et un type énuméré,
-- aucune table existante modifiée. Réversible par suppression des objets créés.

-- CreateEnum
CREATE TYPE "PlanningStudioAction" AS ENUM ('INIT', 'SAVE', 'IMPORT', 'RESTORE', 'RESET');

-- CreateTable
CREATE TABLE "planning_studio_documents" (
    "id" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "planning_studio_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planning_studio_revisions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "action" "PlanningStudioAction" NOT NULL,
    "summary" TEXT,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "planning_studio_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "planning_studio_documents_academicYear_key" ON "planning_studio_documents"("academicYear");

-- CreateIndex
CREATE INDEX "planning_studio_revisions_documentId_createdAt_idx" ON "planning_studio_revisions"("documentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "planning_studio_revisions_documentId_revision_key" ON "planning_studio_revisions"("documentId", "revision");

-- AddForeignKey
ALTER TABLE "planning_studio_documents" ADD CONSTRAINT "planning_studio_documents_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_studio_revisions" ADD CONSTRAINT "planning_studio_revisions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "planning_studio_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_studio_revisions" ADD CONSTRAINT "planning_studio_revisions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
