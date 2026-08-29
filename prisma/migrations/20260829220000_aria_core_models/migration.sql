-- AlterTable aria_conversations: add courseKey, skillId, resourceId, contextVersion, make subject nullable
ALTER TABLE "aria_conversations" ADD COLUMN IF NOT EXISTS "courseKey" TEXT;
ALTER TABLE "aria_conversations" ADD COLUMN IF NOT EXISTS "skillId" TEXT;
ALTER TABLE "aria_conversations" ADD COLUMN IF NOT EXISTS "resourceId" TEXT;
ALTER TABLE "aria_conversations" ADD COLUMN IF NOT EXISTS "contextVersion" TEXT DEFAULT 'v1';
ALTER TABLE "aria_conversations" ALTER COLUMN "subject" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "aria_conversations_studentId_courseKey_idx" ON "aria_conversations"("studentId", "courseKey");

-- AlterTable aria_messages: add status, metadata
ALTER TABLE "aria_messages" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'COMPLETED';
ALTER TABLE "aria_messages" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- CreateTable aria_learning_profiles
CREATE TABLE IF NOT EXISTS "aria_learning_profiles" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "selectedCourseKeys" JSONB NOT NULL DEFAULT '[]',
    "uiPreferences" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aria_learning_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "aria_learning_profiles_studentId_key" ON "aria_learning_profiles"("studentId");
ALTER TABLE "aria_learning_profiles" ADD CONSTRAINT "aria_learning_profiles_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable aria_message_citations
CREATE TABLE IF NOT EXISTS "aria_message_citations" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "sourceTitle" TEXT NOT NULL,
    "sourceDocument" TEXT NOT NULL,
    "sourceLocation" TEXT,
    "courseKey" TEXT NOT NULL,
    "provenance" TEXT NOT NULL,
    "url" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aria_message_citations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "aria_message_citations_messageId_idx" ON "aria_message_citations"("messageId");
ALTER TABLE "aria_message_citations" ADD CONSTRAINT "aria_message_citations_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "aria_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable aria_feedbacks
CREATE TABLE IF NOT EXISTS "aria_feedbacks" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "useful" BOOLEAN NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aria_feedbacks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "aria_feedbacks_messageId_studentId_key" ON "aria_feedbacks"("messageId", "studentId");
ALTER TABLE "aria_feedbacks" ADD CONSTRAINT "aria_feedbacks_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "aria_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "aria_feedbacks" ADD CONSTRAINT "aria_feedbacks_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
