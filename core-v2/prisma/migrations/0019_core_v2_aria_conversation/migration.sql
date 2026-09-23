-- Native Core v2 conversation foundation. No legacy tables or foreign keys.
CREATE TYPE "AriaConversationTurnStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'CANCELLED', 'ERROR');
CREATE TYPE "AriaConversationTurnUseCase" AS ENUM ('CONVERSATION');
CREATE TYPE "AriaVisibility" AS ENUM ('STUDENT_PRIVATE', 'COACH_VISIBLE', 'PARENT_VISIBLE', 'SYSTEM_ONLY');
CREATE TYPE "AriaConversationMessageRole" AS ENUM ('USER', 'ASSISTANT');

CREATE TABLE "aria_conversations_core_v2" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "courseKey" TEXT NOT NULL,
  "skillId" TEXT,
  "resourceId" TEXT,
  "contextVersion" TEXT NOT NULL DEFAULT 'core-v2',
  "title" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "aria_conversations_core_v2_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "aria_conversation_turns_core_v2" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "subjectStudentId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "cancellationRequestedByActorId" TEXT,
  "useCase" "AriaConversationTurnUseCase" NOT NULL,
  "clientRequestId" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "status" "AriaConversationTurnStatus" NOT NULL DEFAULT 'PENDING',
  "executionToken" TEXT,
  "heartbeatAt" TIMESTAMP(3),
  "leaseExpiresAt" TIMESTAMP(3),
  "cancellationRequestedAt" TIMESTAMP(3),
  "academicSnapshot" JSONB NOT NULL,
  "pedagogicalMode" TEXT NOT NULL,
  "agentRole" TEXT NOT NULL,
  "visibility" "AriaVisibility" NOT NULL DEFAULT 'STUDENT_PRIVATE',
  "retrievalPolicy" JSONB,
  "retrievalEvidence" JSONB,
  "ragStatus" TEXT,
  "policyVersion" TEXT,
  "promptVersion" TEXT,
  "modelPolicy" JSONB NOT NULL,
  "executionMetadata" JSONB,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "aria_conversation_turns_core_v2_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "aria_messages_core_v2" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "turnId" TEXT NOT NULL,
  "role" "AriaConversationMessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "aria_messages_core_v2_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "aria_message_citations_core_v2" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "sourceTitle" TEXT NOT NULL,
  "sourceDocument" TEXT NOT NULL,
  "sourceLocation" TEXT,
  "courseKey" TEXT NOT NULL,
  "provenance" TEXT NOT NULL,
  "url" TEXT,
  "resourceId" TEXT,
  "resourceVersionId" TEXT,
  "contentSha256" TEXT,
  "chunkId" TEXT,
  "locator" JSONB,
  "corpusId" TEXT,
  "corpusVersionId" TEXT,
  "manifestSha256" TEXT,
  CONSTRAINT "aria_message_citations_core_v2_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "aria_feedback_core_v2" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "useful" BOOLEAN NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "aria_feedback_core_v2_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "aria_conversations_core_v2_id_studentId_key" ON "aria_conversations_core_v2" ("id", "studentId");
CREATE UNIQUE INDEX "aria_conversation_turns_core_v2_id_conversationId_key" ON "aria_conversation_turns_core_v2" ("id", "conversationId");
CREATE UNIQUE INDEX "aria_conversation_turns_core_v2_actorUserId_subjectStudentI_key" ON "aria_conversation_turns_core_v2" ("actorUserId", "subjectStudentId", "useCase", "clientRequestId");
CREATE UNIQUE INDEX "aria_conversation_turns_core_v2_conversationId_sequence_key" ON "aria_conversation_turns_core_v2" ("conversationId", "sequence");
CREATE UNIQUE INDEX "aria_messages_core_v2_turnId_role_key" ON "aria_messages_core_v2" ("turnId", "role");
CREATE UNIQUE INDEX "aria_feedback_core_v2_messageId_studentId_key" ON "aria_feedback_core_v2" ("messageId", "studentId");
CREATE UNIQUE INDEX "aria_conversation_turns_core_v2_one_active_per_conversation" ON "aria_conversation_turns_core_v2" ("conversationId") WHERE "status" IN ('PENDING', 'RUNNING');
CREATE INDEX "aria_conversations_core_v2_studentId_updatedAt_idx" ON "aria_conversations_core_v2" ("studentId", "updatedAt");
CREATE INDEX "aria_conversations_core_v2_studentId_courseKey_updatedAt_idx" ON "aria_conversations_core_v2" ("studentId", "courseKey", "updatedAt");
CREATE INDEX "aria_conversation_turns_core_v2_conversationId_status_idx" ON "aria_conversation_turns_core_v2" ("conversationId", "status");
CREATE INDEX "aria_conversation_turns_core_v2_status_leaseExpiresAt_idx" ON "aria_conversation_turns_core_v2" ("status", "leaseExpiresAt");
CREATE INDEX "aria_conversation_turns_core_v2_subjectStudentId_createdAt_idx" ON "aria_conversation_turns_core_v2" ("subjectStudentId", "createdAt");
CREATE INDEX "aria_messages_core_v2_conversationId_createdAt_idx" ON "aria_messages_core_v2" ("conversationId", "createdAt");
CREATE INDEX "aria_feedback_core_v2_studentId_createdAt_idx" ON "aria_feedback_core_v2" ("studentId", "createdAt");
CREATE INDEX "aria_message_citations_core_v2_messageId_idx" ON "aria_message_citations_core_v2" ("messageId");

ALTER TABLE "aria_conversation_turns_core_v2"
  ADD CONSTRAINT "aria_conversation_turns_core_v2_sequence_check"
    CHECK ("sequence" > 0),
  ADD CONSTRAINT "aria_conversation_turns_core_v2_fingerprint_check"
    CHECK ("requestFingerprint" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "aria_conversation_turns_core_v2_snapshot_check"
    CHECK (jsonb_typeof("academicSnapshot") = 'object'),
  ADD CONSTRAINT "aria_conversation_turns_core_v2_cancellation_pair_check"
    CHECK (("cancellationRequestedAt" IS NULL) = ("cancellationRequestedByActorId" IS NULL)),
  ADD CONSTRAINT "aria_conversation_turns_core_v2_cancellation_actor_check"
    CHECK ("cancellationRequestedByActorId" IS NULL OR "cancellationRequestedByActorId" = "actorUserId"),
  ADD CONSTRAINT "aria_conversation_turns_core_v2_runtime_state_check"
    CHECK (
      ("status" = 'PENDING' AND "executionToken" IS NULL AND "heartbeatAt" IS NULL
        AND "leaseExpiresAt" IS NULL AND "startedAt" IS NULL AND "completedAt" IS NULL)
      OR
      ("status" = 'RUNNING' AND "executionToken" IS NOT NULL AND "heartbeatAt" IS NOT NULL
        AND "leaseExpiresAt" > "heartbeatAt" AND "startedAt" IS NOT NULL AND "completedAt" IS NULL)
      OR
      ("status" IN ('COMPLETED', 'CANCELLED', 'ERROR') AND "completedAt" IS NOT NULL)
    );

ALTER TABLE "aria_message_citations_core_v2"
  ADD CONSTRAINT "aria_message_citations_core_v2_identity_atomic_check"
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

CREATE OR REPLACE FUNCTION aria_core_v2_turn_status_transition_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."status" = OLD."status" THEN
    RETURN NEW;
  END IF;
  IF NOT (
    (OLD."status" = 'PENDING' AND NEW."status" IN ('RUNNING', 'CANCELLED', 'ERROR'))
    OR
    (OLD."status" = 'RUNNING' AND NEW."status" IN ('COMPLETED', 'CANCELLED', 'ERROR'))
  ) THEN
    RAISE EXCEPTION 'ARIA_CORE_V2_TURN_STATUS_TRANSITION_FORBIDDEN'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER aria_core_v2_turn_status_transition_guard
BEFORE UPDATE OF "status" ON "aria_conversation_turns_core_v2"
FOR EACH ROW EXECUTE FUNCTION aria_core_v2_turn_status_transition_guard();

ALTER TABLE "aria_conversations_core_v2" ADD CONSTRAINT "aria_conversations_core_v2_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "aria_conversation_turns_core_v2" ADD CONSTRAINT "aria_conversation_turns_core_v2_conversationId_subjectStud_fkey" FOREIGN KEY ("conversationId", "subjectStudentId") REFERENCES "aria_conversations_core_v2"("id", "studentId") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "students_v2_id_userId_key" ON "students_v2" ("id", "userId");
ALTER TABLE "aria_conversation_turns_core_v2" ADD CONSTRAINT "aria_conversation_turns_core_v2_subjectStudentId_actorUser_fkey" FOREIGN KEY ("subjectStudentId", "actorUserId") REFERENCES "students_v2"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "aria_conversation_turns_core_v2" ADD CONSTRAINT "aria_conversation_turns_core_v2_cancellationRequestedByAct_fkey" FOREIGN KEY ("cancellationRequestedByActorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "aria_messages_core_v2" ADD CONSTRAINT "aria_messages_core_v2_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "aria_conversations_core_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "aria_messages_core_v2" ADD CONSTRAINT "aria_messages_core_v2_turnId_conversationId_fkey" FOREIGN KEY ("turnId", "conversationId") REFERENCES "aria_conversation_turns_core_v2"("id", "conversationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "aria_message_citations_core_v2" ADD CONSTRAINT "aria_message_citations_core_v2_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "aria_messages_core_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "aria_feedback_core_v2" ADD CONSTRAINT "aria_feedback_core_v2_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "aria_messages_core_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "aria_feedback_core_v2" ADD CONSTRAINT "aria_feedback_core_v2_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
