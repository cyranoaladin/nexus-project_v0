-- Upgrade pgvector dimensions to 3072 for Option A
-- Ensure pgvector extension exists
CREATE EXTENSION IF NOT EXISTS vector;

-- It is recommended to drop indexes depending on the embedding column before altering the type.
-- Add DROP INDEX statements here if you have any on these columns.

-- Alter memories.embedding to vector(3072)
ALTER TABLE "public"."memories"
  ALTER COLUMN "embedding" TYPE vector(3072);

-- Alter knowledge_assets.embedding to vector(3072)
ALTER TABLE "public"."knowledge_assets"
  ALTER COLUMN "embedding" TYPE vector(3072);

