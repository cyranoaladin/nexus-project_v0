# Technical Specification - Full Project Testing & Validation

**Task ID**: tests-locaux-41a0  
**Version**: 1.0  
**Status**: Ready for Implementation  
**Based on**: requirements.md (v1.0)

---

## 1. Technical Context

### 1.1 Technology Stack

**Frontend & Backend**:
- Next.js 15.5.11 (App Router)
- React 18.3.1
- TypeScript 5 (strict mode)
- Tailwind CSS 4.1.18

**Database**:
- Prisma ORM 6.13.0
- PostgreSQL 15+ (production)
- SQLite (development fallback)

**Testing Frameworks**:
- Jest 29.7.0 (unit + integration)
- Playwright 1.58.1 (E2E)
- Testing Library (React 14.3.1, User Event 14.6.1)

**Build & Development**:
- Node.js 20.x
- npm (package manager)
- Docker & Docker Compose

**Key Dependencies**:
- NextAuth 4.24.11 (authentication)
- Zod 3.23.8 (validation)
- OpenAI 4.104.0 (AI assistant)
- Nodemailer 7.0.13 (email)

### 1.2 Current Project Structure

```
nexus-reussite-app/
├── app/                         # Next.js App Router
│   ├── api/                     # API routes
│   ├── (dashboard)/             # Protected dashboard routes
│   └── [public-pages]/          # Public pages
├── __tests__/                   # Test files
│   ├── api/                     # Integration tests (54 test files)
│   ├── components/              # Unit tests (components)
│   ├── lib/                     # Unit tests (utilities)
│   ├── database/                # Database tests
│   ├── middleware/              # Middleware tests
│   └── ui/                      # UI component tests
├── e2e/                         # E2E tests (8 spec files)
│   ├── helpers/                 # Test helpers
│   └── *.spec.ts                # Test scenarios
├── lib/                         # Shared libraries
│   ├── api/                     # API utilities
│   ├── validation/              # Validation schemas
│   └── *.ts                     # Core utilities
├── prisma/
│   ├── schema.prisma            # Database schema
│   ├── migrations/              # Migration history
│   └── seed.ts                  # Seed script
├── scripts/
│   ├── setup-e2e-db.sh         # E2E DB setup
│   ├── teardown-e2e-db.sh      # E2E DB cleanup
│   └── seed-e2e-db.ts          # E2E seed data
├── docker-compose.yml          # Dev environment
├── docker-compose.e2e.yml      # E2E test environment
├── docker-compose.prod.yml     # Production environment
├── jest.config.unit.js         # Unit test config
├── jest.config.integration.js  # Integration test config
└── playwright.config.ts        # E2E test config
```

### 1.3 Test Configuration Summary

**Unit Tests** (`jest.config.unit.js`):
- Environment: `jest-environment-jsdom`
- Patterns: `__tests__/lib/**/*.test.ts(x)`, `__tests__/components/ui/**/*.test.ts(x)`, `tests/**/*.test.ts(x)`
- Coverage threshold: 70% (branches, functions, lines, statements)

**Integration Tests** (`jest.config.integration.js`):
- Environment: `node`
- Patterns: `__tests__/api/**/*.test.ts`, `__tests__/database/**/*.test.ts`, `__tests__/middleware/**/*.test.ts`
- Max workers: 1 (serial execution to avoid DB conflicts)
- Coverage threshold: 70%

**E2E Tests** (`playwright.config.ts`):
- Test directory: `./e2e`
- Base URL: `http://localhost:3000`
- Browsers: Chromium, Firefox, WebKit
- Retries: 0 locally, 2 in CI
- Web server: `npm run dev` (auto-started)

---

## 2. Implementation Approach

### 2.1 Five-Phase Strategy

This implementation follows a sequential, incremental approach to ensure systematic validation:

**Phase 1: Environment & Build Validation**
- Validate environment setup
- Run build and fix all build errors
- Ensure lint and typecheck pass
- Generate Prisma client

**Phase 2: Unit Test Execution & Fixes**
- Run all unit tests
- Fix failing tests
- Handle empty test files (skip or implement critical ones)
- Verify 100% pass rate

**Phase 3: Integration Test Execution & Fixes**
- Setup development database
- Run all integration tests
- Fix API, database, and middleware issues
- Verify 100% pass rate

**Phase 4: E2E Test Execution & Fixes**
- Setup E2E database environment
- Run all E2E tests
- Fix UI, navigation, and workflow issues
- Verify 100% pass rate (no flaky tests)

**Phase 5: Production Environment Validation**
- Build and start production Docker containers
- Validate health checks
- Run smoke tests on production build
- Document final results and commit all changes

### 2.2 Error Resolution Workflow

For each phase, apply this systematic approach:

1. **Execute**: Run the relevant command (build, test suite, etc.)
2. **Capture**: Save full error output and logs
3. **Categorize**: Classify errors by priority (P0-P3)
4. **Fix**: Implement minimal, targeted fixes
5. **Verify**: Re-run to confirm fix doesn't break other tests
6. **Commit**: Commit changes with clear message
7. **Repeat**: Continue until 100% success

**Priority Levels**:
- **P0 (Critical)**: Build failures, server crashes, auth broken → Fix immediately
- **P1 (High)**: Core feature test failures (booking, payments) → Fix in same phase
- **P2 (Medium)**: Secondary feature failures → Fix if time permits
- **P3 (Low)**: Warnings, minor issues → Document and defer

### 2.3 Test Isolation Strategy

**Unit Tests**:
- No database access (use mocks)
- Mock external APIs (Prisma, NextAuth, OpenAI, Nodemailer)
- Use `jest.mock()` for module mocking
- JSDOM environment for React component rendering

**Integration Tests**:
- Real PostgreSQL database (port 5434 for dev)
- Transaction-based isolation (rollback after each test)
- Mock external services (email, payments, AI)
- Setup: `jest.setup.integration.js`

**E2E Tests**:
- Isolated PostgreSQL (port 5435)
- Full application stack (Next.js + DB)
- Real browser automation
- Ephemeral database (docker-compose.e2e.yml with tmpfs)
- Setup/teardown scripts

---

## 3. Source Code Changes

### 3.1 Expected File Modifications

Based on analysis, the following files may need fixes:

**Build/TypeScript Errors**:
- API route handlers (`app/api/**/*.ts`)
- Type definitions (`types/**/*.ts`)
- Library functions with type mismatches (`lib/**/*.ts`)

**Test Fixes**:
- Empty test files (0 bytes):
  - `__tests__/api-bilan-gratuit.test.ts`
  - `__tests__/bilan-gratuit-integration.test.tsx`
  - `__tests__/form-validation.test.ts`
  - `__tests__/validation-simple.test.ts`
- Failing unit tests in `__tests__/lib/**/*.test.ts`
- Failing integration tests in `__tests__/api/**/*.test.ts`
- Failing E2E tests in `e2e/**/*.spec.ts`

**Configuration Files** (if needed):
- `.env.production` - Production environment variables
- Environment variable validation

### 3.2 Code Quality Standards

All fixes must adhere to:
- No `any` types (use proper TypeScript types)
- No `@ts-ignore` or `eslint-disable` comments
- No `console.log` (use proper logger from `lib/logger.ts`)
- Follow existing code patterns (check neighboring files)
- Use existing utilities (don't reinvent)

### 3.3 Database Considerations

**Schema** (`prisma/schema.prisma`):
- Provider: PostgreSQL (production)
- Key models: User, Student, Parent, Coach, SessionBooking, Payment
- Enums: UserRole, SessionStatus, PaymentStatus, etc.

**Migrations**:
- Use `npm run db:migrate:deploy` (production)
- Use `npm run db:migrate` (development)
- Never modify existing migrations

**Seeding**:
- Development: `npm run db:seed` (prisma/seed.ts)
- E2E tests: `scripts/seed-e2e-db.ts`

---

## 4. Data Model & API Changes

### 4.1 No Schema Changes Expected

This task is validation-only; no database schema changes are planned. If schema issues are discovered:
1. Document the issue
2. Create a minimal migration if absolutely necessary
3. Test migration on fresh database
4. Apply to all environments

### 4.2 API Route Validation

All API routes must follow project conventions:

**Authentication** (from `lib/auth.ts`):
```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const session = await getServerSession(authOptions);
if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Error Handling** (from `lib/api-error.ts`):
```typescript
import { ApiError, handleApiError } from '@/lib/api-error';

try {
  // ... API logic
} catch (error) {
  return handleApiError(error);
}
```

**Validation** (using Zod schemas from `lib/validation/`):
```typescript
import { bookingSchema } from '@/lib/validation/session-booking';

const result = bookingSchema.safeParse(body);
if (!result.success) {
  return NextResponse.json({ error: result.error }, { status: 400 });
}
```

---

## 5. Testing Approach

### 5.1 Unit Test Patterns

**Component Testing** (React Testing Library):
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByTestId('my-component')).toBeInTheDocument();
  });
});
```

**Utility Testing**:
```typescript
describe('calculateTotal', () => {
  it('sums session prices correctly', () => {
    const sessions = [{ price: 50 }, { price: 30 }];
    expect(calculateTotal(sessions)).toBe(80);
  });
});
```

### 5.2 Integration Test Patterns

**API Route Testing**:
```typescript
import { createMocks } from 'node-mocks-http';
import handler from '@/app/api/sessions/route';

describe('GET /api/sessions', () => {
  it('returns sessions for authenticated user', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      headers: { cookie: 'session=valid-token' },
    });
    
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
  });
});
```

**Database Testing**:
```typescript
import { prisma } from '@/lib/prisma';

describe('User model', () => {
  afterEach(async () => {
    await prisma.user.deleteMany();
  });

  it('creates user with hashed password', async () => {
    const user = await prisma.user.create({
      data: { email: 'test@example.com', password: 'hashed' },
    });
    expect(user.id).toBeDefined();
  });
});
```

### 5.3 E2E Test Patterns

**Authentication Flow**:
```typescript
import { test, expect } from '@playwright/test';

test('user can login and access dashboard', async ({ page }) => {
  await page.goto('/auth/signin');
  
  await page.getByTestId('email-input').fill('test@example.com');
  await page.getByTestId('password-input').fill('password');
  await page.getByTestId('login-button').click();
  
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByTestId('user-menu')).toBeVisible();
});
```

**Best Practices**:
- Use `data-testid` attributes (not CSS selectors)
- Use explicit waits (`waitForSelector`, `expect().toBeVisible()`)
- Disable animations: `page.emulateMedia({ reducedMotion: 'reduce' })`
- Run 3 times to verify no flakiness

---

## 6. Delivery Phases

### Phase 1: Environment & Build (Est: 30 min)

**Objectives**:
- Validate environment setup
- Fix all build errors
- Pass lint and typecheck

**Tasks**:
1. Check Node.js, npm, Docker versions
2. Install dependencies: `npm install`
3. Generate Prisma client: `npm run db:generate`
4. Run build: `npm run build`
5. Fix TypeScript errors
6. Run lint: `npm run lint`
7. Fix ESLint errors
8. Run typecheck: `npm run typecheck`
9. Fix remaining type issues

**Success Criteria**:
- `npm run build` → Success
- `npm run lint` → 0 errors
- `npm run typecheck` → 0 errors

**Deliverable**: Commit "fix: resolve build and type errors"

---

### Phase 2: Unit Tests (Est: 1-2 hours)

**Objectives**:
- Execute all unit tests
- Fix failing tests
- Achieve 100% pass rate

**Tasks**:
1. Run unit tests: `npm run test:unit`
2. Identify failing tests
3. Fix each test systematically:
   - Update mocks if needed
   - Fix assertions
   - Update test data
4. Handle empty test files:
   - Skip if non-critical
   - Implement if critical path
5. Re-run until 100% pass

**Success Criteria**:
- All unit tests pass (X/X tests)
- No skipped tests (unless documented)
- Coverage ≥70%

**Deliverable**: Commit "test: fix unit test failures"

---

### Phase 3: Integration Tests (Est: 2-3 hours)

**Objectives**:
- Execute all integration tests
- Fix API and database issues
- Achieve 100% pass rate

**Tasks**:
1. Start development database: `npm run docker:up`
2. Apply migrations: `npm run db:migrate:deploy`
3. Run integration tests: `npm run test:integration`
4. Fix failing tests:
   - API route errors
   - Database query issues
   - Authentication/authorization bugs
   - Validation errors
5. Verify RBAC permissions
6. Re-run until 100% pass

**Success Criteria**:
- All integration tests pass (Y/Y tests)
- Database transactions isolated
- No flaky tests

**Deliverable**: Commit "test: fix integration test failures"

---

### Phase 4: E2E Tests (Est: 2-3 hours)

**Objectives**:
- Execute all E2E tests
- Fix UI and workflow issues
- Achieve 100% pass rate (no flakiness)

**Tasks**:
1. Setup E2E database: `npm run test:e2e:setup`
2. Run E2E tests: `npm run test:e2e`
3. Fix failing tests:
   - Update selectors to use data-testid
   - Fix navigation issues
   - Resolve workflow errors
   - Add proper waits
4. Run 3 times to verify stability
5. Teardown: `npm run test:e2e:teardown`

**Success Criteria**:
- All E2E tests pass (Z/Z tests)
- No flaky tests (3 consecutive passes)
- Screenshots available for failures

**Deliverable**: Commit "test: fix E2E test failures"

---

### Phase 5: Production Validation (Est: 1-2 hours)

**Objectives**:
- Validate production environment
- Ensure all services run correctly
- Document final results

**Tasks**:
1. Create `.env.production` with all required variables
2. Build production Docker images:
   ```bash
   docker-compose -f docker-compose.prod.yml build
   ```
3. Start production stack:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```
4. Validate health checks:
   ```bash
   curl http://localhost/api/health
   ```
5. Check all services:
   - PostgreSQL: `docker logs nexus-postgres-prod`
   - Next.js App: `docker logs nexus-app-prod`
   - Nginx: `docker logs nexus-nginx-prod`
6. Run smoke tests (manual or automated)
7. Stop stack: `docker-compose -f docker-compose.prod.yml down`

**Success Criteria**:
- All containers start successfully
- All health checks pass
- Application serves pages without errors
- Database is accessible

**Deliverable**: Commit "chore: validate production environment"

---

### Phase 6: Final Verification & Commit (Est: 30 min)

**Objectives**:
- Run full verification suite
- Commit all changes
- Document completion

**Tasks**:
1. Run full verification: `npm run verify`
2. Verify all checks pass:
   - Lint ✅
   - TypeCheck ✅
   - Unit Tests ✅
   - Integration Tests ✅
   - E2E Tests ✅
   - Build ✅
3. Review all commits
4. Create final summary commit:
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

**Success Criteria**:
- `npm run verify` passes completely
- All changes committed with clear messages
- Git history is clean

**Deliverable**: Final commit + task completion report

---

## 7. Verification Approach

### 7.1 Automated Verification

**Quick Verification** (5 min):
```bash
npm run verify:quick
# Runs: lint + typecheck + unit + integration
```

**Full Verification** (10 min):
```bash
npm run verify
# Runs: lint + typecheck + unit + integration + E2E + build
```

**Continuous Verification**:
- Run after each fix
- Verify no regressions
- Commit only when passing

### 7.2 Manual Verification

**Production Environment**:
1. Start production stack
2. Open browser: `http://localhost`
3. Test critical flows:
   - Homepage loads
   - Login works
   - Dashboard accessible
   - API responds
4. Check logs for errors

**Database Verification**:
```bash
# Connect to prod DB
docker exec -it nexus-postgres-prod psql -U nexus_user -d nexus_reussite_prod

# Check tables
\dt

# Verify data
SELECT * FROM "User" LIMIT 5;
```

### 7.3 Success Metrics

**Quantitative**:
- Build time: <5 minutes
- Test execution: <10 minutes (all tests)
- Test pass rate: 100%
- Docker startup: <2 minutes

**Qualitative**:
- All critical workflows function
- No errors in production logs
- Code is maintainable
- Deployment confidence is high

---

## 8. Risk Mitigation

### 8.1 Known Risks & Solutions

| Risk | Impact | Mitigation |
|------|--------|------------|
| Empty test files | Medium | Skip non-critical ones, implement critical ones |
| Flaky E2E tests | High | Use data-testid, explicit waits, reducedMotion |
| Build timeout | Medium | Increase timeout, optimize dependencies |
| Port conflicts | Low | Use Docker networks, check availability |
| Database migration issues | High | Test on fresh DB, backup before apply |
| Environment variable issues | High | Validate all required vars before starting |

### 8.2 Rollback Strategy

If critical issues are discovered:
1. Document the issue clearly
2. Revert problematic changes: `git revert <commit>`
3. Re-run verification
4. Investigate root cause
5. Implement proper fix

### 8.3 Debugging Tools

**Jest Tests**:
```bash
npm run test:unit -- --verbose --no-coverage
npm run test:integration -- --verbose --runInBand
```

**Playwright Tests**:
```bash
npm run test:e2e:debug     # Debug mode
npm run test:e2e:ui        # UI mode
npm run test:e2e:headed    # Headed browser
```

**Docker Logs**:
```bash
docker logs nexus-app-prod --follow
docker-compose -f docker-compose.prod.yml logs -f
```

---

## 9. Dependencies & Constraints

### 9.1 Technical Dependencies

**Required Software**:
- Node.js 20.x
- npm 9+
- Docker 24+
- Docker Compose 2+
- PostgreSQL 15+ (via Docker)

**Required Environment Variables** (`.env.production`):
```env
# Database
DATABASE_URL="postgresql://nexus_user:password@postgres:5432/nexus_reussite_prod"

# NextAuth
NEXTAUTH_URL="http://localhost"
NEXTAUTH_SECRET="<min-32-chars-secret>"

# SMTP (required for emails)
SMTP_HOST="smtp.example.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="user@example.com"
SMTP_PASSWORD="password"
SMTP_FROM="noreply@example.com"
EMAIL_FROM="Nexus Réussite <noreply@example.com>"

# Optional (can be empty)
OPENAI_API_KEY=""
KONNECT_API_KEY=""
```

### 9.2 Constraints

**Time**:
- No specific deadline
- Focus on thoroughness over speed
- Estimated: 8-12 hours total

**Resources**:
- Sufficient disk space for Docker volumes (~5GB)
- Sufficient RAM for Docker containers (4GB recommended)
- Isolated testing environment (no production impact)

### 9.3 Assumptions

1. Codebase is generally functional (no major architectural issues)
2. Test infrastructure is properly configured
3. Docker and PostgreSQL are available
4. Environment variables can be configured
5. Goal is validation, not feature development

---

## 10. Out of Scope

Explicitly **NOT** included:
- New feature development
- UI/UX improvements
- Performance optimization (unless blocking tests)
- Security enhancements (unless blocking tests)
- Documentation updates (unless critical)
- Dependency upgrades (unless fixing bugs)
- Code refactoring (unless fixing bugs)
- Infrastructure changes (beyond testing needs)

---

## 11. Appendix

### 11.1 Command Reference

```bash
# Build & Quality
npm run build              # Production build
npm run lint               # ESLint
npm run typecheck          # TypeScript

# Database
npm run db:generate        # Generate Prisma client
npm run db:migrate:deploy  # Apply migrations
npm run db:seed            # Seed data

# Unit Tests
npm run test:unit          # Run unit tests
npm run test:unit:watch    # Watch mode

# Integration Tests
npm run test:integration   # Run integration tests

# E2E Tests
npm run test:e2e:setup     # Setup E2E DB
npm run test:e2e           # Run E2E tests
npm run test:e2e:teardown  # Cleanup E2E DB
npm run test:e2e:full      # Full E2E workflow

# Combined
npm run test               # Unit + Integration
npm run test:all           # Unit + Integration + E2E
npm run verify             # Full verification
npm run verify:quick       # Quick verification

# Docker
npm run docker:up          # Start dev containers
npm run docker:down        # Stop dev containers
docker-compose -f docker-compose.prod.yml up -d --build  # Production
```

### 11.2 File Locations

**Configuration**:
- `package.json` - Scripts and dependencies
- `jest.config.unit.js` - Unit test config
- `jest.config.integration.js` - Integration test config
- `playwright.config.ts` - E2E test config
- `docker-compose.prod.yml` - Production Docker config

**Tests**:
- `__tests__/` - Unit and integration tests
- `e2e/` - E2E test scenarios
- `scripts/` - Helper scripts

**Documentation**:
- `docs/TEST_STRATEGY.md` - Test strategy
- `docs/CI_PIPELINE.md` - CI/CD pipeline
- `docs/DEPLOY_PRODUCTION.md` - Deployment guide

### 11.3 Related Documentation

- [Product Requirements](./requirements.md) - Full PRD
- [Implementation Plan](./plan.md) - Detailed task breakdown
- [Test Strategy](../../docs/TEST_STRATEGY.md) - Testing guidelines
- [API Conventions](../../docs/API_CONVENTIONS.md) - API standards

---

**Document Status**: Ready for Planning Phase  
**Next Step**: Create detailed implementation plan with concrete tasks  
**Estimated Effort**: 8-12 hours (6 phases)  
**Last Updated**: 2026-02-06
