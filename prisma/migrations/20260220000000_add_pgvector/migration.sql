-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add vector column to PedagogicalContent (assuming 1536 dimensions for text-embedding-3-small)
ALTER TABLE "pedagogical_contents" ADD COLUMN IF NOT EXISTS "embedding_vector" vector(1536);

-- Create HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS "pedagogical_contents_embedding_idx" ON "pedagogical_contents" USING hnsw ("embedding_vector" vector_cosine_ops);
