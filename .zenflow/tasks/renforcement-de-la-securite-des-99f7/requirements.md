# Product Requirements Document (PRD)
## API Security Hardening and Abuse Protection

**Task ID**: renforcement-de-la-securite-des-99f7  
**Version**: 1.0  
**Date**: 2026-02-02  
**Status**: Draft

---

## 1. Executive Summary

### 1.1 Overview
Enhance the security posture of the Nexus Réussite Next.js application by implementing comprehensive API protection mechanisms against abuse, unauthorized access, and common web vulnerabilities.

### 1.2 Goals
1. **Prevent API Abuse**: Implement rate limiting on critical endpoints (ARIA AI calls, authentication)
2. **Enhance Security Headers**: Configure defense-in-depth security headers at the application level
3. **Improve Observability**: Integrate Pino logger for structured logging of security events
4. **Ensure Quality**: Validate implementation with integration tests

### 1.3 Success Criteria
- ✅ ARIA and authentication endpoints protected with rate limiting
- ✅ Security headers (CSP, HSTS, X-Frame-Options) configured at Next.js middleware level
- ✅ Pino logger integrated and logging unauthorized access attempts
- ✅ Integration test validates 429 response for rate limit violations
- ✅ All existing tests pass
- ✅ No breaking changes to existing functionality

---

## 2. Current State Analysis

### 2.1 Existing Infrastructure

**Application Stack**:
- Next.js 15.5.11 with TypeScript
- NextAuth v4 for authentication (JWT strategy)
- Prisma ORM with PostgreSQL
- Jest + Playwright for testing

**Security Components Already Present**:

1. **Rate Limiting** (`lib/middleware/rateLimit.ts`):
   - ✅ In-memory implementation with sliding window algorithm
   - ✅ Presets defined: `auth`, `api`, `expensive`, `public`
   - ✅ Returns 429 status code via error handling
   - ⚠️ **NOT applied** to ARIA endpoints
   - ⚠️ **NOT applied** to authentication endpoints

2. **Structured Logger** (`lib/middleware/logger.ts`):
   - ✅ Custom implementation with JSON structured logging
   - ✅ Request ID correlation
   - ✅ User context tracking
   - ⚠️ **NOT Pino** - needs migration or integration

3. **Security Headers** (`nginx/nginx.conf`):
   - ✅ Configured at nginx reverse proxy level
   - ✅ Includes: HSTS, CSP, X-Frame-Options, X-Content-Type-Options
   - ⚠️ Missing at Next.js application level (no defense-in-depth)

4. **API Error Handling** (`lib/api/errors.ts`):
   - ✅ Standardized error responses
   - ✅ Sanitized error messages
   - ✅ Support for `TOO_MANY_REQUESTS` (429) status code

### 2.2 Endpoints Requiring Protection

**High-Priority Endpoints** (exposed to abuse):

1. **ARIA AI Endpoints** (expensive operations):
   - `POST /api/aria/chat` - OpenAI API calls
   - `POST /api/aria/feedback` - Less critical but should be protected

2. **Authentication Endpoints**:
   - `POST /api/auth/callback/credentials` - NextAuth login endpoint
   - Handled by NextAuth, needs rate limiting wrapper

3. **Other Sensitive Endpoints** (optional enhancement):
   - `POST /api/payments/**` - Payment operations
   - `POST /api/sessions/book` - Session booking

### 2.3 Security Headers Gap Analysis

**nginx.conf** (already configured):
```nginx
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Content-Security-Policy: [defined]
```

**Gap**: These headers are only set at nginx level. If nginx is bypassed or misconfigured, the application lacks defense-in-depth.

---

## 3. Requirements

### 3.1 Functional Requirements

#### FR-1: Rate Limiting for ARIA Endpoints

**Priority**: HIGH  
**User Story**: As a platform administrator, I want to limit AI API calls to prevent abuse and control costs.

**Acceptance Criteria**:
- `POST /api/aria/chat` limited to **10 requests per minute per IP/user**
- `POST /api/aria/feedback` limited to **30 requests per minute per IP/user**
- Rate limit enforced **before** expensive operations (OpenAI API calls)
- Returns **HTTP 429** when limit exceeded
- Includes `Retry-After` header with seconds until reset
- Logs rate limit violations with user/IP information

**Technical Notes**:
- Use existing `RateLimitPresets.expensive` for `/api/aria/chat`
- Use existing `RateLimitPresets.api` for `/api/aria/feedback`
- Apply rate limit before authentication check to prevent abuse of auth system

#### FR-2: Rate Limiting for Authentication Endpoints

**Priority**: HIGH  
**User Story**: As a security engineer, I want to prevent brute-force attacks on login endpoints.

**Acceptance Criteria**:
- NextAuth credential provider callback limited to **5 attempts per 15 minutes per IP**
- Rate limit persists across failed login attempts
- Returns **HTTP 429** with appropriate error message
- Logs failed authentication attempts with IP and email (sanitized)

**Technical Notes**:
- Use existing `RateLimitPresets.auth` (5 requests / 15 minutes)
- May require custom NextAuth configuration or middleware wrapper
- **Challenge**: NextAuth handles `/api/auth/callback/credentials` internally

**Implementation Options**:
1. **Option A**: Apply rate limiting in Next.js middleware before NextAuth
2. **Option B**: Create custom authorize callback with rate limit check
3. **Option C**: Use NextAuth events to log and custom middleware to limit

**Decision**: Use **Option A** (middleware-based) for simplest implementation.

#### FR-3: Security Headers Middleware

**Priority**: MEDIUM  
**User Story**: As a security engineer, I want defense-in-depth security headers at the application level.

**Acceptance Criteria**:
- Next.js middleware sets security headers on all responses
- Headers include:
  - `Strict-Transport-Security`: 1 year with subdomains and preload
  - `X-Frame-Options`: SAMEORIGIN
  - `X-Content-Type-Options`: nosniff
  - `Content-Security-Policy`: Aligned with nginx configuration
- Headers do NOT conflict with nginx configuration
- Applied to all routes including API and pages

**Technical Notes**:
- Implemented in `middleware.ts` at root level
- Should match nginx configuration for consistency
- CSP should allow Next.js functionality (`'unsafe-inline'` for styles, etc.)

#### FR-4: Pino Logger Integration

**Priority**: HIGH  
**User Story**: As a DevOps engineer, I want production-grade structured logging compatible with log aggregation tools.

**Acceptance Criteria**:
- Pino logger integrated as primary logging system
- Logs unauthorized access attempts (401, 403 responses)
- Logs rate limit violations (429 responses)
- Logs authentication events (success, failure)
- Log format: JSON with fields:
  - `timestamp` (ISO 8601)
  - `level` (info, warn, error)
  - `requestId` (correlation ID)
  - `userId` (if authenticated)
  - `ip` (sanitized)
  - `method`, `path`, `statusCode`, `duration`
  - `message` (human-readable)
- Existing logger functionality preserved or migrated

**Technical Notes**:
- Install `pino` and `pino-http` packages
- Replace or wrap existing logger in `lib/middleware/logger.ts`
- Ensure compatibility with existing logger usage across codebase
- Configure Pino for production (e.g., `level: 'info'` in production)

**Migration Strategy**:
- **Option A**: Full replacement - refactor all logger usage
- **Option B**: Wrapper - keep existing API, use Pino internally
- **Decision**: Use **Option B** (wrapper) to minimize breaking changes

#### FR-5: Integration Testing

**Priority**: HIGH  
**User Story**: As a developer, I want automated tests to verify rate limiting works correctly.

**Acceptance Criteria**:
- Test file: `__tests__/api/rate-limit.test.ts`
- Test cases:
  1. ✅ Request within limit returns **200 OK**
  2. ✅ Exceeding limit returns **429 Too Many Requests**
  3. ✅ Response includes rate limit headers (`X-RateLimit-*`, `Retry-After`)
  4. ✅ Rate limit resets after time window
  5. ✅ Different IPs have separate rate limits
- Covers both ARIA and authentication endpoints
- All existing tests continue to pass

**Technical Notes**:
- Use Jest with mocked NextRequest
- Test in-memory rate limiter (not Redis)
- Clear rate limit store between tests using `clearRateLimit()`

### 3.2 Non-Functional Requirements

#### NFR-1: Performance
- Rate limiting adds **< 5ms latency** per request
- Logging adds **< 2ms latency** per request
- No impact on successful request throughput

#### NFR-2: Backward Compatibility
- No breaking changes to existing API contracts
- Existing logger calls continue to work (wrapper approach)
- Rate limits do NOT block legitimate users

#### NFR-3: Security
- Rate limit keys use **IP address** (from `X-Forwarded-For` or `X-Real-IP`)
- For authenticated requests, use **userId** instead of IP
- Logs MUST NOT contain sensitive data (passwords, tokens)
- Error messages MUST NOT expose internal implementation details

#### NFR-4: Maintainability
- Code follows existing patterns and conventions
- Configuration centralized (rate limits, security headers)
- Documentation updated (SECURITY.md, MIDDLEWARE.md)

---

## 4. Out of Scope

The following are **explicitly excluded** from this task:

1. **Redis-based rate limiting** - Keep in-memory implementation (document as future enhancement)
2. **Account lockout after failed logins** - Requires user state management
3. **CAPTCHA integration** - Requires frontend changes
4. **DDoS protection** - Handled by nginx and infrastructure
5. **API key authentication** - Different feature
6. **Rate limit customization per user tier** - Premium feature for future
7. **Real-time rate limit monitoring dashboard** - Separate observability task

---

## 5. Technical Constraints

### 5.1 Existing Architecture
- Must use Next.js 15.5.11 middleware system
- Must integrate with existing NextAuth setup
- Must use existing error handling (`lib/api/errors.ts`)
- Must maintain compatibility with nginx reverse proxy

### 5.2 Dependencies to Add
- `pino` - Fast, low-overhead logger
- `pino-http` (optional) - HTTP request logger middleware
- `pino-pretty` (dev) - Pretty-print logs in development

### 5.3 Configuration
- Rate limits configurable via constants (not environment variables initially)
- Security headers configurable in middleware
- Pino log level controlled by `NODE_ENV`

---

## 6. Assumptions and Decisions

### 6.1 Assumptions
1. **Pino Reference**: Task mentions "Pino logger (developed in Lot 1)" but codebase has custom logger. **Assumption**: Pino was planned but not yet implemented. We will integrate Pino now.

2. **Security Headers**: nginx already configures headers. **Assumption**: Add at Next.js level for defense-in-depth, not as replacement.

3. **Rate Limit Storage**: Task does not mention Redis. **Assumption**: Keep in-memory implementation, document Redis migration path.

4. **IP-based Rate Limiting**: No user authentication for rate limiting specified. **Assumption**: Use IP as primary key, with optional userId for authenticated requests.

### 6.2 Key Decisions

| Decision | Rationale |
|----------|-----------|
| **Wrap existing logger with Pino** | Minimize breaking changes, easier migration |
| **Apply rate limits in middleware** | Intercept before NextAuth for better protection |
| **Use in-memory rate limiter** | Simpler for single-instance deployments, matches existing code |
| **Security headers at app level** | Defense-in-depth, protects if nginx bypassed |
| **Test with Jest (not e2e)** | Faster feedback, easier to test rate limit edge cases |

---

## 7. Open Questions

### 7.1 Questions for Stakeholder

1. **Pino Integration Scope**:
   - Q: Should we fully replace the existing custom logger or wrap it?
   - **Decision**: Wrap to minimize changes

2. **Rate Limit Key Strategy**:
   - Q: For authenticated users, should rate limits be per-user or per-IP?
   - **Proposed Answer**: Per-IP by default, with option to switch to userId for authenticated routes

3. **Security Headers CSP**:
   - Q: Should CSP at Next.js level match nginx or be more permissive?
   - **Proposed Answer**: Match nginx for consistency

4. **Test Coverage**:
   - Q: Should we add e2e tests or only integration tests?
   - **Proposed Answer**: Integration tests sufficient for rate limiting logic

### 7.2 Clarifications Made

- **Custom logger vs Pino**: Integrating Pino as requested, wrapping existing API
- **Security headers**: Adding at Next.js level alongside nginx (defense-in-depth)
- **Rate limits**: Applying existing implementation to ARIA and auth endpoints
- **Test type**: Integration tests with Jest, not e2e with Playwright

---

## 8. User Flows

### 8.1 Normal ARIA Chat Request

```
User → POST /api/aria/chat
  ↓
Middleware: Check rate limit (10/min)
  ↓ [Within limit]
Middleware: Check security headers
  ↓
Route: Authenticate user (NextAuth)
  ↓ [Authorized]
Route: Call OpenAI API
  ↓
Route: Save conversation
  ↓
Logger: Log successful request (200)
  ↓
User ← 200 OK with AI response
```

### 8.2 Rate Limited ARIA Request

```
User → POST /api/aria/chat (11th request in 1 minute)
  ↓
Middleware: Check rate limit (10/min)
  ↓ [LIMIT EXCEEDED]
Logger: Log rate limit violation (429)
  ↓
User ← 429 Too Many Requests
       Headers: X-RateLimit-Limit: 10
                X-RateLimit-Remaining: 0
                Retry-After: 45
```

### 8.3 Brute Force Login Attempt

```
Attacker → POST /api/auth/callback/credentials (6th attempt in 15 min)
  ↓
Middleware: Check rate limit (5/15min)
  ↓ [LIMIT EXCEEDED]
Logger: Log rate limit violation with IP
  ↓
Attacker ← 429 Too Many Requests
           Message: "Too many login attempts, please try again later"
```

### 8.4 Unauthorized Access Attempt

```
User → GET /api/admin/users (no auth token)
  ↓
Middleware: Rate limit check [OK]
  ↓
Route: Check authentication
  ↓ [UNAUTHORIZED]
Logger: Log unauthorized attempt (401)
       Fields: { userId: null, ip: "1.2.3.4", path: "/api/admin/users" }
  ↓
User ← 401 Unauthorized
```

---

## 9. Success Metrics

### 9.1 Functional Metrics
- **Rate Limit Coverage**: 100% of critical endpoints (ARIA, auth)
- **Security Header Coverage**: 100% of responses
- **Log Coverage**: All 401, 403, 429 responses logged
- **Test Coverage**: 100% of rate limiting logic

### 9.2 Performance Metrics
- **Latency Impact**: < 5ms added by middleware
- **Error Rate**: No increase in 5xx errors
- **False Positives**: < 0.1% legitimate requests blocked

### 9.3 Security Metrics
- **Brute Force Prevention**: Failed logins capped at 5 per 15 min per IP
- **AI Abuse Prevention**: ARIA calls capped at 10 per min per IP/user
- **Header Compliance**: 100% of responses include security headers

---

## 10. Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Rate limiting blocks legitimate users** | HIGH | MEDIUM | Set generous limits, monitor logs, allow admin override |
| **In-memory rate limiter loses state on restart** | MEDIUM | HIGH | Document limitation, plan Redis migration |
| **CSP breaks existing functionality** | HIGH | LOW | Test thoroughly, align with nginx config |
| **Pino integration breaks existing logs** | MEDIUM | LOW | Wrap existing API, run all tests |
| **NextAuth rate limiting complex** | MEDIUM | MEDIUM | Use middleware approach, test edge cases |

---

## 11. Dependencies

### 11.1 NPM Packages to Add
```json
{
  "pino": "^8.17.0",
  "pino-http": "^9.0.0",
  "pino-pretty": "^10.3.0" // dev dependency
}
```

### 11.2 Internal Dependencies
- Existing: `lib/middleware/rateLimit.ts`
- Existing: `lib/middleware/logger.ts` (to be enhanced)
- Existing: `lib/api/errors.ts`
- Existing: `lib/guards.ts`

### 11.3 Infrastructure Dependencies
- nginx reverse proxy (already configured)
- PostgreSQL (no changes required)
- Next.js 15.5.11 middleware system

---

## 12. Documentation Requirements

### 12.1 Code Documentation
- JSDoc comments on new functions
- Inline comments for complex logic
- README section on rate limiting configuration

### 12.2 Technical Documentation (to update)
- `docs/SECURITY.md` - Add rate limiting section
- `docs/MIDDLEWARE.md` - Update with Pino integration
- `docs/API_CONVENTIONS.md` - Document 429 error handling

### 12.3 Operational Documentation
- Log format and fields reference
- Rate limit configuration guide
- Troubleshooting common issues (false positives, etc.)

---

## 13. Acceptance Checklist

**Before marking this task complete, verify**:

- [ ] ARIA endpoints (`/api/aria/chat`, `/api/aria/feedback`) have rate limiting
- [ ] Authentication endpoint has rate limiting (5 attempts / 15 min)
- [ ] Security headers middleware implemented and active
- [ ] Pino logger integrated and logging security events
- [ ] Integration test validates 429 response for rate limit exceeded
- [ ] All existing tests pass (`npm run test`)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] Documentation updated (SECURITY.md, MIDDLEWARE.md)
- [ ] No breaking changes to existing API contracts
- [ ] Performance impact acceptable (< 5ms latency)

---

## 14. Timeline and Effort Estimate

**Estimated Effort**: 8-12 hours

**Breakdown**:
1. **Pino Integration** (2-3 hours)
   - Install and configure Pino
   - Wrap existing logger
   - Test log output

2. **Rate Limiting Application** (2-3 hours)
   - Apply to ARIA endpoints
   - Apply to authentication endpoints
   - Configure and test

3. **Security Headers Middleware** (1-2 hours)
   - Implement middleware
   - Configure headers
   - Test CSP compatibility

4. **Integration Tests** (2-3 hours)
   - Write test cases
   - Test rate limiting scenarios
   - Test header presence

5. **Documentation** (1-2 hours)
   - Update SECURITY.md
   - Update MIDDLEWARE.md
   - Add inline documentation

**Critical Path**: Pino integration → Rate limiting → Testing

---

## 15. Next Steps

After approval of this PRD:

1. **Technical Specification**: Create detailed technical design in `spec.md`
2. **Planning**: Break down into implementation tasks in `plan.md`
3. **Implementation**: Execute tasks with test-driven approach
4. **Review**: Code review and security review
5. **Deployment**: Deploy to staging, then production
6. **Monitoring**: Monitor logs for false positives and adjust limits if needed

---

**Document Status**: ✅ Ready for Review  
**Approver**: Task Owner / Tech Lead  
**Next Document**: `spec.md` (Technical Specification)
