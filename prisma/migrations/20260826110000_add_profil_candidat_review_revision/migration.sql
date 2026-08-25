-- AlterTable: assistante workspace surface (mission recâblage §5) —
-- createdByUserId (who opened the profil), review-request marker (staff-set,
-- never auto-derived from a pipeline result status), and a revision chain
-- scoped to ProfilCandidat (mirrors the existing, still-unwired Quote
-- previousRevisionId/supersededBy/revisionNumber pattern, kept separate so
-- this never touches the shared legacy-engine Quote write path).
ALTER TABLE "profils_candidats"
  ADD COLUMN "createdByUserId" TEXT,
  ADD COLUMN "reviewRequestedAt" TIMESTAMP(3),
  ADD COLUMN "reviewRequestedByUserId" TEXT,
  ADD COLUMN "reviewNote" TEXT,
  ADD COLUMN "previousProfilId" TEXT,
  ADD COLUMN "revisionNumber" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "profils_candidats_previousProfilId_key" ON "profils_candidats"("previousProfilId");

-- AddForeignKey
ALTER TABLE "profils_candidats" ADD CONSTRAINT "profils_candidats_previousProfilId_fkey" FOREIGN KEY ("previousProfilId") REFERENCES "profils_candidats"("id") ON DELETE SET NULL ON UPDATE CASCADE;
