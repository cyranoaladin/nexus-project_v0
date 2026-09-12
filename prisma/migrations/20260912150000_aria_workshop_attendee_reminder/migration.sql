-- AlterTable
ALTER TABLE "aria_workshop_attendees" ADD COLUMN "reminderQueuedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "aria_workshop_attendees_status_reminderQueuedAt_idx" ON "aria_workshop_attendees"("status", "reminderQueuedAt");
