-- Cockpit d'apprentissage ARIA — migration ADDITIVE UNIQUEMENT.
--
-- Contenu : une table, un index unique, une clé étrangère.
-- Aucun DROP, aucun ALTER destructif, aucune modification de table existante,
-- aucune modification d'enum, aucune réécriture de migration historique.

-- CreateTable
CREATE TABLE "aria_learning_profiles" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "targetSession" INTEGER,
    "selectedCourseKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weeklyGoalMinutes" INTEGER NOT NULL DEFAULT 180,
    "learningGoals" JSONB NOT NULL DEFAULT '[]',
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "curriculumVersion" TEXT NOT NULL DEFAULT 'v1',
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aria_learning_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aria_learning_profiles_studentId_key" ON "aria_learning_profiles"("studentId");

-- AddForeignKey
ALTER TABLE "aria_learning_profiles" ADD CONSTRAINT "aria_learning_profiles_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
