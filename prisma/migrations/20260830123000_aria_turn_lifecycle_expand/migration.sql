-- ARIA-B M1: additive conversation lifecycle, lineage and entitlement scopes.
-- This migration does not infer a course and does not remove any legacy column.

CREATE TYPE "AriaConversationContextState" AS ENUM ('ACTIVE', 'LEGACY_CONTEXT_UNRESOLVED');
CREATE TYPE "AriaConversationTurnStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'CANCELLED', 'ERROR');
CREATE TYPE "AriaConversationTurnUseCase" AS ENUM ('CONVERSATION', 'LEGACY_IMPORT');
CREATE TYPE "AriaConversationTurnMessageRole" AS ENUM ('USER', 'ASSISTANT');
CREATE TYPE "AriaVisibility" AS ENUM ('STUDENT_PRIVATE', 'COACH_VISIBLE', 'PARENT_VISIBLE', 'SYSTEM_ONLY');
CREATE TYPE "AriaEntitlementScopeKind" AS ENUM ('GLOBAL', 'COURSE');
CREATE TYPE "AriaDataMigrationMode" AS ENUM ('DRY_RUN', 'APPLY', 'VERIFY', 'ROLLBACK');
CREATE TYPE "AriaDataMigrationStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'ROLLED_BACK');
CREATE TYPE "AriaDataMigrationClassification" AS ENUM (
  'DETERMINISTIC_BACKFILL',
  'ARCHIVED_NON_RESUMABLE',
  'MANUAL_REVIEW_REQUIRED'
);

ALTER TYPE "CanonicalJobType" ADD VALUE IF NOT EXISTS 'RECOVER_ARIA_TURN';

CREATE TABLE "aria_data_migration_runs" (
  "id" TEXT NOT NULL,
  "migrationName" TEXT NOT NULL,
  "mode" "AriaDataMigrationMode" NOT NULL,
  "sourceSnapshot" JSONB NOT NULL,
  "sourceDigest" TEXT NOT NULL,
  "status" "AriaDataMigrationStatus" NOT NULL DEFAULT 'RUNNING',
  "scannedCount" INTEGER NOT NULL DEFAULT 0,
  "deterministicCount" INTEGER NOT NULL DEFAULT 0,
  "archivedCount" INTEGER NOT NULL DEFAULT 0,
  "manualReviewCount" INTEGER NOT NULL DEFAULT 0,
  "mutatedCount" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "aria_data_migration_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "aria_data_migration_runs_digest_check"
    CHECK ("sourceDigest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "aria_data_migration_runs_counts_check"
    CHECK (
      "scannedCount" >= 0 AND "deterministicCount" >= 0
      AND "archivedCount" >= 0 AND "manualReviewCount" >= 0
      AND "mutatedCount" >= 0
    )
);
CREATE UNIQUE INDEX "aria_data_migration_runs_name_digest_mode_key"
  ON "aria_data_migration_runs" ("migrationName", "sourceDigest", "mode");
CREATE INDEX "aria_data_migration_runs_name_status_idx"
  ON "aria_data_migration_runs" ("migrationName", "status");

CREATE TABLE "aria_data_migration_row_audits" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceFingerprint" TEXT NOT NULL,
  "classification" "AriaDataMigrationClassification" NOT NULL,
  "targetTable" TEXT,
  "targetId" TEXT,
  "targetKey" JSONB,
  "beforeImage" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "aria_data_migration_row_audits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "aria_data_migration_row_audits_fingerprint_check"
    CHECK ("sourceFingerprint" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "aria_data_migration_row_audits_before_image_check"
    CHECK (jsonb_typeof("beforeImage") = 'object'),
  CONSTRAINT "aria_data_migration_rows_before_image_allowlist_check"
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
    ),
  CONSTRAINT "aria_data_migration_row_audits_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "aria_data_migration_runs"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "aria_data_migration_row_audits_run_source_key"
  ON "aria_data_migration_row_audits" ("runId", "sourceType", "sourceId");
CREATE INDEX "aria_data_migration_row_audits_classification_idx"
  ON "aria_data_migration_row_audits" ("classification");

ALTER TABLE "aria_conversations"
  ADD COLUMN "contextState" "AriaConversationContextState",
  ADD COLUMN "contextMigrationRunId" TEXT;
UPDATE "aria_conversations"
SET "contextState" = 'LEGACY_CONTEXT_UNRESOLVED'::"AriaConversationContextState";
-- Validate NOT NULL via a NOT VALID check first: VALIDATE CONSTRAINT only takes
-- SHARE UPDATE EXCLUSIVE (concurrent reads/writes proceed), unlike a bare SET NOT
-- NULL, which holds ACCESS EXCLUSIVE for the whole scan on a pre-existing table.
ALTER TABLE "aria_conversations"
  ADD CONSTRAINT "aria_conversations_contextState_not_null_check"
  CHECK ("contextState" IS NOT NULL) NOT VALID;
ALTER TABLE "aria_conversations"
  VALIDATE CONSTRAINT "aria_conversations_contextState_not_null_check";
ALTER TABLE "aria_conversations"
  ALTER COLUMN "contextState" SET NOT NULL,
  ALTER COLUMN "contextState" SET DEFAULT 'ACTIVE';
ALTER TABLE "aria_conversations"
  DROP CONSTRAINT "aria_conversations_contextState_not_null_check";
ALTER TABLE "aria_conversations"
  ADD CONSTRAINT "aria_conversations_active_course_check"
  CHECK (
    ("contextState" = 'ACTIVE' AND "courseKey" IS NOT NULL)
    OR
    "contextState" = 'LEGACY_CONTEXT_UNRESOLVED'
  ),
  ADD CONSTRAINT "aria_conversations_contextMigrationRunId_fkey"
  FOREIGN KEY ("contextMigrationRunId") REFERENCES "aria_data_migration_runs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "aria_conversations_id_studentId_key"
  ON "aria_conversations" ("id", "studentId");
CREATE INDEX "aria_conversations_contextState_idx"
  ON "aria_conversations" ("contextState");
CREATE INDEX "aria_conversations_contextMigrationRunId_idx"
  ON "aria_conversations" ("contextMigrationRunId");

ALTER TABLE "aria_learning_profiles"
  ADD COLUMN "preferencesVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "pinnedCourseKeys" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "focusedCourseKey" TEXT,
  ADD COLUMN "courseOrder" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "showCitations" BOOLEAN NOT NULL DEFAULT true,
  ADD CONSTRAINT "aria_learning_profiles_preferences_version_check"
    CHECK ("preferencesVersion" = 1),
  ADD CONSTRAINT "aria_learning_profiles_preference_arrays_check"
    CHECK (
      jsonb_typeof("pinnedCourseKeys") = 'array'
      AND jsonb_typeof("courseOrder") = 'array'
    );

ALTER TABLE "aria_feedbacks"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "aria_message_citations"
  ADD COLUMN "resourceId" TEXT,
  ADD COLUMN "resourceVersionId" TEXT,
  ADD COLUMN "contentSha256" TEXT,
  ADD COLUMN "chunkId" TEXT,
  ADD COLUMN "locator" JSONB,
  ADD COLUMN "corpusId" TEXT,
  ADD COLUMN "corpusVersionId" TEXT,
  ADD COLUMN "manifestSha256" TEXT,
  ADD CONSTRAINT "aria_message_citations_identity_atomic_check"
  CHECK (
    (
      "resourceId" IS NULL AND "resourceVersionId" IS NULL
      AND "contentSha256" IS NULL AND "chunkId" IS NULL
      AND "locator" IS NULL AND "corpusId" IS NULL
      AND "corpusVersionId" IS NULL AND "manifestSha256" IS NULL
    )
    OR
    (
      "resourceId" IS NOT NULL AND "resourceVersionId" IS NOT NULL
      AND "contentSha256" ~ '^[0-9a-f]{64}$' AND "chunkId" IS NOT NULL
      AND jsonb_typeof("locator") = 'object' AND "corpusId" IS NOT NULL
      AND "corpusVersionId" IS NOT NULL AND "manifestSha256" ~ '^[0-9a-f]{64}$'
    )
  );

ALTER TABLE "entitlements" ADD COLUMN "sourceSubscriptionId" TEXT;
CREATE UNIQUE INDEX "entitlements_sourceSubscriptionId_key"
  ON "entitlements" ("sourceSubscriptionId");
ALTER TABLE "entitlements"
  ADD CONSTRAINT "entitlements_sourceSubscriptionId_fkey"
  FOREIGN KEY ("sourceSubscriptionId") REFERENCES "subscriptions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "aria_entitlement_scopes" (
  "id" TEXT NOT NULL,
  "entitlementId" TEXT NOT NULL,
  "kind" "AriaEntitlementScopeKind" NOT NULL,
  "courseKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "aria_entitlement_scopes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "aria_entitlement_scopes_kind_course_check"
  CHECK (
    ("kind" = 'GLOBAL' AND "courseKey" IS NULL)
    OR
    ("kind" = 'COURSE' AND "courseKey" IS NOT NULL AND length("courseKey") > 0)
  ),
  CONSTRAINT "aria_entitlement_scopes_entitlementId_fkey"
  FOREIGN KEY ("entitlementId") REFERENCES "entitlements"("id")
  ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "aria_entitlement_scopes_global_key"
  ON "aria_entitlement_scopes" ("entitlementId") WHERE "kind" = 'GLOBAL';
CREATE UNIQUE INDEX "aria_entitlement_scopes_course_key"
  ON "aria_entitlement_scopes" ("entitlementId", "courseKey") WHERE "kind" = 'COURSE';
CREATE INDEX "aria_entitlement_scopes_kind_course_idx"
  ON "aria_entitlement_scopes" ("kind", "courseKey");

CREATE TABLE "aria_conversation_turns" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "subjectStudentId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "useCase" "AriaConversationTurnUseCase" NOT NULL,
  "clientRequestId" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "status" "AriaConversationTurnStatus" NOT NULL DEFAULT 'PENDING',
  "executionToken" TEXT,
  "heartbeatAt" TIMESTAMP(3),
  "leaseExpiresAt" TIMESTAMP(3),
  "cancellationRequestedAt" TIMESTAMP(3),
  "cancellationRequestedByActorId" TEXT,
  "academicSnapshot" JSONB NOT NULL,
  "pedagogicalMode" TEXT NOT NULL DEFAULT 'DISCOVERY',
  "agentRole" TEXT NOT NULL DEFAULT 'TUTOR',
  "visibility" "AriaVisibility" NOT NULL DEFAULT 'STUDENT_PRIVATE',
  "retrievalPolicy" JSONB,
  "retrievalEvidence" JSONB,
  "ragStatus" TEXT,
  "policyVersion" TEXT,
  "promptVersion" TEXT,
  "modelPolicy" JSONB,
  "executionMetadata" JSONB,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "migrationRunId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "aria_conversation_turns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "aria_conversation_turns_sequence_check" CHECK ("sequence" > 0),
  CONSTRAINT "aria_conversation_turns_fingerprint_check"
    CHECK ("requestFingerprint" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "aria_conversation_turns_academic_snapshot_check"
    CHECK (jsonb_typeof("academicSnapshot") = 'object'),
  CONSTRAINT "aria_conversation_turns_cancellation_pair_check"
    CHECK (
      ("cancellationRequestedAt" IS NULL AND "cancellationRequestedByActorId" IS NULL)
      OR
      ("cancellationRequestedAt" IS NOT NULL AND "cancellationRequestedByActorId" IS NOT NULL)
    ),
  CONSTRAINT "aria_conversation_turns_runtime_state_check"
    CHECK (
      (
        "useCase" = 'LEGACY_IMPORT'
        AND "status" IN ('COMPLETED', 'CANCELLED', 'ERROR')
        AND "completedAt" IS NOT NULL
      )
      OR
      (
        "useCase" = 'CONVERSATION'
        AND (
          (
            "status" = 'PENDING' AND "executionToken" IS NULL
            AND "heartbeatAt" IS NULL AND "leaseExpiresAt" IS NULL
            AND "startedAt" IS NULL AND "completedAt" IS NULL
          )
          OR
          (
            "status" = 'RUNNING' AND "executionToken" IS NOT NULL
            AND "heartbeatAt" IS NOT NULL AND "leaseExpiresAt" > "heartbeatAt"
            AND "startedAt" IS NOT NULL AND "completedAt" IS NULL
          )
          OR
          ("status" IN ('COMPLETED', 'CANCELLED', 'ERROR') AND "completedAt" IS NOT NULL)
        )
      )
    ),
  CONSTRAINT "aria_conversation_turns_conversation_subject_fkey"
    FOREIGN KEY ("conversationId", "subjectStudentId")
    REFERENCES "aria_conversations"("id", "studentId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "aria_conversation_turns_subjectStudentId_fkey"
    FOREIGN KEY ("subjectStudentId") REFERENCES "students"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "aria_conversation_turns_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "aria_conversation_turns_cancellationActor_fkey"
    FOREIGN KEY ("cancellationRequestedByActorId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "aria_conversation_turns_migrationRunId_fkey"
    FOREIGN KEY ("migrationRunId") REFERENCES "aria_data_migration_runs"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "aria_conversation_turns_id_conversationId_key"
  ON "aria_conversation_turns" ("id", "conversationId");
CREATE UNIQUE INDEX "aria_conversation_turns_actor_subject_use_case_client_request_key"
  ON "aria_conversation_turns" ("actorUserId", "subjectStudentId", "useCase", "clientRequestId");
CREATE UNIQUE INDEX "aria_conversation_turns_conversation_sequence_key"
  ON "aria_conversation_turns" ("conversationId", "sequence");
CREATE UNIQUE INDEX "aria_conversation_turns_one_active_per_conversation"
  ON "aria_conversation_turns" ("conversationId")
  WHERE "status" IN ('PENDING', 'RUNNING');
CREATE INDEX "aria_conversation_turns_conversation_status_idx"
  ON "aria_conversation_turns" ("conversationId", "status");
CREATE INDEX "aria_conversation_turns_status_lease_idx"
  ON "aria_conversation_turns" ("status", "leaseExpiresAt");
CREATE INDEX "aria_conversation_turns_migrationRunId_idx"
  ON "aria_conversation_turns" ("migrationRunId");

CREATE OR REPLACE FUNCTION aria_turn_active_context_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  conversation_state "AriaConversationContextState";
BEGIN
  IF NEW."useCase" = 'CONVERSATION' THEN
    SELECT "contextState" INTO conversation_state
    FROM "aria_conversations" WHERE id = NEW."conversationId";
    IF conversation_state IS DISTINCT FROM 'ACTIVE' THEN
      RAISE EXCEPTION 'ARIA_TURN_REQUIRES_ACTIVE_COURSE_CONTEXT'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER aria_turn_active_context_guard
BEFORE INSERT OR UPDATE OF "conversationId", "useCase"
ON "aria_conversation_turns"
FOR EACH ROW EXECUTE FUNCTION aria_turn_active_context_guard();

CREATE OR REPLACE FUNCTION aria_turn_status_transition_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  IF NOT (
    (OLD.status = 'PENDING' AND NEW.status IN ('RUNNING', 'CANCELLED', 'ERROR'))
    OR
    (OLD.status = 'RUNNING' AND NEW.status IN ('COMPLETED', 'CANCELLED', 'ERROR'))
  ) THEN
    RAISE EXCEPTION 'ARIA_TURN_STATUS_TRANSITION_FORBIDDEN'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER aria_turn_status_transition_guard
BEFORE UPDATE OF status ON "aria_conversation_turns"
FOR EACH ROW EXECUTE FUNCTION aria_turn_status_transition_guard();

ALTER TABLE "aria_messages"
  ADD COLUMN "turnId" TEXT,
  ADD COLUMN "turnRole" "AriaConversationTurnMessageRole",
  ADD CONSTRAINT "aria_messages_turn_pair_check"
  CHECK (("turnId" IS NULL) = ("turnRole" IS NULL)),
  ADD CONSTRAINT "aria_messages_turn_role_semantics_check"
  CHECK (
    "turnRole" IS NULL
    OR ("turnRole" = 'USER' AND role = 'user')
    OR ("turnRole" = 'ASSISTANT' AND role = 'assistant')
  ),
  ADD CONSTRAINT "aria_messages_turn_conversation_fkey"
  FOREIGN KEY ("turnId", "conversationId")
  REFERENCES "aria_conversation_turns"("id", "conversationId")
  ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "aria_messages_turnId_turnRole_key"
  ON "aria_messages" ("turnId", "turnRole");
CREATE INDEX "aria_messages_turnId_idx" ON "aria_messages" ("turnId");

CREATE OR REPLACE FUNCTION aria_turn_expected_legacy_message_status(
  turn_status "AriaConversationTurnStatus"
) RETURNS TEXT LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT CASE turn_status
    WHEN 'PENDING' THEN 'PENDING'
    WHEN 'RUNNING' THEN 'STREAMING'
    WHEN 'COMPLETED' THEN 'COMPLETED'
    WHEN 'CANCELLED' THEN 'CANCELLED'
    WHEN 'ERROR' THEN 'ERROR'
  END
$$;

CREATE OR REPLACE FUNCTION aria_turn_message_status_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  turn_status "AriaConversationTurnStatus";
  expected_status TEXT;
BEGIN
  IF NEW."turnId" IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT status INTO STRICT turn_status
  FROM "aria_conversation_turns" WHERE id = NEW."turnId";

  IF NEW."turnRole" = 'USER' AND NEW.status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'ARIA_USER_MESSAGE_STATUS_MUST_BE_COMPLETED'
      USING ERRCODE = '23514';
  END IF;
  IF NEW."turnRole" = 'ASSISTANT' THEN
    expected_status := aria_turn_expected_legacy_message_status(turn_status);
    IF NEW.status <> expected_status THEN
      RAISE EXCEPTION 'ARIA_ASSISTANT_MESSAGE_STATUS_IS_DERIVED'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER aria_turn_message_status_guard
BEFORE INSERT OR UPDATE OF status, "turnId", "turnRole"
ON "aria_messages"
FOR EACH ROW EXECUTE FUNCTION aria_turn_message_status_guard();

CREATE OR REPLACE FUNCTION aria_turn_status_projection()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE "aria_messages"
    SET status = aria_turn_expected_legacy_message_status(NEW.status)
    WHERE "turnId" = NEW.id
      AND "turnRole" = 'ASSISTANT';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER aria_turn_status_projection
AFTER UPDATE OF status ON "aria_conversation_turns"
FOR EACH ROW EXECUTE FUNCTION aria_turn_status_projection();
