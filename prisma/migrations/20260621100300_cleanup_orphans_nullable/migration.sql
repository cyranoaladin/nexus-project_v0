-- E4: Cleanup orphan table + fix nullable array columns

-- Drop orphan student_profiles table (0 rows, no Prisma model, superseded by students table)
DROP TABLE IF EXISTS student_profiles;

-- Fix nullable arrays: bilans.ragCollections (14 rows all NULL → backfill empty array)
UPDATE bilans SET "ragCollections" = '{}' WHERE "ragCollections" IS NULL;
ALTER TABLE bilans ALTER COLUMN "ragCollections" SET DEFAULT '{}';
ALTER TABLE bilans ALTER COLUMN "ragCollections" SET NOT NULL;

-- Fix nullable arrays: diagnostics.ragCollections (0 rows, just align constraint)
ALTER TABLE diagnostics ALTER COLUMN "ragCollections" SET DEFAULT '{}';
ALTER TABLE diagnostics ALTER COLUMN "ragCollections" SET NOT NULL;

-- Fix nullable arrays: copy_pages.convertedFilePaths (4 rows, 0 NULLs, just align constraint)
ALTER TABLE copy_pages ALTER COLUMN "convertedFilePaths" SET DEFAULT '{}';
ALTER TABLE copy_pages ALTER COLUMN "convertedFilePaths" SET NOT NULL;
