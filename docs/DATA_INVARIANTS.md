# Data Invariants - Nexus Réussite

This document describes the critical data invariants enforced at the database and application level to ensure data integrity, prevent race conditions, and maintain financial accuracy.

## Table of Contents

- [Payment Invariants](#payment-invariants)
- [Session Booking Invariants](#session-booking-invariants)
- [Credit Transaction Invariants](#credit-transaction-invariants)
- [Cron Job Invariants](#cron-job-invariants)
- [Transaction Patterns](#transaction-patterns)
- [Testing Invariants](#testing-invariants)
- [Monitoring](#monitoring)

---

## Payment Invariants

### INV-PAY-1: Payment Idempotency

**What:** Each external payment transaction (identified by `externalId` + `method`) can only be recorded once in the database.

**Why:** Payment provider webhooks may be called multiple times for the same transaction (network retries, webhook replays). Without idempotency, we would create duplicate payment records, leading to:
- Double credit allocation
- Incorrect financial reporting
- Reconciliation issues

**Enforcement:**

1. **Database Constraint:**
   - Unique partial index: `payments_externalId_method_key` on `(externalId, method)` WHERE `externalId IS NOT NULL`
   - Migration: `20260201201047_add_payment_idempotency`
   - Allows multiple NULL `externalId` (for manual payments)

2. **Application Logic:**
   - `lib/payments.ts:upsertPaymentByExternalId()` uses idempotent upsert pattern
   - Fast-path check: Query for existing payment first
   - Catch P2002 error on race condition
   - Returns `{ payment, created: boolean }` to indicate if payment was created or found

3. **Tests:**
   - `__tests__/concurrency/payment-idempotency.test.ts`
   - Verifies concurrent webhook calls create only one payment
   - Tests that same `externalId` with different `method` is allowed

**Example Violation:**
```typescript
// ❌ BAD: Direct create without idempotency check
await prisma.payment.create({ data: { externalId: 'konnect_123', ... }});

// ✅ GOOD: Use upsert pattern
const { payment, created } = await upsertPaymentByExternalId({ externalId: 'konnect_123', ... });
```

---

### INV-PAY-2: Payment Validation Atomicity

**What:** When a payment is validated (approved), three operations must succeed or fail together:
1. Payment status update to `COMPLETED`
2. Subscription activation (deactivate old, activate new)
3. Initial credit allocation

**Why:** Without atomic transaction, crash between operations leads to inconsistent state:
- Payment marked completed but customer gets no credits → financial loss for customer
- Credits allocated but payment still pending → free credits
- Subscription activated but payment failed → unauthorized service access

**Enforcement:**

1. **Database:** PostgreSQL transaction with Serializable isolation

2. **Application Logic:**
   - `app/api/payments/validate/route.ts` wraps approve flow in `prisma.$transaction()`
   - Isolation level: `Serializable`
   - Timeout: 10 seconds
   - Error handling: P2034 (serialization failure) returns 409 Conflict

3. **Tests:**
   - `__tests__/transactions/payment-validation-rollback.test.ts`
   - Verifies payment status rolls back if subscription activation fails
   - Verifies no orphaned credit transactions if payment update fails

**Example Implementation:**
```typescript
await prisma.$transaction(async (tx) => {
  await tx.payment.update({ status: 'COMPLETED' });
  await tx.subscription.updateMany({ status: 'ACTIVE' });
  await tx.creditTransaction.create({ amount: creditsPerMonth });
}, {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  timeout: 10000
});
```

---

## Session Booking Invariants

### INV-SES-1: No Exact Duplicate Bookings

**What:** The same session booking cannot be created twice (same coach, student, date, time, and status).

**Why:** Race conditions in booking flow could allow duplicate bookings if two concurrent requests pass validation checks. This leads to:
- Double credit debits for one session
- Confusion in session management
- Data integrity issues

**Enforcement:**

1. **Database Constraint:**
   - GiST exclusion constraint: `SessionBooking_no_overlap_excl`
   - Prevents overlapping time ranges for same coach + date
   - Only applies to active statuses: SCHEDULED, CONFIRMED, IN_PROGRESS

2. **Application Logic:**
   - `app/api/sessions/book/route.ts` uses Serializable transaction
   - Error handling: 23P01 (exclusion constraint violation) returns 409 Conflict

3. **Tests:**
   - `__tests__/concurrency/double-booking.test.ts`
   - Verifies concurrent identical booking requests create only one booking

---

### INV-SES-2: No Overlapping Sessions

**What:** A coach cannot have two active sessions with overlapping time ranges on the same date.

**Why:** Double-booking a coach creates operational chaos:
- Coach cannot attend both sessions
- Poor customer experience
- Credibility damage

**Enforcement:**

1. **Database Constraint:**
   - PostgreSQL GiST exclusion constraint using `btree_gist` extension
   - Constraint: `EXCLUDE USING gist (coachId WITH =, scheduledDate WITH =, time_range WITH &&)`
   - Uses immutable function `session_time_to_timestamp()` to convert string times to timestamp range
   - Partial constraint: Only active sessions (WHERE status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'))

2. **Application Logic:**
   - Constraint enforced at database level (application-level checks are defense-in-depth)
   - Error code 23P01 mapped to HTTP 409 Conflict

3. **Tests:**
   - `__tests__/concurrency/double-booking.test.ts`
   - Tests various overlap scenarios:
     - Partial overlap (14:00-15:00 vs 14:30-15:30)
     - Complete containment (14:00-15:00 vs 13:00-16:00)
     - Adjacent non-overlapping (14:00-15:00 vs 15:00-16:00 allowed)
   - Verifies cancelled sessions don't block new bookings

**Example:**
```sql
-- This constraint prevents overlaps:
ALTER TABLE "SessionBooking"
ADD CONSTRAINT "SessionBooking_no_overlap_excl"
EXCLUDE USING gist (
  "coachId" WITH =,
  "scheduledDate" WITH =,
  tsrange(
    session_time_to_timestamp("scheduledDate"::DATE, "startTime"),
    session_time_to_timestamp("scheduledDate"::DATE, "endTime")
  ) WITH &&
)
WHERE (status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'));
```

---

### INV-SES-3: Session Booking Serializability

**What:** Session booking transaction uses Serializable isolation level to prevent phantom reads and race conditions.

**Why:** With lower isolation (READ COMMITTED), two concurrent booking requests could both:
1. Check coach availability → both see "available"
2. Check no conflicting sessions → both see "no conflicts"
3. Create booking → both succeed before exclusion constraint is checked
4. One fails with constraint violation after credits already debited

**Enforcement:**

1. **Application Logic:**
   - Transaction isolation: `Serializable`
   - Timeout: 15 seconds
   - Handles P2034 serialization failures gracefully with 409 response

2. **Tests:**
   - `__tests__/concurrency/double-booking.test.ts`
   - Concurrent overlapping requests scenario

**Example:**
```typescript
await prisma.$transaction(async (tx) => {
  const availability = await tx.coachAvailability.findFirst({ ... });
  if (!availability) throw new Error('Not available');

  const conflict = await tx.sessionBooking.findFirst({ overlapping ... });
  if (conflict) throw new Error('Conflict');

  await tx.sessionBooking.create({ ... });
  await tx.creditTransaction.create({ type: 'USAGE', ... });
}, {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  timeout: 15000
});
```

---

## Credit Transaction Invariants

### INV-CRE-1: One Debit Per Session

**What:** Each session can have at most one USAGE (debit) credit transaction.

**Why:** Without this constraint, concurrent booking confirmations or retries could create multiple debit transactions for the same session, leading to:
- Customer charged multiple times for one session
- Negative credit balances
- Financial discrepancies

**Enforcement:**

1. **Database Constraint:**
   - Partial unique index: `credit_transactions_session_usage_key` on `(sessionId, type)` WHERE `sessionId IS NOT NULL AND type = 'USAGE'`
   - Migration: `20260201201534_add_credit_transaction_idempotency`

2. **Application Logic:**
   - Session booking endpoint creates USAGE transaction within same transaction as session creation
   - Catch P2002 error indicates duplicate attempt

3. **Tests:**
   - `__tests__/concurrency/credit-debit-idempotency.test.ts`
   - Verifies concurrent debit attempts create only one transaction

---

### INV-CRE-2: One Refund Per Session

**What:** Each session can have at most one REFUND credit transaction.

**Why:** Prevents duplicate refunds when session is cancelled. Without this:
- Customer gets credits back multiple times
- Financial loss for business
- Credit balance integrity issues

**Enforcement:**

1. **Database Constraint:**
   - Partial unique index: `credit_transactions_session_refund_key` on `(sessionId, type)` WHERE `sessionId IS NOT NULL AND type = 'REFUND'`

2. **Application Logic:**
   - `lib/credits.ts:refundSessionBookingById()` uses Serializable transaction
   - Checks for existing refund before creating new one (idempotency)
   - Handles P2002 gracefully

3. **Tests:**
   - `__tests__/concurrency/credit-debit-idempotency.test.ts`
   - Verifies concurrent refund attempts create only one transaction

**Example:**
```typescript
// ✅ GOOD: Idempotent refund pattern (from lib/credits.ts)
await prisma.$transaction(async (tx) => {
  const existing = await tx.creditTransaction.findFirst({
    where: { sessionId, type: 'REFUND' }
  });
  if (existing) return { ok: true, alreadyRefunded: true };

  await tx.creditTransaction.create({ type: 'REFUND', ... });
}, { isolationLevel: 'Serializable' });
```

---

### INV-CRE-3: USAGE + REFUND Allowed

**What:** A session can have both one USAGE transaction and one REFUND transaction (normal cancellation flow).

**Why:** When a session is cancelled after booking:
1. USAGE transaction records initial debit
2. REFUND transaction records credit restoration
3. Net effect: credits returned to student

**Enforcement:**

1. **Database Constraint:**
   - Two separate partial indexes allow both types for same session
   - Each type independently limited to one occurrence

2. **Tests:**
   - `__tests__/concurrency/credit-debit-idempotency.test.ts`
   - Verifies both USAGE and REFUND can exist for same session
   - Verifies duplicate USAGE still blocked even if REFUND exists

---

## Cron Job Invariants

### INV-CRON-1: Monthly Allocation Idempotency

**What:** Monthly credit allocation can only run once per month, even if cron job is triggered multiple times.

**Why:** If monthly allocation runs twice in the same month:
- Students get double credits
- Financial loss for business
- Subscription cost calculation breaks

**Enforcement:**

1. **Database:**
   - `cron_executions` table tracks job executions
   - Unique constraint: `cron_executions_job_key` on `(jobName, executionKey)`
   - Execution key format: `"YYYY-MM"` (e.g., "2026-02")

2. **Application Logic:**
   - `lib/cron-jobs.ts:allocateMonthlyCredits()`
   - Calls `startExecution('monthly-allocation', '2026-02')` before processing
   - Returns early if execution already exists (P2002 caught)
   - Marks execution as COMPLETED after success

3. **Tests:**
   - Unit tests in `__tests__/lib/cron-jobs.test.ts` (to be created)
   - Verify duplicate run attempts are skipped

**Example:**
```typescript
export async function allocateMonthlyCredits() {
  const executionKey = `${year}-${month}`;
  const execution = await startExecution('monthly-allocation', executionKey);
  if (!execution) return; // Already executed this month

  try {
    await prisma.$transaction(async (tx) => {
      // ... allocation logic
    });
    await completeExecution(execution.id);
  } catch (error) {
    await completeExecution(execution.id, error.message);
    throw error;
  }
}
```

---

### INV-CRON-2: Credit Expiration Atomicity

**What:** Credit expiration must atomically create expiration transaction and update original transaction.

**Why:** Two-step operation must be atomic:
1. Create EXPIRATION transaction with negative amount
2. Update original transaction amount to 0 (mark as expired)

Without transaction, crash between steps leads to:
- Credits expired but still showing as available
- Incorrect credit balance calculation

**Enforcement:**

1. **Application Logic:**
   - `lib/cron-jobs.ts:expireOldCredits()` wraps loop in transaction
   - Isolation level: Serializable
   - Timeout: 60 seconds

2. **Tests:**
   - Unit tests verify both operations succeed or fail together

**Example:**
```typescript
await prisma.$transaction(async (tx) => {
  const expired = await tx.creditTransaction.findMany({ ... });
  for (const transaction of expired) {
    await tx.creditTransaction.create({ type: 'EXPIRATION', amount: -transaction.amount });
    await tx.creditTransaction.update({ where: { id: transaction.id }, data: { amount: 0 } });
  }
}, { isolationLevel: 'Serializable', timeout: 60000 });
```

---

## Transaction Patterns

### Pattern 1: Idempotent Upsert

**Use Case:** External system may call API multiple times for same operation (webhooks, retries).

**Pattern:**
```typescript
async function upsertByExternalId(externalId: string, data: CreateData) {
  // Fast path: check if exists
  const existing = await prisma.entity.findFirst({
    where: { externalId }
  });
  if (existing) return { entity: existing, created: false };

  try {
    // Try to create
    const created = await prisma.entity.create({ data });
    return { entity: created, created: true };
  } catch (err) {
    // Race condition: another request created it
    if (err?.code === 'P2002') {
      const found = await prisma.entity.findFirst({ where: { externalId } });
      if (found) return { entity: found, created: false };
    }
    throw err;
  }
}
```

**Requirements:**
- Unique constraint on natural key (e.g., `externalId + method`)
- Handle P2002 (unique constraint violation)
- Return both entity and creation flag

**Example:** `lib/payments.ts:upsertPaymentByExternalId()`

---

### Pattern 2: Serializable Transaction with Conflict Check

**Use Case:** Multi-step operation that must be atomic, with validation and conflict checking.

**Pattern:**
```typescript
await prisma.$transaction(async (tx) => {
  // 1. Validate preconditions
  const resource = await tx.resource.findUnique({ where: { id } });
  if (!resource) throw new Error('Not found');

  // 2. Check for conflicts
  const conflict = await tx.conflictingEntity.findFirst({ where: { ... } });
  if (conflict) throw new Error('Conflict detected');

  // 3. Perform multiple related updates
  await tx.entityA.update({ ... });
  await tx.entityB.create({ ... });
  await tx.entityC.updateMany({ ... });

  return result;
}, {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  timeout: 10000
});
```

**Requirements:**
- Wrap all operations in transaction
- Use Serializable isolation to prevent phantom reads
- Set appropriate timeout
- Handle P2034 (serialization failure) in catch block
- Return 409 Conflict for constraint violations

**Examples:**
- `app/api/payments/validate/route.ts` (payment approval flow)
- `app/api/sessions/book/route.ts` (session booking flow)

---

### Pattern 3: Cron Job Idempotency

**Use Case:** Scheduled job that must not run multiple times for same execution period.

**Pattern:**
```typescript
async function scheduledJob() {
  // Create execution key (e.g., "2026-02" for monthly job)
  const executionKey = computeExecutionKey();

  const execution = await startExecution(jobName, executionKey);
  if (!execution) {
    // Job already executed for this key
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Perform job operations
    }, { isolationLevel: 'Serializable', timeout: 60000 });

    await completeExecution(execution.id);
  } catch (error) {
    await completeExecution(execution.id, error.message);
    throw error;
  }
}
```

**Requirements:**
- CronExecution table with unique constraint on (jobName, executionKey)
- startExecution catches P2002 and returns null for duplicate runs
- All job work wrapped in transaction
- Execution marked COMPLETED or FAILED

**Example:** `lib/cron-jobs.ts:allocateMonthlyCredits()`

---

## Testing Invariants

### Concurrency Tests

All critical invariants have concurrency tests that verify constraints work under concurrent load:

1. **Double Booking Prevention** (`__tests__/concurrency/double-booking.test.ts`)
   - Concurrent identical bookings → only one succeeds
   - Overlapping time slots → constraint violation
   - Non-overlapping slots → both allowed

2. **Payment Idempotency** (`__tests__/concurrency/payment-idempotency.test.ts`)
   - Concurrent webhook calls → one payment created
   - Upsert pattern returns same payment ID

3. **Credit Transaction Idempotency** (`__tests__/concurrency/credit-debit-idempotency.test.ts`)
   - Concurrent USAGE attempts → one transaction
   - Concurrent REFUND attempts → one transaction
   - USAGE + REFUND combination allowed

### Rollback Tests

Transaction atomicity verified by rollback tests:

1. **Payment Validation Rollback** (`__tests__/transactions/payment-validation-rollback.test.ts`)
   - Payment status rolls back if subscription fails
   - Subscription changes roll back if credit allocation fails
   - All-or-nothing behavior verified

### Running Tests

```bash
# All concurrency tests
npm run test:integration -- --testPathPattern=concurrency

# All transaction tests
npm run test:integration -- --testPathPattern=transactions

# All integration tests
npm run test:integration
```

---

## Monitoring

### Health Checks

Queries to verify no invariant violations exist:

```sql
-- Check for duplicate payments (should return 0 rows)
SELECT "externalId", "method", COUNT(*) as count
FROM "payments"
WHERE "externalId" IS NOT NULL
GROUP BY "externalId", "method"
HAVING COUNT(*) > 1;

-- Check for multiple USAGE per session (should return 0 rows)
SELECT "sessionId", COUNT(*) as count
FROM "credit_transactions"
WHERE "sessionId" IS NOT NULL AND type = 'USAGE'
GROUP BY "sessionId"
HAVING COUNT(*) > 1;

-- Check for multiple REFUND per session (should return 0 rows)
SELECT "sessionId", COUNT(*) as count
FROM "credit_transactions"
WHERE "sessionId" IS NOT NULL AND type = 'REFUND'
GROUP BY "sessionId"
HAVING COUNT(*) > 1;

-- Check for overlapping active sessions (should return 0 rows)
-- Note: This is complex due to time range checking, constraint prevents this at insert

-- Check for failed cron executions
SELECT *
FROM "cron_executions"
WHERE status = 'FAILED'
ORDER BY "startedAt" DESC
LIMIT 10;

-- Check for long-running cron executions
SELECT *
FROM "cron_executions"
WHERE status = 'RUNNING'
  AND "startedAt" < NOW() - INTERVAL '1 hour';
```

### Metrics to Track

1. **Payment Integrity:**
   - P2002 errors on payment creation (duplicate attempts)
   - P2034 errors on payment validation (serialization conflicts)

2. **Session Booking Integrity:**
   - 23P01 errors (exclusion constraint violations)
   - P2034 errors on booking (serialization failures)

3. **Credit Transaction Integrity:**
   - P2002 errors on USAGE/REFUND (duplicate attempts)

4. **Cron Job Health:**
   - Failed executions count
   - Execution duration (alert if > expected)
   - Skipped executions (already ran)

### Alerting Thresholds

- **Critical:** Multiple failed cron executions within 24 hours
- **Warning:** P2034 rate > 1% of requests (too many serialization conflicts)
- **Info:** 23P01 rate > 0 (users attempting double bookings)

---

## Summary

This document describes 9 critical invariants enforced across 4 domains:

- **2 Payment Invariants:** Idempotency + Validation Atomicity
- **3 Session Invariants:** No Duplicates + No Overlaps + Serializability
- **3 Credit Invariants:** One Debit + One Refund + Both Allowed
- **2 Cron Invariants:** Monthly Allocation Idempotency + Expiration Atomicity

Each invariant is enforced through:
1. Database constraints (unique indexes, exclusion constraints)
2. Application transaction logic (Serializable isolation, idempotency checks)
3. Comprehensive test coverage (concurrency + rollback tests)

Together, these invariants ensure data integrity, prevent race conditions, and maintain financial accuracy in the Nexus Réussite platform.
