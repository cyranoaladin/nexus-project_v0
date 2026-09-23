-- Native Core v2 conversation foundation. No legacy tables or foreign keys.
CREATE TYPE "AriaConversationContextState" AS ENUM ('ACTIVE', 'LEGACY_CONTEXT_UNRESOLVED');
CREATE TYPE "AriaConversationTurnStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'CANCELLED', 'ERROR');
CREATE TYPE "AriaConversationTurnUseCase" AS ENUM ('CONVERSATION');
CREATE TYPE "AriaVisibility" AS ENUM ('STUDENT_PRIVATE', 'COACH_VISIBLE', 'PARENT_VISIBLE', 'SYSTEM_ONLY');
CREATE TYPE "AriaConversationMessageRole" AS ENUM ('USER', 'ASSISTANT');
CREATE TYPE "AriaConversationTurnMessageRole" AS ENUM ('USER', 'ASSISTANT');

CREATE TABLE "aria_conversations_core_v2" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "courseKey" TEXT NOT NULL,
  "skillId" TEXT,
  "resourceId" TEXT,
  "contextVersion" TEXT NOT NULL DEFAULT 'core-v2',
  "contextState" "AriaConversationContextState" NOT NULL DEFAULT 'ACTIVE',
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
  "turnId" TEXT,
  "role" "AriaConversationMessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "metadata" JSONB,
  "turnRole" "AriaConversationTurnMessageRole",
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
  CONSTRAINT "aria_feedback_core_v2_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "aria_conversation_turns_core_v2_idempotency_key" ON "aria_conversation_turns_core_v2" ("actorUserId", "subjectStudentId", "useCase", "clientRequestId");
CREATE UNIQUE INDEX "aria_conversation_turns_core_v2_sequence_key" ON "aria_conversation_turns_core_v2" ("conversationId", "sequence");
CREATE UNIQUE INDEX "aria_messages_core_v2_turn_role_key" ON "aria_messages_core_v2" ("turnId", "turnRole");
CREATE UNIQUE INDEX "aria_feedback_core_v2_message_student_key" ON "aria_feedback_core_v2" ("messageId", "studentId");
CREATE INDEX "aria_conversations_core_v2_student_updated_idx" ON "aria_conversations_core_v2" ("studentId", "updatedAt");
CREATE INDEX "aria_conversations_core_v2_student_course_updated_idx" ON "aria_conversations_core_v2" ("studentId", "courseKey", "updatedAt");
CREATE INDEX "aria_conversation_turns_core_v2_conversation_status_idx" ON "aria_conversation_turns_core_v2" ("conversationId", "status");
CREATE INDEX "aria_conversation_turns_core_v2_status_lease_idx" ON "aria_conversation_turns_core_v2" ("status", "leaseExpiresAt");
CREATE INDEX "aria_conversation_turns_core_v2_subject_created_idx" ON "aria_conversation_turns_core_v2" ("subjectStudentId", "createdAt");
CREATE INDEX "aria_messages_core_v2_conversation_created_idx" ON "aria_messages_core_v2" ("conversationId", "createdAt");
CREATE INDEX "aria_feedback_core_v2_student_created_idx" ON "aria_feedback_core_v2" ("studentId", "createdAt");
CREATE INDEX "aria_message_citations_core_v2_message_idx" ON "aria_message_citations_core_v2" ("messageId");

ALTER TABLE "aria_conversations_core_v2" ADD CONSTRAINT "aria_conversations_core_v2_student_fkey" FOREIGN KEY ("studentId") REFERENCES "students_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "aria_conversation_turns_core_v2" ADD CONSTRAINT "aria_conversation_turns_core_v2_conversation_fkey" FOREIGN KEY ("conversationId") REFERENCES "aria_conversations_core_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "aria_conversation_turns_core_v2" ADD CONSTRAINT "aria_conversation_turns_core_v2_subject_fkey" FOREIGN KEY ("subjectStudentId") REFERENCES "students_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "aria_conversation_turns_core_v2" ADD CONSTRAINT "aria_conversation_turns_core_v2_actor_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "aria_messages_core_v2" ADD CONSTRAINT "aria_messages_core_v2_conversation_fkey" FOREIGN KEY ("conversationId") REFERENCES "aria_conversations_core_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "aria_messages_core_v2" ADD CONSTRAINT "aria_messages_core_v2_turn_fkey" FOREIGN KEY ("turnId") REFERENCES "aria_conversation_turns_core_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "aria_message_citations_core_v2" ADD CONSTRAINT "aria_message_citations_core_v2_message_fkey" FOREIGN KEY ("messageId") REFERENCES "aria_messages_core_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "aria_feedback_core_v2" ADD CONSTRAINT "aria_feedback_core_v2_message_fkey" FOREIGN KEY ("messageId") REFERENCES "aria_messages_core_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "aria_feedback_core_v2" ADD CONSTRAINT "aria_feedback_core_v2_student_fkey" FOREIGN KEY ("studentId") REFERENCES "students_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
