-- Extend the source-specific migration before-image allowlist for C07.
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
        'ariaSubjects', 'endDate', 'startDate', 'status', 'subscriptionId'
      ]::TEXT[] = '{}'::JSONB
    )
  );
