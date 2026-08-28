-- SSoT des enseignements CHOISIS par un élève.
--
-- Étape 1/2 : création de la table et reprise DÉTERMINISTE des données de
-- `students.specialties`. La colonne héritée n'est pas touchée ici ; elle est
-- supprimée par la migration suivante, qui porte sa propre barrière.
--
-- ── Ce qui est repris, et ce qui ne l'est pas ────────────────────────────────
-- Seuls les CHOIX sont stockés : spécialités et options. Le tronc commun et les
-- modules de voie sont dérivés du couple (niveau × voie) via le catalogue
-- versionné ; leur créer une ligne serait affirmer deux fois la même chose, et
-- ouvrirait la porte à une divergence entre la ligne et le catalogue.
--
-- Les valeurs historiques correspondant à du tronc commun (FRANCAIS en
-- première, PHILOSOPHIE et HISTOIRE_GEO en terminale…) ne produisent donc
-- AUCUNE ligne : le resolver les rendra par dérivation.
--
-- Les valeurs indécidables (ANGLAIS, ESPAGNOL : impossible de trancher entre
-- LVA et LVB) ne sont pas devinées. Elles bloquent la migration destructive
-- suivante tant qu'un humain ne les a pas arbitrées.
--
-- ── Déterminisme ─────────────────────────────────────────────────────────────
-- L'identifiant de chaque ligne est dérivé de (studentId, courseKey), sans
-- aléa ni horloge : rejouer la migration sur un clone de la même base produit
-- exactement les mêmes identités.

-- CreateEnum
CREATE TYPE "AcademicEnrollmentKind" AS ENUM ('SPECIALTY', 'OPTION');

-- CreateEnum
CREATE TYPE "AcademicEnrollmentSource" AS ENUM ('ADMIN', 'ASSISTANTE', 'SEED', 'BACKFILL_LEGACY_SPECIALTIES');

-- CreateTable
CREATE TABLE "student_academic_enrollments" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseKey" TEXT NOT NULL,
    "kind" "AcademicEnrollmentKind" NOT NULL,
    "source" "AcademicEnrollmentSource" NOT NULL,
    "curriculumVersion" TEXT NOT NULL DEFAULT 'v1',
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_academic_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_academic_enrollments_studentId_courseKey_key" ON "student_academic_enrollments"("studentId", "courseKey");

-- CreateIndex
CREATE INDEX "student_academic_enrollments_studentId_kind_idx" ON "student_academic_enrollments"("studentId", "kind");

-- AddForeignKey
ALTER TABLE "student_academic_enrollments" ADD CONSTRAINT "student_academic_enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_academic_enrollments" ADD CONSTRAINT "student_academic_enrollments_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Reprise déterministe des seuls CHOIX (spécialités et options).
INSERT INTO "student_academic_enrollments" (
    "id", "studentId", "courseKey", "kind", "source", "curriculumVersion", "createdAt", "updatedAt"
)
SELECT
    md5(s."id" || '|' || mapped."courseKey"),
    s."id",
    mapped."courseKey",
    mapped."kind",
    'BACKFILL_LEGACY_SPECIALTIES'::"AcademicEnrollmentSource",
    'v1',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "students" s
CROSS JOIN LATERAL unnest(s."specialties") AS legacy(subject)
CROSS JOIN LATERAL (
    SELECT
        CASE
            WHEN s."gradeLevel" = 'PREMIERE'  AND legacy.subject = 'MATHEMATIQUES'   THEN 'eds-maths-premiere'
            WHEN s."gradeLevel" = 'PREMIERE'  AND legacy.subject = 'NSI'             THEN 'eds-nsi-premiere'
            WHEN s."gradeLevel" = 'PREMIERE'  AND legacy.subject = 'PHYSIQUE_CHIMIE' THEN 'eds-physique-chimie-premiere'
            WHEN s."gradeLevel" = 'PREMIERE'  AND legacy.subject = 'SVT'             THEN 'eds-svt-premiere'
            WHEN s."gradeLevel" = 'PREMIERE'  AND legacy.subject = 'SES'             THEN 'eds-ses-premiere'
            WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'MATHEMATIQUES'   THEN 'eds-maths-terminale'
            WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'NSI'             THEN 'eds-nsi-terminale'
            WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'PHYSIQUE_CHIMIE' THEN 'eds-physique-chimie-terminale'
            WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'SVT'             THEN 'eds-svt-terminale'
            WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'SES'             THEN 'eds-ses-terminale'
            WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'MATHS_EXPERTES'  THEN 'opt-maths-expertes-terminale'
            ELSE NULL
        END AS "courseKey",
        CASE
            WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'MATHS_EXPERTES'
                THEN 'OPTION'::"AcademicEnrollmentKind"
            ELSE 'SPECIALTY'::"AcademicEnrollmentKind"
        END AS "kind"
) AS mapped
WHERE mapped."courseKey" IS NOT NULL
ON CONFLICT ("studentId", "courseKey") DO NOTHING;
