-- An explicit operational schooling status for Core v2 RAG identity.
-- Historical INDIVIDUAL rows remain unchanged; no implicit backfill is safe.
ALTER TYPE "SchoolingStatus" ADD VALUE IF NOT EXISTS 'CANDIDAT_LIBRE';
