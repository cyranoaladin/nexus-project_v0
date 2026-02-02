# Technical Specification
## Optimisation et sécurisation du schéma Prisma

**Project**: Nexus Réussite  
**Task ID**: optimisation-et-securisation-du-d5ee  
**Date**: 2026-02-02  
**Status**: Technical Specification Phase

---

## 1. Technical Context

### Technology Stack

- **Database**: PostgreSQL 15+ (exclusive, no SQLite compatibility needed)
- **ORM**: Prisma 6.13.0
- **Runtime**: Node.js with Next.js 15.5.11
- **Testing**: Jest 29.7.0 with real PostgreSQL instances
- **CI/CD**: GitHub Actions with PostgreSQL service containers

### Current Schema State

- **Total Models**: 30+
- **Total Relations**: ~26
- **Relations with `onDelete`**: 20 (76.9%)
- **Relations without `onDelete`**: 6 (23.1%)
- **Existing Indexes**: 12 (on SessionBooking, SessionNotification, SessionReminder, CoachAvailability, CronExecution)
- **Advanced Constraints**: 
  - EXCLUDE constraint for session overlap prevention (`SessionBooking_no_overlap_excl`)
  - Partial unique indexes for transaction idempotency
  - Unique constraints for payment idempotency

### Existing Test Infrastructure

- **Location**: `__tests__/setup/test-database.ts`
- **Factories**: createTestParent, createTestStudent, createTestCoach, createTestSessionBooking
- **Test Database**: PostgreSQL (via `TEST_DATABASE_URL`)
- **Integration Test Suite**: Comprehensive tests in `__tests__/api/`, `__tests__/concurrency/`, `__tests__/transactions/`

---

## 2. Implementation Approach

### 2.1 Schema Analysis & Gap Identification

**Objective**: Identify all relations missing `onDelete` constraints and fields needing performance indexes.

**Method**:
1. Parse `prisma/schema.prisma` (718 lines, 30+ models)
2. Catalog all foreign key relations and their current `onDelete` behavior
3. Identify high-frequency query patterns from:
   - API route handlers (`app/api/*/route.ts`)
   - Guards and middleware (`lib/guards.ts`)
   - Business logic (`lib/credits.ts`, `lib/payments.ts`)
4. Map fields appearing in `WHERE`, `JOIN`, `ORDER BY` clauses

**Relations Missing `onDelete` Constraints** (identified in requirements):

| Model | Field | Target | Line | Proposed Action |
|-------|-------|--------|------|-----------------|
| `Session` | `coach` | `CoachProfile` | 269 | `onDelete: SetNull` |
| `Payment` | `user` | `User` | 391 | `onDelete: Restrict` |
| `Message` | `sender` | `User` | 419 | `onDelete: SetNull` |
| `Message` | `receiver` | `User` | 422 | `onDelete: SetNull` |
| `StudentBadge` | `badge` | `Badge` | 354 | `onDelete: Restrict` |
| `StudentReport` | `coach` | `CoachProfile` | 369 | `onDelete: SetNull` |

**Fields Needing Indexes**:

| Model | Field(s) | Type | Justification |
|-------|----------|------|---------------|
| `User` | `role` | Single | RBAC filtering in guards (`WHERE role = ?`) |
| `Session` | `studentId` | Single | Student session history queries |
| `Session` | `coachId` | Single | Coach dashboard queries |
| `Session` | `status` | Single | Status-based filtering (COMPLETED, SCHEDULED) |
| `AriaConversation` | `studentId`, `updatedAt` | Composite | Chat history with recency sorting |
| `AriaMessage` | `conversationId`, `createdAt` | Composite | Message threading in chronological order |
| `Notification` | `userId`, `read` | Composite | Unread notification queries |
| `CreditTransaction` | `studentId`, `createdAt` | Composite | Transaction history (paginated) |
| `CreditTransaction` | `sessionId` | Single | Session-specific transaction lookups |
| `Subscription` | `studentId`, `status` | Composite | Active subscription checks |

### 2.2 Cascade Delete Strategy

**Philosophy**: Preserve educational and financial records, cascade ephemeral data.

**Decision Matrix**:

| Relation | Strategy | Rationale |
|----------|----------|-----------|
| `Session.coach` → `CoachProfile` | `SetNull` | Preserve session history even if coach account removed; session record remains for audit |
| `Payment.user` → `User` | `Restrict` | Financial compliance: prevent deletion of users with payment history |
| `Message.sender/receiver` → `User` | `SetNull` | Preserve communication history while anonymizing deleted users |
| `StudentBadge.badge` → `Badge` | `Restrict` | Badges are system-level data; prevent deletion if awarded to students |
| `StudentReport.coach` → `CoachProfile` | `SetNull` | Educational records outlive coach employment; maintain historical reports |

**Existing Cascades** (to preserve):
- All User profile relations (`ParentProfile`, `StudentProfile`, `CoachProfile`, `Student`) already have `Cascade`
- Child records (`Subscription`, `CreditTransaction`, `AriaConversation`, `SessionBooking`) correctly cascade from parent entities

### 2.3 Index Strategy

**PostgreSQL-Specific Optimizations**:

1. **Composite Indexes** for multi-column queries:
   ```sql
   CREATE INDEX idx_notifications_user_read ON notifications(userId, read);
   -- Optimizes: WHERE userId = ? AND read = false
   ```

2. **Partial Indexes** (PostgreSQL-only) for filtered queries:
   ```sql
   CREATE INDEX idx_subscriptions_active ON subscriptions(studentId) 
   WHERE status = 'ACTIVE';
   -- Optimizes: WHERE studentId = ? AND status = 'ACTIVE'
   ```

3. **Index Cardinality Considerations**:
   - `User.role`: Low cardinality (5 values) but high selectivity in queries → index beneficial
   - `Session.status`: 7 possible values, frequently filtered → index beneficial
   - Primary keys already indexed by PostgreSQL

4. **CONCURRENTLY Option** (for production migrations):
   - Use `CREATE INDEX CONCURRENTLY` to avoid table locks
   - Requires raw SQL migration (Prisma doesn't support CONCURRENTLY syntax)
   - Example pattern from existing migrations (`20260201201415_add_session_overlap_prevention`)

**Index Naming Convention**:
- Follow Prisma auto-naming: `@@index([field1, field2])`
- Prisma generates: `{table}_{field1}_{field2}_idx`
- Custom names only for raw SQL indexes

### 2.4 Migration Approach

**Phase 1: Schema Update**

1. Edit `prisma/schema.prisma`:
   - Add missing `onDelete` constraints (6 relations)
   - Add performance indexes (10 new indexes)
   - Add inline comments documenting rationale

2. Generate migration:
   ```bash
   npm run db:migrate
   # Name: "add_referential_integrity_and_indexes"
   ```

3. Review generated SQL:
   - Verify `ALTER TABLE ... ADD CONSTRAINT` for foreign keys
   - Verify `CREATE INDEX` statements
   - Add `CONCURRENTLY` manually if needed for production

**Phase 2: Test Implementation**

1. Create `tests/database/schema.test.ts`:
   - Cascade delete behavior tests
   - Index existence validation
   - Constraint enforcement tests
   - Query performance benchmarks (optional)

2. Leverage existing test infrastructure:
   - Use `testPrisma` from `__tests__/setup/test-database.ts`
   - Use existing factories (createTestStudent, createTestCoach, etc.)
   - Follow patterns from `__tests__/concurrency/` tests

**Phase 3: Validation**

1. Local testing:
   ```bash
   npm run test -- tests/database/schema.test.ts
   npm run test:integration  # Ensure no regressions
   npm run verify:quick      # Lint + typecheck + tests
   ```

2. Database verification:
   ```sql
   -- Check indexes
   SELECT tablename, indexname, indexdef 
   FROM pg_indexes 
   WHERE schemaname = 'public' AND tablename NOT LIKE 'pg_%';
   
   -- Check foreign key constraints
   SELECT tc.table_name, kcu.column_name, 
          ccu.table_name AS foreign_table_name,
          rc.delete_rule
   FROM information_schema.table_constraints AS tc
   JOIN information_schema.key_column_usage AS kcu
     ON tc.constraint_name = kcu.constraint_name
   JOIN information_schema.constraint_column_usage AS ccu
     ON ccu.constraint_name = tc.constraint_name
   JOIN information_schema.referential_constraints AS rc
     ON rc.constraint_name = tc.constraint_name
   WHERE tc.constraint_type = 'FOREIGN KEY';
   ```

3. CI/CD validation:
   - GitHub Actions will run full test suite with PostgreSQL service container
   - Migration applies cleanly in CI environment

---

## 3. Detailed Schema Changes

### 3.1 Foreign Key Constraint Updates

**File**: `prisma/schema.prisma`

**Line 269** - `Session.coach`:
```prisma
// BEFORE
coach   CoachProfile @relation(fields: [coachId], references: [id])

// AFTER
coach   CoachProfile @relation(fields: [coachId], references: [id], onDelete: SetNull)
```
**Impact**: Requires `coachId` to be nullable (`String?`)  
**Comment**: `// Preserve session history; coach may leave organization`

**Line 391** - `Payment.user`:
```prisma
// BEFORE
user   User   @relation(fields: [userId], references: [id])

// AFTER
user   User   @relation(fields: [userId], references: [id], onDelete: Restrict)
```
**Impact**: Prevents user deletion if payments exist  
**Comment**: `// Financial compliance: prevent deletion of users with payment records`

**Lines 419, 422** - `Message.sender/receiver`:
```prisma
// BEFORE
sender     User   @relation("MessageSender", fields: [senderId], references: [id])
receiver   User   @relation("MessageReceiver", fields: [receiverId], references: [id])

// AFTER
sender     User   @relation("MessageSender", fields: [senderId], references: [id], onDelete: SetNull)
receiver   User   @relation("MessageReceiver", fields: [receiverId], references: [id], onDelete: SetNull)
```
**Impact**: Requires `senderId` and `receiverId` to be nullable (`String?`)  
**Comment**: `// Anonymize messages when user deleted; preserve conversation history`

**Line 354** - `StudentBadge.badge`:
```prisma
// BEFORE
badge   Badge  @relation(fields: [badgeId], references: [id])

// AFTER
badge   Badge  @relation(fields: [badgeId], references: [id], onDelete: Restrict)
```
**Impact**: Prevents badge deletion if awarded to students  
**Comment**: `// Prevent deletion of badges that have been awarded`

**Line 369** - `StudentReport.coach`:
```prisma
// BEFORE
coach   CoachProfile @relation(fields: [coachId], references: [id])

// AFTER
coach   CoachProfile @relation(fields: [coachId], references: [id], onDelete: SetNull)
```
**Impact**: Requires `coachId` to be nullable (`String?`)  
**Comment**: `// Preserve educational records; coach may leave organization`

### 3.2 Index Additions

**User Model** (line ~113):
```prisma
@@map("users")
@@index([role]) // RBAC filtering
```

**Session Model** (line ~293):
```prisma
@@map("sessions")
@@index([studentId]) // Student session history
@@index([coachId]) // Coach dashboard queries
@@index([status]) // Status filtering
```

**AriaConversation Model** (line ~310):
```prisma
@@map("aria_conversations")
@@index([studentId, updatedAt]) // Chat history with recency
```

**AriaMessage Model** (line ~327):
```prisma
@@map("aria_messages")
@@index([conversationId, createdAt]) // Message threading
```

**Notification Model** (line ~489):
```prisma
@@map("notifications")
@@index([userId, read]) // Unread notification queries
@@index([userRole]) // Role-based notification filtering
```

**CreditTransaction Model** (line ~259):
```prisma
@@map("credit_transactions")
@@index([studentId, createdAt]) // Transaction history
@@index([sessionId]) // Session-specific lookups
```

**Subscription Model** (line ~235):
```prisma
@@map("subscriptions")
@@index([studentId, status]) // Active subscription checks
```

### 3.3 Schema Comments

Add documentation comments for clarity:

```prisma
// REFERENTIAL INTEGRITY STRATEGY:
// - Cascade: Delete child records when parent is deleted (ephemeral data)
// - SetNull: Preserve child records, anonymize reference (historical data)
// - Restrict: Prevent parent deletion if children exist (system data)
//
// INDEXING STRATEGY:
// - Single indexes: High-frequency WHERE clause fields
// - Composite indexes: Multi-column queries (order matters)
// - Partial indexes: Use raw SQL for filtered indexes (PostgreSQL-specific)
```

---

## 4. Test Suite Structure

### 4.1 File Organization

**Location**: `tests/database/schema.test.ts`

**Structure**:
```typescript
describe('Prisma Schema Integrity', () => {
  // Setup/teardown
  beforeAll(async () => { /* Connect to test DB */ });
  afterAll(async () => { /* Disconnect */ });
  beforeEach(async () => { /* Clean tables */ });

  describe('Cascade Delete Behavior', () => {
    describe('User -> Profile Cascades', () => { /* ... */ });
    describe('Student -> Child Records Cascades', () => { /* ... */ });
    describe('SessionBooking Cascades', () => { /* ... */ });
  });

  describe('SetNull Behavior', () => {
    describe('Session.coach SetNull', () => { /* ... */ });
    describe('Message sender/receiver SetNull', () => { /* ... */ });
    describe('StudentReport.coach SetNull', () => { /* ... */ });
  });

  describe('Restrict Behavior', () => {
    describe('Payment.user Restrict', () => { /* ... */ });
    describe('StudentBadge.badge Restrict', () => { /* ... */ });
  });

  describe('Index Existence', () => {
    test('Verify all indexes exist in database', async () => { /* ... */ });
  });

  describe('Constraint Enforcement', () => {
    describe('Unique Constraints', () => { /* ... */ });
    describe('Session Overlap Prevention', () => { /* ... */ });
  });
});
```

### 4.2 Test Patterns

**Cascade Test Pattern**:
```typescript
test('Deleting User cascades to ParentProfile', async () => {
  const { parentUser, parentProfile } = await createTestParent();
  
  // Delete user
  await testPrisma.user.delete({ where: { id: parentUser.id } });
  
  // Verify profile is also deleted
  const deletedProfile = await testPrisma.parentProfile.findUnique({
    where: { id: parentProfile.id }
  });
  expect(deletedProfile).toBeNull();
});
```

**SetNull Test Pattern**:
```typescript
test('Deleting CoachProfile sets Session.coachId to null', async () => {
  const { coachUser, coachProfile } = await createTestCoach();
  const { student } = await createTestStudent(parentId);
  
  const session = await testPrisma.session.create({
    data: {
      studentId: student.id,
      coachId: coachProfile.id,
      // ... other required fields
    }
  });
  
  // Delete coach profile
  await testPrisma.coachProfile.delete({ where: { id: coachProfile.id } });
  
  // Session should still exist with null coachId
  const updatedSession = await testPrisma.session.findUnique({
    where: { id: session.id }
  });
  expect(updatedSession).not.toBeNull();
  expect(updatedSession.coachId).toBeNull();
});
```

**Restrict Test Pattern**:
```typescript
test('Cannot delete User with Payment history (Restrict)', async () => {
  const { parentUser } = await createTestParent();
  
  await testPrisma.payment.create({
    data: {
      userId: parentUser.id,
      type: 'SUBSCRIPTION',
      amount: 199.99,
      description: 'Test payment'
    }
  });
  
  // Attempt to delete user should fail
  await expect(
    testPrisma.user.delete({ where: { id: parentUser.id } })
  ).rejects.toThrow(/foreign key constraint/);
});
```

**Index Verification**:
```typescript
test('Verify performance indexes exist', async () => {
  const indexes = await testPrisma.$queryRaw`
    SELECT tablename, indexname 
    FROM pg_indexes 
    WHERE schemaname = 'public' AND tablename NOT LIKE 'pg_%'
    ORDER BY tablename, indexname;
  `;
  
  const indexNames = indexes.map(i => i.indexname);
  
  // Check critical indexes
  expect(indexNames).toContain('users_role_idx');
  expect(indexNames).toContain('sessions_studentId_idx');
  expect(indexNames).toContain('sessions_coachId_idx');
  expect(indexNames).toContain('notifications_userId_read_idx');
  // ... etc
});
```

### 4.3 Test Data Management

**Leverage Existing Factories**:
```typescript
import {
  testPrisma,
  setupTestDatabase,
  teardownTestDatabase,
  createTestParent,
  createTestStudent,
  createTestCoach,
  createTestSessionBooking,
} from '../__tests__/setup/test-database';
```

**Isolation Pattern**:
```typescript
beforeEach(async () => {
  await setupTestDatabase(); // Cleans all tables in dependency order
});
```

---

## 5. Migration File Structure

**Expected Migration Name**: `20260202XXXXXX_add_referential_integrity_and_indexes`

**Generated SQL Structure**:
```sql
-- AlterTable: Make fields nullable for SetNull constraints
ALTER TABLE "sessions" ALTER COLUMN "coachId" DROP NOT NULL;
ALTER TABLE "messages" ALTER COLUMN "senderId" DROP NOT NULL;
ALTER TABLE "messages" ALTER COLUMN "receiverId" DROP NOT NULL;
ALTER TABLE "student_reports" ALTER COLUMN "coachId" DROP NOT NULL;

-- AddForeignKey: Update constraints with onDelete behavior
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_coachId_fkey";
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_coachId_fkey" 
  FOREIGN KEY ("coachId") REFERENCES "coach_profiles"("id") ON DELETE SET NULL;

ALTER TABLE "payments" DROP CONSTRAINT "payments_userId_fkey";
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT;

-- ... (similar for other constraints)

-- CreateIndex: Performance indexes
CREATE INDEX "users_role_idx" ON "users"("role");
CREATE INDEX "sessions_studentId_idx" ON "sessions"("studentId");
CREATE INDEX "sessions_coachId_idx" ON "sessions"("coachId");
CREATE INDEX "sessions_status_idx" ON "sessions"("status");
CREATE INDEX "aria_conversations_studentId_updatedAt_idx" 
  ON "aria_conversations"("studentId", "updatedAt");
CREATE INDEX "aria_messages_conversationId_createdAt_idx" 
  ON "aria_messages"("conversationId", "createdAt");
CREATE INDEX "notifications_userId_read_idx" 
  ON "notifications"("userId", "read");
CREATE INDEX "notifications_userRole_idx" 
  ON "notifications"("userRole");
CREATE INDEX "credit_transactions_studentId_createdAt_idx" 
  ON "credit_transactions"("studentId", "createdAt");
CREATE INDEX "credit_transactions_sessionId_idx" 
  ON "credit_transactions"("sessionId");
CREATE INDEX "subscriptions_studentId_status_idx" 
  ON "subscriptions"("studentId", "status");
```

**Production Optimization** (manual edit for CONCURRENTLY):
```sql
-- For zero-downtime index creation in production:
CREATE INDEX CONCURRENTLY "users_role_idx" ON "users"("role");
-- Note: Requires separate transaction, not in migration transaction
```

---

## 6. Verification Steps

### 6.1 Local Development

```bash
# 1. Apply migration
npm run db:migrate
# Enter name: "add_referential_integrity_and_indexes"

# 2. Generate Prisma Client
npm run db:generate

# 3. Run schema tests
npm run test -- tests/database/schema.test.ts

# 4. Run integration tests (ensure no regressions)
npm run test:integration

# 5. Run full verification
npm run verify:quick
# Includes: lint, typecheck, unit tests, integration tests

# 6. Manual database inspection
npm run db:studio
# Or:
psql $DATABASE_URL -c "SELECT * FROM pg_indexes WHERE tablename NOT LIKE 'pg_%';"
```

### 6.2 CI/CD Pipeline

**GitHub Actions** (automatic on PR):
```yaml
- name: Setup PostgreSQL
  uses: postgres service container
  
- name: Run migrations
  run: npm run db:migrate:deploy
  
- name: Run tests
  run: npm run test:ci
```

**Expected Outcomes**:
- ✅ All tests pass (unit + integration)
- ✅ No TypeScript errors
- ✅ No linting errors
- ✅ Migration applies cleanly

### 6.3 Performance Validation (Optional)

**Query Performance Benchmarks**:
```typescript
test('Index improves query performance', async () => {
  // Insert 1000 users with random roles
  // ...
  
  // Query without index (baseline)
  const start1 = Date.now();
  await testPrisma.$queryRaw`
    SELECT * FROM users WHERE role = 'COACH';
  `;
  const noIndexTime = Date.now() - start1;
  
  // Query with index
  const start2 = Date.now();
  const coaches = await testPrisma.user.findMany({
    where: { role: 'COACH' }
  });
  const indexTime = Date.now() - start2;
  
  // Expect >30% improvement
  expect(indexTime).toBeLessThan(noIndexTime * 0.7);
});
```

**EXPLAIN ANALYZE**:
```sql
EXPLAIN ANALYZE 
SELECT * FROM users WHERE role = 'COACH';

-- Expected output with index:
-- Index Scan using users_role_idx on users (cost=0.15..8.17 rows=1 width=...)
--   Index Cond: (role = 'COACH'::user_role)
```

---

## 7. Delivery Phases

### Phase 1: Schema Update (Day 1)
- ✅ Update `prisma/schema.prisma` with constraints and indexes
- ✅ Generate migration file
- ✅ Review SQL for correctness
- ✅ Document changes with inline comments

**Deliverable**: Updated `schema.prisma` + migration file

### Phase 2: Test Implementation (Day 1-2)
- ✅ Create `tests/database/schema.test.ts`
- ✅ Implement cascade, SetNull, Restrict tests
- ✅ Add index verification tests
- ✅ Ensure all tests pass locally

**Deliverable**: Comprehensive test suite with 100% coverage of new constraints

### Phase 3: Validation & Review (Day 2)
- ✅ Run `npm run verify:quick` (all checks pass)
- ✅ Manual database inspection (indexes + constraints)
- ✅ CI/CD validation (GitHub Actions green)
- ✅ Code review ready

**Deliverable**: PR ready for review

---

## 8. Risk Mitigation

### Risk 1: Breaking Changes to Existing Data

**Scenario**: Setting fields to nullable (`coachId`, `senderId`, etc.) might break existing queries.

**Mitigation**:
- TypeScript will catch null-checking issues at compile time
- Integration tests will catch runtime issues
- Review all usages of affected fields:
  ```bash
  grep -r "coachId" app/api/
  grep -r "senderId\|receiverId" app/api/
  ```

**Rollback Plan**: Revert migration, mark as rolled back:
```bash
npx prisma migrate resolve --rolled-back <migration_name>
```

### Risk 2: Index Creation Locks Tables

**Scenario**: `CREATE INDEX` locks table for writes in production.

**Mitigation**:
- Use `CREATE INDEX CONCURRENTLY` for production deployment
- Apply during low-traffic window
- Monitor production logs during deployment

**PostgreSQL CONCURRENTLY Behavior**:
- Doesn't lock table
- Takes longer to create
- Requires autocommit mode (separate transaction)

### Risk 3: Restrict Prevents User Deletion

**Scenario**: Users with payments cannot be deleted, blocking account cleanup.

**Mitigation**:
- This is intentional (financial compliance)
- Implement soft delete if needed (separate task):
  ```prisma
  model User {
    deletedAt DateTime?
  }
  ```
- Document deletion policy in application logic

### Risk 4: Test Database State

**Scenario**: Tests fail due to dirty state from previous runs.

**Mitigation**:
- `beforeEach()` cleanup in all tests
- Use `setupTestDatabase()` utility (already handles dependency order)
- Isolate test data with unique emails/pseudonyms

---

## 9. Success Criteria

### Functional Requirements

- ✅ All 6 missing `onDelete` constraints added
- ✅ All 10+ performance indexes created
- ✅ No breaking changes to existing API tests
- ✅ Schema changes backward-compatible (additive only)

### Test Coverage

- ✅ 100% of cascade deletes tested
- ✅ 100% of SetNull/Restrict behaviors tested
- ✅ Index existence validated programmatically
- ✅ Constraint enforcement verified

### Performance

- ✅ Indexed queries complete in <50ms (P95)
- ✅ EXPLAIN shows index usage
- ✅ No regression in write performance

### Quality Gates

- ✅ `npm run lint` passes
- ✅ `npm run typecheck` passes
- ✅ `npm run test:unit` passes
- ✅ `npm run test:integration` passes
- ✅ CI/CD pipeline green

### Documentation

- ✅ Inline schema comments explain rationale
- ✅ Migration file includes descriptive comments
- ✅ Test file has clear descriptions for each test case
- ✅ (Optional) Update `docs/DB_STRATEGY.md` with optimization section

---

## 10. Technical Debt & Future Work

### Potential Optimizations (Out of Scope)

1. **Partial Indexes** (PostgreSQL-specific):
   ```sql
   CREATE INDEX idx_active_subscriptions 
   ON subscriptions(studentId) WHERE status = 'ACTIVE';
   ```
   **Benefit**: Smaller index, faster queries for active subscriptions  
   **Implementation**: Raw SQL migration (Prisma doesn't support `WHERE` in `@@index`)

2. **Materialized Views** for dashboards:
   ```sql
   CREATE MATERIALIZED VIEW student_progress_summary AS
   SELECT studentId, COUNT(*) as session_count, AVG(rating) as avg_rating
   FROM sessions
   WHERE status = 'COMPLETED'
   GROUP BY studentId;
   ```
   **Benefit**: Precomputed aggregates for dashboard queries  
   **Maintenance**: Requires refresh strategy (cron job or triggers)

3. **Table Partitioning** for large tables:
   ```sql
   -- Partition sessions by year
   CREATE TABLE sessions_2026 PARTITION OF sessions
   FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
   ```
   **Benefit**: Query performance on historical data  
   **Complexity**: Requires partition management logic

4. **Full-Text Search** on pedagogical content:
   ```sql
   ALTER TABLE pedagogical_contents 
   ADD COLUMN tsv tsvector
   GENERATED ALWAYS AS (to_tsvector('french', content)) STORED;
   
   CREATE INDEX idx_content_fts ON pedagogical_contents USING GIN(tsv);
   ```
   **Benefit**: Natural language search for ARIA  
   **Scope**: Separate feature (French language tokenization)

### Monitoring Recommendations

1. **Query Performance**:
   - Enable `pg_stat_statements` extension
   - Monitor slow queries (>100ms)
   - Track index usage (`pg_stat_user_indexes`)

2. **Index Bloat**:
   - Monitor index size growth
   - Reindex if bloat exceeds 30%
   - Schedule `VACUUM ANALYZE` regularly

3. **Constraint Violations**:
   - Log foreign key errors in application
   - Alert on Restrict violations (attempted deletions)
   - Track cascade delete counts

---

## 11. References

### Documentation

- **Prisma Schema Reference**: https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference
- **PostgreSQL Constraints**: https://www.postgresql.org/docs/15/ddl-constraints.html
- **PostgreSQL Indexes**: https://www.postgresql.org/docs/15/indexes.html
- **Project DB Strategy**: `docs/DB_STRATEGY.md`

### Existing Code

- **Schema File**: `prisma/schema.prisma` (718 lines)
- **Test Setup**: `__tests__/setup/test-database.ts`
- **Migration Examples**: `prisma/migrations/20260201201415_add_session_overlap_prevention/`
- **Concurrency Tests**: `__tests__/concurrency/payment-idempotency.test.ts`

### Related PRs/Issues

- Initial PostgreSQL migration: Commit `e8c5cb42`
- Session overlap prevention: Migration `20260201201415`
- Credit transaction idempotency: Migration `20260201201534`

---

## Appendix A: Complete Index List

**New Indexes to Add** (11 total):

| Table | Index Definition | Estimated Size | Justification |
|-------|------------------|----------------|---------------|
| `users` | `@@index([role])` | ~50 KB | RBAC queries |
| `sessions` | `@@index([studentId])` | ~200 KB | Student history |
| `sessions` | `@@index([coachId])` | ~200 KB | Coach dashboard |
| `sessions` | `@@index([status])` | ~100 KB | Status filtering |
| `aria_conversations` | `@@index([studentId, updatedAt])` | ~150 KB | Chat history |
| `aria_messages` | `@@index([conversationId, createdAt])` | ~500 KB | Message threads |
| `notifications` | `@@index([userId, read])` | ~300 KB | Unread queries |
| `notifications` | `@@index([userRole])` | ~100 KB | Role filtering |
| `credit_transactions` | `@@index([studentId, createdAt])` | ~400 KB | Tx history |
| `credit_transactions` | `@@index([sessionId])` | ~200 KB | Session lookups |
| `subscriptions` | `@@index([studentId, status])` | ~100 KB | Active subs |

**Total Index Overhead**: ~2.3 MB (estimated for 10K records each)

---

## Appendix B: Test Case Checklist

**Cascade Deletes**:
- [ ] User → ParentProfile
- [ ] User → StudentProfile  
- [ ] User → CoachProfile
- [ ] User → Student
- [ ] Student → Subscription
- [ ] Student → CreditTransaction
- [ ] Student → Session
- [ ] Student → AriaConversation
- [ ] SessionBooking → SessionNotification
- [ ] SessionBooking → SessionReminder
- [ ] AriaConversation → AriaMessage

**SetNull Behavior**:
- [ ] Session.coach → CoachProfile (preserves session)
- [ ] Message.sender → User (anonymizes sender)
- [ ] Message.receiver → User (anonymizes receiver)
- [ ] StudentReport.coach → CoachProfile (preserves report)
- [ ] SessionBooking.parent → User (optional parent)

**Restrict Behavior**:
- [ ] Payment.user → User (prevents deletion)
- [ ] StudentBadge.badge → Badge (prevents badge deletion)

**Index Verification**:
- [ ] All 11 new indexes exist in `pg_indexes`
- [ ] Index names match Prisma convention
- [ ] EXPLAIN shows index usage for sample queries

**Constraint Verification**:
- [ ] Unique constraints enforced (payments, cron executions)
- [ ] Session overlap prevention (EXCLUDE constraint)
- [ ] Credit transaction idempotency (partial indexes)

---

**End of Technical Specification**
