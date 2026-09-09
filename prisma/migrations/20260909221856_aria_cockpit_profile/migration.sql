-- Additive only: a new cockpit-scoped learning-preferences table, distinct
-- from the pre-existing `AriaLearningProfile` (see prisma/schema.prisma for
-- the collision this resolves). No existing column, row, or constraint is
-- changed by this migration.

-- CreateTable
CREATE TABLE "aria_cockpit_profiles" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "targetSession" INTEGER,
    "pinnedCourseKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weeklyGoalMinutes" INTEGER NOT NULL DEFAULT 180,
    "learningGoals" JSONB NOT NULL DEFAULT '[]',
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "curriculumVersion" TEXT NOT NULL DEFAULT 'v1',
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aria_cockpit_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aria_cockpit_profiles_studentId_key" ON "aria_cockpit_profiles"("studentId");

-- AddForeignKey
ALTER TABLE "aria_cockpit_profiles" ADD CONSTRAINT "aria_cockpit_profiles_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
