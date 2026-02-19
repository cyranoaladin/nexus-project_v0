-- Add unique constraints to make skipDuplicates meaningful on post-commit side-effects.
-- Migration is idempotent: dedup first (keep newest), then CREATE INDEX IF NOT EXISTS.
--
-- Pre-deploy verification (run on staging first):
--   SELECT "sessionId","userId",type,method, COUNT(*) AS c
--   FROM "SessionNotification"
--   GROUP BY "sessionId","userId",type,method HAVING COUNT(*)>1;
--
--   SELECT "sessionId","reminderType", COUNT(*) AS c
--   FROM "SessionReminder"
--   GROUP BY "sessionId","reminderType" HAVING COUNT(*)>1;
--
-- All 4 key columns are NOT NULL (verified in DB schema).
-- No COALESCE workaround needed.

-- Step 1: Deduplicate SessionNotification (keep newest per key)
DELETE FROM "SessionNotification"
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY "sessionId", "userId", type, method
             ORDER BY "createdAt" DESC
           ) AS rn
    FROM "SessionNotification"
  ) ranked
  WHERE rn > 1
);

-- Step 2: Deduplicate SessionReminder (keep newest per key)
DELETE FROM "SessionReminder"
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY "sessionId", "reminderType"
             ORDER BY "createdAt" DESC
           ) AS rn
    FROM "SessionReminder"
  ) ranked
  WHERE rn > 1
);

-- Step 3: Create unique indexes (IF NOT EXISTS for idempotency)
CREATE UNIQUE INDEX IF NOT EXISTS "SessionNotification_sessionId_userId_type_method_key"
ON "SessionNotification"("sessionId", "userId", "type", "method");

CREATE UNIQUE INDEX IF NOT EXISTS "SessionReminder_sessionId_reminderType_key"
ON "SessionReminder"("sessionId", "reminderType");
