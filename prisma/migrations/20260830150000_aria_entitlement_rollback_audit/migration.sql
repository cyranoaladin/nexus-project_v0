-- Preserve the exact non-PII canonical entitlement state needed for B3 CAS rollback.
ALTER TABLE "aria_data_migration_row_audits"
  DROP CONSTRAINT "aria_data_migration_rows_before_image_allowlist_check";
ALTER TABLE "aria_data_migration_row_audits"
  ADD CONSTRAINT "aria_data_migration_rows_before_image_allowlist_check"
  CHECK (
    (
      "sourceType" = 'ARIA_CONVERSATION'
      AND "beforeImage" - ARRAY[
        'contextState', 'courseKey', 'resourceId', 'skillId', 'subject'
      ]::TEXT[] = '{}'::JSONB
    )
    OR
    (
      "sourceType" = 'ARIA_MESSAGE_GROUP'
      AND "beforeImage" - ARRAY['messageIds', 'roles', 'statuses']::TEXT[] = '{}'::JSONB
    )
    OR
    (
      "sourceType" = 'ARIA_SUBSCRIPTION_ENTITLEMENT'
      AND "beforeImage" - ARRAY[
        'ariaSubjects', 'endDate', 'entitlement', 'startDate', 'status', 'subscriptionId'
      ]::TEXT[] = '{}'::JSONB
    )
    OR
    (
      "sourceType" = 'ARIA_MESSAGE_FEEDBACK'
      AND "beforeImage" - ARRAY['feedback']::TEXT[] = '{}'::JSONB
    )
    OR
    (
      "sourceType" = 'ARIA_LEARNING_PROFILE'
      AND "beforeImage" - ARRAY[
        'selectedCourseKeys', 'uiPreferences'
      ]::TEXT[] = '{}'::JSONB
    )
  );
