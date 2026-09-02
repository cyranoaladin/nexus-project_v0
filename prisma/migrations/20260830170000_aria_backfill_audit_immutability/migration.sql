-- Migration audit rows are insert-only. Insertion locks the owning run so
-- terminalization and evidence creation have a single PostgreSQL order.
-- Completed evidence can neither be reopened nor rewritten.

CREATE FUNCTION "aria_migration_run_require_monotonic_lifecycle"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'ARIA migration run evidence cannot be deleted';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW."migrationName" IS DISTINCT FROM OLD."migrationName"
     OR NEW.mode IS DISTINCT FROM OLD.mode
     OR NEW."sourceSnapshot" IS DISTINCT FROM OLD."sourceSnapshot"
     OR NEW."sourceDigest" IS DISTINCT FROM OLD."sourceDigest"
     OR NEW."prerequisiteRunId" IS DISTINCT FROM OLD."prerequisiteRunId"
     OR NEW."startedAt" IS DISTINCT FROM OLD."startedAt" THEN
    RAISE EXCEPTION 'ARIA migration run identity and source evidence are immutable';
  END IF;

  IF OLD.status IS DISTINCT FROM 'RUNNING'::public."AriaDataMigrationStatus" THEN
    IF NEW IS NOT DISTINCT FROM OLD THEN
      RETURN NEW;
    END IF;
    IF OLD.status = 'COMPLETED'::public."AriaDataMigrationStatus"
       AND NEW.status = 'ROLLED_BACK'::public."AriaDataMigrationStatus"
       AND NEW."scannedCount" IS NOT DISTINCT FROM OLD."scannedCount"
       AND NEW."deterministicCount" IS NOT DISTINCT FROM OLD."deterministicCount"
       AND NEW."archivedCount" IS NOT DISTINCT FROM OLD."archivedCount"
       AND NEW."manualReviewCount" IS NOT DISTINCT FROM OLD."manualReviewCount"
       AND NEW."mutatedCount" IS NOT DISTINCT FROM OLD."mutatedCount" THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'terminal ARIA migration run evidence is immutable';
  END IF;

  IF NEW.status NOT IN (
    'RUNNING'::public."AriaDataMigrationStatus",
    'COMPLETED'::public."AriaDataMigrationStatus",
    'FAILED'::public."AriaDataMigrationStatus"
  ) THEN
    RAISE EXCEPTION 'invalid ARIA migration run transition';
  END IF;
  IF NEW.status IS DISTINCT FROM 'RUNNING'::public."AriaDataMigrationStatus"
     AND NEW."completedAt" IS NULL THEN
    RAISE EXCEPTION 'terminal ARIA migration run requires completedAt';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER "aria_migration_runs_monotonic_lifecycle"
BEFORE UPDATE OR DELETE ON public."aria_data_migration_runs"
FOR EACH ROW
EXECUTE FUNCTION "aria_migration_run_require_monotonic_lifecycle"();

CREATE FUNCTION "aria_migration_row_audit_require_running_run"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  owning_status public."AriaDataMigrationStatus";
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    RAISE EXCEPTION 'ARIA migration audit evidence is insert-only';
  END IF;

  SELECT status INTO owning_status
  FROM public."aria_data_migration_runs"
  WHERE id = NEW."runId"
  FOR UPDATE;

  IF (
    owning_status IS DISTINCT FROM 'RUNNING'::public."AriaDataMigrationStatus"
    AND EXISTS (
      SELECT 1
      FROM public."aria_data_migration_row_audits" existing
      WHERE existing."runId" = NEW."runId"
        AND existing."sourceType" = NEW."sourceType"
        AND existing."sourceId" = NEW."sourceId"
        AND existing."sourceFingerprint" = NEW."sourceFingerprint"
        AND existing.classification = NEW.classification
        AND existing."targetTable" IS NOT DISTINCT FROM NEW."targetTable"
        AND existing."targetId" IS NOT DISTINCT FROM NEW."targetId"
        AND existing."targetKey" IS NOT DISTINCT FROM NEW."targetKey"
        AND existing."beforeImage" IS NOT DISTINCT FROM NEW."beforeImage"
    )
  ) THEN
    RETURN NULL;
  END IF;

  IF owning_status IS DISTINCT FROM 'RUNNING'::public."AriaDataMigrationStatus" THEN
    RAISE EXCEPTION 'terminal ARIA migration audit evidence is immutable';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER "aria_migration_row_audits_terminal_immutable"
BEFORE INSERT OR UPDATE OR DELETE ON public."aria_data_migration_row_audits"
FOR EACH ROW
EXECUTE FUNCTION "aria_migration_row_audit_require_running_run"();
