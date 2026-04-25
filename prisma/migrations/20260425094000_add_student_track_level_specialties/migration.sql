-- Phase 1: student academic track metadata for Premiere EDS/STMG dashboards

CREATE TYPE "GradeLevel" AS ENUM ('SECONDE', 'PREMIERE', 'TERMINALE', 'POSTBAC');

CREATE TYPE "AcademicTrack" AS ENUM (
    'EDS_GENERALE',
    'STMG',
    'STI2D',
    'ST2S',
    'STL',
    'STD2A',
    'STMG_NON_LYCEEN'
);

CREATE TYPE "StmgPathway" AS ENUM (
    'RHC',
    'MERCATIQUE',
    'GF',
    'SIG',
    'INDETERMINE'
);

ALTER TABLE "students"
    ADD COLUMN "gradeLevel" "GradeLevel" NOT NULL DEFAULT 'PREMIERE',
    ADD COLUMN "academicTrack" "AcademicTrack" NOT NULL DEFAULT 'EDS_GENERALE',
    ADD COLUMN "specialties" "Subject"[] NOT NULL DEFAULT ARRAY[]::"Subject"[],
    ADD COLUMN "stmgPathway" "StmgPathway",
    ADD COLUMN "updatedTrackAt" TIMESTAMP(3);

UPDATE "students"
SET
    "gradeLevel" = CASE
        WHEN UPPER(COALESCE("grade", '')) LIKE '%TERMINALE%' THEN 'TERMINALE'::"GradeLevel"
        WHEN UPPER(COALESCE("grade", '')) LIKE '%SECONDE%' THEN 'SECONDE'::"GradeLevel"
        ELSE 'PREMIERE'::"GradeLevel"
    END,
    "updatedTrackAt" = CURRENT_TIMESTAMP
WHERE "updatedTrackAt" IS NULL;

CREATE INDEX "students_gradeLevel_academicTrack_idx"
    ON "students"("gradeLevel", "academicTrack");
