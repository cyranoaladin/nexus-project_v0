-- AlterEnum
ALTER TYPE "AcademicTrack" ADD VALUE 'COLLEGE';

-- AlterEnum
ALTER TYPE "GradeLevel" ADD VALUE 'TROISIEME';
ALTER TYPE "GradeLevel" ADD VALUE 'AUTRE';

-- AlterTable
ALTER TABLE "students" ALTER COLUMN "gradeLevel" DROP DEFAULT;

-- Ensure parentId remains NOT NULL (it was already NOT NULL, but we keep it that way)
-- No action needed if it was already NOT NULL, but we explicitly avoid any DROP NOT NULL.
