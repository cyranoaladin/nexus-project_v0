-- Dernière activité réelle de l'étudiant sur son dossier.
--
-- La conservation court douze mois à compter de cette date. Elle n'est
-- alimentée que par des interactions réelles — connexion, soumission de module,
-- consultation des résultats — jamais par une écriture technique : une purge
-- doit suivre l'usage, pas la maintenance. `updatedAt` ne pouvait donc pas
-- servir, il bouge à chaque migration.
--
-- Purement additive : colonne nullable, aucune donnée existante modifiée. Les
-- dossiers antérieurs restent à nul, et la purge échoue fermé sur une date
-- inconnue — conserver à tort vaut mieux qu'effacer à tort.

ALTER TABLE "candidate_diagnostics" ADD COLUMN "lastActivityAt" TIMESTAMP(3);

CREATE INDEX "candidate_diagnostics_lastActivityAt_idx"
    ON "candidate_diagnostics"("lastActivityAt");
