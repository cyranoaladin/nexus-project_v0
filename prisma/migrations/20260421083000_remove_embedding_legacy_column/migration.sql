-- Migration F23: Remove legacy embedding column from pedagogical_contents
-- Generated manually (2026-04-21) due to local DB unavailability
-- This column was superseded by embedding_vector (pgvector) and is no longer used at runtime

ALTER TABLE "pedagogical_contents" DROP COLUMN IF EXISTS "embedding";
