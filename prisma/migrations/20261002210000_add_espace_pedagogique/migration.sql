-- Espace pédagogique Terminale : identité sans email (username + pinHash),
-- groupes, inscriptions, séances, travaux versionnés, annotations, pièces
-- jointes et provenance legacy.
-- Migration strictement additive : 12 tables et 5 types énumérés créés, quatre
-- colonnes nullables + un index unique sur "users". Aucune donnée existante
-- n'est lue, déplacée ni supprimée. Rollback applicatif : laisser les objets en
-- place (ils sont inertes sans le code). Aucune suppression de table n'est
-- prévue : elles contiendront des travaux d'élèves.

-- CreateEnum
CREATE TYPE "EspaceActivityKind" AS ENUM ('PYTHON_TP', 'RESOURCE_PACK', 'UPLOAD_EXERCISE');

-- CreateEnum
CREATE TYPE "EspaceSessionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "EspaceWorkStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'CORRECTED', 'REOPENED', 'DONE');

-- CreateEnum
CREATE TYPE "EspaceVersionReason" AS ENUM ('STEP_CHANGE', 'RUN', 'SUBMIT', 'REOPEN', 'CORRECTION', 'INTERVAL', 'LEGACY_IMPORT');

-- CreateEnum
CREATE TYPE "EspaceAnnotationKind" AS ENUM ('GENERAL', 'QUESTION', 'STEP', 'CODE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "disabledAt" TIMESTAMP(3),
ADD COLUMN     "pinHash" TEXT,
ADD COLUMN     "pinSetAt" TIMESTAMP(3),
ADD COLUMN     "username" TEXT;

-- CreateTable
CREATE TABLE "espace_groups" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "espace_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "espace_enrollments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "subject" "Subject" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "espace_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "espace_teacher_assignments" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "subject" "Subject" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "espace_teacher_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "espace_activities" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "subject" "Subject" NOT NULL,
    "moduleSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "EspaceActivityKind" NOT NULL,
    "stepsTotal" INTEGER NOT NULL DEFAULT 0,
    "contentVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "espace_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "espace_sessions" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "subject" "Subject" NOT NULL,
    "activityId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "status" "EspaceSessionStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "espace_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "espace_session_participants" (
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "espace_session_participants_pkey" PRIMARY KEY ("sessionId","userId")
);

-- CreateTable
CREATE TABLE "espace_works" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "sessionId" TEXT,
    "status" "EspaceWorkStatus" NOT NULL DEFAULT 'DRAFT',
    "content" JSONB NOT NULL DEFAULT '{}',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "progressSteps" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSavedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "correctedAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "espace_works_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "espace_work_versions" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "reason" "EspaceVersionReason" NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "espace_work_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "espace_annotations" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" "EspaceAnnotationKind" NOT NULL,
    "stepId" TEXT,
    "questionId" TEXT,
    "workRevision" INTEGER,
    "lineStart" INTEGER,
    "lineEnd" INTEGER,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "espace_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "espace_comment_snippets" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "espace_comment_snippets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "espace_work_attachments" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "espace_work_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "espace_legacy_links" (
    "id" TEXT NOT NULL,
    "legacyTraceId" TEXT NOT NULL,
    "sourceSha" TEXT NOT NULL,
    "sourceAlias" TEXT NOT NULL,
    "sourceDbSha256" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "workId" TEXT,
    "linkedById" TEXT NOT NULL,
    "note" TEXT,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "espace_legacy_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "espace_groups_slug_key" ON "espace_groups"("slug");

-- CreateIndex
CREATE INDEX "espace_enrollments_groupId_subject_idx" ON "espace_enrollments"("groupId", "subject");

-- CreateIndex
CREATE INDEX "espace_enrollments_userId_idx" ON "espace_enrollments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "espace_enrollments_userId_groupId_subject_key" ON "espace_enrollments"("userId", "groupId", "subject");

-- CreateIndex
CREATE INDEX "espace_teacher_assignments_groupId_subject_idx" ON "espace_teacher_assignments"("groupId", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "espace_teacher_assignments_teacherId_groupId_subject_key" ON "espace_teacher_assignments"("teacherId", "groupId", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "espace_activities_slug_key" ON "espace_activities"("slug");

-- CreateIndex
CREATE INDEX "espace_activities_subject_moduleSlug_idx" ON "espace_activities"("subject", "moduleSlug");

-- CreateIndex
CREATE INDEX "espace_sessions_groupId_status_idx" ON "espace_sessions"("groupId", "status");

-- CreateIndex
CREATE INDEX "espace_sessions_teacherId_status_idx" ON "espace_sessions"("teacherId", "status");

-- CreateIndex
CREATE INDEX "espace_sessions_activityId_idx" ON "espace_sessions"("activityId");

-- CreateIndex
CREATE INDEX "espace_session_participants_userId_idx" ON "espace_session_participants"("userId");

-- CreateIndex
CREATE INDEX "espace_works_activityId_status_idx" ON "espace_works"("activityId", "status");

-- CreateIndex
CREATE INDEX "espace_works_status_lastSavedAt_idx" ON "espace_works"("status", "lastSavedAt");

-- CreateIndex
CREATE INDEX "espace_works_sessionId_idx" ON "espace_works"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "espace_works_studentId_activityId_key" ON "espace_works"("studentId", "activityId");

-- CreateIndex
CREATE INDEX "espace_work_versions_workId_createdAt_idx" ON "espace_work_versions"("workId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "espace_work_versions_workId_revision_key" ON "espace_work_versions"("workId", "revision");

-- CreateIndex
CREATE INDEX "espace_annotations_workId_createdAt_idx" ON "espace_annotations"("workId", "createdAt");

-- CreateIndex
CREATE INDEX "espace_annotations_authorId_idx" ON "espace_annotations"("authorId");

-- CreateIndex
CREATE INDEX "espace_comment_snippets_teacherId_idx" ON "espace_comment_snippets"("teacherId");

-- CreateIndex
CREATE INDEX "espace_work_attachments_workId_idx" ON "espace_work_attachments"("workId");

-- CreateIndex
CREATE UNIQUE INDEX "espace_legacy_links_legacyTraceId_key" ON "espace_legacy_links"("legacyTraceId");

-- CreateIndex
CREATE UNIQUE INDEX "espace_legacy_links_sourceSha_key" ON "espace_legacy_links"("sourceSha");

-- CreateIndex
CREATE INDEX "espace_legacy_links_studentId_idx" ON "espace_legacy_links"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AddForeignKey
ALTER TABLE "espace_enrollments" ADD CONSTRAINT "espace_enrollments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace_enrollments" ADD CONSTRAINT "espace_enrollments_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "espace_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace_teacher_assignments" ADD CONSTRAINT "espace_teacher_assignments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace_teacher_assignments" ADD CONSTRAINT "espace_teacher_assignments_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "espace_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace_sessions" ADD CONSTRAINT "espace_sessions_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "espace_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace_sessions" ADD CONSTRAINT "espace_sessions_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "espace_activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace_sessions" ADD CONSTRAINT "espace_sessions_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace_session_participants" ADD CONSTRAINT "espace_session_participants_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "espace_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace_session_participants" ADD CONSTRAINT "espace_session_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace_works" ADD CONSTRAINT "espace_works_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace_works" ADD CONSTRAINT "espace_works_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "espace_activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace_works" ADD CONSTRAINT "espace_works_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "espace_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace_work_versions" ADD CONSTRAINT "espace_work_versions_workId_fkey" FOREIGN KEY ("workId") REFERENCES "espace_works"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace_annotations" ADD CONSTRAINT "espace_annotations_workId_fkey" FOREIGN KEY ("workId") REFERENCES "espace_works"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace_annotations" ADD CONSTRAINT "espace_annotations_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace_comment_snippets" ADD CONSTRAINT "espace_comment_snippets_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace_work_attachments" ADD CONSTRAINT "espace_work_attachments_workId_fkey" FOREIGN KEY ("workId") REFERENCES "espace_works"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace_work_attachments" ADD CONSTRAINT "espace_work_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace_legacy_links" ADD CONSTRAINT "espace_legacy_links_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace_legacy_links" ADD CONSTRAINT "espace_legacy_links_workId_fkey" FOREIGN KEY ("workId") REFERENCES "espace_works"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace_legacy_links" ADD CONSTRAINT "espace_legacy_links_linkedById_fkey" FOREIGN KEY ("linkedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

