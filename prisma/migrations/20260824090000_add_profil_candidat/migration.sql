-- CreateEnum
CREATE TYPE "CandidateLevel" AS ENUM ('PREMIERE', 'TERMINALE');

-- CreateEnum
CREATE TYPE "Modalite" AS ENUM ('A', 'B');

-- CreateEnum
CREATE TYPE "BrancheBascule" AS ENUM ('CONSERVATION_MOYENNES_PREMIERE', 'RENONCIATION_MOYENNES_PREMIERE');

-- CreateTable
CREATE TABLE "profils_candidats" (
    "id" TEXT NOT NULL,
    "contactLeadId" TEXT,
    "studentId" TEXT,
    "level" "CandidateLevel" NOT NULL,
    "examSession" INTEGER NOT NULL,
    "modalite" "Modalite" NOT NULL,
    "specialite1" "Subject" NOT NULL,
    "specialite2" "Subject" NOT NULL,
    "specialiteAbandonnee" "Subject",
    "langueA" "Subject",
    "langueB" "Subject",
    "estRedoublant" BOOLEAN NOT NULL DEFAULT false,
    "estTitulaireBacDejaObtenu" BOOLEAN NOT NULL DEFAULT false,
    "brancheBascule" "BrancheBascule",
    "moyenneRattrapage" INTEGER,
    "optionsTerminale" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notesConservees" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profils_candidats_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN "profilId" TEXT,
ADD COLUMN "snapshotCarte" JSONB,
ADD COLUMN "snapshotRegles" JSONB;

-- CreateIndex
CREATE INDEX "profils_candidats_contactLeadId_idx" ON "profils_candidats"("contactLeadId");

-- CreateIndex
CREATE INDEX "profils_candidats_studentId_idx" ON "profils_candidats"("studentId");

-- CreateIndex
CREATE INDEX "quotes_profilId_idx" ON "quotes"("profilId");

-- AddForeignKey
ALTER TABLE "profils_candidats" ADD CONSTRAINT "profils_candidats_contactLeadId_fkey" FOREIGN KEY ("contactLeadId") REFERENCES "contact_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profils_candidats" ADD CONSTRAINT "profils_candidats_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_profilId_fkey" FOREIGN KEY ("profilId") REFERENCES "profils_candidats"("id") ON DELETE SET NULL ON UPDATE CASCADE;
