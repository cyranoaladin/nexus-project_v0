-- An APPLY run is valid only as the exact child of the canonical completed
-- DRY_RUN that sealed the same source snapshot. This makes direct SQL callers
-- obey the same lineage boundary as the application workers.

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public."aria_data_migration_runs"
    WHERE mode = 'APPLY'::public."AriaDataMigrationMode"
  ) THEN
    RAISE EXCEPTION 'ARIA APPLY lineage guard requires zero pre-existing APPLY runs';
  END IF;
END;
$preflight$;

CREATE FUNCTION "aria_migration_run_require_apply_prerequisite"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  prerequisite public."aria_data_migration_runs"%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'COMPLETED'::public."AriaDataMigrationStatus"
     AND NEW.status = 'ROLLED_BACK'::public."AriaDataMigrationStatus"
     AND OLD.mode IS DISTINCT FROM 'APPLY'::public."AriaDataMigrationMode" THEN
    RAISE EXCEPTION 'only APPLY migration runs can be rolled back';
  END IF;

  IF NEW.mode IS DISTINCT FROM 'APPLY'::public."AriaDataMigrationMode" THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
     AND NEW.status IS DISTINCT FROM 'RUNNING'::public."AriaDataMigrationStatus" THEN
    RAISE EXCEPTION 'APPLY migration run must start RUNNING';
  END IF;

  IF NEW."prerequisiteRunId" IS NULL THEN
    RAISE EXCEPTION 'ARIA APPLY requires a canonical completed DRY_RUN prerequisite';
  END IF;

  SELECT * INTO prerequisite
  FROM public."aria_data_migration_runs"
  WHERE id = NEW."prerequisiteRunId"
  FOR UPDATE;

  IF prerequisite.id IS NULL
     OR prerequisite."migrationName" IS DISTINCT FROM NEW."migrationName"
     OR prerequisite.mode IS DISTINCT FROM 'DRY_RUN'::public."AriaDataMigrationMode"
     OR prerequisite.status IS DISTINCT FROM 'COMPLETED'::public."AriaDataMigrationStatus"
     OR prerequisite."sourceDigest" IS DISTINCT FROM NEW."sourceDigest"
     OR prerequisite."sourceSnapshot" IS DISTINCT FROM NEW."sourceSnapshot" THEN
    RAISE EXCEPTION 'ARIA APPLY requires a canonical completed DRY_RUN prerequisite';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER "aria_migration_runs_apply_prerequisite"
BEFORE INSERT OR UPDATE ON public."aria_data_migration_runs"
FOR EACH ROW
EXECUTE FUNCTION "aria_migration_run_require_apply_prerequisite"();

CREATE FUNCTION "aria_entitlement_rollback_before_image_valid"(
  before_image JSONB,
  target_key JSONB,
  source_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $function$
DECLARE
  entitlement_before JSONB;
  scope JSONB;
BEGIN
  IF jsonb_typeof(before_image) IS DISTINCT FROM 'object'
     OR NOT before_image ?& ARRAY[
       'ariaSubjects', 'endDate', 'entitlement', 'startDate', 'status', 'subscriptionId'
     ]::TEXT[]
     OR before_image - ARRAY[
       'ariaSubjects', 'endDate', 'entitlement', 'startDate', 'status', 'subscriptionId'
     ]::TEXT[] <> '{}'::JSONB
     OR jsonb_typeof(before_image->'ariaSubjects') IS DISTINCT FROM 'string'
     OR jsonb_typeof(before_image->'startDate') IS DISTINCT FROM 'string'
     OR jsonb_typeof(before_image->'endDate') NOT IN ('string', 'null')
     OR jsonb_typeof(before_image->'status') IS DISTINCT FROM 'string'
     OR before_image->>'status' NOT IN ('ACTIVE', 'INACTIVE', 'CANCELLED', 'EXPIRED')
     OR jsonb_typeof(before_image->'subscriptionId') IS DISTINCT FROM 'string'
     OR before_image->>'subscriptionId' IS DISTINCT FROM source_id THEN
    RETURN FALSE;
  END IF;

  entitlement_before := before_image->'entitlement';
  IF target_key IS NULL THEN
    RETURN jsonb_typeof(entitlement_before) = 'null';
  END IF;
  IF target_key->'created' = 'true'::JSONB THEN
    RETURN jsonb_typeof(entitlement_before) = 'null';
  END IF;
  IF target_key->'created' IS DISTINCT FROM 'false'::JSONB
     OR jsonb_typeof(entitlement_before) IS DISTINCT FROM 'object'
     OR NOT entitlement_before ?& ARRAY[
       'status', 'startsAt', 'endsAt', 'suspendedAt', 'revokedAt', 'scopes'
     ]::TEXT[]
     OR entitlement_before - ARRAY[
       'status', 'startsAt', 'endsAt', 'suspendedAt', 'revokedAt', 'scopes'
     ]::TEXT[] <> '{}'::JSONB
     OR jsonb_typeof(entitlement_before->'status') IS DISTINCT FROM 'string'
     OR entitlement_before->>'status' NOT IN ('ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED')
     OR jsonb_typeof(entitlement_before->'startsAt') IS DISTINCT FROM 'string'
     OR jsonb_typeof(entitlement_before->'endsAt') NOT IN ('string', 'null')
     OR jsonb_typeof(entitlement_before->'suspendedAt') NOT IN ('string', 'null')
     OR jsonb_typeof(entitlement_before->'revokedAt') NOT IN ('string', 'null')
     OR jsonb_typeof(entitlement_before->'scopes') IS DISTINCT FROM 'array' THEN
    RETURN FALSE;
  END IF;

  FOR scope IN SELECT value FROM jsonb_array_elements(entitlement_before->'scopes') LOOP
    IF jsonb_typeof(scope) IS DISTINCT FROM 'object'
       OR NOT scope ?& ARRAY['kind', 'courseKey']::TEXT[]
       OR scope - ARRAY['kind', 'courseKey']::TEXT[] <> '{}'::JSONB
       OR jsonb_typeof(scope->'kind') IS DISTINCT FROM 'string'
       OR (
         scope->>'kind' = 'GLOBAL'
         AND jsonb_typeof(scope->'courseKey') IS DISTINCT FROM 'null'
       )
       OR (
         scope->>'kind' = 'COURSE'
         AND (
           jsonb_typeof(scope->'courseKey') IS DISTINCT FROM 'string'
           OR length(scope->>'courseKey') = 0
         )
       )
       OR scope->>'kind' NOT IN ('GLOBAL', 'COURSE') THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$function$;

CREATE FUNCTION "aria_entitlement_apply_require_terminal_evidence"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  audit_total INTEGER;
  deterministic_total INTEGER;
  archived_total INTEGER;
  manual_total INTEGER;
  mutated_total INTEGER;
  invalid_total INTEGER;
BEGIN
  IF NEW."migrationName" IS DISTINCT FROM 'aria-entitlements-v1'
     OR NEW.mode IS DISTINCT FROM 'APPLY'::public."AriaDataMigrationMode"
     OR OLD.status IS DISTINCT FROM 'RUNNING'::public."AriaDataMigrationStatus"
     OR NEW.status IS DISTINCT FROM 'COMPLETED'::public."AriaDataMigrationStatus" THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (
      WHERE "sourceType" = 'ARIA_SUBSCRIPTION_ENTITLEMENT'
        AND classification = 'DETERMINISTIC_BACKFILL'::public."AriaDataMigrationClassification"
    )::INTEGER,
    COUNT(*) FILTER (
      WHERE "sourceType" = 'ARIA_SUBSCRIPTION_ENTITLEMENT'
        AND classification = 'ARCHIVED_NON_RESUMABLE'::public."AriaDataMigrationClassification"
    )::INTEGER,
    COUNT(*) FILTER (
      WHERE "sourceType" = 'ARIA_SUBSCRIPTION_ENTITLEMENT'
        AND classification = 'MANUAL_REVIEW_REQUIRED'::public."AriaDataMigrationClassification"
    )::INTEGER,
    COUNT(*) FILTER (
      WHERE "sourceType" = 'ARIA_SUBSCRIPTION_ENTITLEMENT'
        AND classification = 'DETERMINISTIC_BACKFILL'::public."AriaDataMigrationClassification"
        AND "targetTable" = 'entitlements' AND "targetId" IS NOT NULL
    )::INTEGER,
    COUNT(*) FILTER (
      WHERE "sourceType" IS DISTINCT FROM 'ARIA_SUBSCRIPTION_ENTITLEMENT'
         OR subscription.id IS NULL
         OR student.id IS NULL
         OR NOT public."aria_entitlement_rollback_before_image_valid"(
           audit."beforeImage",
           CASE
             WHEN classification = 'DETERMINISTIC_BACKFILL'::public."AriaDataMigrationClassification"
               THEN audit."targetKey"
             ELSE NULL
           END,
           audit."sourceId"
         )
         OR (
           classification = 'DETERMINISTIC_BACKFILL'::public."AriaDataMigrationClassification"
           AND (
             "targetTable" IS DISTINCT FROM 'entitlements'
             OR "targetId" IS NULL
             OR entitlement.id IS NULL
             OR entitlement."productCode" IS DISTINCT FROM 'ARIA_ACCESS'
             OR entitlement."sourceSubscriptionId" IS DISTINCT FROM audit."sourceId"
             OR entitlement."userId" IS DISTINCT FROM student."userId"
             OR jsonb_typeof(audit."targetKey") IS DISTINCT FROM 'object'
             OR NOT audit."targetKey" ?& ARRAY[
               'afterFingerprint', 'academicMapConsulted', 'created', 'generation', 'scopeCount'
             ]::TEXT[]
             OR audit."targetKey" - ARRAY[
               'afterFingerprint', 'academicMapConsulted', 'created', 'generation', 'scopeCount'
             ]::TEXT[] <> '{}'::JSONB
             OR jsonb_typeof(audit."targetKey"->'afterFingerprint') IS DISTINCT FROM 'string'
             OR audit."targetKey"->>'afterFingerprint' !~ '^[0-9a-f]{64}$'
             OR jsonb_typeof(audit."targetKey"->'academicMapConsulted') IS DISTINCT FROM 'boolean'
             OR jsonb_typeof(audit."targetKey"->'created') IS DISTINCT FROM 'boolean'
             OR jsonb_typeof(audit."targetKey"->'generation') IS DISTINCT FROM 'number'
             OR audit."targetKey"->>'generation' !~ '^[1-9][0-9]*$'
             OR (audit."targetKey"->>'generation')::NUMERIC > 2147483647
             OR jsonb_typeof(audit."targetKey"->'scopeCount') IS DISTINCT FROM 'number'
             OR audit."targetKey"->>'scopeCount' !~ '^(0|[1-9][0-9]*)$'
           )
         )
         OR (
           classification IS DISTINCT FROM 'DETERMINISTIC_BACKFILL'::public."AriaDataMigrationClassification"
           AND ("targetTable" IS NOT NULL OR "targetId" IS NOT NULL OR "targetKey" IS NOT NULL)
         )
    )::INTEGER
  INTO audit_total, deterministic_total, archived_total, manual_total, mutated_total, invalid_total
  FROM public."aria_data_migration_row_audits" audit
  LEFT JOIN public.entitlements entitlement ON entitlement.id = audit."targetId"
  LEFT JOIN public.subscriptions subscription ON subscription.id = audit."sourceId"
  LEFT JOIN public.students student ON student.id = subscription."studentId"
  WHERE audit."runId" = NEW.id;

  IF NEW."sourceSnapshot"->>'target' IS DISTINCT FROM 'entitlements'
     OR NEW."sourceSnapshot"->'report'->>'scanned' IS DISTINCT FROM NEW."scannedCount"::TEXT
     OR NEW."sourceSnapshot"->'report'->>'deterministic' IS DISTINCT FROM NEW."deterministicCount"::TEXT
     OR NEW."sourceSnapshot"->'report'->>'archived' IS DISTINCT FROM NEW."archivedCount"::TEXT
     OR NEW."sourceSnapshot"->'report'->>'manualReview' IS DISTINCT FROM NEW."manualReviewCount"::TEXT
     OR audit_total IS DISTINCT FROM NEW."scannedCount"
     OR deterministic_total IS DISTINCT FROM NEW."deterministicCount"
     OR archived_total IS DISTINCT FROM NEW."archivedCount"
     OR manual_total IS DISTINCT FROM NEW."manualReviewCount"
     OR mutated_total IS DISTINCT FROM NEW."mutatedCount"
     OR invalid_total <> 0 THEN
    RAISE EXCEPTION 'APPLY terminal evidence does not match row audits';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER "aria_entitlement_apply_terminal_evidence"
BEFORE UPDATE ON public."aria_data_migration_runs"
FOR EACH ROW
EXECUTE FUNCTION "aria_entitlement_apply_require_terminal_evidence"();
