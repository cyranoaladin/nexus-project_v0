-- Core v2 greenfield baseline. Generated verbatim (not hand-authored) via:
--   npx prisma migrate diff --from-empty \
--     --to-schema-datamodel core-v2/prisma/schema.prisma --script
-- Bootstraps an EMPTY PostgreSQL database to exactly the schema in
-- core-v2/prisma/schema.prisma. Does not reuse or reference any of the
-- ~106 legacy migrations under prisma/migrations/ — this is a fresh
-- baseline, per docs/architecture/adr/0001-core-v2-single-source-of-truth.md
-- item 7. Invariants Prisma cannot express (CHECK, partial unique index)
-- are added by the following migration, 0002_core_v2_sql_invariants.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ASSISTANTE', 'COACH', 'PARENT', 'ELEVE');

-- CreateEnum
CREATE TYPE "AcademicYearStatus" AS ENUM ('UPCOMING', 'CURRENT', 'CLOSED');

-- CreateEnum
CREATE TYPE "StudentAcademicYearEnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'WITHDRAWN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AcademicEnrollmentKind" AS ENUM ('SPECIALTY', 'OPTION');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateEnum
CREATE TYPE "SchoolingStatus" AS ENUM ('SCHOOL_ENROLLED', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "GradeLevel" AS ENUM ('QUATRIEME', 'TROISIEME', 'SECONDE', 'PREMIERE', 'TERMINALE', 'POSTBAC', 'AUTRE');

-- CreateEnum
CREATE TYPE "AcademicTrack" AS ENUM ('COLLEGE', 'EDS_GENERALE', 'STMG', 'STI2D', 'ST2S', 'STL', 'STD2A', 'STMG_NON_LYCEEN');

-- CreateEnum
CREATE TYPE "StmgPathway" AS ENUM ('RHC', 'MERCATIQUE', 'GF', 'SIG', 'INDETERMINE');

-- CreateEnum
CREATE TYPE "SessionModality" AS ENUM ('ONLINE', 'IN_PERSON', 'HYBRID');

-- CreateEnum
CREATE TYPE "PlanningSeriesStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT,
    "role" "UserRole" NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "activatedAt" TIMESTAMP(3),
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "registrationCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "households" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_parents" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_parents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students_v2" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_years" (
    "id" TEXT NOT NULL,
    "startYear" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "AcademicYearStatus" NOT NULL DEFAULT 'UPCOMING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_academic_year_enrollments" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "status" "StudentAcademicYearEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "schoolingStatus" "SchoolingStatus",
    "gradeLevel" "GradeLevel" NOT NULL,
    "academicTrack" "AcademicTrack" NOT NULL DEFAULT 'EDS_GENERALE',
    "stmgPathway" "StmgPathway",
    "school" TEXT,
    "academicRevision" INTEGER NOT NULL DEFAULT 0,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_academic_year_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_course_enrollments" (
    "id" TEXT NOT NULL,
    "academicYearEnrollmentId" TEXT NOT NULL,
    "courseKey" TEXT NOT NULL,
    "kind" "AcademicEnrollmentKind" NOT NULL,
    "curriculumVersion" TEXT NOT NULL DEFAULT 'v1',
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_course_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_profiles_v2" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_profiles_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_course_capabilities" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "courseKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_course_capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_student_course_assignments" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "academicYearEnrollmentId" TEXT NOT NULL,
    "courseKey" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignmentType" "AssignmentType",
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_student_course_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planning_series_v2" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Tunis',
    "startDate" DATE NOT NULL,
    "localStartTime" TEXT NOT NULL,
    "localEndTime" TEXT NOT NULL,
    "recurrenceRule" TEXT NOT NULL,
    "recurrenceCount" INTEGER,
    "recurrenceUntil" DATE,
    "modality" "SessionModality" NOT NULL,
    "location" TEXT,
    "status" "PlanningSeriesStatus" NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planning_series_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_bookings_v2" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "planningSeriesId" TEXT,
    "occurrenceKey" TEXT,
    "overridesBookingId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "modality" "SessionModality" NOT NULL DEFAULT 'ONLINE',
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "session_bookings_v2_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "household_parents_userId_key" ON "household_parents"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "household_parents_householdId_userId_key" ON "household_parents"("householdId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "students_v2_userId_key" ON "students_v2"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "academic_years_startYear_key" ON "academic_years"("startYear");

-- CreateIndex
CREATE INDEX "student_academic_year_enrollments_academicYearId_status_idx" ON "student_academic_year_enrollments"("academicYearId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "student_academic_year_enrollments_studentId_academicYearId_key" ON "student_academic_year_enrollments"("studentId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "student_course_enrollments_academicYearEnrollmentId_courseK_key" ON "student_course_enrollments"("academicYearEnrollmentId", "courseKey");

-- CreateIndex
CREATE UNIQUE INDEX "coach_profiles_v2_userId_key" ON "coach_profiles_v2"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "coach_course_capabilities_coachId_courseKey_key" ON "coach_course_capabilities"("coachId", "courseKey");

-- CreateIndex
CREATE INDEX "coach_student_course_assignments_coachId_status_idx" ON "coach_student_course_assignments"("coachId", "status");

-- CreateIndex
CREATE INDEX "coach_student_course_assignments_academicYearEnrollmentId_s_idx" ON "coach_student_course_assignments"("academicYearEnrollmentId", "status");

-- CreateIndex
CREATE INDEX "planning_series_v2_assignmentId_status_idx" ON "planning_series_v2"("assignmentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "session_bookings_v2_occurrenceKey_key" ON "session_bookings_v2"("occurrenceKey");

-- CreateIndex
CREATE UNIQUE INDEX "session_bookings_v2_overridesBookingId_key" ON "session_bookings_v2"("overridesBookingId");

-- CreateIndex
CREATE INDEX "session_bookings_v2_assignmentId_startsAt_idx" ON "session_bookings_v2"("assignmentId", "startsAt");

-- CreateIndex
CREATE INDEX "session_bookings_v2_planningSeriesId_startsAt_idx" ON "session_bookings_v2"("planningSeriesId", "startsAt");

-- CreateIndex
CREATE INDEX "session_bookings_v2_status_startsAt_idx" ON "session_bookings_v2"("status", "startsAt");

-- AddForeignKey
ALTER TABLE "household_parents" ADD CONSTRAINT "household_parents_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_parents" ADD CONSTRAINT "household_parents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students_v2" ADD CONSTRAINT "students_v2_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students_v2" ADD CONSTRAINT "students_v2_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_academic_year_enrollments" ADD CONSTRAINT "student_academic_year_enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_academic_year_enrollments" ADD CONSTRAINT "student_academic_year_enrollments_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_academic_year_enrollments" ADD CONSTRAINT "student_academic_year_enrollments_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_course_enrollments" ADD CONSTRAINT "student_course_enrollments_academicYearEnrollmentId_fkey" FOREIGN KEY ("academicYearEnrollmentId") REFERENCES "student_academic_year_enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_course_enrollments" ADD CONSTRAINT "student_course_enrollments_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_profiles_v2" ADD CONSTRAINT "coach_profiles_v2_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_course_capabilities" ADD CONSTRAINT "coach_course_capabilities_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coach_profiles_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_student_course_assignments" ADD CONSTRAINT "coach_student_course_assignments_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coach_profiles_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_student_course_assignments" ADD CONSTRAINT "coach_student_course_assignments_academicYearEnrollmentId_fkey" FOREIGN KEY ("academicYearEnrollmentId") REFERENCES "student_academic_year_enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_student_course_assignments" ADD CONSTRAINT "coach_student_course_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_series_v2" ADD CONSTRAINT "planning_series_v2_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "coach_student_course_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_series_v2" ADD CONSTRAINT "planning_series_v2_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_bookings_v2" ADD CONSTRAINT "session_bookings_v2_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "coach_student_course_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_bookings_v2" ADD CONSTRAINT "session_bookings_v2_planningSeriesId_fkey" FOREIGN KEY ("planningSeriesId") REFERENCES "planning_series_v2"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_bookings_v2" ADD CONSTRAINT "session_bookings_v2_overridesBookingId_fkey" FOREIGN KEY ("overridesBookingId") REFERENCES "session_bookings_v2"("id") ON DELETE SET NULL ON UPDATE CASCADE;

