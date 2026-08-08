-- Validation pédagogique par item du diagnostic candidat libre.
--
-- Un item n'est montré à l'étudiant — score compris — que s'il a été relu et
-- validé par un enseignant qualifié. La validation nomme ce relecteur et porte
-- l'empreinte de l'item relu : toute modification ultérieure de l'énoncé, des
-- options ou de la réponse attendue change l'empreinte et invalide la
-- validation, au lieu de la laisser couvrir un contenu jamais relu.
--
-- Purement additive : nouvelle table, aucune donnée existante modifiée.

CREATE TABLE "candidate_diagnostic_item_validations" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "reviewerName" TEXT NOT NULL,
    "itemChecksum" TEXT NOT NULL,
    "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_diagnostic_item_validations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "candidate_diagnostic_item_validations_itemId_key"
    ON "candidate_diagnostic_item_validations"("itemId");

CREATE INDEX "candidate_diagnostic_item_validations_moduleKey_idx"
    ON "candidate_diagnostic_item_validations"("moduleKey");
