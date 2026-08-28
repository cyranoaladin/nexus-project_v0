-- SSoT des enseignements suivis par un élève.
--
-- Étape 1/2 : création de la table et REPRISE DÉTERMINISTE des données de
-- `students.specialties`. La colonne héritée n'est pas touchée ici ; elle est
-- supprimée par la migration suivante, une fois la reprise vérifiable.
--
-- La correspondance ci-dessous est volontairement limitée aux cas UNIVOQUES.
-- Une valeur historique qui ne correspond à aucun enseignement identifiable
-- (ANGLAIS/ESPAGNOL, qui ne permettent pas de trancher entre LVA et LVB) n'est
-- PAS devinée : elle reste détectable par
-- `scripts/curriculum/verify-legacy-specialties.ts`, à exécuter avant migration.

-- CreateEnum
CREATE TYPE "AcademicEnrollmentKind" AS ENUM ('CORE', 'SPECIALTY', 'OPTION', 'TRACK_MODULE');

-- CreateEnum
CREATE TYPE "AcademicEnrollmentSource" AS ENUM ('ADMIN', 'ASSISTANTE', 'SEED', 'BACKFILL_LEGACY_SPECIALTIES', 'DERIVED_FROM_LEVEL_TRACK');

-- CreateTable
CREATE TABLE "student_academic_enrollments" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseKey" TEXT NOT NULL,
    "kind" "AcademicEnrollmentKind" NOT NULL,
    "source" "AcademicEnrollmentSource" NOT NULL,
    "curriculumVersion" TEXT NOT NULL DEFAULT 'v1',
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
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

-- Backfill déterministe depuis students.specialties
INSERT INTO "student_academic_enrollments" (
    "id", "studentId", "courseKey", "kind", "source", "curriculumVersion", "createdAt", "updatedAt"
)
SELECT
    md5(random()::text || clock_timestamp()::text || s."id" || mapped."courseKey"),
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
            WHEN s."gradeLevel" = 'PREMIERE' AND legacy.subject = 'MATHEMATIQUES'   THEN 'eds-maths-premiere'
            WHEN s."gradeLevel" = 'PREMIERE' AND legacy.subject = 'NSI'             THEN 'eds-nsi-premiere'
            WHEN s."gradeLevel" = 'PREMIERE' AND legacy.subject = 'PHYSIQUE_CHIMIE' THEN 'eds-physique-chimie-premiere'
            WHEN s."gradeLevel" = 'PREMIERE' AND legacy.subject = 'SVT'             THEN 'eds-svt-premiere'
            WHEN s."gradeLevel" = 'PREMIERE' AND legacy.subject = 'SES'             THEN 'eds-ses-premiere'
            WHEN s."gradeLevel" = 'PREMIERE' AND legacy.subject = 'FRANCAIS'        THEN 'tc-francais-premiere'
            WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'MATHEMATIQUES'   THEN 'eds-maths-terminale'
            WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'NSI'             THEN 'eds-nsi-terminale'
            WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'PHYSIQUE_CHIMIE' THEN 'eds-physique-chimie-terminale'
            WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'SVT'             THEN 'eds-svt-terminale'
            WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'SES'             THEN 'eds-ses-terminale'
            WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'MATHS_EXPERTES'  THEN 'opt-maths-expertes-terminale'
            WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'PHILOSOPHIE'     THEN 'tc-philosophie-terminale'
            WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'HISTOIRE_GEO'    THEN 'tc-histoire-geo-terminale'
            ELSE NULL
        END AS "courseKey",
        CASE
            WHEN legacy.subject IN ('MATHEMATIQUES', 'NSI', 'PHYSIQUE_CHIMIE', 'SVT', 'SES')
                 AND s."gradeLevel" IN ('PREMIERE', 'TERMINALE')                     THEN 'SPECIALTY'::"AcademicEnrollmentKind"
            WHEN s."gradeLevel" = 'TERMINALE' AND legacy.subject = 'MATHS_EXPERTES'  THEN 'OPTION'::"AcademicEnrollmentKind"
            ELSE 'CORE'::"AcademicEnrollmentKind"
        END AS "kind"
) AS mapped
WHERE mapped."courseKey" IS NOT NULL
ON CONFLICT ("studentId", "courseKey") DO NOTHING;
