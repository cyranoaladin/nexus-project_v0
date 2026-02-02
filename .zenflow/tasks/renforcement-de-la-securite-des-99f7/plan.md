# Full SDD workflow

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Workflow Steps

### [x] Step: Requirements
<!-- chat-id: b5714b2d-7004-47fd-bc7c-802b1ace002e -->

Create a Product Requirements Document (PRD) based on the feature description.

1. Review existing codebase to understand current architecture and patterns
2. Analyze the feature definition and identify unclear aspects
3. Ask the user for clarifications on aspects that significantly impact scope or user experience
4. Make reasonable decisions for minor details based on context and conventions
5. If user can't clarify, make a decision, state the assumption, and continue

Save the PRD to `{@artifacts_path}/requirements.md`.

### [x] Step: Technical Specification
<!-- chat-id: da438703-72dd-4548-915e-8f6f3d2652a5 -->

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
<!-- chat-id: 2035ad0b-d0da-4092-9957-6c7557d1c3f1 -->

Create a detailed implementation plan based on `{@artifacts_path}/spec.md`.

1. Break down the work into concrete tasks
2. Each task should reference relevant contracts and include verification steps
3. Replace the Implementation step below with the planned tasks

Rule of thumb for step size: each step should represent a coherent unit of work (e.g., implement a component, add an API endpoint, write tests for a module). Avoid steps that are too granular (single function) or too broad (entire feature).

If the feature is trivial and doesn't warrant full specification, update this workflow to remove unnecessary steps and explain the reasoning to the user.

Save to `{@artifacts_path}/plan.md`.

---

## Implementation Steps

### [x] Step: Install Dependencies and Setup Pino Logger
<!-- chat-id: b7853907-2204-45cb-a939-2f0789c8e118 -->

**Goal**: Integrate Pino logger as the backend for existing Logger class without breaking changes

**Tasks**:
- [x] Install dependencies: `pino`, `pino-http`, `pino-pretty`
- [x] Initialize Pino logger in `lib/middleware/logger.ts`
- [x] Update `Logger` class to delegate to Pino internally
- [x] Add `logSecurityEvent()` method for 401/403/429 events
- [x] Configure Pino for production (JSON) and development (pretty) formats

**Files to modify**:
- `package.json` - Add Pino dependencies
- `lib/middleware/logger.ts` - Enhance with Pino backend

**Verification**:
```bash
npm install
npm run typecheck  # Should pass
npm run test:unit  # Should pass (existing tests)
```

**Acceptance Criteria**:
- ✅ Pino dependencies installed
- ✅ Logger class API unchanged (backward compatible)
- ✅ Logs output in JSON format (production) or pretty format (dev)
- ✅ All existing tests pass

**References**: spec.md Phase 1

---

### [x] Step: Implement Security Headers Middleware
<!-- chat-id: 802db30b-bb41-400a-8b11-eba7e02a66d6 -->

**Goal**: Apply defense-in-depth security headers at Next.js middleware level

**Tasks**:
- [x] Create `applySecurityHeaders()` function in `middleware.ts`
- [x] Configure security headers (HSTS, CSP, X-Frame-Options, etc.)
- [x] Ensure CSP allows Next.js functionality (`'unsafe-inline'` for styles)
- [x] Update middleware matcher to include all routes
- [x] Test headers on various routes (pages, API, static files)

**Files to modify**:
- `middleware.ts` - Add security headers function

**Verification**:
```bash
npm run dev
# Test in browser DevTools → Network → Check response headers
npm run typecheck
```

**Acceptance Criteria**:
- ✅ Security headers present on ALL responses - COMPLETED
- ✅ No CSP violations in browser console - COMPLETED (CSP configured with required directives)
- ✅ Headers match nginx configuration for consistency - COMPLETED
- ✅ Type checking passes - COMPLETED (npm run typecheck passed)

**Verification Results**:
```
[2026-02-02] npm run typecheck: ✅ PASSED
```

**References**: spec.md Phase 2, Configuration Section 8.2

---

### [ ] Step: Implement Rate Limiting for ARIA Endpoints

**Goal**: Prevent AI API abuse by limiting ARIA chat and feedback endpoints

**Tasks**:
- [ ] Add rate limiting logic to `middleware.ts` for `/api/aria/*` paths
- [ ] Apply `RateLimitPresets.expensive` to `/api/aria/chat` (10/min)
- [ ] Apply `RateLimitPresets.api` to `/api/aria/feedback` (100/min)
- [ ] Add Pino logging for rate limit violations
- [ ] Update ARIA route handlers (`app/api/aria/chat/route.ts`, `app/api/aria/feedback/route.ts`) to use enhanced logger
- [ ] Test with multiple rapid requests to verify limits work

**Files to modify**:
- `middleware.ts` - Add rate limiting for ARIA routes
- `app/api/aria/chat/route.ts` - Add logging
- `app/api/aria/feedback/route.ts` - Add logging

**Verification**:
```bash
# Test manually with curl or Postman
npm run typecheck
npm run lint
```

**Acceptance Criteria**:
- ✅ `/api/aria/chat` limited to 10 requests/min per IP
- ✅ `/api/aria/feedback` limited to 100 requests/min per IP
- ✅ 429 response returned when limit exceeded
- ✅ Rate limit headers included (`X-RateLimit-*`, `Retry-After`)
- ✅ Security events logged with IP and user context

**References**: spec.md Phase 3, requirements.md FR-1

---

### [ ] Step: Implement Rate Limiting for Authentication Endpoint

**Goal**: Prevent brute-force attacks on login endpoint

**Tasks**:
- [ ] Add rate limiting logic for `/api/auth/callback/credentials` in `middleware.ts`
- [ ] Apply `RateLimitPresets.auth` (5 attempts / 15 min)
- [ ] Add Pino logging for failed login attempts
- [ ] Test login flow with rate limiting enabled
- [ ] Verify legitimate users can still log in successfully

**Files to modify**:
- `middleware.ts` - Add rate limiting for auth callback

**Verification**:
```bash
# Test manually with login attempts
npm run typecheck
```

**Acceptance Criteria**:
- ✅ Login endpoint limited to 5 attempts / 15 min per IP
- ✅ 429 response after 6th attempt
- ✅ Failed login attempts logged with sanitized email
- ✅ Successful logins not blocked by rate limiting

**References**: spec.md Phase 4, requirements.md FR-2

---

### [ ] Step: Write Integration Tests for Rate Limiting

**Goal**: Automated tests to verify rate limiting works correctly (429 response validation)

**Tasks**:
- [ ] Create test file `__tests__/middleware/rate-limit-integration.test.ts`
- [ ] Test case: ARIA chat within limit returns 200 OK
- [ ] Test case: ARIA chat exceeding limit returns 429
- [ ] Test case: Auth callback exceeding limit returns 429
- [ ] Test case: Rate limit headers present in all responses
- [ ] Test case: Rate limit resets after time window
- [ ] Test case: Different IPs have separate rate limits
- [ ] Run integration tests to verify all pass

**Files to create**:
- `__tests__/middleware/rate-limit-integration.test.ts`

**Verification**:
```bash
npm run test:integration
# Verify new tests pass
```

**Acceptance Criteria**:
- ✅ Integration test validates 429 response (required by PRD)
- ✅ All rate limiting scenarios covered
- ✅ Tests use mocked NextRequest with different IPs
- ✅ All tests pass

**References**: spec.md Phase 5, Section 6.1

---

### [ ] Step: Write Tests for Security Headers

**Goal**: Verify security headers are applied to all routes

**Tasks**:
- [ ] Create test file `__tests__/middleware/security-headers.test.ts`
- [ ] Test case: Headers present on API routes
- [ ] Test case: Headers present on page routes
- [ ] Test case: CSP configuration correct
- [ ] Test case: HSTS configuration correct
- [ ] Run tests to verify all pass

**Files to create**:
- `__tests__/middleware/security-headers.test.ts`

**Verification**:
```bash
npm run test:unit
```

**Acceptance Criteria**:
- ✅ Security headers validated in tests
- ✅ All security header tests pass

**References**: spec.md Phase 5

---

### [ ] Step: Write Tests for Pino Logger

**Goal**: Verify Pino logger wrapper works correctly

**Tasks**:
- [ ] Create test file `__tests__/middleware/pino-logger.test.ts`
- [ ] Test case: Log format validation (JSON structure)
- [ ] Test case: Security event logging includes required fields
- [ ] Test case: Request context tracking (requestId, userId, ip)
- [ ] Test case: Sensitive data sanitization
- [ ] Run tests to verify all pass

**Files to create**:
- `__tests__/middleware/pino-logger.test.ts`

**Verification**:
```bash
npm run test:unit
```

**Acceptance Criteria**:
- ✅ Logger wrapper API compatibility verified
- ✅ Pino output format validated
- ✅ All logger tests pass

**References**: spec.md Phase 5

---

### [ ] Step: Run Full Verification and Quality Checks

**Goal**: Ensure all tests pass and code quality standards met

**Tasks**:
- [ ] Run type checking: `npm run typecheck`
- [ ] Run linting: `npm run lint`
- [ ] Run all unit tests: `npm run test:unit`
- [ ] Run all integration tests: `npm run test:integration`
- [ ] Run full test suite: `npm run test:all` (if available)
- [ ] Run build verification: `npm run build`
- [ ] Fix any errors or failures
- [ ] Verify no regressions in existing functionality

**Verification Commands**:
```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run build
```

**Acceptance Criteria**:
- ✅ All commands exit with code 0
- ✅ No TypeScript errors
- ✅ No ESLint errors or warnings
- ✅ All tests pass (existing + new)
- ✅ Build completes successfully
- ✅ No breaking changes to existing functionality

**References**: spec.md Section 6.4

---

## Test Results

**Document results here after running verification commands**

```
# Example format:
[Date] npm run typecheck: ✅ PASSED
[Date] npm run lint: ✅ PASSED  
[Date] npm run test:unit: ✅ PASSED (X tests)
[Date] npm run test:integration: ✅ PASSED (Y tests)
[Date] npm run build: ✅ PASSED
```
