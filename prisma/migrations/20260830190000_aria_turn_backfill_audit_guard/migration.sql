-- Conversation-turn backfill v2: exact source evidence, target linkage and counters.
-- This is additive hardening for M1 and does not contract any legacy column.

CREATE FUNCTION "aria_message_group_before_image_valid"(
  before_image JSONB,
  classification public."AriaDataMigrationClassification"
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $function$
DECLARE
  item JSONB;
  item_count INTEGER;
  reason TEXT;
BEGIN
  IF jsonb_typeof(before_image) IS DISTINCT FROM 'object'
     OR NOT before_image ?& ARRAY[
       'clusterId', 'createdAts', 'messageIds', 'reason', 'roles', 'statuses'
     ]::TEXT[]
     OR before_image - ARRAY[
       'clusterId', 'createdAts', 'messageIds', 'reason', 'roles', 'statuses'
     ]::TEXT[] <> '{}'::JSONB
     OR jsonb_typeof(before_image->'clusterId') NOT IN ('string', 'null')
     OR jsonb_typeof(before_image->'createdAts') IS DISTINCT FROM 'array'
     OR jsonb_typeof(before_image->'messageIds') IS DISTINCT FROM 'array'
     OR jsonb_typeof(before_image->'reason') IS DISTINCT FROM 'string'
     OR jsonb_typeof(before_image->'roles') IS DISTINCT FROM 'array'
     OR jsonb_typeof(before_image->'statuses') IS DISTINCT FROM 'array' THEN
    RETURN FALSE;
  END IF;

  item_count := jsonb_array_length(before_image->'messageIds');
  IF item_count NOT IN (1, 2)
     OR jsonb_array_length(before_image->'createdAts') <> item_count
     OR jsonb_array_length(before_image->'roles') <> item_count
     OR jsonb_array_length(before_image->'statuses') <> item_count THEN
    RETURN FALSE;
  END IF;

  FOR item IN
    SELECT value FROM jsonb_array_elements(before_image->'messageIds')
  LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'string' OR length(item #>> '{}') = 0 THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  FOR item IN
    SELECT value FROM jsonb_array_elements(before_image->'createdAts')
  LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'string' THEN RETURN FALSE; END IF;
    PERFORM (item #>> '{}')::TIMESTAMPTZ;
  END LOOP;
  FOR item IN
    SELECT value FROM jsonb_array_elements(before_image->'roles')
  LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'string' THEN RETURN FALSE; END IF;
  END LOOP;
  FOR item IN
    SELECT value FROM jsonb_array_elements(before_image->'statuses')
  LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'string' THEN RETURN FALSE; END IF;
  END LOOP;

  reason := before_image->>'reason';
  IF classification = 'DETERMINISTIC_BACKFILL'::public."AriaDataMigrationClassification" THEN
    RETURN item_count = 2
      AND jsonb_typeof(before_image->'clusterId') = 'null'
      AND reason IN ('PAIR_COMPLETED', 'PAIR_CANCELLED', 'PAIR_ERROR')
      AND before_image->'roles' = '["user", "assistant"]'::JSONB
      AND before_image->'statuses'->>0 = 'COMPLETED'
      AND before_image->'statuses'->>1 = replace(reason, 'PAIR_', '');
  END IF;
  IF classification = 'ARCHIVED_NON_RESUMABLE'::public."AriaDataMigrationClassification" THEN
    RETURN item_count = 1
      AND jsonb_typeof(before_image->'clusterId') = 'null'
      AND reason IN (
        'CONTEXT_UNRESOLVED', 'ORPHAN_USER', 'ORPHAN_ASSISTANT',
        'SYSTEM_MESSAGE', 'NON_TERMINAL_STATUS'
      );
  END IF;
  IF classification = 'MANUAL_REVIEW_REQUIRED'::public."AriaDataMigrationClassification" THEN
    RETURN item_count = 1
      AND jsonb_typeof(before_image->'clusterId') = 'string'
      AND before_image->>'clusterId' ~ '^[0-9a-f]{64}$'
      AND reason IN (
        'TIMESTAMP_ORDER_AMBIGUOUS', 'NON_ALTERNATING_TERMINAL_GROUP',
        'UNKNOWN_ROLE', 'UNKNOWN_STATUS'
      );
  END IF;
  RETURN FALSE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$function$;

CREATE FUNCTION "aria_turn_v2_identity_sha256"(
  conversation_id TEXT,
  ordered_message_ids TEXT[]
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $function$
  SELECT CASE
    WHEN pg_catalog.cardinality(ordered_message_ids) NOT IN (1, 2) THEN NULL
    ELSE pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(
        '{"contractVersion":2,"conversationId":'
        || pg_catalog.to_json(conversation_id)::TEXT
        || ',"orderedMessageIds":['
        || COALESCE((
          SELECT pg_catalog.string_agg(
            pg_catalog.to_json(message_id)::TEXT, ',' ORDER BY position
          )
          FROM pg_catalog.unnest(ordered_message_ids)
            WITH ORDINALITY ordered(message_id, position)
        ), '')
        || ']}',
        'UTF8'
      )),
      'hex'
    )
  END;
$function$;

CREATE FUNCTION "aria_turn_v2_source_fingerprint"(
  actor_user_id TEXT,
  context_state TEXT,
  context_version TEXT,
  conversation_id TEXT,
  course_key TEXT,
  message_ids TEXT[],
  message_roles TEXT[],
  message_statuses TEXT[],
  message_created_ats TEXT[],
  student_id TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $function$
  SELECT CASE
    WHEN pg_catalog.cardinality(message_ids) NOT IN (1, 2)
      OR pg_catalog.cardinality(message_roles) <> pg_catalog.cardinality(message_ids)
      OR pg_catalog.cardinality(message_statuses) <> pg_catalog.cardinality(message_ids)
      OR pg_catalog.cardinality(message_created_ats) <> pg_catalog.cardinality(message_ids)
    THEN NULL
    ELSE pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(
        '{"actorUserId":' || pg_catalog.to_json(actor_user_id)::TEXT
        || ',"contextState":' || pg_catalog.to_json(context_state)::TEXT
        || ',"contextVersion":'
        || COALESCE(pg_catalog.to_json(context_version)::TEXT, 'null')
        || ',"contractVersion":2,"conversationId":'
        || pg_catalog.to_json(conversation_id)::TEXT
        || ',"courseKey":' || COALESCE(pg_catalog.to_json(course_key)::TEXT, 'null')
        || ',"messages":['
        || COALESCE((
          SELECT pg_catalog.string_agg(
            '{"id":' || pg_catalog.to_json(message_id)::TEXT
            || ',"role":' || pg_catalog.to_json(message_roles[position])::TEXT
            || ',"status":' || pg_catalog.to_json(message_statuses[position])::TEXT
            || ',"createdAt":' || pg_catalog.to_json(message_created_ats[position])::TEXT
            || '}',
            ',' ORDER BY position
          )
          FROM pg_catalog.unnest(message_ids)
            WITH ORDINALITY ordered(message_id, position)
        ), '')
        || '],"studentId":' || pg_catalog.to_json(student_id)::TEXT || '}',
        'UTF8'
      )),
      'hex'
    )
  END;
$function$;

CREATE FUNCTION "aria_turn_v2_ambiguous_cluster_sha256"(
  conversation_id TEXT,
  created_ats TEXT[],
  message_ids TEXT[],
  message_roles TEXT[],
  message_statuses TEXT[]
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $function$
  SELECT CASE
    WHEN pg_catalog.cardinality(message_ids) < 1
      OR pg_catalog.cardinality(created_ats) <> pg_catalog.cardinality(message_ids)
      OR pg_catalog.cardinality(message_roles) <> pg_catalog.cardinality(message_ids)
      OR pg_catalog.cardinality(message_statuses) <> pg_catalog.cardinality(message_ids)
    THEN NULL
    ELSE pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(
        '{"conversationId":' || pg_catalog.to_json(conversation_id)::TEXT
        || ',"createdAts":[' || COALESCE((
          SELECT pg_catalog.string_agg(pg_catalog.to_json(value)::TEXT, ',' ORDER BY position)
          FROM pg_catalog.unnest(created_ats) WITH ORDINALITY ordered(value, position)
        ), '') || ']'
        || ',"messageIds":[' || COALESCE((
          SELECT pg_catalog.string_agg(pg_catalog.to_json(value)::TEXT, ',' ORDER BY position)
          FROM pg_catalog.unnest(message_ids) WITH ORDINALITY ordered(value, position)
        ), '') || ']'
        || ',"roles":[' || COALESCE((
          SELECT pg_catalog.string_agg(pg_catalog.to_json(value)::TEXT, ',' ORDER BY position)
          FROM pg_catalog.unnest(message_roles) WITH ORDINALITY ordered(value, position)
        ), '') || ']'
        || ',"statuses":[' || COALESCE((
          SELECT pg_catalog.string_agg(pg_catalog.to_json(value)::TEXT, ',' ORDER BY position)
          FROM pg_catalog.unnest(message_statuses) WITH ORDINALITY ordered(value, position)
        ), '') || ']}',
        'UTF8'
      )),
      'hex'
    )
  END;
$function$;

CREATE FUNCTION "aria_turn_v2_group_signature"(
  classification TEXT,
  cluster_id TEXT,
  message_ids TEXT[],
  reason TEXT,
  sequence_value INTEGER
)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $function$
  SELECT pg_catalog.jsonb_build_object(
    'classification', classification,
    'clusterId', cluster_id,
    'messageIds', pg_catalog.to_jsonb(message_ids),
    'reason', reason,
    'sequence', sequence_value
  );
$function$;

CREATE FUNCTION "aria_turn_v2_run_matches_planner"(run_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $function$
DECLARE
  actual_signatures JSONB;
  assistant_status TEXT;
  cluster_id TEXT;
  conversation_id TEXT;
  conversation_messages JSONB;
  current_message JSONB;
  expected_signatures JSONB := '[]'::JSONB;
  expected_sorted JSONB;
  has_equal_timestamp BOOLEAN;
  index_value INTEGER;
  message_count INTEGER;
  pair_end INTEGER;
  pair_start INTEGER;
  position_value INTEGER;
  run_end INTEGER;
  run_start INTEGER;
  sequence_value INTEGER;
  strict_pair_sequence BOOLEAN;
BEGIN
  FOR conversation_id IN
    SELECT DISTINCT live_message."conversationId"
    FROM public."aria_data_migration_row_audits" audit
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements_text(
      audit."beforeImage"->'messageIds'
    ) expanded(message_id)
    JOIN public.aria_messages live_message ON live_message.id = expanded.message_id
    WHERE audit."runId" = run_id AND audit."sourceType" = 'ARIA_MESSAGE_GROUP'
    ORDER BY live_message."conversationId"
  LOOP
    SELECT pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'contextState', source_conversation."contextState"::TEXT,
        'courseKey', source_conversation."courseKey",
        'createdAt', pg_catalog.to_char(
          live_message."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS'
        ) || 'Z',
        'id', live_message.id,
        'role', live_message.role,
        'status', live_message.status
      ) ORDER BY live_message."createdAt", live_message.id
    )
    INTO conversation_messages
    FROM public."aria_data_migration_row_audits" audit
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements_text(
      audit."beforeImage"->'messageIds'
    ) expanded(message_id)
    JOIN public.aria_messages live_message ON live_message.id = expanded.message_id
    JOIN public.aria_conversations source_conversation
      ON source_conversation.id = live_message."conversationId"
    WHERE audit."runId" = run_id
      AND audit."sourceType" = 'ARIA_MESSAGE_GROUP'
      AND live_message."conversationId" = conversation_id;

    SELECT COALESCE(MAX(turn.sequence), 0)::INTEGER + 1
    INTO sequence_value
    FROM public.aria_conversation_turns turn
    WHERE turn."conversationId" = conversation_id
      AND turn."migrationRunId" IS DISTINCT FROM run_id;

    message_count := pg_catalog.jsonb_array_length(conversation_messages);
    index_value := 0;
    WHILE index_value < message_count LOOP
      current_message := conversation_messages->index_value;
      IF current_message->>'contextState' <> 'ACTIVE'
         OR pg_catalog.jsonb_typeof(current_message->'courseKey') = 'null' THEN
        expected_signatures := expected_signatures || pg_catalog.jsonb_build_array(
          public."aria_turn_v2_group_signature"(
            'ARCHIVED_NON_RESUMABLE', NULL, ARRAY[current_message->>'id'],
            'CONTEXT_UNRESOLVED', NULL
          )
        );
        index_value := index_value + 1;
      ELSIF (
        (current_message->>'role' = 'user' AND current_message->>'status' = 'COMPLETED')
        OR (
          current_message->>'role' = 'assistant'
          AND current_message->>'status' IN ('COMPLETED', 'CANCELLED', 'ERROR')
        )
      ) THEN
        run_start := index_value;
        index_value := index_value + 1;
        WHILE index_value < message_count LOOP
          current_message := conversation_messages->index_value;
          EXIT WHEN current_message->>'contextState' <> 'ACTIVE'
            OR pg_catalog.jsonb_typeof(current_message->'courseKey') = 'null'
            OR NOT (
              (current_message->>'role' = 'user'
                AND current_message->>'status' = 'COMPLETED')
              OR (
                current_message->>'role' = 'assistant'
                AND current_message->>'status' IN ('COMPLETED', 'CANCELLED', 'ERROR')
              )
            );
          index_value := index_value + 1;
        END LOOP;
        run_end := index_value;
        has_equal_timestamp := FALSE;
        position_value := run_start + 1;
        WHILE position_value < run_end LOOP
          IF conversation_messages->(position_value - 1)->>'createdAt'
             = conversation_messages->position_value->>'createdAt' THEN
            has_equal_timestamp := TRUE;
          END IF;
          position_value := position_value + 1;
        END LOOP;

        IF has_equal_timestamp THEN
          SELECT public."aria_turn_v2_ambiguous_cluster_sha256"(
            conversation_id,
            ARRAY(
              SELECT item->>'createdAt'
              FROM pg_catalog.jsonb_array_elements(conversation_messages)
                WITH ORDINALITY ordered(item, position)
              WHERE position > run_start AND position <= run_end
              ORDER BY position
            ),
            ARRAY(
              SELECT item->>'id'
              FROM pg_catalog.jsonb_array_elements(conversation_messages)
                WITH ORDINALITY ordered(item, position)
              WHERE position > run_start AND position <= run_end
              ORDER BY position
            ),
            ARRAY(
              SELECT item->>'role'
              FROM pg_catalog.jsonb_array_elements(conversation_messages)
                WITH ORDINALITY ordered(item, position)
              WHERE position > run_start AND position <= run_end
              ORDER BY position
            ),
            ARRAY(
              SELECT item->>'status'
              FROM pg_catalog.jsonb_array_elements(conversation_messages)
                WITH ORDINALITY ordered(item, position)
              WHERE position > run_start AND position <= run_end
              ORDER BY position
            )
          ) INTO cluster_id;
          position_value := run_start;
          WHILE position_value < run_end LOOP
            current_message := conversation_messages->position_value;
            expected_signatures := expected_signatures || pg_catalog.jsonb_build_array(
              public."aria_turn_v2_group_signature"(
                'MANUAL_REVIEW_REQUIRED', cluster_id, ARRAY[current_message->>'id'],
                'TIMESTAMP_ORDER_AMBIGUOUS', NULL
              )
            );
            position_value := position_value + 1;
          END LOOP;
        ELSE
          pair_start := run_start;
          WHILE pair_start < run_end
            AND conversation_messages->pair_start->>'role' = 'assistant'
          LOOP
            current_message := conversation_messages->pair_start;
            expected_signatures := expected_signatures || pg_catalog.jsonb_build_array(
              public."aria_turn_v2_group_signature"(
                'ARCHIVED_NON_RESUMABLE', NULL, ARRAY[current_message->>'id'],
                'ORPHAN_ASSISTANT', NULL
              )
            );
            pair_start := pair_start + 1;
          END LOOP;
          pair_end := run_end;
          WHILE pair_end > pair_start
            AND conversation_messages->(pair_end - 1)->>'role' = 'user'
          LOOP
            pair_end := pair_end - 1;
          END LOOP;
          strict_pair_sequence := ((pair_end - pair_start) % 2 = 0);
          position_value := pair_start;
          WHILE strict_pair_sequence AND position_value < pair_end LOOP
            IF (conversation_messages->position_value->>'role')
                 <> (CASE WHEN (position_value - pair_start) % 2 = 0
                      THEN 'user' ELSE 'assistant' END) THEN
              strict_pair_sequence := FALSE;
            END IF;
            position_value := position_value + 1;
          END LOOP;
          IF strict_pair_sequence THEN
            position_value := pair_start;
            WHILE position_value < pair_end LOOP
              assistant_status := conversation_messages->(position_value + 1)->>'status';
              expected_signatures := expected_signatures || pg_catalog.jsonb_build_array(
                public."aria_turn_v2_group_signature"(
                  'DETERMINISTIC_BACKFILL', NULL,
                  ARRAY[
                    conversation_messages->position_value->>'id',
                    conversation_messages->(position_value + 1)->>'id'
                  ],
                  'PAIR_' || assistant_status,
                  sequence_value
                )
              );
              sequence_value := sequence_value + 1;
              position_value := position_value + 2;
            END LOOP;
          ELSE
            SELECT public."aria_turn_v2_ambiguous_cluster_sha256"(
              conversation_id,
              ARRAY(
                SELECT item->>'createdAt'
                FROM pg_catalog.jsonb_array_elements(conversation_messages)
                  WITH ORDINALITY ordered(item, position)
                WHERE position > pair_start AND position <= pair_end
                ORDER BY position
              ),
              ARRAY(
                SELECT item->>'id'
                FROM pg_catalog.jsonb_array_elements(conversation_messages)
                  WITH ORDINALITY ordered(item, position)
                WHERE position > pair_start AND position <= pair_end
                ORDER BY position
              ),
              ARRAY(
                SELECT item->>'role'
                FROM pg_catalog.jsonb_array_elements(conversation_messages)
                  WITH ORDINALITY ordered(item, position)
                WHERE position > pair_start AND position <= pair_end
                ORDER BY position
              ),
              ARRAY(
                SELECT item->>'status'
                FROM pg_catalog.jsonb_array_elements(conversation_messages)
                  WITH ORDINALITY ordered(item, position)
                WHERE position > pair_start AND position <= pair_end
                ORDER BY position
              )
            ) INTO cluster_id;
            position_value := pair_start;
            WHILE position_value < pair_end LOOP
              current_message := conversation_messages->position_value;
              expected_signatures := expected_signatures || pg_catalog.jsonb_build_array(
                public."aria_turn_v2_group_signature"(
                  'MANUAL_REVIEW_REQUIRED', cluster_id, ARRAY[current_message->>'id'],
                  'NON_ALTERNATING_TERMINAL_GROUP', NULL
                )
              );
              position_value := position_value + 1;
            END LOOP;
          END IF;
          position_value := pair_end;
          WHILE position_value < run_end LOOP
            current_message := conversation_messages->position_value;
            expected_signatures := expected_signatures || pg_catalog.jsonb_build_array(
              public."aria_turn_v2_group_signature"(
                'ARCHIVED_NON_RESUMABLE', NULL, ARRAY[current_message->>'id'],
                'ORPHAN_USER', NULL
              )
            );
            position_value := position_value + 1;
          END LOOP;
        END IF;
      ELSE
        IF current_message->>'role' NOT IN ('user', 'assistant', 'system') THEN
          cluster_id := public."aria_turn_v2_ambiguous_cluster_sha256"(
            conversation_id,
            ARRAY[current_message->>'createdAt'], ARRAY[current_message->>'id'],
            ARRAY[current_message->>'role'], ARRAY[current_message->>'status']
          );
          expected_signatures := expected_signatures || pg_catalog.jsonb_build_array(
            public."aria_turn_v2_group_signature"(
              'MANUAL_REVIEW_REQUIRED', cluster_id, ARRAY[current_message->>'id'],
              'UNKNOWN_ROLE', NULL
            )
          );
        ELSIF current_message->>'status'
          NOT IN ('PENDING', 'STREAMING', 'COMPLETED', 'CANCELLED', 'ERROR') THEN
          cluster_id := public."aria_turn_v2_ambiguous_cluster_sha256"(
            conversation_id,
            ARRAY[current_message->>'createdAt'], ARRAY[current_message->>'id'],
            ARRAY[current_message->>'role'], ARRAY[current_message->>'status']
          );
          expected_signatures := expected_signatures || pg_catalog.jsonb_build_array(
            public."aria_turn_v2_group_signature"(
              'MANUAL_REVIEW_REQUIRED', cluster_id, ARRAY[current_message->>'id'],
              'UNKNOWN_STATUS', NULL
            )
          );
        ELSIF current_message->>'role' = 'system' THEN
          expected_signatures := expected_signatures || pg_catalog.jsonb_build_array(
            public."aria_turn_v2_group_signature"(
              'ARCHIVED_NON_RESUMABLE', NULL, ARRAY[current_message->>'id'],
              'SYSTEM_MESSAGE', NULL
            )
          );
        ELSE
          expected_signatures := expected_signatures || pg_catalog.jsonb_build_array(
            public."aria_turn_v2_group_signature"(
              'ARCHIVED_NON_RESUMABLE', NULL, ARRAY[current_message->>'id'],
              'NON_TERMINAL_STATUS', NULL
            )
          );
        END IF;
        index_value := index_value + 1;
      END IF;
    END LOOP;
  END LOOP;

  SELECT COALESCE(pg_catalog.jsonb_agg(value ORDER BY value::TEXT), '[]'::JSONB)
  INTO expected_sorted
  FROM pg_catalog.jsonb_array_elements(expected_signatures);

  SELECT COALESCE(pg_catalog.jsonb_agg(signature ORDER BY signature::TEXT), '[]'::JSONB)
  INTO actual_signatures
  FROM (
    SELECT public."aria_turn_v2_group_signature"(
      audit.classification::TEXT,
      audit."beforeImage"->>'clusterId',
      ARRAY(
        SELECT message_id
        FROM pg_catalog.jsonb_array_elements_text(audit."beforeImage"->'messageIds')
          WITH ORDINALITY ordered(message_id, position)
        ORDER BY position
      ),
      audit."beforeImage"->>'reason',
      CASE WHEN audit.classification
        = 'DETERMINISTIC_BACKFILL'::public."AriaDataMigrationClassification"
        THEN (audit."targetKey"->>'sequence')::INTEGER ELSE NULL END
    ) AS signature
    FROM public."aria_data_migration_row_audits" audit
    WHERE audit."runId" = run_id AND audit."sourceType" = 'ARIA_MESSAGE_GROUP'
  ) actual;

  RETURN actual_signatures = expected_sorted;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$function$;

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
        'selectedCourseKeys', 'uiPreferences'
      ]::TEXT[] = '{}'::JSONB
    )
  );

CREATE FUNCTION "aria_turn_apply_require_terminal_evidence"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  audit_total INTEGER;
  deterministic_total INTEGER;
  eligible_source_total INTEGER;
  archived_total INTEGER;
  manual_total INTEGER;
  invalid_total INTEGER;
  expanded_total INTEGER;
  distinct_message_total INTEGER;
  prior_source_overlap_total INTEGER;
  run_target_total INTEGER;
BEGIN
  IF NEW."migrationName" IS DISTINCT FROM 'aria-conversation-turns-v1'
     OR NEW.mode IS DISTINCT FROM 'APPLY'::public."AriaDataMigrationMode"
     OR OLD.status IS DISTINCT FROM 'RUNNING'::public."AriaDataMigrationStatus"
     OR NEW.status IS DISTINCT FROM 'COMPLETED'::public."AriaDataMigrationStatus" THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (
      WHERE classification = 'DETERMINISTIC_BACKFILL'::public."AriaDataMigrationClassification"
    )::INTEGER,
    COUNT(*) FILTER (
      WHERE classification = 'ARCHIVED_NON_RESUMABLE'::public."AriaDataMigrationClassification"
    )::INTEGER,
    COUNT(*) FILTER (
      WHERE classification = 'MANUAL_REVIEW_REQUIRED'::public."AriaDataMigrationClassification"
    )::INTEGER,
    COUNT(*) FILTER (
      WHERE "sourceType" IS DISTINCT FROM 'ARIA_MESSAGE_GROUP'
         OR audit."sourceId" !~ '^legacy_message_group_v2_[0-9a-f]{64}$'
         OR NOT public."aria_message_group_before_image_valid"("beforeImage", classification)
         OR source_user.id IS NULL
         OR source_conversation.id IS NULL
         OR source_student.id IS NULL
         OR audit."sourceId" IS DISTINCT FROM
           'legacy_message_group_v2_' || public."aria_turn_v2_identity_sha256"(
             source_conversation.id,
             ARRAY(
               SELECT message_id
               FROM jsonb_array_elements_text("beforeImage"->'messageIds')
                 WITH ORDINALITY ordered(message_id, position)
               ORDER BY position
             )
           )
         OR audit."sourceFingerprint" IS DISTINCT FROM
           public."aria_turn_v2_source_fingerprint"(
             source_student."userId",
             source_conversation."contextState"::TEXT,
             source_conversation."contextVersion",
             source_conversation.id,
             source_conversation."courseKey",
             ARRAY(
               SELECT message_id
               FROM jsonb_array_elements_text("beforeImage"->'messageIds')
                 WITH ORDINALITY ordered(message_id, position)
               ORDER BY position
             ),
             ARRAY(
               SELECT role
               FROM jsonb_array_elements_text("beforeImage"->'roles')
                 WITH ORDINALITY ordered(role, position)
               ORDER BY position
             ),
             ARRAY(
               SELECT status
               FROM jsonb_array_elements_text("beforeImage"->'statuses')
                 WITH ORDINALITY ordered(status, position)
               ORDER BY position
             ),
             ARRAY(
               SELECT created_at
               FROM jsonb_array_elements_text("beforeImage"->'createdAts')
                 WITH ORDINALITY ordered(created_at, position)
               ORDER BY position
             ),
             source_conversation."studentId"
           )
         OR (
           SELECT COUNT(*)
           FROM jsonb_array_elements_text("beforeImage"->'messageIds')
             WITH ORDINALITY source_message(message_id, position)
           JOIN public.aria_messages live_message ON live_message.id = source_message.message_id
           WHERE live_message.role = "beforeImage"->'roles'->>(source_message.position - 1)::INTEGER
             AND live_message.status = "beforeImage"->'statuses'->>(source_message.position - 1)::INTEGER
             AND to_char(live_message."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') || 'Z'
               = "beforeImage"->'createdAts'->>(source_message.position - 1)::INTEGER
         ) <> jsonb_array_length("beforeImage"->'messageIds')
         OR (
           classification = 'DETERMINISTIC_BACKFILL'::public."AriaDataMigrationClassification"
           AND (
             "targetTable" IS DISTINCT FROM 'aria_conversation_turns'
             OR "targetId" IS NULL
             OR turn.id IS NULL
             OR turn."migrationRunId" IS DISTINCT FROM NEW.id
             OR turn.id !~ '^legacy_turn_v2_[0-9a-f]{64}$'
             OR turn."useCase" IS DISTINCT FROM 'LEGACY_IMPORT'::public."AriaConversationTurnUseCase"
             OR turn."clientRequestId" IS DISTINCT FROM audit."sourceId"
             OR turn."requestFingerprint" IS DISTINCT FROM audit."sourceFingerprint"
             OR source_assistant.id IS NULL
             OR source_user."conversationId" IS DISTINCT FROM source_assistant."conversationId"
             OR source_conversation."contextState" IS DISTINCT FROM 'ACTIVE'::public."AriaConversationContextState"
             OR source_conversation."courseKey" IS NULL
             OR turn.id IS DISTINCT FROM
               'legacy_turn_v2_' || public."aria_turn_v2_identity_sha256"(
                 source_conversation.id,
                 ARRAY[source_user.id, source_assistant.id]
               )
             OR turn."conversationId" IS DISTINCT FROM source_conversation.id
             OR turn."subjectStudentId" IS DISTINCT FROM source_conversation."studentId"
             OR turn."actorUserId" IS DISTINCT FROM source_student."userId"
             OR turn."academicSnapshot" IS DISTINCT FROM jsonb_build_object(
               'contextVersion', source_conversation."contextVersion",
               'courseKey', source_conversation."courseKey",
               'provenance', 'LEGACY_IMPORT'
             )
             OR turn."pedagogicalMode" IS DISTINCT FROM 'LEGACY_UNSPECIFIED'
             OR turn."agentRole" IS DISTINCT FROM 'LEGACY_IMPORT'
             OR turn.visibility IS DISTINCT FROM 'STUDENT_PRIVATE'::public."AriaVisibility"
             OR to_char(turn."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') || 'Z'
               IS DISTINCT FROM "beforeImage"->'createdAts'->>0
             OR to_char(turn."completedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') || 'Z'
               IS DISTINCT FROM "beforeImage"->'createdAts'->>1
             OR turn.status::TEXT IS DISTINCT FROM "beforeImage"->'statuses'->>1
             OR jsonb_typeof("targetKey") IS DISTINCT FROM 'object'
             OR NOT "targetKey" ?& ARRAY[
               'contractVersion', 'messageIds', 'sequence', 'status', 'turnId'
             ]::TEXT[]
             OR "targetKey" - ARRAY[
               'contractVersion', 'messageIds', 'sequence', 'status', 'turnId'
             ]::TEXT[] <> '{}'::JSONB
             OR jsonb_typeof("targetKey"->'contractVersion') IS DISTINCT FROM 'number'
             OR jsonb_typeof("targetKey"->'messageIds') IS DISTINCT FROM 'array'
             OR jsonb_typeof("targetKey"->'sequence') IS DISTINCT FROM 'number'
             OR jsonb_typeof("targetKey"->'status') IS DISTINCT FROM 'string'
             OR jsonb_typeof("targetKey"->'turnId') IS DISTINCT FROM 'string'
             OR "targetKey"->'contractVersion' IS DISTINCT FROM '2'::JSONB
             OR "targetKey"->'messageIds' IS DISTINCT FROM "beforeImage"->'messageIds'
             OR "targetKey"->>'turnId' IS DISTINCT FROM "targetId"
             OR "targetKey"->>'turnId' IS DISTINCT FROM turn.id
             OR "targetKey"->'sequence' IS DISTINCT FROM to_jsonb(turn.sequence)
             OR "targetKey"->'status' IS DISTINCT FROM to_jsonb(turn.status::TEXT)
             OR "targetKey"->>'status' IS DISTINCT FROM "beforeImage"->'statuses'->>1
             OR (SELECT COUNT(*) FROM public.aria_messages linked
                 WHERE linked."turnId" = turn.id) <> 2
             OR NOT EXISTS (
               SELECT 1 FROM public.aria_messages linked
               WHERE linked.id = "beforeImage"->'messageIds'->>0
                 AND linked."turnId" = turn.id AND linked."turnRole" = 'USER'
             )
             OR NOT EXISTS (
               SELECT 1 FROM public.aria_messages linked
               WHERE linked.id = "beforeImage"->'messageIds'->>1
                 AND linked."turnId" = turn.id AND linked."turnRole" = 'ASSISTANT'
             )
           )
         )
         OR (
           classification IS DISTINCT FROM 'DETERMINISTIC_BACKFILL'::public."AriaDataMigrationClassification"
           AND (
             "targetTable" IS NOT NULL OR "targetId" IS NOT NULL OR "targetKey" IS NOT NULL
             OR EXISTS (
               SELECT 1 FROM public.aria_messages linked
               WHERE linked.id = "beforeImage"->'messageIds'->>0
                 AND linked."turnId" IS NOT NULL
             )
           )
         )
    )::INTEGER
  INTO audit_total, deterministic_total, archived_total, manual_total, invalid_total
  FROM public."aria_data_migration_row_audits" audit
  LEFT JOIN public.aria_conversation_turns turn ON turn.id = audit."targetId"
  LEFT JOIN public.aria_messages source_user
    ON source_user.id = audit."beforeImage"->'messageIds'->>0
  LEFT JOIN public.aria_messages source_assistant
    ON source_assistant.id = audit."beforeImage"->'messageIds'->>1
  LEFT JOIN public.aria_conversations source_conversation
    ON source_conversation.id = source_user."conversationId"
  LEFT JOIN public.students source_student
    ON source_student.id = source_conversation."studentId"
  WHERE audit."runId" = NEW.id;

  SELECT COUNT(*)::INTEGER, COUNT(DISTINCT message_id)::INTEGER
  INTO expanded_total, distinct_message_total
  FROM public."aria_data_migration_row_audits" audit
  CROSS JOIN LATERAL jsonb_array_elements_text(audit."beforeImage"->'messageIds')
    AS expanded(message_id)
  WHERE audit."runId" = NEW.id AND audit."sourceType" = 'ARIA_MESSAGE_GROUP';

  SELECT COUNT(*)::INTEGER
  INTO eligible_source_total
  FROM public.aria_messages candidate
  WHERE EXISTS (
      SELECT 1
      FROM public."aria_data_migration_row_audits" current_audit
      CROSS JOIN LATERAL jsonb_array_elements_text(
        current_audit."beforeImage"->'messageIds'
      ) current_source(message_id)
      WHERE current_audit."runId" = NEW.id
        AND current_audit."sourceType" = 'ARIA_MESSAGE_GROUP'
        AND current_source.message_id = candidate.id
    )
    OR (
      candidate."turnId" IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public."aria_data_migration_row_audits" prior_audit
        JOIN public."aria_data_migration_runs" prior_run
          ON prior_run.id = prior_audit."runId"
        CROSS JOIN LATERAL jsonb_array_elements_text(
          prior_audit."beforeImage"->'messageIds'
        ) prior_source(message_id)
        WHERE prior_audit."sourceType" = 'ARIA_MESSAGE_GROUP'
          AND prior_run.id <> NEW.id
          AND prior_run."migrationName" = 'aria-conversation-turns-v1'
          AND prior_run.mode = 'APPLY'::public."AriaDataMigrationMode"
          AND prior_run.status = 'COMPLETED'::public."AriaDataMigrationStatus"
          AND prior_source.message_id = candidate.id
      )
    );

  SELECT COUNT(DISTINCT current_source.message_id)::INTEGER
  INTO prior_source_overlap_total
  FROM public."aria_data_migration_row_audits" current_audit
  CROSS JOIN LATERAL jsonb_array_elements_text(
    current_audit."beforeImage"->'messageIds'
  ) current_source(message_id)
  WHERE current_audit."runId" = NEW.id
    AND current_audit."sourceType" = 'ARIA_MESSAGE_GROUP'
    AND EXISTS (
      SELECT 1
      FROM public."aria_data_migration_row_audits" prior_audit
      JOIN public."aria_data_migration_runs" prior_run
        ON prior_run.id = prior_audit."runId"
      CROSS JOIN LATERAL jsonb_array_elements_text(
        prior_audit."beforeImage"->'messageIds'
      ) prior_source(message_id)
      WHERE prior_audit."sourceType" = 'ARIA_MESSAGE_GROUP'
        AND prior_run.id <> NEW.id
        AND prior_run."migrationName" = 'aria-conversation-turns-v1'
        AND prior_run.mode = 'APPLY'::public."AriaDataMigrationMode"
        AND prior_run.status = 'COMPLETED'::public."AriaDataMigrationStatus"
        AND prior_source.message_id = current_source.message_id
    );

  SELECT COUNT(*)::INTEGER
  INTO run_target_total
  FROM public.aria_conversation_turns
  WHERE "migrationRunId" = NEW.id;

  IF NEW."sourceSnapshot"->>'target' IS DISTINCT FROM 'conversation-turns'
     OR NEW."sourceSnapshot"->>'plannerVersion' IS DISTINCT FROM '2'
     OR NEW."sourceSnapshot"->'report'->>'scanned' IS DISTINCT FROM NEW."scannedCount"::TEXT
     OR NEW."sourceSnapshot"->'report'->>'deterministic' IS DISTINCT FROM NEW."deterministicCount"::TEXT
     OR NEW."sourceSnapshot"->'report'->>'archived' IS DISTINCT FROM NEW."archivedCount"::TEXT
     OR NEW."sourceSnapshot"->'report'->>'manualReview' IS DISTINCT FROM NEW."manualReviewCount"::TEXT
     OR NEW."scannedCount" <> (2 * NEW."deterministicCount")
       + NEW."archivedCount" + NEW."manualReviewCount"
     OR NEW."mutatedCount" <> NEW."deterministicCount"
     OR audit_total <> NEW."deterministicCount" + NEW."archivedCount" + NEW."manualReviewCount"
     OR deterministic_total <> NEW."deterministicCount"
     OR archived_total <> NEW."archivedCount"
     OR manual_total <> NEW."manualReviewCount"
     OR expanded_total <> NEW."scannedCount"
     OR distinct_message_total <> expanded_total
     OR eligible_source_total <> expanded_total
     OR prior_source_overlap_total <> 0
     OR run_target_total <> NEW."deterministicCount"
     OR public."aria_turn_v2_run_matches_planner"(NEW.id) IS DISTINCT FROM TRUE
     OR invalid_total <> 0 THEN
    RAISE EXCEPTION 'conversation-turn APPLY terminal evidence does not match row audits';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER "aria_turn_apply_terminal_evidence"
BEFORE UPDATE OF status ON public."aria_data_migration_runs"
FOR EACH ROW
EXECUTE FUNCTION "aria_turn_apply_require_terminal_evidence"();
