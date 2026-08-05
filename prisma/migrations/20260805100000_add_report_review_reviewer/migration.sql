-- Additive: let an ASSISTANTE review a report via `users`, alongside the
-- existing COACH path via `coach_profiles`. Historical rows keep coachId
-- only; new reviews populate reviewerId only. Application code enforces
-- which one to write; this constraint enforces exactly one is ever set.

ALTER TABLE "canonical_report_reviews" ALTER COLUMN "coachId" DROP NOT NULL;

ALTER TABLE "canonical_report_reviews" ADD COLUMN "reviewerId" TEXT;

ALTER TABLE "canonical_report_reviews"
  ADD CONSTRAINT "canonical_report_reviews_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "canonical_report_reviews"
  ADD CONSTRAINT "canonical_report_reviews_exactly_one_reviewer"
  CHECK (("coachId" IS NOT NULL) != ("reviewerId" IS NOT NULL));

CREATE INDEX "canonical_report_reviews_reviewerId_reviewedAt_idx" ON "canonical_report_reviews"("reviewerId", "reviewedAt");
