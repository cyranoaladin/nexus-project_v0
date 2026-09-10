-- Additive only: ARIA Practice submission mechanics (P2a). No existing
-- column, row, or constraint is changed. Pre-existing schema drift on main
-- (undeclared students.specialties drop, FK/index renames — tracked in
-- issue #225) is deliberately excluded, same as every prior ARIA migration
-- this lot's history followed.

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('MCQ', 'SHORT_ANSWER', 'STRUCTURED_RESPONSE', 'PROBLEM', 'DOCUMENT_ANALYSIS', 'CODE');

-- CreateEnum
CREATE TYPE "ActivityVersionStatus" AS ENUM ('ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "ActivityAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED');

-- CreateTable
CREATE TABLE "aria_activities" (
    "id" TEXT NOT NULL,
    "courseKey" TEXT NOT NULL,
    "skillId" TEXT,
    "curriculumVersion" TEXT NOT NULL,
    "activityType" "ActivityType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aria_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aria_activity_versions" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "prompt" JSONB NOT NULL,
    "expectedAnswerShape" JSONB NOT NULL,
    "correctionRubric" JSONB NOT NULL,
    "status" "ActivityVersionStatus" NOT NULL DEFAULT 'ACTIVE',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aria_activity_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aria_activity_attempts" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "activityVersionId" TEXT NOT NULL,
    "courseKey" TEXT NOT NULL,
    "status" "ActivityAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "aria_activity_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aria_activity_responses" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aria_activity_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aria_activities_courseKey_skillId_idx" ON "aria_activities"("courseKey", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "aria_activity_versions_activityId_versionLabel_key" ON "aria_activity_versions"("activityId", "versionLabel");

-- CreateIndex
CREATE INDEX "aria_activity_attempts_studentId_courseKey_idx" ON "aria_activity_attempts"("studentId", "courseKey");

-- Hand-added: Prisma 6.19's schema DSL cannot express a partial unique
-- index. At most one IN_PROGRESS attempt per (studentId, activityVersionId)
-- — a retired/SUBMITTED attempt never counts, so a student can legitimately
-- retry an activity across separate attempts; this only prevents two
-- concurrently-open attempts on the same version.
CREATE UNIQUE INDEX "aria_activity_attempts_open_student_version_key"
  ON "aria_activity_attempts"("studentId", "activityVersionId")
  WHERE "status" = 'IN_PROGRESS';

-- CreateIndex
CREATE UNIQUE INDEX "aria_activity_responses_attemptId_key" ON "aria_activity_responses"("attemptId");

-- AddForeignKey
ALTER TABLE "aria_activity_versions" ADD CONSTRAINT "aria_activity_versions_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "aria_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aria_activity_attempts" ADD CONSTRAINT "aria_activity_attempts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aria_activity_attempts" ADD CONSTRAINT "aria_activity_attempts_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "aria_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aria_activity_attempts" ADD CONSTRAINT "aria_activity_attempts_activityVersionId_fkey" FOREIGN KEY ("activityVersionId") REFERENCES "aria_activity_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aria_activity_responses" ADD CONSTRAINT "aria_activity_responses_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "aria_activity_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
