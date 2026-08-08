-- Consentement parental spécifique au diagnostic candidat libre.
--
-- Volontairement distinct de canonical_parent_student_links (bilan gratuit) :
-- la notice du candidat libre couvre le dépôt de documents officiels et un
-- enregistrement audio, absents du bilan gratuit. Un consentement donné pour
-- l'un ne vaut pas pour l'autre.
--
-- Vit hors de candidate_diagnostics parce que le consentement doit précéder la
-- création du dossier.
--
-- Purement additif : aucune table ni colonne existante n'est modifiée.

CREATE TABLE "candidate_diagnostic_consents" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "noticeVersion" TEXT NOT NULL,
    "parentConsentedAt" TIMESTAMP(3) NOT NULL,
    "studentAssentedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "withdrawnReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_diagnostic_consents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "candidate_diagnostic_consents_studentId_noticeVersion_key"
    ON "candidate_diagnostic_consents"("studentId", "noticeVersion");

CREATE INDEX "candidate_diagnostic_consents_studentId_withdrawnAt_idx"
    ON "candidate_diagnostic_consents"("studentId", "withdrawnAt");

ALTER TABLE "candidate_diagnostic_consents"
    ADD CONSTRAINT "candidate_diagnostic_consents_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "candidate_diagnostic_consents"
    ADD CONSTRAINT "candidate_diagnostic_consents_parentUserId_fkey"
    FOREIGN KEY ("parentUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
