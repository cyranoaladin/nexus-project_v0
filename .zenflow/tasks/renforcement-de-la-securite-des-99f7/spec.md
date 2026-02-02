# Technical Specification
## API Security Hardening and Abuse Protection

**Task ID**: renforcement-de-la-securite-des-99f7  
**Version**: 1.0  
**Date**: 2026-02-02  
**Status**: Draft

---

## 1. Technical Context

### 1.1 Technology Stack
- **Framework**: Next.js 15.5.11 (App Router)
- **Runtime**: Node.js (TypeScript)
- **Authentication**: NextAuth v4 (JWT strategy)
- **ORM**: Prisma with PostgreSQL
- **Testing**: Jest (unit/integration), Playwright (e2e)
- **Deployment**: nginx reverse proxy + Node.js server

### 1.2 Existing Security Infrastructure

#### Rate Limiting (`lib/middleware/rateLimit.ts`)
- **Algorithm**: Sliding window with in-memory store
- **Key Strategy**: IP-based (from `x-forwarded-for` or `x-real-ip`)
- **Response**: Returns `NextResponse` with 429 + headers or `null`
- **Presets**: `auth` (5/15min), `api` (100/min), `expensive` (10/min), `public` (300/min)
- **Utilities**: `clearRateLimit()`, `getRateLimitStatus()`

**Current Usage**: Not applied to any routes (exists but unused)

#### Structured Logger (`lib/middleware/logger.ts`)
- **Format**: JSON structured logs via `console.log/warn/error`
- **Features**: Request ID, user context, duration tracking, sanitization
- **API**: `Logger` class with `debug()`, `info()`, `warn()`, `error()`, `logRequest()`
- **Limitation**: Custom implementation, not Pino

#### Error Handling (`lib/api/errors.ts`)
- **Format**: `{ error: string, message: string, details?: unknown }`
- **Status Codes**: Includes `TOO_MANY_REQUESTS: 429`
- **Error Codes**: Includes `RATE_LIMIT_EXCEEDED`
- **Utilities**: `errorResponse()`, `handleApiError()`, `ApiError` class

#### Middleware (`middleware.ts`)
- **Current Scope**: Dashboard route protection only (matcher: `/dashboard/:path*`)
- **Function**: NextAuth `withAuth()` wrapper for role-based access
- **Gap**: No API route protection, no security headers

### 1.3 Dependencies to Add

```json
{
  "dependencies": {
    "pino": "^9.6.0",
    "pino-http": "^10.1.0"
  },
  "devDependencies": {
    "pino-pretty": "^13.0.0"
  }
}
```

**Rationale**: 
- `pino`: High-performance logger (20x faster than Winston)
- `pino-http`: Express/Next.js request logging middleware
- `pino-pretty`: Development-friendly log formatting

---

## 2. Implementation Approach

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       Next.js Middleware                     │
│  middleware.ts (Enhanced)                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. Security Headers Injection                       │   │
│  │    - CSP, HSTS, X-Frame-Options                     │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 2. Rate Limiting (API routes)                       │   │
│  │    - /api/auth/callback/credentials (auth preset)   │   │
│  │    - /api/aria/* (expensive preset for chat)        │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 3. Security Event Logging (Pino)                    │   │
│  │    - Log 401, 403, 429 responses                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│                    NextAuth Handler                          │
│  /api/auth/[...nextauth]/route.ts                           │
│  - Receives rate-limited requests                           │
│  - Logs auth attempts via Pino logger                       │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│                    ARIA API Routes                           │
│  /api/aria/chat/route.ts                                    │
│  /api/aria/feedback/route.ts                                │
│  - Receives rate-limited requests                           │
│  - Logs AI calls via Pino logger                            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Strategy: Middleware-First Approach

**Rationale**: 
- Centralized security at middleware level prevents endpoint-by-endpoint implementation
- Intercepts requests BEFORE NextAuth and route handlers
- Reduces code duplication and ensures consistency

**Trade-offs**:
- NextAuth callbacks run after middleware (can't rate-limit inside authorize())
- Requires careful matcher configuration to avoid performance overhead
- In-memory store limitations (single-instance only, state lost on restart)

**Alternatives Considered**:
1. ❌ **Route-level rate limiting**: Requires modifying every endpoint
2. ❌ **NextAuth events**: Can't prevent requests, only log after the fact
3. ✅ **Middleware + route logging**: Balance of enforcement and observability

### 2.3 Pino Integration Strategy

**Approach**: Wrapper pattern over existing logger

```typescript
// Enhanced lib/middleware/logger.ts
import pino from 'pino';
import { NextRequest } from 'next/server';

const pinoLogger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  formatters: {
    level: (label) => ({ level: label }),
  },
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  })
});

export class Logger {
  private logger: pino.Logger;
  // ... keep existing API, delegate to pino internally
}
```

**Benefits**:
- Existing code continues to work (backward compatible)
- Pino's performance and ecosystem (log rotation, transports)
- Gradual migration path (can refactor later)

---

## 3. Source Code Structure Changes

### 3.1 New Files

**None** - All changes are enhancements to existing files.

### 3.2 Modified Files

#### `middleware.ts` (Enhanced)
**Current**: 56 lines, handles dashboard auth only  
**New**: ~150 lines, adds security headers + rate limiting

```typescript
// Structure:
// 1. Security headers function
// 2. Rate limiting for API routes
// 3. Existing auth logic for dashboards
// 4. Updated matcher to include /api/*
```

**Key Changes**:
- Add `applySecurityHeaders()` function
- Add rate limiting before NextAuth check
- Update `config.matcher` to include API routes
- Integrate Pino logger for security events

#### `lib/middleware/logger.ts` (Enhanced)
**Current**: 317 lines, custom JSON logger  
**New**: ~350 lines, Pino-backed logger

**Key Changes**:
- Add `pino` initialization at module level
- Update `Logger` class to use Pino internally
- Keep existing API (`debug()`, `info()`, `warn()`, `error()`)
- Add new method: `logSecurityEvent()` for 401/403/429

#### `app/api/aria/chat/route.ts` (Enhanced)
**Current**: 126 lines  
**New**: ~135 lines

**Key Changes**:
- Import `createLogger` from enhanced logger
- Add `logger.info()` calls for AI requests
- Add `logger.logSecurityEvent()` for auth failures
- No rate limiting code (handled by middleware)

#### `app/api/aria/feedback/route.ts` (Enhanced)
**Current**: 82 lines  
**New**: ~90 lines

**Key Changes**:
- Import `createLogger`
- Add logging for feedback submissions
- No rate limiting code (handled by middleware)

### 3.3 Test Files (New)

#### `__tests__/middleware/security-headers.test.ts`
Tests security headers application:
- Headers present on all responses
- CSP configuration
- HSTS configuration

#### `__tests__/middleware/rate-limit-integration.test.ts`
Tests rate limiting integration:
- ARIA chat rate limit (10/min)
- Auth callback rate limit (5/15min)
- 429 response format
- Rate limit headers
- Reset after window

#### `__tests__/middleware/pino-logger.test.ts`
Tests Pino logger wrapper:
- Log format validation
- Security event logging
- Request context tracking
- Sanitization of sensitive data

---

## 4. Data Model / API / Interface Changes

### 4.1 No Database Schema Changes
Rate limiting uses in-memory store (no Prisma changes required).

### 4.2 API Response Changes

#### New 429 Response Format (already supported by `lib/api/errors.ts`)
```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests, please try again later",
  "details": {
    "retryAfter": 45
  }
}
```

**Headers**:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: Unix timestamp of window reset
- `Retry-After`: Seconds until retry allowed

### 4.3 HTTP Security Headers (New)

Applied to ALL responses via middleware:

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'self';
```

**CSP Justification**:
- `'unsafe-inline'` for scripts: Required by Next.js inline scripts
- `'unsafe-eval'`: Required by Next.js development mode
- `https:` for connect-src: Allows external API calls (OpenAI, etc.)

### 4.4 Log Format (Pino JSON)

**Security Event Log**:
```json
{
  "level": "warn",
  "time": 1704715200000,
  "msg": "Rate limit exceeded",
  "requestId": "req_1704715200_abc123",
  "method": "POST",
  "path": "/api/aria/chat",
  "ip": "192.168.1.100",
  "userId": "user_123",
  "statusCode": 429,
  "duration": 5,
  "event": "rate_limit_exceeded",
  "retryAfter": 45
}
```

**Authentication Failure Log**:
```json
{
  "level": "warn",
  "time": 1704715200000,
  "msg": "Unauthorized access attempt",
  "requestId": "req_1704715200_xyz789",
  "method": "POST",
  "path": "/api/aria/chat",
  "ip": "192.168.1.100",
  "statusCode": 401,
  "duration": 120,
  "event": "unauthorized_access"
}
```

---

## 5. Delivery Phases

### Phase 1: Foundation (Pino Integration)
**Goal**: Replace logging backend with Pino without breaking existing code

**Tasks**:
1. Install Pino dependencies (`pino`, `pino-http`, `pino-pretty`)
2. Initialize Pino logger in `lib/middleware/logger.ts`
3. Update `Logger` class to delegate to Pino
4. Add `logSecurityEvent()` method to Logger class
5. Write unit tests for Pino wrapper
6. Run existing tests to ensure no regressions

**Acceptance Criteria**:
- ✅ All existing logger calls work unchanged
- ✅ Logs output in Pino JSON format (production) or pretty format (dev)
- ✅ Unit tests pass
- ✅ No breaking changes to logger API

**Estimated Time**: 2-3 hours

---

### Phase 2: Security Headers Middleware
**Goal**: Apply defense-in-depth security headers at application level

**Tasks**:
1. Create `applySecurityHeaders()` function in `middleware.ts`
2. Configure CSP to match nginx + Next.js requirements
3. Update middleware matcher to include all routes
4. Test header application on various routes (pages, API, static)
5. Write integration tests for header presence
6. Verify no CSP violations in browser console

**Acceptance Criteria**:
- ✅ Security headers present on ALL responses
- ✅ No CSP violations in application functionality
- ✅ Headers match nginx configuration (consistency)
- ✅ Integration tests validate header presence

**Estimated Time**: 1-2 hours

---

### Phase 3: Rate Limiting for ARIA Endpoints
**Goal**: Prevent AI API abuse by limiting ARIA chat and feedback endpoints

**Tasks**:
1. Add rate limiting logic to `middleware.ts` for `/api/aria/*` paths
2. Apply `RateLimitPresets.expensive` to `/api/aria/chat` (10/min)
3. Apply `RateLimitPresets.api` to `/api/aria/feedback` (100/min)
4. Add Pino logging for rate limit violations
5. Update ARIA route handlers to use enhanced logger
6. Write integration tests for rate limiting behavior
7. Test with concurrent requests to verify accuracy

**Acceptance Criteria**:
- ✅ `/api/aria/chat` limited to 10 requests/min per IP
- ✅ `/api/aria/feedback` limited to 100 requests/min per IP
- ✅ 429 response returned when limit exceeded
- ✅ Rate limit headers included in all responses
- ✅ Security events logged with IP and user context
- ✅ Integration test validates rate limiting

**Estimated Time**: 2-3 hours

---

### Phase 4: Rate Limiting for Authentication
**Goal**: Prevent brute-force attacks on login endpoint

**Tasks**:
1. Add rate limiting logic for `/api/auth/callback/credentials`
2. Apply `RateLimitPresets.auth` (5 attempts / 15 min)
3. Add Pino logging for failed login attempts
4. Test login flow with rate limiting enabled
5. Write integration tests for auth rate limiting
6. Verify legitimate users can still log in

**Acceptance Criteria**:
- ✅ Login endpoint limited to 5 attempts / 15 min per IP
- ✅ 429 response after 6th attempt
- ✅ Failed login attempts logged with sanitized email
- ✅ Successful logins not blocked
- ✅ Integration test validates auth rate limiting

**Estimated Time**: 2-3 hours

---

### Phase 5: Integration Testing & Documentation
**Goal**: Comprehensive test coverage and updated documentation

**Tasks**:
1. Write integration test: Rate limit violation returns 429
2. Write integration test: Different IPs have separate limits
3. Write integration test: Rate limit resets after window
4. Write integration test: Security headers on all routes
5. Update `docs/SECURITY.md` with rate limiting configuration
6. Update `docs/MIDDLEWARE.md` with Pino integration details
7. Add JSDoc comments to new functions
8. Run full test suite (`npm run test:all`)
9. Run type checking (`npm run typecheck`)
10. Run linting (`npm run lint`)

**Acceptance Criteria**:
- ✅ Integration test validates 429 response (as required by PRD)
- ✅ All existing tests pass
- ✅ Type checking passes with no errors
- ✅ Linting passes with no errors
- ✅ Documentation updated and accurate

**Estimated Time**: 2-3 hours

---

## 6. Verification Approach

### 6.1 Testing Strategy

#### Unit Tests
- **Logger wrapper**: Verify Pino delegation and API compatibility
- **Security headers**: Verify header generation logic
- **Rate limiting**: Already tested in existing `rateLimit.ts`

#### Integration Tests (Primary Focus)
**Test File**: `__tests__/api/rate-limit.test.ts`

**Test Cases**:
1. **ARIA chat rate limiting**:
   - Request 1-10: Returns 200 OK
   - Request 11: Returns 429 with `Retry-After` header
   - After 60 seconds: Request 1 returns 200 OK

2. **Auth rate limiting**:
   - Attempt 1-5: Returns 200/401 (depending on credentials)
   - Attempt 6: Returns 429
   - After 15 minutes: Attempt 1 returns 200/401

3. **Rate limit headers**:
   - Verify `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
   - Verify `Retry-After` on 429 responses

4. **IP isolation**:
   - Different `x-forwarded-for` headers have separate rate limits

5. **Security headers**:
   - All responses include `Strict-Transport-Security`
   - All responses include `Content-Security-Policy`

**Test Utilities**:
```typescript
// Mock NextRequest with custom IP
function mockRequest(path: string, ip: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    headers: { 'x-forwarded-for': ip }
  });
}

// Simulate rapid requests
async function sendRequests(path: string, count: number, ip: string) {
  const responses = [];
  for (let i = 0; i < count; i++) {
    const req = mockRequest(path, ip);
    const res = await middleware(req);
    responses.push(res);
  }
  return responses;
}
```

#### End-to-End Tests (Optional)
- Not required for this task (integration tests sufficient)
- Future enhancement: Playwright test for login brute-force protection

### 6.2 Manual Testing Checklist

**Rate Limiting**:
- [ ] ARIA chat: Can send 10 requests in 1 minute
- [ ] ARIA chat: 11th request returns 429
- [ ] Login: Can fail 5 times in 15 minutes
- [ ] Login: 6th attempt returns 429
- [ ] Different browsers (different IPs) have separate limits

**Security Headers**:
- [ ] Open DevTools → Network → Check response headers
- [ ] Verify CSP present and no console errors
- [ ] Verify HSTS present

**Logging**:
- [ ] Check server logs for 429 events
- [ ] Check server logs for failed auth attempts
- [ ] Verify IP addresses logged (sanitized if private)
- [ ] Verify no passwords or tokens in logs

### 6.3 Performance Testing

**Baseline** (before changes):
```bash
# Measure baseline latency
curl -w "@curl-format.txt" http://localhost:3000/api/aria/chat
```

**After Implementation**:
```bash
# Measure latency with middleware
curl -w "@curl-format.txt" http://localhost:3000/api/aria/chat
```

**Acceptance**:
- ✅ Latency increase < 5ms (as per NFR-1)
- ✅ No increase in 5xx error rate

### 6.4 Project Verification Commands

**Pre-deployment checklist**:
```bash
# 1. Type checking
npm run typecheck

# 2. Linting
npm run lint

# 3. Unit tests
npm run test:unit

# 4. Integration tests (includes new rate limiting tests)
npm run test:integration

# 5. Full test suite (optional, includes e2e)
npm run test:all

# 6. Build verification
npm run build
```

**Success Criteria**:
- All commands exit with code 0
- No TypeScript errors
- No ESLint errors
- All tests pass
- Build completes successfully

---

## 7. Security Considerations

### 7.1 IP-Based Rate Limiting Limitations

**Risk**: IP address can be spoofed or shared (NAT, proxy)

**Mitigations**:
- Use `x-forwarded-for` first IP (most likely to be real client IP)
- Trust nginx to set headers correctly (configured at infrastructure level)
- For authenticated routes, consider using `userId` instead of IP

**Future Enhancement**: Hybrid approach (IP + userId for authenticated routes)

### 7.2 In-Memory Store Limitations

**Risk**: Rate limit state lost on server restart

**Mitigations**:
- Document limitation in code comments
- Set generous rate limits (10/min for expensive ops, not 1/min)
- Plan Redis migration for multi-instance deployments

**Future Enhancement**: Redis-based store (`@upstash/ratelimit`)

### 7.3 CSP Compatibility

**Risk**: CSP too strict breaks Next.js functionality

**Mitigations**:
- Allow `'unsafe-inline'` for styles (Next.js requirement)
- Allow `'unsafe-eval'` for dev mode (remove in production build)
- Test thoroughly in both dev and production modes

**Testing**: Verify no CSP violations in browser console

### 7.4 Log Sanitization

**Risk**: Sensitive data leakage in logs

**Mitigations**:
- Existing `sanitizeLogData()` function redacts passwords, tokens
- Never log request bodies for auth endpoints
- Log only email (not password) for failed logins

**Validation**: Code review for any `logger.info(password)` patterns

---

## 8. Configuration Reference

### 8.1 Rate Limit Configuration

**Location**: `lib/middleware/rateLimit.ts` (existing presets)

```typescript
export const RateLimitPresets = {
  auth: rateLimit({
    windowMs: 15 * 60 * 1000,      // 15 minutes
    maxRequests: 5,                 // 5 attempts
    message: 'Too many login attempts, please try again later'
  }),
  
  expensive: rateLimit({
    windowMs: 60 * 1000,            // 1 minute
    maxRequests: 10,                // 10 requests
    message: 'Rate limit exceeded for this operation'
  }),
  
  api: rateLimit({
    windowMs: 60 * 1000,            // 1 minute
    maxRequests: 100,               // 100 requests
    message: 'API rate limit exceeded'
  }),
};
```

**Customization**: To change limits, edit values above and restart server.

### 8.2 Security Headers Configuration

**Location**: `middleware.ts` (new `applySecurityHeaders()` function)

```typescript
const headers = new Headers(response.headers);
headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
headers.set('X-Frame-Options', 'SAMEORIGIN');
headers.set('X-Content-Type-Options', 'nosniff');
headers.set('X-XSS-Protection', '1; mode=block');
headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
headers.set('Content-Security-Policy', [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "frame-ancestors 'self'"
].join('; '));
```

**Customization**: Modify CSP directives based on security requirements.

### 8.3 Pino Logger Configuration

**Location**: `lib/middleware/logger.ts`

```typescript
const pinoLogger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    }
  })
});
```

**Environment Variables**:
- `NODE_ENV=production`: JSON logs, `info` level
- `NODE_ENV=development`: Pretty logs, `debug` level

---

## 9. Rollback Plan

### 9.1 Rollback Triggers
- Critical functionality broken (login fails, ARIA unusable)
- Excessive false positives (legitimate users blocked)
- Performance degradation (latency > 50ms)

### 9.2 Rollback Procedure

**Step 1**: Disable rate limiting
```typescript
// In middleware.ts, comment out rate limiting logic
// const rateLimitResult = rateLimitMiddleware(request);
// if (rateLimitResult) return rateLimitResult;
```

**Step 2**: Disable security headers (if causing issues)
```typescript
// In middleware.ts, comment out security headers
// return applySecurityHeaders(response);
return response;
```

**Step 3**: Revert to previous logger (if Pino causes issues)
```bash
git revert <commit-hash>  # Revert logger changes
npm install               # Reinstall dependencies
npm run build            # Rebuild
```

### 9.3 Monitoring Post-Deployment

**Metrics to Watch**:
- 429 error rate (should be < 1% of total requests)
- Login success rate (should remain same as baseline)
- ARIA chat completion rate (should remain same)
- Server response time (p50, p95, p99)

**Alerts**:
- Alert if 429 rate > 5% for 5 minutes
- Alert if login success rate drops > 10%
- Alert if response time p95 > 500ms

---

## 10. Future Enhancements (Out of Scope)

### 10.1 Redis-Based Rate Limiting
**Benefit**: Shared state across multiple server instances  
**Effort**: 4-6 hours  
**Priority**: Medium

### 10.2 User-Based Rate Limiting
**Benefit**: More accurate limiting for authenticated users  
**Effort**: 2-3 hours  
**Priority**: Low

### 10.3 Dynamic Rate Limit Adjustment
**Benefit**: Auto-adjust limits based on traffic patterns  
**Effort**: 8-12 hours  
**Priority**: Low

### 10.4 Rate Limit Dashboard
**Benefit**: Real-time visibility into rate limiting metrics  
**Effort**: 12-16 hours  
**Priority**: Low

---

## 11. Success Criteria Summary

**Functional**:
- ✅ ARIA chat limited to 10 requests/min
- ✅ ARIA feedback limited to 100 requests/min
- ✅ Auth callback limited to 5 attempts/15 min
- ✅ Security headers on all responses
- ✅ Pino logger integrated and logging security events

**Technical**:
- ✅ Integration test validates 429 response
- ✅ All existing tests pass
- ✅ Type checking passes
- ✅ Linting passes
- ✅ No breaking changes

**Performance**:
- ✅ Latency increase < 5ms
- ✅ No increase in error rate

**Documentation**:
- ✅ SECURITY.md updated
- ✅ MIDDLEWARE.md updated
- ✅ JSDoc comments added

---

**Document Status**: ✅ Ready for Implementation  
**Next Document**: `plan.md` (Implementation Plan)
