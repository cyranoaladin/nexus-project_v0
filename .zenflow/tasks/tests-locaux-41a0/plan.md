# Full SDD workflow

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Workflow Steps

### [x] Step: Requirements
<!-- chat-id: a62b11a2-cf6e-4ee7-9866-5f5ad574ed7b -->

Create a Product Requirements Document (PRD) based on the feature description.

1. Review existing codebase to understand current architecture and patterns
2. Analyze the feature definition and identify unclear aspects
3. Ask the user for clarifications on aspects that significantly impact scope or user experience
4. Make reasonable decisions for minor details based on context and conventions
5. If user can't clarify, make a decision, state the assumption, and continue

Save the PRD to `{@artifacts_path}/requirements.md`.

### [x] Step: Technical Specification
<!-- chat-id: 5eb14119-696a-4a34-b299-6fd456998f2c -->

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

Create a detailed implementation plan based on `{@artifacts_path}/spec.md`.

**Plan created**: The implementation is broken down into 6 phases with specific tasks and verification steps below.

---

## Implementation Steps

### [ ] Step 1: Environment & Build Validation
<!-- chat-id: 86e55812-8c6f-4046-8589-99f06d251601 -->

Validate environment setup and fix all build errors.

**Tasks**:
- Check system requirements (Node.js 20.x, npm, Docker)
- Install dependencies: `npm install`
- Generate Prisma client: `npm run db:generate`
- Run build: `npm run build` and fix TypeScript errors
- Run lint: `npm run lint` and fix ESLint errors
- Run typecheck: `npm run typecheck` and fix type errors

**Verification**:
- [ ] `npm run build` completes successfully
- [ ] `npm run lint` passes with 0 errors
- [ ] `npm run typecheck` passes with 0 errors

**Deliverable**: Commit "fix: resolve build and type errors"

---

### [ ] Step 2: Unit Test Execution & Fixes

Execute all unit tests and fix failures to achieve 100% pass rate.

**Tasks**:
- Run unit tests: `npm run test:unit`
- Identify all failing tests and categorize by priority
- Fix failing tests systematically:
  - Update mocks for external dependencies (Prisma, NextAuth, OpenAI)
  - Fix broken assertions
  - Update test data and fixtures
  - Handle empty test files (skip non-critical, implement critical)
- Re-run tests after each batch of fixes
- Verify 100% pass rate with no skipped tests

**Verification**:
- [ ] All unit tests pass (X/X tests)
- [ ] No skipped tests (unless documented)
- [ ] Coverage ≥70%
- [ ] Tests run deterministically (same result on repeat)

**Deliverable**: Commit "test: fix unit test failures"

---

### [ ] Step 3: Integration Test Execution & Fixes

Execute all integration tests with database and fix API/database issues.

**Tasks**:
- Start development database: `npm run docker:up`
- Apply database migrations: `npm run db:migrate:deploy`
- Seed test data if needed: `npm run db:seed`
- Run integration tests: `npm run test:integration`
- Fix failing tests:
  - API route handler errors
  - Database query issues (Prisma queries)
  - Authentication/authorization bugs
  - Validation schema errors (Zod)
  - Transaction isolation issues
- Verify RBAC (Role-Based Access Control) permissions
- Re-run tests until 100% pass rate

**Verification**:
- [ ] All integration tests pass (Y/Y tests)
- [ ] Database transactions are properly isolated
- [ ] No flaky tests (consistent results)
- [ ] All API routes follow project conventions

**Deliverable**: Commit "test: fix integration test failures"

---

### [ ] Step 4: E2E Test Execution & Fixes

Execute all E2E tests and fix UI/workflow issues to achieve stable pass rate.

**Tasks**:
- Setup E2E database environment: `npm run test:e2e:setup`
- Run E2E tests: `npm run test:e2e`
- Fix failing tests:
  - Update selectors to use `data-testid` attributes
  - Fix navigation and routing issues
  - Resolve workflow errors
  - Add explicit waits (avoid race conditions)
  - Disable animations in test mode
- Run tests 3 consecutive times to verify stability (no flaky tests)
- Review screenshots/traces for any failures
- Teardown E2E environment: `npm run test:e2e:teardown`

**Verification**:
- [ ] All E2E tests pass (Z/Z tests)
- [ ] Tests pass 3 consecutive times (no flakiness)
- [ ] All critical user workflows tested (auth, booking, dashboard)
- [ ] Screenshots captured for any failures

**Deliverable**: Commit "test: fix E2E test failures"

---

### [ ] Step 5: Production Environment Validation

Validate the application runs correctly in production-like conditions.

**Tasks**:
- Create/validate `.env.production` with all required variables:
  - DATABASE_URL (PostgreSQL connection)
  - NEXTAUTH_URL and NEXTAUTH_SECRET
  - SMTP credentials (email functionality)
  - Optional: OPENAI_API_KEY, payment keys
- Build production Docker images:
  ```bash
  docker-compose -f docker-compose.prod.yml build
  ```
- Start production stack:
  ```bash
  docker-compose -f docker-compose.prod.yml up -d
  ```
- Validate all services:
  - Check PostgreSQL container: `docker logs nexus-postgres-prod`
  - Check Next.js app container: `docker logs nexus-app-prod`
  - Check Nginx container: `docker logs nexus-nginx-prod`
- Test health endpoint: `curl http://localhost/api/health`
- Verify database connectivity and migrations
- Test critical workflows manually or with smoke tests
- Stop production stack: `docker-compose -f docker-compose.prod.yml down`

**Verification**:
- [ ] All Docker containers start successfully
- [ ] Health checks pass for all services
- [ ] Application serves pages without errors
- [ ] Database is accessible and migrations applied
- [ ] Nginx proxies requests correctly

**Deliverable**: Commit "chore: validate production environment"

---

### [ ] Step 6: Final Verification & Commit

Run full verification suite and commit all changes.

**Tasks**:
- Run full verification: `npm run verify`
- Verify all checks pass:
  - Lint ✅
  - TypeCheck ✅
  - Unit Tests ✅
  - Integration Tests ✅
  - E2E Tests ✅
  - Build ✅
- Review all commits for clarity and organization
- Create final summary commit:
  ```
  chore: complete comprehensive testing and validation
  
  - Build: ✅ Passing
  - Lint: ✅ Passing
  - TypeCheck: ✅ Passing
  - Unit Tests: ✅ 100% (X/X tests)
  - Integration Tests: ✅ 100% (Y/Y tests)
  - E2E Tests: ✅ 100% (Z/Z tests)
  - Production: ✅ Validated
  
  All corrections committed to main folder.
  ```
- Verify git history is clean and logical

**Verification**:
- [ ] `npm run verify` passes completely
- [ ] All changes committed with clear messages
- [ ] No uncommitted changes remain
- [ ] Git history is clean and organized

**Deliverable**: Final summary commit + task completion

---

## Testing Strategy Summary

**Command Reference**:
```bash
# Quick Verification (5 min)
npm run verify:quick    # lint + typecheck + unit + integration

# Full Verification (10 min)
npm run verify          # All checks + E2E + build

# Individual Test Suites
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e:full   # E2E tests (setup + run + teardown)
```

**Error Resolution Approach**:
1. Execute test suite
2. Capture error output and logs
3. Categorize errors (P0: Critical → P3: Low)
4. Fix systematically (minimal, targeted fixes)
5. Re-run to verify fix doesn't break other tests
6. Commit changes incrementally
7. Repeat until 100% pass rate

**Success Metrics**:
- Build time: <5 minutes
- Test execution: <10 minutes (all tests)
- Test pass rate: 100%
- Code coverage: ≥70%
- Docker startup: <2 minutes
