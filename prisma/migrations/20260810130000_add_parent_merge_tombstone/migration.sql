-- Preserve the source account and its historical references when a paper-entry
-- household is attached to an existing parent account.
ALTER TABLE "users"
  ADD COLUMN "mergedIntoUserId" TEXT,
  ADD COLUMN "mergedAt" TIMESTAMP(3);

CREATE INDEX "users_mergedIntoUserId_idx" ON "users"("mergedIntoUserId");

ALTER TABLE "users"
  ADD CONSTRAINT "users_mergedIntoUserId_fkey"
  FOREIGN KEY ("mergedIntoUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
