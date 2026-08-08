-- Consentement adulte du candidat libre.
--
-- L'étudiant est majeur : c'est son consentement qui autorise le traitement de
-- ses données, pas celui d'un parent. Le lien parental subsiste pour la
-- structure et le provisionnement, mais n'expose plus rien : le parent ne voit
-- les résultats que si l'étudiant l'a explicitement autorisé.
--
-- Additive et non destructive. `parentConsentedAt` devient nullable plutôt
-- que d'être supprimée : elle reste pertinente pour un dossier ouvert sur un
-- mineur. Aucune donnée existante n'est modifiée (table vide en production).

ALTER TABLE "candidate_diagnostic_consents"
    ADD COLUMN "studentConsentedAt" TIMESTAMP(3);

ALTER TABLE "candidate_diagnostic_consents"
    ADD COLUMN "parentAccessAuthorizedAt" TIMESTAMP(3);

ALTER TABLE "candidate_diagnostic_consents"
    ALTER COLUMN "parentConsentedAt" DROP NOT NULL;

-- Reprise des dossiers déjà consentis, s'il en existait : l'assentiment de
-- l'étudiant devient son consentement.
UPDATE "candidate_diagnostic_consents"
   SET "studentConsentedAt" = "studentAssentedAt"
 WHERE "studentAssentedAt" IS NOT NULL
   AND "studentConsentedAt" IS NULL;
