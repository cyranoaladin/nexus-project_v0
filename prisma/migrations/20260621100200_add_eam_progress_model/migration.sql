-- E3: Bring eam_progress under Prisma governance
-- Table already exists with 2 rows; columns stay snake_case (raw SQL in runtime routes)
-- Only: normalize timestamps, add FK, cleanup redundant index

-- Convert timestamptz → timestamp(3) (match all other tables)
ALTER TABLE eam_progress ALTER COLUMN created_at TYPE timestamp(3) without time zone;
ALTER TABLE eam_progress ALTER COLUMN updated_at TYPE timestamp(3) without time zone;

-- Add FK to users (pre-check confirmed both user_ids exist)
ALTER TABLE eam_progress ADD CONSTRAINT "eam_progress_user_id_fkey"
  FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- Drop redundant non-unique index (unique index eam_progress_user_id_key already covers it)
DROP INDEX IF EXISTS idx_eam_progress_user_id;
