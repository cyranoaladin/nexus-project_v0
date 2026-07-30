-- Restore append-only protection after the reviewer identity backfill.

DROP TRIGGER IF EXISTS "canonical_report_reviews_append_only"
  ON "canonical_report_reviews";

CREATE TRIGGER "canonical_report_reviews_append_only"
  BEFORE UPDATE OR DELETE ON "canonical_report_reviews"
  FOR EACH ROW EXECUTE FUNCTION canonical_bilans_reject_append_only_mutation();
