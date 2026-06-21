-- E2: Fix text → jsonb type mismatch for columns declared as Json in Prisma
-- Pre-check confirmed: all existing values are valid JSON

ALTER TABLE notifications ALTER COLUMN "data" TYPE jsonb USING "data"::jsonb;
ALTER TABLE coach_profiles ALTER COLUMN "subjects" TYPE jsonb USING "subjects"::jsonb;

-- tags has a text default '[]'::text that blocks auto-cast; drop → cast → re-set as jsonb
ALTER TABLE pedagogical_contents ALTER COLUMN "tags" DROP DEFAULT;
ALTER TABLE pedagogical_contents ALTER COLUMN "tags" TYPE jsonb USING "tags"::jsonb;
ALTER TABLE pedagogical_contents ALTER COLUMN "tags" SET DEFAULT '[]'::jsonb;
