-- Identify every report reviewer by User so both assigned coaches and admins
-- can approve. Historical coach reviews are backfilled through coach_profiles.

ALTER TABLE "canonical_report_reviews"
  ADD COLUMN "reviewerUserId" TEXT;

UPDATE "canonical_report_reviews" AS review
SET "reviewerUserId" = coach."userId"
FROM "coach_profiles" AS coach
WHERE coach."id" = review."coachId";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "canonical_report_reviews"
    WHERE "reviewerUserId" IS NULL
  ) THEN
    RAISE EXCEPTION 'cannot backfill canonical report review user';
  END IF;
END;
$$;

ALTER TABLE "canonical_report_reviews"
  ALTER COLUMN "reviewerUserId" SET NOT NULL,
  ALTER COLUMN "coachId" DROP NOT NULL;

ALTER TABLE "canonical_report_reviews"
  ADD CONSTRAINT "canonical_report_reviews_reviewerUserId_fkey"
  FOREIGN KEY ("reviewerUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "canonical_report_reviews_reviewerUserId_reviewedAt_idx"
  ON "canonical_report_reviews"("reviewerUserId", "reviewedAt");

CREATE OR REPLACE FUNCTION canonical_bilans_validate_report_reviewer()
RETURNS TRIGGER AS $$
DECLARE coach_user_id TEXT;
BEGIN
  IF NEW."coachId" IS NOT NULL THEN
    SELECT "userId" INTO coach_user_id
    FROM "coach_profiles"
    WHERE "id" = NEW."coachId";
    IF coach_user_id IS DISTINCT FROM NEW."reviewerUserId" THEN
      RAISE EXCEPTION 'canonical report coach and reviewer user mismatch';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "canonical_report_reviews_reviewer_guard"
  BEFORE INSERT ON "canonical_report_reviews"
  FOR EACH ROW EXECUTE FUNCTION canonical_bilans_validate_report_reviewer();
