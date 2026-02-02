-- AlterTable: Add unique constraint for payment idempotency
-- This prevents duplicate payments when webhooks are called multiple times
--
-- CRITICAL: Prevents duplicate payment processing (INV-PAY-1)
-- Context: lib/payments.ts:48 expects P2002 error for duplicate prevention
-- Risk without constraint: Payment webhooks can create duplicate payment records

-- Step 1: Verify no existing duplicates (defensive check)
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT "externalId", "method"
    FROM "payments"
    WHERE "externalId" IS NOT NULL
    GROUP BY "externalId", "method"
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Found % duplicate payment(s). Clean up duplicates before applying constraint.', duplicate_count;
  END IF;
END $$;

-- Step 2: Create unique partial index
-- Partial index only applies where externalId IS NOT NULL (allows multiple NULLs)
-- Note: CONCURRENTLY removed because Prisma runs migrations in transactions
CREATE UNIQUE INDEX "payments_externalId_method_key"
ON "payments" ("externalId", "method")
WHERE "externalId" IS NOT NULL;
