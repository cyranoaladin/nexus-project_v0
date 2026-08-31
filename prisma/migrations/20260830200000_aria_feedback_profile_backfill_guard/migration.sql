-- Feedback/profile backfill: make the persisted row audits the database-enforced
-- terminal evidence. This is additive M1 hardening; no legacy column is removed.

ALTER TABLE public."aria_data_migration_row_audits"
  DROP CONSTRAINT "aria_data_migration_rows_before_image_allowlist_check";
ALTER TABLE public."aria_data_migration_row_audits"
  ADD CONSTRAINT "aria_data_migration_rows_before_image_allowlist_check"
  CHECK (
    (
      "sourceType" = 'ARIA_CONVERSATION'
      AND "beforeImage" - ARRAY[
        'contextState', 'courseKey', 'resourceId', 'skillId', 'subject'
      ]::TEXT[] = '{}'::JSONB
    )
    OR (
      "sourceType" = 'ARIA_MESSAGE_GROUP'
      AND public."aria_message_group_before_image_valid"("beforeImage", classification)
    )
    OR (
      "sourceType" = 'ARIA_SUBSCRIPTION_ENTITLEMENT'
      AND "beforeImage" - ARRAY[
        'ariaSubjects', 'endDate', 'entitlement', 'startDate', 'status', 'subscriptionId'
      ]::TEXT[] = '{}'::JSONB
    )
    OR (
      "sourceType" = 'ARIA_MESSAGE_FEEDBACK'
      AND "beforeImage" - ARRAY['feedback']::TEXT[] = '{}'::JSONB
    )
    OR (
      "sourceType" = 'ARIA_LEARNING_PROFILE'
      AND "beforeImage" - ARRAY[
        'selectedCourseKeys', 'sourceCanonicalJson', 'uiPreferences'
      ]::TEXT[] = '{}'::JSONB
    )
  );

CREATE FUNCTION "aria_feedback_legacy_source_sha256"(
  message_id TEXT,
  conversation_id TEXT,
  student_id TEXT,
  feedback_value BOOLEAN
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $function$
  SELECT encode(sha256(convert_to(
    '{"messageId":' || to_json(message_id)::TEXT
    || ',"conversationId":' || to_json(conversation_id)::TEXT
    || ',"studentId":' || to_json(student_id)::TEXT
    || ',"feedback":' || CASE WHEN feedback_value THEN 'true' ELSE 'false' END
    || '}',
    'UTF8'
  )), 'hex');
$function$;

CREATE FUNCTION "aria_profile_legacy_source_sha256"(source_canonical_json TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $function$
  SELECT encode(sha256(convert_to(source_canonical_json, 'UTF8')), 'hex');
$function$;

CREATE FUNCTION "aria_profile_legacy_source_payload_valid"(
  source_canonical_json TEXT,
  profile_id TEXT,
  student_id TEXT,
  selected_course_keys JSONB,
  ui_preferences JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $function$
DECLARE
  payload JSONB;
BEGIN
  payload := source_canonical_json::JSONB;
  RETURN jsonb_typeof(payload) = 'object'
    AND payload ?& ARRAY[
      'profileId', 'selectedCourseKeys', 'studentId', 'uiPreferences'
    ]::TEXT[]
    AND payload - ARRAY[
      'profileId', 'selectedCourseKeys', 'studentId', 'uiPreferences'
    ]::TEXT[] = '{}'::JSONB
    AND payload = jsonb_build_object(
      'profileId', profile_id,
      'studentId', student_id,
      'selectedCourseKeys', selected_course_keys,
      'uiPreferences', ui_preferences
    );
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$function$;

CREATE FUNCTION "aria_feedback_canonical_target_sha256"(
  feedback_id TEXT,
  message_id TEXT,
  student_id TEXT,
  useful_value BOOLEAN,
  reason_value TEXT,
  updated_at_value TIMESTAMPTZ
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $function$
  SELECT encode(sha256(convert_to(
    '{"id":' || to_json(feedback_id)::TEXT
    || ',"messageId":' || to_json(message_id)::TEXT
    || ',"studentId":' || to_json(student_id)::TEXT
    || ',"useful":' || CASE WHEN useful_value THEN 'true' ELSE 'false' END
    || ',"reason":' || COALESCE(to_json(reason_value)::TEXT, 'null')
    || ',"updatedAt":'
    || to_json(to_char(updated_at_value, 'YYYY-MM-DD"T"HH24:MI:SS.MS'))::TEXT
    || '}',
    'UTF8'
  )), 'hex');
$function$;

CREATE FUNCTION "aria_profile_preferences_v1_valid"(
  preferences_version INTEGER,
  pinned_course_keys JSONB,
  focused_course_key TEXT,
  course_order JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $function$
DECLARE
  item JSONB;
BEGIN
  IF preferences_version <> 1
     OR jsonb_typeof(pinned_course_keys) IS DISTINCT FROM 'array'
     OR jsonb_typeof(course_order) IS DISTINCT FROM 'array'
     OR jsonb_array_length(pinned_course_keys) > 64
     OR jsonb_array_length(course_order) > 64
     OR (focused_course_key IS NOT NULL AND length(focused_course_key) = 0) THEN
    RETURN FALSE;
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(pinned_course_keys) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'string' OR length(item #>> '{}') = 0 THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(course_order) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'string' OR length(item #>> '{}') = 0 THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  IF (SELECT COUNT(*) FROM jsonb_array_elements_text(pinned_course_keys))
       <> (SELECT COUNT(DISTINCT value) FROM jsonb_array_elements_text(pinned_course_keys))
     OR (SELECT COUNT(*) FROM jsonb_array_elements_text(course_order))
       <> (SELECT COUNT(DISTINCT value) FROM jsonb_array_elements_text(course_order)) THEN
    RETURN FALSE;
  END IF;
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$function$;

CREATE FUNCTION "aria_feedback_backfill_audit_valid"(
  run_id TEXT,
  source_id TEXT,
  source_fingerprint TEXT,
  classification_value public."AriaDataMigrationClassification",
  target_table TEXT,
  target_id TEXT,
  target_key JSONB,
  before_image JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $function$
DECLARE
  source_row RECORD;
  target_row RECORD;
  run_started_at TIMESTAMPTZ;
  action_value TEXT;
  reason_code TEXT;
  created_value BOOLEAN;
BEGIN
  SELECT message.id AS message_id, message."conversationId" AS conversation_id,
         conversation."studentId" AS student_id, message.feedback
  INTO source_row
  FROM public.aria_messages message
  JOIN public.aria_conversations conversation ON conversation.id = message."conversationId"
  WHERE message.id = source_id AND message.feedback IS NOT NULL;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  SELECT id, "messageId" AS message_id, "studentId" AS student_id, useful,
         reason, "createdAt" AS created_at, "updatedAt" AS updated_at
  INTO target_row
  FROM public.aria_feedbacks
  WHERE id = target_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  SELECT "startedAt" INTO run_started_at
  FROM public.aria_data_migration_runs WHERE id = run_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  IF source_fingerprint IS DISTINCT FROM public."aria_feedback_legacy_source_sha256"(
       source_row.message_id, source_row.conversation_id,
       source_row.student_id, source_row.feedback
     )
     OR target_table IS DISTINCT FROM 'aria_feedbacks'
     OR target_row.message_id IS DISTINCT FROM source_row.message_id
     OR jsonb_typeof(before_image) IS DISTINCT FROM 'object'
     OR before_image IS DISTINCT FROM jsonb_build_object('feedback', source_row.feedback)
     OR jsonb_typeof(target_key) IS DISTINCT FROM 'object'
     OR NOT target_key ?& ARRAY[
       'action', 'afterFingerprint', 'created', 'reasonCode'
     ]::TEXT[]
     OR target_key - ARRAY[
       'action', 'afterFingerprint', 'created', 'reasonCode'
     ]::TEXT[] <> '{}'::JSONB
     OR jsonb_typeof(target_key->'action') IS DISTINCT FROM 'string'
     OR jsonb_typeof(target_key->'afterFingerprint') NOT IN ('string', 'null')
     OR jsonb_typeof(target_key->'created') IS DISTINCT FROM 'boolean'
     OR jsonb_typeof(target_key->'reasonCode') IS DISTINCT FROM 'string' THEN
    RETURN FALSE;
  END IF;

  action_value := target_key->>'action';
  reason_code := target_key->>'reasonCode';
  created_value := (target_key->>'created')::BOOLEAN;

  IF reason_code = 'TARGET_ABSENT' THEN
    IF classification_value IS DISTINCT FROM
         'DETERMINISTIC_BACKFILL'::public."AriaDataMigrationClassification"
       OR action_value IS DISTINCT FROM 'CREATE'
       OR target_row.student_id IS DISTINCT FROM source_row.student_id
       OR target_row.useful IS DISTINCT FROM source_row.feedback THEN
      RETURN FALSE;
    END IF;
    IF created_value THEN
      RETURN target_row.created_at >= run_started_at
        AND target_row.updated_at >= run_started_at
        AND jsonb_typeof(target_key->'afterFingerprint') = 'string'
        AND target_key->>'afterFingerprint' = public."aria_feedback_canonical_target_sha256"(
          target_row.id, target_row.message_id, target_row.student_id,
          target_row.useful, target_row.reason, target_row.updated_at
        );
    END IF;
    RETURN jsonb_typeof(target_key->'afterFingerprint') = 'null';
  END IF;

  IF created_value OR jsonb_typeof(target_key->'afterFingerprint') <> 'null' THEN
    RETURN FALSE;
  END IF;
  IF reason_code = 'TARGET_MATCHES' THEN
    RETURN classification_value =
        'DETERMINISTIC_BACKFILL'::public."AriaDataMigrationClassification"
      AND action_value = 'CANONICAL_NOOP'
      AND target_row.student_id = source_row.student_id
      AND target_row.useful = source_row.feedback;
  END IF;
  IF reason_code = 'TARGET_VALUE_CONFLICT' THEN
    RETURN classification_value =
        'MANUAL_REVIEW_REQUIRED'::public."AriaDataMigrationClassification"
      AND action_value = 'MANUAL_NOOP'
      AND target_row.student_id = source_row.student_id
      AND target_row.useful <> source_row.feedback
      AND NOT EXISTS (
        SELECT 1 FROM public.aria_feedbacks candidate
        WHERE candidate."messageId" = source_row.message_id
          AND candidate."studentId" <> source_row.student_id
      );
  END IF;
  IF reason_code = 'TARGET_OWNER_CONFLICT' THEN
    RETURN classification_value =
        'MANUAL_REVIEW_REQUIRED'::public."AriaDataMigrationClassification"
      AND action_value = 'MANUAL_NOOP'
      AND EXISTS (
        SELECT 1 FROM public.aria_feedbacks candidate
        WHERE candidate."messageId" = source_row.message_id
          AND candidate."studentId" <> source_row.student_id
      );
  END IF;
  RETURN FALSE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$function$;

CREATE FUNCTION "aria_profile_backfill_audit_valid"(
  source_id TEXT,
  source_fingerprint TEXT,
  classification_value public."AriaDataMigrationClassification",
  target_table TEXT,
  target_id TEXT,
  target_key JSONB,
  before_image JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $function$
DECLARE
  profile_row RECORD;
  expected_classification public."AriaDataMigrationClassification";
  expected_action TEXT;
  expected_reason TEXT;
  legacy_eligible BOOLEAN;
  canonical_valid BOOLEAN;
BEGIN
  SELECT id, "studentId" AS student_id,
         "selectedCourseKeys" AS selected_course_keys,
         "uiPreferences" AS ui_preferences,
         "preferencesVersion" AS preferences_version,
         "pinnedCourseKeys" AS pinned_course_keys,
         "focusedCourseKey" AS focused_course_key,
         "courseOrder" AS course_order
  INTO profile_row
  FROM public.aria_learning_profiles
  WHERE id = source_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  IF target_table IS DISTINCT FROM 'aria_learning_profiles'
     OR target_id IS DISTINCT FROM source_id
     OR jsonb_typeof(before_image) IS DISTINCT FROM 'object'
     OR NOT before_image ?& ARRAY[
       'selectedCourseKeys', 'sourceCanonicalJson', 'uiPreferences'
     ]::TEXT[]
     OR before_image - ARRAY[
       'selectedCourseKeys', 'sourceCanonicalJson', 'uiPreferences'
     ]::TEXT[] <> '{}'::JSONB
     OR before_image->'selectedCourseKeys' IS DISTINCT FROM profile_row.selected_course_keys
     OR before_image->'uiPreferences' IS DISTINCT FROM profile_row.ui_preferences
     OR jsonb_typeof(before_image->'sourceCanonicalJson') IS DISTINCT FROM 'string'
     OR public."aria_profile_legacy_source_payload_valid"(
       before_image->>'sourceCanonicalJson',
       profile_row.id,
       profile_row.student_id,
       profile_row.selected_course_keys,
       profile_row.ui_preferences
     ) IS DISTINCT FROM TRUE
     OR source_fingerprint IS DISTINCT FROM public."aria_profile_legacy_source_sha256"(
       before_image->>'sourceCanonicalJson'
     )
     OR jsonb_typeof(target_key) IS DISTINCT FROM 'object'
     OR NOT target_key ?& ARRAY['action', 'reasonCode']::TEXT[]
     OR target_key - ARRAY['action', 'reasonCode']::TEXT[] <> '{}'::JSONB
     OR jsonb_typeof(target_key->'action') IS DISTINCT FROM 'string'
     OR jsonb_typeof(target_key->'reasonCode') IS DISTINCT FROM 'string' THEN
    RETURN FALSE;
  END IF;

  IF jsonb_typeof(profile_row.selected_course_keys) IS DISTINCT FROM 'array' THEN
    expected_reason := 'LEGACY_SELECTED_COURSES_INVALID';
    legacy_eligible := FALSE;
  ELSIF jsonb_array_length(profile_row.selected_course_keys) > 0 THEN
    expected_reason := 'LEGACY_SELECTED_COURSES_PRESENT';
    legacy_eligible := FALSE;
  ELSIF jsonb_typeof(profile_row.ui_preferences) IS DISTINCT FROM 'object' THEN
    expected_reason := 'LEGACY_UI_PREFERENCES_INVALID';
    legacy_eligible := FALSE;
  ELSIF profile_row.ui_preferences <> '{}'::JSONB THEN
    expected_reason := 'LEGACY_UI_PREFERENCES_PRESENT';
    legacy_eligible := FALSE;
  ELSE
    expected_reason := 'LEGACY_EMPTY_CANONICAL_VALID';
    legacy_eligible := TRUE;
  END IF;

  canonical_valid := legacy_eligible AND public."aria_profile_preferences_v1_valid"(
    profile_row.preferences_version,
    profile_row.pinned_course_keys,
    profile_row.focused_course_key,
    profile_row.course_order
  );
  IF legacy_eligible AND NOT canonical_valid THEN
    expected_reason := 'CANONICAL_PREFERENCES_INVALID';
  END IF;
  IF canonical_valid THEN
    expected_classification :=
      'DETERMINISTIC_BACKFILL'::public."AriaDataMigrationClassification";
    expected_action := 'CANONICAL_NOOP';
  ELSE
    expected_classification :=
      'MANUAL_REVIEW_REQUIRED'::public."AriaDataMigrationClassification";
    expected_action := 'MANUAL_NOOP';
  END IF;

  RETURN classification_value = expected_classification
    AND target_key->>'action' = expected_action
    AND target_key->>'reasonCode' = expected_reason;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$function$;

CREATE FUNCTION "aria_feedback_profile_apply_require_terminal_evidence"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  audit_total INTEGER;
  deterministic_total INTEGER;
  manual_total INTEGER;
  mutated_total INTEGER;
  invalid_total INTEGER;
BEGIN
  IF NEW."migrationName" IS DISTINCT FROM 'aria-feedback-profile-v1'
     OR NEW.mode IS DISTINCT FROM 'APPLY'::public."AriaDataMigrationMode"
     OR OLD.status IS DISTINCT FROM 'RUNNING'::public."AriaDataMigrationStatus"
     OR NEW.status IS DISTINCT FROM 'COMPLETED'::public."AriaDataMigrationStatus" THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (
      WHERE classification =
        'DETERMINISTIC_BACKFILL'::public."AriaDataMigrationClassification"
    )::INTEGER,
    COUNT(*) FILTER (
      WHERE classification =
        'MANUAL_REVIEW_REQUIRED'::public."AriaDataMigrationClassification"
    )::INTEGER,
    COUNT(*) FILTER (
      WHERE "sourceType" = 'ARIA_MESSAGE_FEEDBACK'
        AND classification =
          'DETERMINISTIC_BACKFILL'::public."AriaDataMigrationClassification"
        AND "targetKey"->'created' = 'true'::JSONB
    )::INTEGER,
    COUNT(*) FILTER (
      WHERE (
        "sourceType" = 'ARIA_MESSAGE_FEEDBACK'
        AND public."aria_feedback_backfill_audit_valid"(
          audit."runId", audit."sourceId", audit."sourceFingerprint",
          audit.classification, audit."targetTable", audit."targetId",
          audit."targetKey", audit."beforeImage"
        ) IS DISTINCT FROM TRUE
      ) OR (
        "sourceType" = 'ARIA_LEARNING_PROFILE'
        AND public."aria_profile_backfill_audit_valid"(
          audit."sourceId", audit."sourceFingerprint", audit.classification,
          audit."targetTable", audit."targetId", audit."targetKey", audit."beforeImage"
        ) IS DISTINCT FROM TRUE
      ) OR "sourceType" NOT IN ('ARIA_MESSAGE_FEEDBACK', 'ARIA_LEARNING_PROFILE')
        OR classification =
          'ARCHIVED_NON_RESUMABLE'::public."AriaDataMigrationClassification"
    )::INTEGER
  INTO audit_total, deterministic_total, manual_total, mutated_total, invalid_total
  FROM public.aria_data_migration_row_audits audit
  WHERE audit."runId" = NEW.id;

  IF NEW."sourceSnapshot"->>'target' IS DISTINCT FROM 'feedback-profile'
     OR NEW."sourceSnapshot"->>'plannerVersion' IS DISTINCT FROM '1'
     OR NEW."sourceSnapshot"->'report'->>'scanned' IS DISTINCT FROM NEW."scannedCount"::TEXT
     OR NEW."sourceSnapshot"->'report'->>'deterministic'
       IS DISTINCT FROM NEW."deterministicCount"::TEXT
     OR NEW."sourceSnapshot"->'report'->>'archived' IS DISTINCT FROM '0'
     OR NEW."sourceSnapshot"->'report'->>'manualReview'
       IS DISTINCT FROM NEW."manualReviewCount"::TEXT
     OR NEW."archivedCount" <> 0
     OR audit_total IS DISTINCT FROM NEW."scannedCount"
     OR deterministic_total IS DISTINCT FROM NEW."deterministicCount"
     OR manual_total IS DISTINCT FROM NEW."manualReviewCount"
     OR mutated_total IS DISTINCT FROM NEW."mutatedCount"
     OR invalid_total <> 0 THEN
    RAISE EXCEPTION 'feedback-profile APPLY terminal evidence does not match row audits';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER "aria_feedback_profile_apply_terminal_evidence"
BEFORE UPDATE OF status ON public."aria_data_migration_runs"
FOR EACH ROW
EXECUTE FUNCTION "aria_feedback_profile_apply_require_terminal_evidence"();
