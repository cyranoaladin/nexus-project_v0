-- PostgreSQL requires newly added enum values to be committed before a later
-- migration may reference them in constraints or trigger functions.

ALTER TYPE "CanonicalAssessmentAttemptStatus"
  ADD VALUE IF NOT EXISTS 'PENDING_MANUAL_REVIEW';
ALTER TYPE "CanonicalAssessmentAttemptStatus"
  ADD VALUE IF NOT EXISTS 'CANCELLED';
