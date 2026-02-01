-- AlterTable: Add unique constraints for credit transaction idempotency
-- This prevents duplicate debits and refunds for the same session
--
-- HIGH PRIORITY: Prevents double debit/refund (INV-CRE-1, INV-CRE-2)
-- Context: No DB-level protection against duplicate credit operations
-- Risk without constraints: Financial integrity issues - double charges or double refunds

-- Step 1: Verify no existing duplicates for USAGE transactions
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT "sessionId", "type"
    FROM "credit_transactions"
    WHERE "sessionId" IS NOT NULL AND type = 'USAGE'
    GROUP BY "sessionId", "type"
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Found % duplicate USAGE transaction(s). Clean up duplicates before applying constraint.', duplicate_count;
  END IF;
END $$;

-- Step 2: Verify no existing duplicates for REFUND transactions
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT "sessionId", "type"
    FROM "credit_transactions"
    WHERE "sessionId" IS NOT NULL AND type = 'REFUND'
    GROUP BY "sessionId", "type"
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Found % duplicate REFUND transaction(s). Clean up duplicates before applying constraint.', duplicate_count;
  END IF;
END $$;

-- Step 3: Create partial unique index for USAGE transactions
-- Ensures only one USAGE transaction per session
CREATE UNIQUE INDEX "credit_transactions_session_usage_key"
ON "credit_transactions" ("sessionId", "type")
WHERE "sessionId" IS NOT NULL AND type = 'USAGE';

-- Step 4: Create partial unique index for REFUND transactions
-- Ensures only one REFUND transaction per session
CREATE UNIQUE INDEX "credit_transactions_session_refund_key"
ON "credit_transactions" ("sessionId", "type")
WHERE "sessionId" IS NOT NULL AND type = 'REFUND';
