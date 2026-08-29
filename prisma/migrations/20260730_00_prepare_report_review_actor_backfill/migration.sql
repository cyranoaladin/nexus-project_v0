-- Temporarily suspend the append-only trigger so the following additive
-- reviewer identity migration can backfill historical rows. The finalizer
-- migration restores it immediately after that backfill.

DROP TRIGGER IF EXISTS "canonical_report_reviews_append_only"
  ON "canonical_report_reviews";
