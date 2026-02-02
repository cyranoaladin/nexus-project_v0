# Product Requirements Document (PRD)
## Optimisation et sécurisation du schéma Prisma

**Project**: Nexus Réussite  
**Task ID**: optimisation-et-securisation-du-d5ee  
**Date**: 2026-02-02  
**Status**: Requirements Phase

---

## 1. Executive Summary

This task focuses on optimizing and securing the Prisma schema for the Nexus Réussite platform by:
- Adding referential integrity constraints (`onDelete: Cascade`) to critical relations
- Creating performance indexes on frequently queried fields (`userId`, `sessionId`, `role`)
- Ensuring data consistency through automated integrity tests
- Preparing the schema for future scalability while maintaining current PostgreSQL compatibility

---

## 2. Background & Context

### Current State

**Database**: PostgreSQL 15+ (SQLite support removed as per `docs/DB_STRATEGY.md:4`)

**Schema Location**: `prisma/schema.prisma` (718 lines, 30+ models)

**Existing Optimizations**:
- ✅ Some `onDelete: Cascade` constraints already present (20 out of ~26 relations)
- ✅ Partial indexing on `SessionBooking`, `SessionNotification`, `SessionReminder`, `CoachAvailability`
- ✅ Unique constraints for idempotency (`payments_externalId_method_key`, `cron_executions_job_key`)
- ✅ Partial indexes via raw SQL migrations (credit transactions, session overlap prevention)

**Gaps Identified**:
1. **Missing `onDelete` constraints** on 6+ relations:
   - `Session.coach` → `CoachProfile` (line 269)
   - `Payment.user` → `User` (line 391)
   - `Message.sender` → `User` (line 419)
   - `Message.receiver` → `User` (line 422)
   - `StudentBadge.badge` → `Badge` (line 354)
   - `StudentReport.coach` → `CoachProfile` (line 369)

2. **Missing performance indexes** on:
   - `User.role` (frequent RBAC queries)
   - `Session.studentId` (not indexed individually)
   - `Session.coachId` (not indexed individually)
   - `AriaConversation.studentId`
   - `AriaMessage.conversationId`
   - `Notification.userId` and `userRole`
   - `CreditTransaction.studentId` and `sessionId`
   - `Subscription.studentId`

3. **No automated integrity testing** to validate:
   - Cascade deletions work correctly
   - Foreign key constraints are enforced
   - Indexes improve query performance
   - Data consistency after schema changes

---

## 3. Goals & Objectives

### Primary Goals

1. **Data Integrity**: Prevent orphaned records by ensuring all child records are deleted when parent records are removed
2. **Query Performance**: Reduce query execution time on high-frequency operations (user lookups, session queries, role-based access)
3. **Schema Reliability**: Automated tests to catch schema regressions before deployment
4. **PostgreSQL Optimization**: Leverage PostgreSQL-specific features for production readiness

### Success Metrics

- ✅ All foreign key relations have explicit `onDelete` behavior defined
- ✅ Query performance improvement of 30%+ on indexed fields (measured via `EXPLAIN ANALYZE`)
- ✅ 100% test coverage on schema integrity (cascades, indexes, constraints)
- ✅ Zero migration errors in CI/CD pipeline
- ✅ Schema passes `npm run verify:quick` without type errors

---

## 4. Functional Requirements

### 4.1 Cascade Delete Constraints

**Requirement**: Add `onDelete: Cascade` to all parent-child relations where child data has no independent value without the parent.

**Affected Relations**:

| Model | Field | Target | Current | Required | Rationale |
|-------|-------|--------|---------|----------|-----------|
| `Session` | `coach` | `CoachProfile` | None | `Cascade` | Sessions tied to specific coach; retain historical data via soft delete |
| `Payment` | `user` | `User` | None | `Restrict` | Payments should prevent user deletion (financial audit) |
| `Message` | `sender` | `User` | None | `SetNull` | Keep message history even if user deleted |
| `Message` | `receiver` | `User` | None | `SetNull` | Keep message history even if user deleted |
| `StudentBadge` | `badge` | `Badge` | None | `Restrict` | Badges are reusable; don't cascade delete |
| `StudentReport` | `coach` | `CoachProfile` | None | `SetNull` | Preserve reports even if coach leaves |

**Clarifications Needed**:
- ❓ Should `Session.coach` use `Cascade` or `SetNull`? (Impact: deleting a coach profile would cascade-delete all their sessions)
- ❓ Should `Payment.user` prevent deletion (`Restrict`) or allow it (`SetNull`)? (Impact: financial compliance)
- ❓ Are there soft-delete patterns in use that conflict with hard cascade deletes?

**Assumptions** (pending clarification):
- Assume `Session.coach` → `SetNull` (preserve session history even if coach profile removed)
- Assume `Payment.user` → `Restrict` (cannot delete user with payment history)
- Assume `Message` relations → `SetNull` (anonymize messages rather than delete)
- Assume `StudentBadge.badge` → `Restrict` (badge definitions are system-level data)
- Assume `StudentReport.coach` → `SetNull` (preserve educational records)

### 4.2 Performance Indexes

**Requirement**: Create indexes on fields used in frequent queries (WHERE clauses, JOINs, ORDER BY).

**Index Strategy**:

| Table | Index Fields | Type | Rationale |
|-------|-------------|------|-----------|
| `users` | `[role]` | Single | RBAC filtering (`WHERE role = 'COACH'`) |
| `sessions` | `[studentId]` | Single | Student session history |
| `sessions` | `[coachId]` | Single | Coach session dashboard |
| `sessions` | `[status]` | Single | Status-based filtering |
| `aria_conversations` | `[studentId, updatedAt]` | Composite | Student chat history (sorted) |
| `aria_messages` | `[conversationId, createdAt]` | Composite | Message threading |
| `notifications` | `[userId, read]` | Composite | Unread notification queries |
| `credit_transactions` | `[studentId, createdAt]` | Composite | Transaction history |
| `credit_transactions` | `[sessionId]` | Single | Session-related transactions |
| `subscriptions` | `[studentId, status]` | Composite | Active subscription lookup |

**Rationale**: Fields appearing in `WHERE`, `JOIN`, `ORDER BY` clauses in:
- Dashboard queries (coach/student session lists)
- RBAC middleware (`guards.ts`)
- Credit allocation (`credits.ts`)
- Notification systems

### 4.3 Schema Integrity Tests

**Requirement**: Create automated test suite in `tests/database/schema.test.ts`.

**Test Coverage**:

1. **Cascade Delete Tests**
   - ✅ Deleting a `User` cascades to `ParentProfile`, `StudentProfile`, `CoachProfile`
   - ✅ Deleting a `Student` cascades to `Subscription`, `CreditTransaction`, `Session`, `AriaConversation`
   - ✅ Deleting a `SessionBooking` cascades to `SessionNotification`, `SessionReminder`
   - ✅ Foreign key violations are caught (e.g., cannot delete `Badge` if referenced by `StudentBadge`)

2. **Index Validation Tests**
   - ✅ Verify indexes exist via raw SQL (`pg_indexes` table)
   - ✅ Performance benchmarks (query with/without index)
   - ✅ Composite index usage verification (`EXPLAIN` output)

3. **Constraint Tests**
   - ✅ Unique constraints enforced (`@@unique`)
   - ✅ Idempotency constraints work (`payments_externalId_method_key`)
   - ✅ Session overlap prevention (`SessionBooking_no_overlap_excl`)

**Test Framework**: Jest + `@prisma/client`

**Database**: PostgreSQL test instance (Docker Compose or CI service container)

---

## 5. Non-Functional Requirements

### 5.1 Performance

- **Query Latency**: Indexed queries should complete in <50ms (P95)
- **Migration Time**: Schema migrations should complete in <5 minutes on production data (estimated 100K+ records)
- **Index Size**: Total index overhead should not exceed 20% of table size

### 5.2 Compatibility

- **Database**: PostgreSQL 15+ (current production version)
- **Prisma Version**: `^6.13.0` (as per `package.json:47`)
- **Migration Strategy**: Additive only (no breaking changes to existing data)

**Clarification Needed**:
- ❓ Task description mentions "sans casser la compatibilité SQLite actuelle" but `DB_STRATEGY.md:4` states SQLite support was removed. Should we:
  - **Option A**: Ignore SQLite compatibility (align with docs)
  - **Option B**: Maintain dual-provider support (contradicts docs)
  - **Recommended**: Proceed with PostgreSQL-only optimizations (align with current strategy)

**Assumption**: Proceed with PostgreSQL-only optimizations as per existing strategy.

### 5.3 Testing

- **Unit Tests**: All schema changes covered by `tests/database/schema.test.ts`
- **Integration Tests**: Existing API tests (`__tests__/api/*`) should pass without modification
- **CI/CD**: Tests run in GitHub Actions with PostgreSQL 15 service container
- **Coverage**: 100% of new indexes and cascade rules tested

### 5.4 Documentation

- **Schema Comments**: Add inline comments in `schema.prisma` explaining index rationale
- **Migration Notes**: Document breaking changes (if any) in migration file comments
- **DB Strategy Update**: Update `docs/DB_STRATEGY.md` with new optimization section

---

## 6. Technical Constraints

### 6.1 Existing Patterns

- **Must respect**: Existing `@@unique` constraints and idempotency patterns
- **Must preserve**: Raw SQL constraints (EXCLUDE for session overlap, partial indexes for credit transactions)
- **Must maintain**: Soft delete patterns (if any exist in application code)

### 6.2 Migration Safety

- **Zero Downtime**: Indexes created with `CONCURRENTLY` (requires raw SQL migration)
- **Rollback Plan**: Each migration must be reversible
- **Data Validation**: No data loss from cascade deletes (test on staging first)

### 6.3 Development Workflow

- **Local Testing**: Docker Compose PostgreSQL (`localhost:5434`)
- **CI Testing**: GitHub Actions PostgreSQL service container
- **Review Process**: All schema changes require PR review
- **Verification**: `npm run verify:quick` must pass before merge

---

## 7. Out of Scope

### Explicitly Excluded

- ❌ **SQLite compatibility**: Not required based on current strategy (unless clarified otherwise)
- ❌ **Data migration scripts**: Assumes schema changes are backward-compatible
- ❌ **Application code changes**: Focus on schema only; API logic unchanged
- ❌ **Performance monitoring**: No integration with APM tools (e.g., Datadog, New Relic)
- ❌ **Soft delete implementation**: If needed, should be separate task

### Future Considerations

- **Partitioning**: For large tables (e.g., `sessions`, `credit_transactions`) as data grows
- **Materialized Views**: For dashboard queries (e.g., student progress reports)
- **Full-text Search**: On `pedagogical_contents` using PostgreSQL `tsvector`
- **Replication**: Read replicas for analytics queries

---

## 8. Open Questions & Clarifications

### Critical Questions

1. **SQLite Compatibility**: Task says "sans casser la compatibilité SQLite" but docs say SQLite removed. Which is correct?
   - **Recommendation**: Proceed with PostgreSQL-only (align with docs)

2. **Cascade Strategy**: Should `Session.coach` cascade delete or set null?
   - **Impact**: Deleting coach removes all historical sessions vs preserves them
   - **Recommendation**: `SetNull` to preserve educational records

3. **Payment Relations**: Should users with payment history be deletable?
   - **Impact**: Financial audit compliance
   - **Recommendation**: `Restrict` (prevent deletion) or soft delete pattern

4. **Soft Delete**: Does the app use soft deletes (`deletedAt` timestamp pattern)?
   - **Impact**: Cascade deletes might conflict with soft delete logic
   - **Action**: Search codebase for `deletedAt` fields

### Minor Questions

5. **Index Naming**: Use Prisma auto-naming or custom `@@index([field], name: "custom_name")`?
   - **Recommendation**: Auto-naming for consistency

6. **Test Data**: Should `schema.test.ts` use fixtures or seed data?
   - **Recommendation**: Isolated test fixtures (no dependency on `prisma/seed.ts`)

---

## 9. Acceptance Criteria

### Definition of Done

- ✅ All foreign key relations have explicit `onDelete` behavior
- ✅ Performance indexes added to specified fields (`userId`, `sessionId`, `role`, etc.)
- ✅ `tests/database/schema.test.ts` created with 100% passing tests covering:
  - Cascade delete behavior
  - Index existence and usage
  - Constraint enforcement
- ✅ Migration files generated and validated in CI
- ✅ No breaking changes to existing API tests
- ✅ `npm run verify:quick` passes (lint, typecheck, unit tests, integration tests)
- ✅ Documentation updated in `docs/DB_STRATEGY.md` (optional: if significant changes)
- ✅ Schema changes reviewed and approved
- ✅ Tested on staging environment (if available)

### Verification Steps

1. Run `npm run db:migrate` locally (Docker PostgreSQL)
2. Run `npm run test:integration` (all existing tests pass)
3. Run `npm run test -- tests/database/schema.test.ts` (new tests pass)
4. Run `npm run lint && npm run typecheck` (no errors)
5. Verify indexes exist: `npx prisma db execute --stdin <<< "SELECT * FROM pg_indexes WHERE tablename NOT LIKE 'pg_%';"`
6. Verify cascade behavior in Prisma Studio or test database

---

## 10. Dependencies & Risks

### Dependencies

- **Prisma Client**: `@prisma/client@^6.13.0` (current version)
- **PostgreSQL**: 15+ (Docker or managed service)
- **Jest**: Test framework for `schema.test.ts`
- **Existing Migrations**: All prior migrations must be applied cleanly

### Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Cascade deletes remove critical data** | Medium | High | Test on staging data; require manual confirmation for user deletions |
| **Indexes slow down writes** | Low | Medium | Monitor insert/update performance; use partial indexes if needed |
| **Migration fails in production** | Low | High | Test in staging; implement rollback plan; use `CONCURRENTLY` for indexes |
| **Breaking changes to API behavior** | Low | Medium | Run full integration test suite; manual QA on staging |
| **Conflicting soft delete logic** | Medium | Medium | Search codebase for `deletedAt` patterns; clarify with stakeholder |

---

## 11. Timeline & Milestones

**Estimated Effort**: 2-3 development days

### Milestones

1. **Requirements Review** (0.5 day)
   - Stakeholder clarifies open questions
   - Finalize cascade delete strategy

2. **Technical Specification** (0.5 day)
   - Define exact schema changes
   - Plan migration approach
   - Design test structure

3. **Implementation** (1 day)
   - Update `schema.prisma`
   - Generate migration
   - Create `schema.test.ts`

4. **Testing & Validation** (0.5 day)
   - Run full test suite
   - Performance benchmarks
   - Staging environment testing

5. **Review & Deployment** (0.5 day)
   - PR review
   - Merge to main
   - Production deployment (with monitoring)

---

## 12. Assumptions

1. **PostgreSQL-only**: Ignoring SQLite compatibility as per current DB strategy
2. **Backward-compatible migrations**: No data restructuring required
3. **No soft delete**: Assuming hard deletes unless confirmed otherwise
4. **Staging environment exists**: For pre-production validation
5. **Financial data immutability**: Payment records should not be cascade-deleted
6. **Educational record preservation**: Session and report data should survive coach/student profile changes

---

## Appendix A: Schema Analysis Summary

**Total Models**: 30  
**Relations with `onDelete`**: 20  
**Relations without `onDelete`**: 6  
**Existing Indexes**: 12 (on 5 models)  
**Proposed New Indexes**: 10+ (on 8 models)  

**High-Impact Tables** (by query frequency):
1. `users` (auth, RBAC)
2. `session_bookings` (scheduling)
3. `sessions` (legacy sessions)
4. `credit_transactions` (billing)
5. `notifications` (real-time updates)
