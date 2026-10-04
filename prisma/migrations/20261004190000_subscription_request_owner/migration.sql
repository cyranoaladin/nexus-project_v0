-- Unknown historical ownership remains NULL; no email/name backfill.
ALTER TABLE "subscription_requests" ADD COLUMN "requestedByUserId" TEXT;
ALTER TABLE "subscription_requests" ADD CONSTRAINT "subscription_requests_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "subscription_requests_studentId_requestedByUserId_createdAt_idx"
  ON "subscription_requests"("studentId", "requestedByUserId", "createdAt");
