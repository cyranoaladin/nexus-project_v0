-- Additive constraints only. Historical overlaps or invalid ranges stop deployment;
-- no row is deleted, rewritten, or assigned an invented coach.
BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE stage_sessions ADD CONSTRAINT stage_sessions_valid_interval
  CHECK ("endAt" > "startAt") NOT VALID;
ALTER TABLE stage_sessions VALIDATE CONSTRAINT stage_sessions_valid_interval;
ALTER TABLE stage_sessions ADD CONSTRAINT stage_sessions_coach_no_overlap
  EXCLUDE USING gist ("coachId" WITH =, tsrange("startAt", "endAt", '[)') WITH &&)
  WHERE ("coachId" IS NOT NULL);
COMMIT;
