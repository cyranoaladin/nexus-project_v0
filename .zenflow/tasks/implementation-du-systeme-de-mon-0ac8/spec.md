# Technical Specification: Monitoring and Error Management System

**Project**: Nexus Réussite  
**Feature**: Monitoring and Error Management  
**Version**: 1.0  
**Last Updated**: 2026-02-02  
**Status**: Implementation Ready

---

## 1. Technical Context

### 1.1 Stack Overview

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Framework | Next.js (App Router) | 15.5.11 | Full-stack React framework |
| Runtime | Node.js | 20+ | Server-side JavaScript runtime |
| Language | TypeScript | 5.x | Type-safe development |
| Testing (Unit) | Jest | 29.7.0 | Unit and integration tests |
| Testing (E2E) | Playwright | 1.58.1 | End-to-end testing |
| Database | PostgreSQL + Prisma | 6.13.0 | Data persistence |
| Validation | Zod | 3.23.8 | Runtime type validation |

### 1.2 Existing Error Infrastructure

The codebase already has a sophisticated error handling system:

**Files**:
- `lib/api/errors.ts` - Centralized error classes and handlers
- `lib/api/helpers.ts` - API utility functions
- `components/providers.tsx` - Client-side providers wrapper

**Current Error System**:
```typescript
// ApiError class with factory methods
ApiError.badRequest()
ApiError.unauthorized()
ApiError.forbidden()
ApiError.notFound()
ApiError.conflict()
ApiError.internal()

// Unified error handler
handleApiError(error, context)

// Zod validation handler
handleZodError(error)

// Standardized error response format
{
  "error": "ERROR_CODE",
  "message": "Human-readable message",
  "details": { /* optional */ }
}
```

**Current Logging**: Uses `console.log/warn/error` (unstructured)

### 1.3 Dependencies to Add

```json
{
  "dependencies": {
    "pino": "^9.0.0",
    "pino-pretty": "^13.0.0"
  }
}
```

**Rationale**:
- **Pino**: 5-10x faster than Winston, native JSON output, excellent Next.js compatibility
- **pino-pretty**: Development-friendly colored output

---

## 2. Implementation Approach

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Client (Browser)                        │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  ErrorBoundary (Global)                             │  │
│  │  - Catches all React errors                         │  │
│  │  - Shows fallback UI                                │  │
│  │  - Logs to console (dev) or server (future)         │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ API Requests
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Server (Next.js API Routes)                │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Logger (Pino)                                     │    │
│  │  - Structured JSON logs (production)                │    │
│  │  - Pretty-printed logs (development)                │    │
│  │  - Context enrichment (requestId, userId, route)    │    │
│  └────────────────────────────────────────────────────┘    │
│                            │                                 │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Error Handler (lib/api/errors.ts)                 │    │
│  │  - Catches all API errors                           │    │
│  │  - Logs with structured logger                      │    │
│  │  - Returns standardized JSON response               │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Logging Strategy

#### 2.2.1 Logger Configuration

**File**: `lib/logger.ts` (new)

```typescript
import pino from 'pino';

// Environment-aware configuration
const isDev = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';
const logLevel = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');

// Create logger instance
export const logger = pino({
  level: isTest ? 'silent' : logLevel,
  // Development: pretty-print with colors
  // Production: structured JSON
  transport: isDev ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname'
    }
  } : undefined,
  // Base fields for all logs
  base: {
    env: process.env.NODE_ENV
  }
});

// Create child logger with request context
export function createRequestLogger(context: {
  requestId: string;
  method: string;
  path: string;
  userId?: string;
}) {
  return logger.child(context);
}
```

**Environment Variables** (`.env.example`):
```bash
# Logging Configuration
LOG_LEVEL=info  # trace | debug | info | warn | error | fatal
```

#### 2.2.2 Request Logging Helpers

**File**: `lib/api/helpers.ts` (modified)

Add new function:
```typescript
import { logger, createRequestLogger } from '@/lib/logger';

/**
 * Generate unique request ID for tracing
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Log incoming API request
 */
export function logRequest(
  method: string,
  path: string,
  requestId: string,
  userId?: string
) {
  const reqLogger = createRequestLogger({ requestId, method, path, userId });
  reqLogger.info({ event: 'request' }, 'Incoming request');
  return reqLogger;
}
```

#### 2.2.3 Error Handler Integration

**File**: `lib/api/errors.ts` (modified)

Update `handleApiError` function:

```typescript
// Before (existing):
console.warn(`${logPrefix} ${error.code}:`, error.message);
console.error(`${logPrefix} Unexpected error:`, ...);

// After (updated):
import { logger } from '@/lib/logger';

export function handleApiError(
  error: unknown, 
  context?: string,
  requestLogger?: pino.Logger
): NextResponse<ApiErrorResponse> {
  const logContext = { context };
  const log = requestLogger || logger;

  if (error instanceof ApiError) {
    // Expected API errors - log as warning
    log.warn({ 
      ...logContext,
      errorCode: error.code, 
      statusCode: error.statusCode,
      details: error.details 
    }, error.message);
    return error.toResponse();
  }

  if (error instanceof ZodError) {
    // Validation errors
    log.warn({ ...logContext, validationErrors: error.errors }, 'Validation error');
    return handleZodError(error);
  }

  // Unexpected errors - log as error (with stack trace)
  log.error({ 
    ...logContext,
    error: error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : 'Unknown error'
  }, 'Unexpected error');

  // Never expose internal details to client
  return errorResponse(
    HttpStatus.INTERNAL_SERVER_ERROR,
    ErrorCode.INTERNAL_ERROR,
    'An unexpected error occurred'
  );
}
```

#### 2.2.4 Sensitive Data Sanitization

Add sanitization function to `lib/logger.ts`:

```typescript
/**
 * Sanitize sensitive data from logs
 */
export function sanitizeLogData(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'creditCard', 'ssn'];
  const sanitized = { ...data };
  
  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED]';
    }
  }
  
  return sanitized;
}
```

### 2.3 ErrorBoundary Implementation

#### 2.3.1 ErrorBoundary Component

**File**: `components/error-boundary.tsx` (new)

```typescript
'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught error:', error, errorInfo);
    }
    
    // Store error details
    this.setState({ error, errorInfo });
    
    // Future: Send to server-side logging endpoint
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

/**
 * Default error fallback UI
 */
function ErrorFallback({ error, onReset }: { error?: Error; onReset: () => void }) {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">
            Oups ! Une erreur s'est produite
          </h1>
          <p className="text-neutral-400">
            Quelque chose s'est mal passé. Veuillez réessayer.
          </p>
        </div>

        {isDev && error && (
          <div className="bg-red-950/20 border border-red-900 rounded-lg p-4 text-left">
            <p className="text-red-400 font-mono text-sm break-all">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-lg font-medium transition-colors"
          >
            Recharger la page
          </button>
          <button
            onClick={onReset}
            className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-medium transition-colors"
          >
            Réessayer
          </button>
        </div>

        <p className="text-sm text-neutral-500">
          Si le problème persiste, veuillez{' '}
          <a href="/contact" className="text-brand-primary hover:underline">
            contacter le support
          </a>
        </p>
      </div>
    </div>
  );
}
```

#### 2.3.2 Integration with Providers

**File**: `components/providers.tsx` (modified)

```typescript
"use client";

import "@/lib/cleanup-sw";
import { useWeb3Guard } from "@/lib/web3-guard";
import { SessionProvider } from "next-auth/react";
import { LanguageProvider } from "@/context/LanguageContext";
import { ErrorBoundary } from "@/components/error-boundary";

function Web3GuardProvider({ children }: { children: React.ReactNode; }) {
  useWeb3Guard();
  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode; }) {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <LanguageProvider>
          <Web3GuardProvider>
            {children}
          </Web3GuardProvider>
        </LanguageProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}
```

---

## 3. Source Code Structure Changes

### 3.1 New Files

```
lib/
└── logger.ts                          # Pino logger instance and utilities

components/
└── error-boundary.tsx                 # Global ErrorBoundary component

__tests__/
├── lib/
│   └── logger.test.ts                 # Logger unit tests
├── api/
│   └── error-logging.test.ts          # API error logging integration test
└── components/
    └── error-boundary.test.tsx        # ErrorBoundary tests
```

### 3.2 Modified Files

```
lib/api/
├── errors.ts                          # Update handleApiError() to use logger
└── helpers.ts                         # Add request logging helpers

components/
└── providers.tsx                      # Wrap with ErrorBoundary

.env.example                           # Add LOG_LEVEL variable

package.json                           # Add pino and pino-pretty
```

### 3.3 File Modification Details

#### `lib/api/errors.ts`
- **Change**: Replace `console.*` calls with structured logger
- **Lines affected**: ~210-228 (handleApiError function)
- **Breaking changes**: None (internal implementation only)

#### `lib/api/helpers.ts`
- **Change**: Add `generateRequestId()` and `logRequest()` functions
- **Lines affected**: End of file (new exports)
- **Breaking changes**: None (additive only)

#### `components/providers.tsx`
- **Change**: Wrap entire provider tree with `<ErrorBoundary>`
- **Lines affected**: ~14-22 (Providers component return statement)
- **Breaking changes**: None (wrapping component)

#### `.env.example`
- **Change**: Add logging configuration section
- **Lines affected**: End of file (new section)
- **Breaking changes**: None (documentation only)

---

## 4. Data Model / API / Interface Changes

### 4.1 API Response Format

**No changes** - existing error response format preserved:

```typescript
// Existing format (unchanged)
interface ApiErrorResponse {
  error: string;        // ERROR_CODE
  message: string;      // Human-readable message
  details?: unknown;    // Optional context
}
```

### 4.2 Log Record Structure

**New** - Pino log records (server-side only):

```typescript
// Development (pretty-printed)
14:23:45 INFO: Incoming request
  requestId: "a1b2c3d4-..."
  method: "POST"
  path: "/api/sessions/book"
  userId: "cm3..."

// Production (JSON)
{
  "level": 30,
  "time": 1738522425000,
  "env": "production",
  "requestId": "a1b2c3d4-...",
  "method": "POST",
  "path": "/api/sessions/book",
  "userId": "cm3...",
  "event": "request",
  "msg": "Incoming request"
}
```

### 4.3 New Exports

**`lib/logger.ts`**:
```typescript
export const logger: pino.Logger;
export function createRequestLogger(context: RequestContext): pino.Logger;
export function sanitizeLogData(data: Record<string, unknown>): Record<string, unknown>;
```

**`lib/api/helpers.ts`**:
```typescript
export function generateRequestId(): string;
export function logRequest(method: string, path: string, requestId: string, userId?: string): pino.Logger;
```

**`components/error-boundary.tsx`**:
```typescript
export class ErrorBoundary extends Component<Props, State>;
```

---

## 5. Delivery Phases

### Phase 1: Infrastructure Setup ⏱️ 30-45 minutes

**Objective**: Install dependencies and create logger module

**Tasks**:
1. Install Pino dependencies
   ```bash
   npm install pino pino-pretty
   ```
2. Create `lib/logger.ts` with Pino configuration
3. Add `LOG_LEVEL` to `.env.example`
4. Write unit tests (`__tests__/lib/logger.test.ts`)
5. Run tests to verify logger works

**Verification**:
```bash
npm run test:unit -- logger.test.ts
npm run typecheck
```

**Deliverables**:
- [ ] `lib/logger.ts` created
- [ ] `__tests__/lib/logger.test.ts` passing
- [ ] `.env.example` updated
- [ ] Type checking passes

---

### Phase 2: Server-Side Integration ⏱️ 45-60 minutes

**Objective**: Integrate structured logging into existing API error handling

**Tasks**:
1. Update `lib/api/errors.ts`:
   - Import logger
   - Replace `console.*` with `logger.*` in `handleApiError()`
   - Add request context to error logs
2. Update `lib/api/helpers.ts`:
   - Add `generateRequestId()`
   - Add `logRequest()` helper
3. Write API error logging test (`__tests__/api/error-logging.test.ts`)
4. Update 1-2 sample API routes to use request logging (example implementation)

**Verification**:
```bash
npm run test:integration -- error-logging.test.ts
npm run test:unit
npm run typecheck
npm run lint
```

**Deliverables**:
- [ ] `lib/api/errors.ts` updated
- [ ] `lib/api/helpers.ts` updated
- [ ] `__tests__/api/error-logging.test.ts` passing
- [ ] All existing tests still pass
- [ ] Example API route demonstrates usage

---

### Phase 3: Client-Side Error Boundary ⏱️ 30-45 minutes

**Objective**: Implement global error boundary for React errors

**Tasks**:
1. Create `components/error-boundary.tsx`
   - ErrorBoundary class component
   - ErrorFallback UI component
   - Development vs production error display
2. Update `components/providers.tsx` to wrap with ErrorBoundary
3. Write ErrorBoundary tests (`__tests__/components/error-boundary.test.tsx`)
4. Manual testing in browser (trigger test error)

**Verification**:
```bash
npm run test:unit -- error-boundary.test.tsx
npm run dev
# Manually trigger error in browser to verify fallback UI
```

**Deliverables**:
- [ ] `components/error-boundary.tsx` created
- [ ] `components/providers.tsx` updated
- [ ] `__tests__/components/error-boundary.test.tsx` passing
- [ ] Fallback UI styled with design system
- [ ] Manual browser test confirms error catching

---

### Phase 4: Validation & Documentation ⏱️ 20-30 minutes

**Objective**: Comprehensive testing and quality checks

**Tasks**:
1. Run full test suite
   ```bash
   npm run test           # All unit + integration tests
   npm run test:coverage  # Coverage report
   ```
2. Run type checking and linting
   ```bash
   npm run typecheck
   npm run lint
   ```
3. Test in development environment
   - Verify pretty-printed logs in terminal
   - Trigger API errors and check logs
   - Trigger React errors and verify ErrorBoundary
4. Update plan.md with completion status

**Verification**:
```bash
npm run verify:quick  # lint + typecheck + unit + integration tests
```

**Success Criteria**:
- ✅ All tests pass (100% of existing + new tests)
- ✅ Type checking passes with no errors
- ✅ Linting passes with no errors
- ✅ Code coverage ≥ 80% for new code
- ✅ No breaking changes to existing API routes
- ✅ Logger overhead < 5ms (verified in tests)

**Deliverables**:
- [ ] All tests passing
- [ ] Type checking clean
- [ ] Linting clean
- [ ] Coverage report ≥ 80%
- [ ] Manual testing completed
- [ ] `plan.md` marked complete

---

## 6. Verification Approach

### 6.1 Automated Testing

#### Unit Tests

**Logger Tests** (`__tests__/lib/logger.test.ts`):
```typescript
describe('Logger', () => {
  it('should log at correct levels', () => {});
  it('should include request context', () => {});
  it('should sanitize sensitive data', () => {});
  it('should handle different environments', () => {});
});
```

**ErrorBoundary Tests** (`__tests__/components/error-boundary.test.tsx`):
```typescript
describe('ErrorBoundary', () => {
  it('should catch component errors', () => {});
  it('should render fallback UI', () => {});
  it('should show stack trace in development', () => {});
  it('should hide stack trace in production', () => {});
  it('should allow error reset', () => {});
});
```

**API Error Logging Test** (`__tests__/api/error-logging.test.ts`):
```typescript
describe('API Error Logging', () => {
  it('should log exceptions with structured logger', () => {
    // Create mock API route that throws error
    // Verify logger.error() called with correct context
    // Verify standardized error response returned
  });
  
  it('should include request context in logs', () => {});
  it('should sanitize sensitive data from responses', () => {});
});
```

#### Integration Testing Strategy

1. **Existing API Tests**: Should continue to pass (no breaking changes)
2. **New Error Logging Test**: Verify logger integration in real API context
3. **ErrorBoundary Test**: React Testing Library to simulate errors

### 6.2 Manual Testing Checklist

**Development Environment**:
- [ ] Start dev server: `npm run dev`
- [ ] Trigger API error (invalid request) → Check terminal for pretty logs
- [ ] Check log includes: method, path, requestId, error details
- [ ] Verify no passwords/tokens in logs

**Client ErrorBoundary**:
- [ ] Create test page that throws error on button click
- [ ] Verify fallback UI displays
- [ ] Verify "Reload" button works
- [ ] Verify "Réessayer" button resets boundary
- [ ] Check console for error in development mode

**Production Simulation**:
- [ ] Build app: `npm run build`
- [ ] Start production server: `npm start`
- [ ] Trigger error → Verify JSON logs (not pretty-printed)
- [ ] Verify ErrorBoundary hides stack traces

### 6.3 CI/CD Integration

**Existing CI Commands** (from `package.json`):
```bash
npm run test:ci       # Unit + integration tests with coverage
npm run lint          # ESLint
npm run typecheck     # TypeScript compiler
```

**No changes required** - new tests run automatically in CI pipeline.

### 6.4 Performance Benchmarks

**Logging Overhead** (target: < 5ms per request):
```typescript
// Add to logger.test.ts
it('should have minimal overhead', () => {
  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    logger.info({ iteration: i }, 'Test log');
  }
  const duration = performance.now() - start;
  expect(duration).toBeLessThan(50); // 0.05ms per log
});
```

---

## 7. Risk Assessment & Mitigation

### 7.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Logging overhead affects performance | Low | Medium | Use Pino (fastest), async transport, benchmark tests |
| ErrorBoundary breaks existing providers | Low | High | Comprehensive tests, gradual rollout |
| Log volume overwhelms storage | Medium | Medium | Start with `info` level, rotate logs (infrastructure) |
| Sensitive data leaks in logs | Low | Critical | Sanitization function, code review, tests |

### 7.2 Breaking Change Analysis

**Zero Breaking Changes** ✅

- Error response format unchanged (existing clients unaffected)
- `handleApiError()` signature unchanged (optional `requestLogger` param)
- All existing API routes continue to work
- ErrorBoundary is a wrapper (doesn't change children behavior)

### 7.3 Rollback Plan

**Phase 1-2 (Server-side)**:
- Remove logger import from `lib/api/errors.ts`
- Restore `console.*` calls
- Uninstall Pino

**Phase 3 (Client-side)**:
- Remove `<ErrorBoundary>` wrapper from `components/providers.tsx`
- Delete `components/error-boundary.tsx`

**Git Revert**:
```bash
git revert <commit-hash>
```

---

## 8. Security Considerations

### 8.1 Sensitive Data Protection

**Sanitization Strategy**:
1. Never log passwords, tokens, API keys, credit card numbers
2. Use `sanitizeLogData()` helper for request bodies
3. Generic error messages to clients (no stack traces in production)
4. Request IDs for correlation (not sensitive data)

**Code Example**:
```typescript
// ❌ BAD - logs password
logger.info({ body: requestBody }, 'User login');

// ✅ GOOD - sanitizes body
logger.info({ body: sanitizeLogData(requestBody) }, 'User login');
```

### 8.2 Log Access Control

**Recommendations** (infrastructure responsibility):
- Restrict log file permissions to authorized users only
- Use secure log aggregation service (future: CloudWatch, Datadog)
- Implement log retention policies (GDPR compliance)

### 8.3 Error Message Sanitization

**Client Responses**:
- Production: Generic messages ("An error occurred")
- Development: Detailed messages (for debugging)
- Never expose: Stack traces, file paths, environment variables

**Implemented in `handleApiError()`** ✅

---

## 9. Future Enhancements (Out of Scope)

1. **External Error Tracking**: Sentry/Rollbar integration for production monitoring
2. **Client-to-Server Error Reporting**: API endpoint to receive client errors
3. **Log Aggregation**: CloudWatch/ELK/Datadog integration
4. **Distributed Tracing**: OpenTelemetry for microservices correlation
5. **APM**: Performance monitoring (response times, throughput)
6. **Real-time Alerting**: Slack/email notifications for critical errors
7. **Log Analytics Dashboard**: UI for searching/filtering logs

---

## 10. Dependencies & Compatibility

### 10.1 New Dependencies

```json
{
  "dependencies": {
    "pino": "^9.0.0",          // 0 deps, 8.5MB installed size
    "pino-pretty": "^13.0.0"   // dev-only transport
  }
}
```

**Bundle Impact**:
- Server: +8.5MB (Pino only, acceptable)
- Client: +0 bytes (ErrorBoundary is React built-in)

### 10.2 Compatibility Matrix

| Component | Minimum Version | Tested Version | Status |
|-----------|----------------|----------------|--------|
| Node.js | 18.0.0 | 20.19.9 | ✅ |
| Next.js | 15.0.0 | 15.5.11 | ✅ |
| React | 18.0.0 | 18.3.1 | ✅ |
| TypeScript | 5.0.0 | 5.x | ✅ |
| Jest | 29.0.0 | 29.7.0 | ✅ |

---

## 11. Success Metrics (Post-Implementation)

### 11.1 Technical Metrics

- ✅ 100% of API routes use `handleApiError()` (existing + new)
- ✅ 100% of errors logged with structured format
- ✅ 0 unhandled promise rejections in API routes
- ✅ ErrorBoundary catches all React errors (verified by test)
- ✅ Test coverage ≥ 80% for new code

### 11.2 Performance Metrics

- ✅ Logging overhead < 5ms per request (measured in benchmarks)
- ✅ No increase in API P95 response time
- ✅ ErrorBoundary bundle size < 1KB (React built-in)

### 11.3 Quality Metrics

- ✅ All tests pass (unit + integration + E2E)
- ✅ TypeScript compilation with zero errors
- ✅ ESLint passes with zero warnings
- ✅ Zero production errors from monitoring/logging system itself

---

## 12. Implementation Notes

### 12.1 Coding Conventions

Follow existing project patterns:
- **Imports**: Use `@/` alias for absolute imports
- **Error Handling**: Use `handleApiError()` wrapper in all API routes
- **TypeScript**: Strict mode enabled, no `any` types
- **Formatting**: Match existing Prettier/ESLint configuration
- **Comments**: JSDoc for public functions, inline comments for complex logic

### 12.2 Testing Conventions

- **Unit Tests**: `__tests__/lib/`, `__tests__/components/`
- **Integration Tests**: `__tests__/api/`
- **Test Files**: `*.test.ts` or `*.test.tsx`
- **Coverage**: Minimum 80% for new code
- **Mocking**: Use Jest mocks for external dependencies

### 12.3 Git Workflow

```bash
# Feature branch
git checkout -b feature/monitoring-error-management

# Commit structure (one per phase)
git commit -m "feat: add pino logger infrastructure"
git commit -m "feat: integrate logger with API error handling"
git commit -m "feat: add global ErrorBoundary component"
git commit -m "test: add comprehensive error management tests"

# Final PR
git push origin feature/monitoring-error-management
```

---

## 13. Appendix

### 13.1 Example API Route (Before/After)

**Before**:
```typescript
// app/api/sessions/book/route.ts
export async function POST(request: NextRequest) {
  try {
    const body = await safeJsonParse(request);
    const session = await getServerSession(authOptions);
    // ... business logic
    return successResponse(booking);
  } catch (error) {
    return handleApiError(error, 'POST /api/sessions/book');
  }
}
```

**After** (with request logging):
```typescript
// app/api/sessions/book/route.ts
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const reqLogger = logRequest('POST', '/api/sessions/book', requestId);
  
  try {
    const body = await safeJsonParse(request);
    const session = await getServerSession(authOptions);
    
    reqLogger.info({ userId: session.user.id }, 'Booking session');
    
    // ... business logic
    
    reqLogger.info({ bookingId: booking.id }, 'Session booked successfully');
    return successResponse(booking);
  } catch (error) {
    return handleApiError(error, 'POST /api/sessions/book', reqLogger);
  }
}
```

### 13.2 Sample Log Output

**Development** (pretty-printed):
```
14:23:45 INFO: Incoming request
  requestId: "a1b2c3d4-5678-90ab-cdef-1234567890ab"
  method: "POST"
  path: "/api/sessions/book"
  userId: "cm3abc123"
  
14:23:46 ERROR: Validation error
  requestId: "a1b2c3d4-5678-90ab-cdef-1234567890ab"
  validationErrors: [
    { path: "studentId", message: "Required" }
  ]
```

**Production** (JSON):
```json
{"level":30,"time":1738522425000,"env":"production","requestId":"a1b2c3d4-5678-90ab-cdef-1234567890ab","method":"POST","path":"/api/sessions/book","userId":"cm3abc123","event":"request","msg":"Incoming request"}
{"level":50,"time":1738522426000,"env":"production","requestId":"a1b2c3d4-5678-90ab-cdef-1234567890ab","validationErrors":[{"path":"studentId","message":"Required"}],"msg":"Validation error"}
```

---

**End of Technical Specification**
