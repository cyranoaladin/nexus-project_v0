-- CreateEnum
CREATE TYPE "public"."CronExecutionStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- DropForeignKey
ALTER TABLE "public"."messages" DROP CONSTRAINT "messages_receiverId_fkey";

-- DropForeignKey
ALTER TABLE "public"."messages" DROP CONSTRAINT "messages_senderId_fkey";

-- DropForeignKey
ALTER TABLE "public"."sessions" DROP CONSTRAINT "sessions_coachId_fkey";

-- DropForeignKey
ALTER TABLE "public"."student_reports" DROP CONSTRAINT "student_reports_coachId_fkey";

-- AlterTable
ALTER TABLE "public"."cron_executions" ALTER COLUMN "id" DROP DEFAULT,
DROP COLUMN "status",
ADD COLUMN     "status" "public"."CronExecutionStatus" NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."messages" ALTER COLUMN "senderId" DROP NOT NULL,
ALTER COLUMN "receiverId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."sessions" ALTER COLUMN "coachId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."student_reports" ALTER COLUMN "coachId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "aria_conversations_studentId_updatedAt_idx" ON "public"."aria_conversations"("studentId", "updatedAt");

-- CreateIndex
CREATE INDEX "aria_messages_conversationId_createdAt_idx" ON "public"."aria_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "credit_transactions_studentId_createdAt_idx" ON "public"."credit_transactions"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "credit_transactions_sessionId_idx" ON "public"."credit_transactions"("sessionId");

-- CreateIndex
CREATE INDEX "cron_executions_status_idx" ON "public"."cron_executions"("status");

-- CreateIndex
CREATE INDEX "notifications_userId_read_idx" ON "public"."notifications"("userId", "read");

-- CreateIndex
CREATE INDEX "notifications_userRole_idx" ON "public"."notifications"("userRole");

-- CreateIndex (skip if already exists from payment_idempotency migration)
-- DROP INDEX IF EXISTS "public"."payments_externalId_method_key";
-- CREATE UNIQUE INDEX "payments_externalId_method_key" ON "public"."payments"("externalId", "method");

-- CreateIndex
CREATE INDEX "sessions_studentId_idx" ON "public"."sessions"("studentId");

-- CreateIndex
CREATE INDEX "sessions_coachId_idx" ON "public"."sessions"("coachId");

-- CreateIndex
CREATE INDEX "sessions_status_idx" ON "public"."sessions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_studentId_status_idx" ON "public"."subscriptions"("studentId", "status");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "public"."users"("role");

-- AddForeignKey
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "public"."coach_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."student_reports" ADD CONSTRAINT "student_reports_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "public"."coach_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "public"."cron_executions_job_key" RENAME TO "cron_executions_jobName_executionKey_key";

