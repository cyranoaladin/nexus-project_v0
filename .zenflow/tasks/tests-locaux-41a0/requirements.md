# Product Requirements Document (PRD)
## Full Project Testing & Validation

**Task ID**: tests-locaux-41a0  
**Created**: 2026-02-06  
**Version**: 1.0  
**Status**: Draft

---

## 1. Executive Summary

### 1.1 Objective
Execute a comprehensive testing and validation workflow for the Nexus Réussite platform to ensure 100% functional correctness and production readiness. This includes building the entire project, fixing all build errors, launching all services in production-like conditions, and running the complete test suite (unit, integration, and E2E tests) until achieving 100% pass rate.

### 1.2 Success Criteria
- ✅ **Build**: Project builds successfully with zero errors (`npm run build`)
- ✅ **Lint**: Code passes all linting checks (`npm run lint`)
- ✅ **TypeCheck**: No TypeScript errors (`npm run typecheck`)
- ✅ **Unit Tests**: 100% pass rate (`npm run test:unit`)
- ✅ **Integration Tests**: 100% pass rate (`npm run test:integration`)
- ✅ **E2E Tests**: 100% pass rate (`npm run test:e2e`)
- ✅ **Production Environment**: Backend, frontend, and database run successfully in production mode
- ✅ **All Fixes Committed**: All corrections, modifications, and updates are committed to the main folder

### 1.3 Scope
- **In Scope**:
  - Full project build and error resolution
  - All unit tests (components, lib, validation logic)
  - All integration tests (API endpoints with database)
  - All E2E tests (full user workflows)
  - Production environment setup and validation
  - Bug fixes and code corrections
  - Commit all changes to repository
  
- **Out of Scope**:
  - New feature development
  - Infrastructure changes beyond what's needed for testing
  - Performance optimization (unless blocking tests)
  - Documentation updates (unless critical for understanding test failures)

---

## 2. Background & Context

### 2.1 Project Overview
**Nexus Réussite** is a SaaS application for educational management (LMS + back-office) that includes:
- Public pages and role-based dashboards (Admin, Assistant, Coach, Parent, Student)
- Authentication system (NextAuth with JWT)
- Session booking and management
- AI pedagogical assistant (ARIA)
- Video conferencing integration (Jitsi)
- Payment processing (Konnect/Wise)
- Subscription and credit management

### 2.2 Technical Stack
- **Frontend**: Next.js 15.5.11, React 18, TypeScript 5, Tailwind CSS 4
- **Backend**: Next.js API Routes (App Router)
- **Database**: Prisma ORM with PostgreSQL (production) / SQLite (development)
- **Authentication**: NextAuth v4 (Credentials + Prisma Adapter)
- **Testing**: Jest (unit/integration), Playwright (E2E)
- **Deployment**: Docker Compose (PostgreSQL + Next.js + Nginx)

### 2.3 Current State
Based on project analysis:
- Test infrastructure is well-defined (unit, integration, E2E configurations)
- Multiple test files exist but some are empty (0 bytes)
- Production Docker configuration exists (`docker-compose.prod.yml`)
- CI pipeline is configured but needs validation
- Test strategy documentation is comprehensive

### 2.4 Motivation
This comprehensive validation ensures:
1. All existing tests are functional and passing
2. The codebase is production-ready
3. No regressions exist in critical workflows
4. The application runs correctly in production-like conditions
5. All code quality standards are met

---

## 3. Detailed Requirements

### 3.1 Build Phase

#### 3.1.1 Build Process
- **Command**: `npm run build`
- **Expected Output**: Successful Next.js production build
- **Build Includes**:
  - TypeScript compilation
  - Next.js static optimization
  - Asset bundling
  - Public asset copying (`scripts/copy-public-assets.js`)

#### 3.1.2 Build Error Resolution
- Identify all build errors (TypeScript, ESLint, bundling)
- Fix each error at the source (no workarounds)
- Verify build completes successfully
- Document any critical fixes

#### 3.1.3 Code Quality Checks
- **Linting**: `npm run lint` must pass (ESLint)
- **Type Checking**: `npm run typecheck` must pass (TypeScript strict mode)
- **No Warnings**: Resolve critical warnings (errors are non-negotiable)

### 3.2 Database Setup

#### 3.2.1 Development Database
- Use PostgreSQL for realistic testing (SQLite in dev mode is acceptable for unit tests)
- Apply all migrations: `npm run db:migrate:deploy`
- Seed test data if needed: `npm run db:seed`

#### 3.2.2 E2E Database
- Isolated PostgreSQL instance (port 5435)
- Use Docker Compose E2E configuration
- Setup script: `npm run test:e2e:setup`
- Teardown script: `npm run test:e2e:teardown`

### 3.3 Test Execution

#### 3.3.1 Unit Tests
- **Target**: `__tests__/**/*.test.ts(x)` (components, lib, validation)
- **Command**: `npm run test:unit`
- **Environment**: JSDOM (no database)
- **Configuration**: `jest.config.unit.js`
- **Requirements**:
  - All tests must pass (100% success rate)
  - Fix any failing tests
  - Implement missing tests for empty test files if critical
  - No skipped tests (`.skip`) unless documented

#### 3.3.2 Integration Tests
- **Target**: `__tests__/api/**/*.test.ts` (API routes + database)
- **Command**: `npm run test:integration`
- **Environment**: Node.js + PostgreSQL
- **Configuration**: `jest.config.integration.js`
- **Requirements**:
  - All tests must pass (100% success rate)
  - Database transactions must be isolated
  - Fix API errors, validation issues, database queries
  - Verify RBAC (role-based access control) permissions

#### 3.3.3 E2E Tests
- **Target**: `e2e/**/*.spec.ts` (full user workflows)
- **Command**: `npm run test:e2e`
- **Environment**: Playwright (Chromium) + Next.js server + PostgreSQL
- **Configuration**: `playwright.config.ts`
- **Requirements**:
  - All tests must pass (100% success rate)
  - No flaky tests (must pass consistently on 3 consecutive runs)
  - Fix UI issues, navigation problems, workflow errors
  - Screenshots/traces captured on failure

### 3.4 Production Environment Testing

#### 3.4.1 Production Build
- Use `docker-compose.prod.yml` to simulate production
- Services required:
  - PostgreSQL (nexus-postgres-prod)
  - Next.js Application (nexus-app-prod)
  - Nginx Reverse Proxy (nexus-nginx-prod)

#### 3.4.2 Environment Configuration
- Create/validate `.env.production` with all required variables:
  - `DATABASE_URL` (PostgreSQL connection)
  - `NEXTAUTH_URL` (application URL)
  - `NEXTAUTH_SECRET` (min 32 chars)
  - SMTP credentials for emails
  - Optional: OPENAI_API_KEY, payment keys

#### 3.4.3 Health Checks
- Verify all services start successfully
- Check health endpoints (`/api/health`)
- Verify database connectivity
- Ensure Nginx proxies requests correctly

#### 3.4.4 Production Validation
- Test critical user workflows manually or with E2E tests
- Verify authentication works
- Check API routes respond correctly
- Validate database operations

### 3.5 Error Resolution Strategy

#### 3.5.1 Categorization
Errors should be categorized and prioritized:
1. **Critical (P0)**: Build failures, server crashes, authentication broken
2. **High (P1)**: Test failures in critical paths (auth, payments, bookings)
3. **Medium (P2)**: Test failures in secondary features
4. **Low (P3)**: Linting warnings, minor UI issues

#### 3.5.2 Fix Approach
For each error:
1. Identify root cause (logs, stack traces, debugging)
2. Implement minimal fix (don't over-engineer)
3. Verify fix doesn't break other tests
4. Run relevant test suite to confirm
5. Document complex fixes in commit messages

#### 3.5.3 Testing After Fixes
After fixing each category:
- Re-run affected test suite
- Run quick verification: `npm run verify:quick`
- For critical fixes, run full suite: `npm run verify`

### 3.6 Commit Requirements

#### 3.6.1 Commit Strategy
- Commit fixes incrementally (not one giant commit)
- Group related fixes together
- Use clear, descriptive commit messages

#### 3.6.2 Commit Message Format
```
<type>: <subject>

<body>

<footer>
```

**Types**:
- `fix`: Bug fixes
- `test`: Test fixes or additions
- `refactor`: Code refactoring
- `build`: Build system changes
- `chore`: Maintenance tasks

**Examples**:
```
fix: resolve TypeScript errors in session booking API

- Fix type mismatch in booking validation
- Update Prisma client usage in session handlers
- Add missing null checks

Fixes build errors in lib/session-booking.ts

---

test: fix failing unit tests in auth module

- Mock bcrypt correctly in auth tests
- Update test fixtures for new user schema
- Fix async/await issues in token validation tests

All unit tests now passing (127/127)
```

#### 3.6.3 Final Commit
After all tests pass, create a summary commit:
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

---

## 4. User Scenarios

### 4.1 Developer Scenario
**As a developer**, I need to ensure all tests pass so that I can confidently deploy to production knowing the application works correctly.

**Acceptance Criteria**:
- Can run `npm run verify` and see all checks pass
- Can build Docker production image successfully
- Can deploy to production without manual intervention

### 4.2 QA Scenario
**As a QA engineer**, I need to validate all user workflows function correctly in a production-like environment.

**Acceptance Criteria**:
- All E2E tests pass in production mode
- Critical paths (auth, booking, payments) work end-to-end
- No console errors or warnings in browser

### 4.3 DevOps Scenario
**As a DevOps engineer**, I need to verify the application runs correctly in Docker containers with all services properly configured.

**Acceptance Criteria**:
- Docker Compose starts all services successfully
- Health checks pass for all containers
- Services communicate correctly (app ↔ database, nginx ↔ app)
- Environment variables are properly configured

---

## 5. Technical Specifications

### 5.1 Test Commands Reference

```bash
# Code Quality
npm run lint              # ESLint
npm run typecheck         # TypeScript

# Build
npm run build             # Production build
npm run build:base        # Build without asset copying

# Unit Tests
npm run test:unit         # Run unit tests
npm run test:unit:watch   # Watch mode

# Integration Tests
npm run test:integration         # Run integration tests
npm run test:integration:watch   # Watch mode

# E2E Tests
npm run test:e2e:setup     # Setup E2E database
npm run test:e2e           # Run E2E tests
npm run test:e2e:teardown  # Cleanup E2E database
npm run test:e2e:full      # Setup + Run + Teardown

# Combined
npm run test               # Unit + Integration
npm run test:all           # Unit + Integration + E2E
npm run verify             # Lint + TypeCheck + Test + Build
npm run verify:quick       # Lint + TypeCheck + Unit + Integration

# Database
npm run db:generate        # Generate Prisma client
npm run db:migrate         # Create migration
npm run db:migrate:deploy  # Apply migrations
npm run db:seed            # Seed database

# Docker
npm run docker:up          # Start dev containers
npm run docker:down        # Stop dev containers
docker-compose -f docker-compose.prod.yml up -d --build  # Production
```

### 5.2 Environment Variables

**Required for Build**:
- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_URL`: Application URL
- `NEXTAUTH_SECRET`: Authentication secret (min 32 chars)

**Required for Tests**:
- `NODE_ENV=test`
- `DATABASE_URL`: Test database connection
- All NEXTAUTH variables

**Required for Production**:
- All build variables
- SMTP credentials (email functionality)
- Optional: OPENAI_API_KEY, payment keys

### 5.3 Database Schema

**Provider**: PostgreSQL (production) / SQLite (development)  
**Schema**: `prisma/schema.prisma`  
**Migrations**: `prisma/migrations/`

**Key Models**:
- User, Account, Session (authentication)
- Student, Parent, Coach (user profiles)
- SessionBooking (appointments)
- Subscription, Credit (payments)
- Message, Notification (communication)

### 5.4 Test Isolation

**Unit Tests**:
- No database
- Mocked external dependencies (Prisma, NextAuth, OpenAI)
- JSDOM for React rendering

**Integration Tests**:
- Real PostgreSQL database
- Transaction rollback after each test
- Mocked external APIs (emails, payments, AI)

**E2E Tests**:
- Isolated PostgreSQL instance (port 5435)
- Full Next.js server
- Real browser (Playwright)
- Mocked external services

---

## 6. Acceptance Criteria

### 6.1 Build Success
- [ ] `npm run build` completes without errors
- [ ] `npm run lint` passes with 0 errors
- [ ] `npm run typecheck` passes with 0 errors
- [ ] Build output size is reasonable (<50MB for .next)

### 6.2 Test Success
- [ ] Unit tests: 100% pass rate (0 failures, 0 skipped)
- [ ] Integration tests: 100% pass rate (0 failures, 0 skipped)
- [ ] E2E tests: 100% pass rate (0 failures, 0 flaky)
- [ ] All test runs are deterministic (same result on repeat)

### 6.3 Production Validation
- [ ] Docker Compose production stack starts successfully
- [ ] PostgreSQL container is healthy
- [ ] Next.js app container is healthy
- [ ] Nginx container is healthy and proxies correctly
- [ ] Health endpoint `/api/health` returns 200 OK
- [ ] Database migrations apply successfully
- [ ] Application serves pages without errors

### 6.4 Code Quality
- [ ] No TypeScript `any` types introduced
- [ ] No `eslint-disable` comments added
- [ ] No `@ts-ignore` comments added
- [ ] All console.log removed (use proper logging)
- [ ] No hardcoded credentials or secrets

### 6.5 Commit Quality
- [ ] All fixes committed with clear messages
- [ ] Commits are atomic and well-organized
- [ ] No merge conflicts
- [ ] Git history is clean and logical

### 6.6 Final Verification
- [ ] `npm run verify` passes completely
- [ ] Can deploy to production successfully
- [ ] No errors in production logs
- [ ] All services restart without issues

---

## 7. Dependencies & Constraints

### 7.1 Technical Dependencies
- Node.js 20.x
- PostgreSQL 15+ (production)
- Docker & Docker Compose
- npm dependencies (as per package.json)

### 7.2 Time Constraints
- No specific deadline mentioned
- Should be thorough, not rushed
- Quality over speed

### 7.3 Resource Constraints
- Testing environment must be isolated
- Production environment must be on separate ports
- Sufficient disk space for Docker volumes

### 7.4 Known Limitations
- Some test files are currently empty (0 bytes) - implement if critical
- Konnect payments are in demo mode
- Jitsi uses public server (meet.jit.si)
- SQLite used in development, PostgreSQL in production

---

## 8. Risks & Mitigation

### 8.1 Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Empty test files | Medium | High | Implement tests for critical features only |
| Flaky E2E tests | High | Medium | Use deterministic waits, stable selectors |
| Database migration issues | High | Low | Test migrations on fresh DB before production |
| Build timeout | Medium | Low | Optimize build process, increase timeout |
| Missing environment variables | High | Medium | Validate all required vars before starting |
| Port conflicts | Low | Medium | Use Docker networks, check port availability |

### 8.2 Mitigation Strategies

**For Flaky Tests**:
- Use data-testid attributes instead of CSS selectors
- Add explicit waits with timeouts
- Disable animations in test mode
- Run tests 3 times to verify stability

**For Build Issues**:
- Verify all dependencies are installed
- Clear .next and node_modules if needed
- Check TypeScript version compatibility
- Review recent commits for breaking changes

**For Database Issues**:
- Always use fresh database for E2E tests
- Verify migrations apply cleanly
- Check schema matches Prisma client
- Use transaction rollback for isolation

---

## 9. Success Metrics

### 9.1 Quantitative Metrics
- **Build Time**: <5 minutes
- **Test Execution Time**: <10 minutes (all tests)
- **Test Pass Rate**: 100%
- **Code Coverage**: >70% (unit tests)
- **Docker Startup Time**: <2 minutes

### 9.2 Qualitative Metrics
- All critical user workflows function correctly
- Code is maintainable and well-tested
- Production environment is stable
- Developer confidence in deployment is high

---

## 10. Out of Scope

Explicitly **NOT** included in this task:
- New feature development
- UI/UX improvements
- Performance optimization
- Security enhancements (unless blocking tests)
- Documentation updates (unless critical)
- Dependency upgrades (unless fixing vulnerabilities)
- Code refactoring (unless fixing bugs)
- Infrastructure changes (beyond testing needs)

---

## 11. Clarifications & Assumptions

### 11.1 Assumptions
1. The codebase is generally functional (no major architectural issues)
2. Test infrastructure is properly configured
3. Docker and PostgreSQL are available on the system
4. Environment variables can be configured as needed
5. The goal is validation, not feature completion

### 11.2 Questions for User
No critical questions at this stage. Will proceed with the following defaults:
- Use PostgreSQL for production testing
- Fix all test failures without major refactoring
- Implement minimal tests for empty test files if they cover critical paths
- Commit incrementally with clear messages

If any ambiguity arises during implementation, will make reasonable decisions based on:
- Code conventions in the project
- Test strategy documentation
- Best practices for Next.js/React/TypeScript

---

## 12. Deliverables

### 12.1 Code Deliverables
- ✅ Fixed build errors (all files that prevent build)
- ✅ Fixed test failures (unit, integration, E2E)
- ✅ Updated test files (if empty and critical)
- ✅ Environment configuration files (if needed)

### 12.2 Documentation Deliverables
- ✅ Commit messages documenting fixes
- ✅ This requirements document
- ✅ Technical specification (next step)
- ✅ Implementation plan (next step)

### 12.3 Validation Deliverables
- ✅ Test execution logs showing 100% pass
- ✅ Build output showing success
- ✅ Production environment running successfully

---

## 13. Appendix

### 13.1 Related Documentation
- `README.md` - Project overview
- `docs/TEST_STRATEGY.md` - Testing strategy
- `docs/CI_PIPELINE.md` - CI/CD pipeline
- `docs/DEPLOY_PRODUCTION.md` - Deployment guide
- `ARCHITECTURE_TECHNIQUE.md` - Technical architecture

### 13.2 Test File Locations
- **Unit**: `__tests__/**/*.test.ts(x)`
- **Integration**: `__tests__/api/**/*.test.ts`
- **E2E**: `e2e/**/*.spec.ts`

### 13.3 Configuration Files
- `jest.config.unit.js` - Unit test config
- `jest.config.integration.js` - Integration test config
- `playwright.config.ts` - E2E test config
- `docker-compose.prod.yml` - Production Docker config
- `docker-compose.e2e.yml` - E2E Docker config

---

**Document Status**: Ready for Technical Specification  
**Next Step**: Create technical specification based on this PRD  
**Version**: 1.0  
**Last Updated**: 2026-02-06
