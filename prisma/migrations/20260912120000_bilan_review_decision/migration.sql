-- ARIA periodic bilan human review (P7b-2): additive-only, nullable columns
-- on the existing `bilans` table. No existing row or BilanType is affected;
-- only ARIA_PERIODIC's publish path (enforced in application code) ever
-- requires these to be set.
CREATE TYPE "BilanReviewDecision" AS ENUM ('APPROVED', 'REJECTED');

ALTER TABLE "bilans"
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewDecision" "BilanReviewDecision";

ALTER TABLE "bilans"
  ADD CONSTRAINT "bilans_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
