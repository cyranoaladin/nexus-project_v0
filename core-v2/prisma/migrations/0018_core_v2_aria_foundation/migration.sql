-- CreateEnum
CREATE TYPE "AriaAccessGrantStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CoreV2AriaTier" AS ENUM ('ARIA_AUTONOMIE', 'ARIA_SUIVI', 'ARIA_ACCOMPAGNEE');

-- CreateTable
CREATE TABLE "aria_cockpit_profiles_core_v2" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "targetSession" INTEGER,
    "pinnedCourseKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weeklyGoalMinutes" INTEGER NOT NULL DEFAULT 180,
    "learningGoals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "curriculumVersion" TEXT NOT NULL DEFAULT 'v1',
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aria_cockpit_profiles_core_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aria_access_grants_core_v2" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "ariaTier" "CoreV2AriaTier" NOT NULL DEFAULT 'ARIA_AUTONOMIE',
    "courseScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "AriaAccessGrantStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "grantedById" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aria_access_grants_core_v2_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aria_cockpit_profiles_core_v2_studentId_key" ON "aria_cockpit_profiles_core_v2"("studentId");

-- CreateIndex
CREATE INDEX "aria_access_grants_core_v2_studentId_featureKey_status_idx" ON "aria_access_grants_core_v2"("studentId", "featureKey", "status");

-- AddForeignKey
ALTER TABLE "aria_cockpit_profiles_core_v2" ADD CONSTRAINT "aria_cockpit_profiles_core_v2_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aria_access_grants_core_v2" ADD CONSTRAINT "aria_access_grants_core_v2_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aria_access_grants_core_v2" ADD CONSTRAINT "aria_access_grants_core_v2_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
