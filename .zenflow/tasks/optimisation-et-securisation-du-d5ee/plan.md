# Full SDD workflow

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Workflow Steps

### [x] Step: Requirements
<!-- chat-id: 98aebbf2-be37-483a-8f82-b5d76feedd32 -->

Create a Product Requirements Document (PRD) based on the feature description.

1. Review existing codebase to understand current architecture and patterns
2. Analyze the feature definition and identify unclear aspects
3. Ask the user for clarifications on aspects that significantly impact scope or user experience
4. Make reasonable decisions for minor details based on context and conventions
5. If user can't clarify, make a decision, state the assumption, and continue

Save the PRD to `{@artifacts_path}/requirements.md`.

### [x] Step: Technical Specification
<!-- chat-id: 8919e421-5def-4c67-9ed9-c50ce68e6085 -->

Create a technical specification based on the PRD in `{@artifacts_path}/requirements.md`.

1. Review existing codebase architecture and identify reusable components
2. Define the implementation approach

Save to `{@artifacts_path}/spec.md` with:
- Technical context (language, dependencies)
- Implementation approach referencing existing code patterns
- Source code structure changes
- Data model / API / interface changes
- Delivery phases (incremental, testable milestones)
- Verification approach using project lint/test commands

### [x] Step: Planning
<!-- chat-id: 19de7f48-93b6-4deb-ae38-372ffa33ade9 -->

Create a detailed implementation plan based on `{@artifacts_path}/spec.md`.

1. Break down the work into concrete tasks
2. Each task should reference relevant contracts and include verification steps
3. Replace the Implementation step below with the planned tasks

Rule of thumb for step size: each step should represent a coherent unit of work (e.g., implement a component, add an API endpoint, write tests for a module). Avoid steps that are too granular (single function) or too broad (entire feature).

If the feature is trivial and doesn't warrant full specification, update this workflow to remove unnecessary steps and explain the reasoning to the user.

Save to `{@artifacts_path}/plan.md`.

---

## Implementation Steps

### [x] Step: Schema Analysis and Field Updates
<!-- chat-id: add6536d-d27a-4fcd-80d3-194d5d747109 -->

**Objective**: Update `prisma/schema.prisma` to make fields nullable for SetNull constraints.

**Tasks**:
- Make `Session.coachId` nullable (`String?`) to support `onDelete: SetNull`
- Make `Message.senderId` nullable (`String?`) to support `onDelete: SetNull`
- Make `Message.receiverId` nullable (`String?`) to support `onDelete: SetNull`
- Make `StudentReport.coachId` nullable (`String?`) to support `onDelete: SetNull`

**Files Modified**: 
- `prisma/schema.prisma` (lines 268, 418, 421, 368)

**Verification**: 
- TypeScript compilation should pass
- Run `npm run typecheck` to ensure no errors

---

### [x] Step: Add Foreign Key Constraints
<!-- chat-id: 3eac3869-6f69-465c-aa2e-1d40823906f5 -->

**Objective**: Add missing `onDelete` constraints to all relations.

**Tasks**:
- Add `onDelete: SetNull` to `Session.coach` → `CoachProfile` (line 269)
- Add `onDelete: Restrict` to `Payment.user` → `User` (line 391)
- Add `onDelete: SetNull` to `Message.sender` → `User` (line 419)
- Add `onDelete: SetNull` to `Message.receiver` → `User` (line 422)
- Add `onDelete: Restrict` to `StudentBadge.badge` → `Badge` (line 354)
- Add `onDelete: SetNull` to `StudentReport.coach` → `CoachProfile` (line 369)
- Add inline comments documenting rationale for each constraint

**Files Modified**: 
- `prisma/schema.prisma`

**Rationale Documentation**:
- `Session.coach SetNull`: Preserve session history even if coach account removed
- `Payment.user Restrict`: Financial compliance - prevent deletion of users with payment history
- `Message sender/receiver SetNull`: Preserve communication history while anonymizing deleted users
- `StudentBadge.badge Restrict`: Badges are system-level data; prevent deletion if awarded to students
- `StudentReport.coach SetNull`: Educational records outlive coach employment

**Verification**: 
- Schema syntax validation: `npx prisma validate`

---

### [x] Step: Add Performance Indexes
<!-- chat-id: 1ff68626-c8e6-4f33-bccf-1f33b4468e55 -->

**Objective**: Add performance indexes on frequently queried fields.

**Tasks**:
- Add `@@index([role])` to `User` model (RBAC filtering)
- Add `@@index([studentId])` to `Session` model (student session history)
- Add `@@index([coachId])` to `Session` model (coach dashboard queries)
- Add `@@index([status])` to `Session` model (status-based filtering)
- Add `@@index([studentId, updatedAt])` to `AriaConversation` model (chat history with recency)
- Add `@@index([conversationId, createdAt])` to `AriaMessage` model (message threading)
- Add `@@index([userId, read])` to `Notification` model (unread notification queries)
- Add `@@index([userRole])` to `Notification` model (role-based notification filtering)
- Add `@@index([studentId, createdAt])` to `CreditTransaction` model (transaction history)
- Add `@@index([sessionId])` to `CreditTransaction` model (session-specific lookups)
- Add `@@index([studentId, status])` to `Subscription` model (active subscription checks)

**Files Modified**: 
- `prisma/schema.prisma`

**Verification**: 
- Schema syntax validation: `npx prisma validate`

---

### [x] Step: Generate Database Migration
<!-- chat-id: 69637623-83af-401a-abd9-98d52d8a471e -->

**Objective**: Generate migration file with all schema changes.

**Tasks**:
- Run `npm run db:migrate` with name "add_referential_integrity_and_indexes"
- Review generated SQL for correctness:
  - Verify `ALTER TABLE` statements for nullable fields
  - Verify `ALTER TABLE` statements for foreign key constraints with `onDelete` behavior
  - Verify `CREATE INDEX` statements for all new indexes
- Ensure migration includes all expected changes

**Files Created**: 
- `prisma/migrations/YYYYMMDDHHMMSS_add_referential_integrity_and_indexes/migration.sql`

**Verification**: 
- Migration applies cleanly: `npm run db:migrate:deploy` (in test environment)
- Database schema matches Prisma schema

---

### [x] Step: Create Schema Integrity Test Suite
<!-- chat-id: f6b95970-3c70-4cb4-bbf7-e14ad4198bc1 -->

**Objective**: Create comprehensive test suite in `tests/database/schema.test.ts`.

**Test Coverage**:

1. **Cascade Delete Tests** (existing constraints):
   - Deleting User cascades to ParentProfile
   - Deleting User cascades to StudentProfile  
   - Deleting User cascades to CoachProfile
   - Deleting Student cascades to Subscription
   - Deleting Student cascades to CreditTransaction
   - Deleting Student cascades to Session
   - Deleting Student cascades to AriaConversation
   - Deleting SessionBooking cascades to SessionNotification
   - Deleting SessionBooking cascades to SessionReminder

2. **SetNull Behavior Tests** (new constraints):
   - Deleting CoachProfile sets Session.coachId to null
   - Deleting User sets Message.senderId to null
   - Deleting User sets Message.receiverId to null
   - Deleting CoachProfile sets StudentReport.coachId to null

3. **Restrict Behavior Tests** (new constraints):
   - Cannot delete User with Payment history
   - Cannot delete Badge if awarded to students

4. **Index Existence Tests**:
   - Verify all performance indexes exist via `pg_indexes` query
   - Check index names match expected pattern

5. **Constraint Enforcement Tests** (existing):
   - Unique constraints enforced
   - Session overlap prevention works
   - Payment idempotency constraints work

**Files Created**: 
- `tests/database/schema.test.ts`

**Test Infrastructure**:
- Use existing `testPrisma` from `__tests__/setup/test-database.ts`
- Use existing factories: `createTestParent`, `createTestStudent`, `createTestCoach`, `createTestSessionBooking`
- Follow patterns from `__tests__/concurrency/` tests
- Use `setupTestDatabase()` in `beforeEach()` for isolation

**Verification**: 
- All tests pass: `npm run test -- tests/database/schema.test.ts`
- Test coverage 100% for new constraints

---

### [x] Step: Verify TypeScript Compilation
<!-- chat-id: f9781a35-7f7c-4b0d-aa78-b6a9e60d2837 -->

**Objective**: Ensure schema changes don't break existing code.

**Tasks**:
- Run `npm run typecheck` to catch null-checking issues
- Fix any TypeScript errors related to nullable fields:
  - `Session.coachId` may be null
  - `Message.senderId` may be null
  - `Message.receiverId` may be null
  - `StudentReport.coachId` may be null
- Search codebase for usages of affected fields and add null checks if needed

**Verification**: 
- `npm run typecheck` passes with no errors

---

### [x] Step: Run Full Test Suite
<!-- chat-id: 4172327a-af77-4107-bb5b-bf2cea0f9220 -->

**Objective**: Ensure no regressions in existing functionality.

**Tasks**:
- Run unit tests: `npm run test:unit`
- Run integration tests: `npm run test:integration`
- Verify all existing tests pass
- Fix any failing tests related to schema changes

**Expected Outcome**: 
- All existing tests pass
- No regressions in API behavior
- Schema tests validate new constraints

**Verification**: 
- `npm run test` passes all tests

---

### [x] Step: Run Linting and Verification
<!-- chat-id: 55eb5614-ddaf-4f1d-9e68-5bd4b82fe0c7 -->

**Objective**: Ensure code quality and project standards.

**Tasks**:
- Run lint: `npm run lint`
- Run typecheck: `npm run typecheck`
- Run quick verification: `npm run verify:quick`

**Verification**: 
- All quality gates pass
- No linting errors
- No type errors
- All tests pass

---

### [x] Step: Documentation and Review
<!-- chat-id: bdd56c04-da2e-4263-a250-d658ff11a9e9 -->

**Objective**: Document changes and prepare for review.

**Tasks**:
- Review all schema changes in `prisma/schema.prisma`
- Verify all inline comments are clear and accurate
- Review migration SQL file
- Review test coverage
- Confirm all acceptance criteria met:
  - ✅ All foreign key relations have explicit `onDelete` behavior
  - ✅ Performance indexes added to specified fields
  - ✅ 100% test coverage on schema integrity
  - ✅ No breaking changes to existing API tests
  - ✅ `npm run verify:quick` passes

**Deliverables**:
- Updated `prisma/schema.prisma` with constraints and indexes
- Migration file: `prisma/migrations/*/add_referential_integrity_and_indexes/migration.sql`
- Test suite: `tests/database/schema.test.ts`
- All verification checks passing

**Verification**: 
- Final review of all changes
- All acceptance criteria documented in spec.md are met
