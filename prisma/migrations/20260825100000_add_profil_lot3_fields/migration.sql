-- AlterTable
ALTER TABLE "profils_candidats" ADD COLUMN "intentionCycleComplet" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "epreuvesDispenseesDeclarees" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "etalementPlurisessionsDeclare" BOOLEAN NOT NULL DEFAULT false;
