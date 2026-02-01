# Middleware - Nexus Réussite

**Last Updated**: 2026-02-01
**Status**: Production-Ready

---

## 🎯 Overview

This document describes the middleware layer for API routes, including rate limiting and structured logging.

---

## 🚦 Rate Limiting

### Overview

Rate limiting prevents abuse and ensures fair resource allocation. We use an in-memory sliding window algorithm with configurable presets.

### Implementation

**Location**: `lib/middleware/rateLimit.ts`

**Algorithm**: Sliding window counter
- Tracks request count per IP/user within time window
- Resets counter when window expires
- Returns 429 (via 400 with error code) when limit exceeded

**Storage**:
- In-memory store (current)
- For production multi-instance: Use Redis (upstash/ratelimit, ioredis, etc.)

### Usage

#### Basic Usage

```typescript
import { rateLimit } from '@/lib/middleware/rateLimit';

export async function POST(request: NextRequest) {
  // Apply rate limit
  const rateLimitResult = rateLimit({
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 10       // 10 requests per minute
  })(request);

  if (rateLimitResult) return rateLimitResult;

  // ... route logic
}
```

#### Using Presets

```typescript
import { RateLimitPresets } from '@/lib/middleware/rateLimit';

export async function POST(request: NextRequest) {
  // Use preset rate limiter
  const rateLimitResult = RateLimitPresets.expensive(request, 'payment-create');
  if (rateLimitResult) return rateLimitResult;

  // ... route logic
}
```

### Available Presets

| Preset | Window | Max Requests | Use Case |
|--------|--------|--------------|----------|
| `auth` | 15 min | 5 | Login, password reset |
| `api` | 1 min | 100 | General API endpoints |
| `expensive` | 1 min | 10 | Database writes, external APIs |
| `public` | 1 min | 300 | Public read-only endpoints |

### Response Headers

Rate limit info is included in response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706782800
Retry-After: 45 (when limited)
```

### Error Response

When rate limit exceeded:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Too many requests, please try again later",
  "details": {
    "retryAfter": 45
  }
}
```

### Advanced Usage

#### Custom Key Prefix

```typescript
// Different limits for different operations
const rateLimitResult = RateLimitPresets.api(request, 'user-create');
```

#### Clear Rate Limit (Testing/Admin)

```typescript
import { clearRateLimit } from '@/lib/middleware/rateLimit';

// Clear rate limit for specific request
clearRateLimit(request, 'user-create');
```

#### Check Status Without Incrementing

```typescript
import { getRateLimitStatus } from '@/lib/middleware/rateLimit';

const status = getRateLimitStatus(request, {
  windowMs: 60 * 1000,
  maxRequests: 100
});

console.log(`Remaining: ${status.remaining}`);
```

### Production Considerations

1. **Use Redis for multi-instance deployments**:
```typescript
// Example with upstash/ratelimit
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '60 s'),
});
```

2. **Customize key generation** for authenticated users:
```typescript
// In getRateLimitKey()
const userId = session?.user?.id;
return userId ? `rl:user:${userId}` : `rl:ip:${ip}`;
```

3. **Monitor rate limit hits** to detect abuse patterns

---

## 📊 Structured Logging

### Overview

Structured logging provides consistent, queryable logs with contextual information for debugging and monitoring.

### Implementation

**Location**: `lib/middleware/logger.ts`

**Format**: JSON structured logs
- Request ID for correlation
- Timestamp (ISO 8601)
- User context (ID, role)
- Performance metrics (duration)
- Error details (sanitized)

### Usage

#### Basic Usage

```typescript
import { createLogger } from '@/lib/middleware/logger';

export async function GET(request: NextRequest) {
  const logger = createLogger(request);

  logger.info('Fetching users');

  try {
    const users = await prisma.user.findMany();

    logger.logRequest(200, { count: users.length });

    return successResponse({ users });
  } catch (error) {
    logger.error('Failed to fetch users', error);
    logger.logRequest(500);

    return handleApiError(error);
  }
}
```

#### With Authentication Context

```typescript
const session = await requireRole('ADMIN');
if (isErrorResponse(session)) return session;

const logger = createLogger(request, session);
// Logger now includes userId and userRole
```

### Log Levels

| Level | Use Case | Production |
|-------|----------|------------|
| `DEBUG` | Development debugging | Disabled |
| `INFO` | Normal operations | Enabled |
| `WARN` | Non-critical issues | Enabled |
| `ERROR` | Failures and exceptions | Enabled |

### Log Methods

#### `logger.debug(message, meta?)`
Development-only detailed logs.

```typescript
logger.debug('Validating user input', { fieldCount: 5 });
```

#### `logger.info(message, meta?)`
Informational logs for normal operations.

```typescript
logger.info('User created', { userId: 'user-123', role: 'ELEVE' });
```

#### `logger.warn(message, meta?)`
Warning logs for recoverable issues.

```typescript
logger.warn('Rate limit approaching', { remaining: 5 });
```

#### `logger.error(message, error?, meta?)`
Error logs with exception details.

```typescript
logger.error('Database query failed', error, { query: 'findMany' });
```

#### `logger.logRequest(statusCode, meta?)`
Log request completion with auto-level based on status code.

```typescript
logger.logRequest(200, { count: users.length, duration: 45 });
// Output: "GET /api/users 200 - 45ms"
```

### Log Output Format

```json
{
  "level": "info",
  "message": "GET /api/users 200 - 45ms",
  "requestId": "req_1706782745123_abc123",
  "timestamp": "2026-02-01T12:05:45.123Z",
  "method": "GET",
  "path": "/api/users",
  "userId": "user-123",
  "userRole": "ADMIN",
  "statusCode": 200,
  "duration": 45,
  "count": 50
}
```

### Advanced Features

#### Add Custom Context

```typescript
logger.addContext('operation', 'bulk-import');
logger.addContext('batchSize', 100);
```

#### Performance Timing

```typescript
import { timeOperation } from '@/lib/middleware/logger';

const users = await timeOperation('db.users.findMany', async () => {
  return await prisma.user.findMany();
}, logger);
```

#### Log Presets

```typescript
import { LogPresets } from '@/lib/middleware/logger';

// Authentication attempt
LogPresets.authAttempt(logger, 'user@example.com', true);

// Authorization check
LogPresets.authzCheck(logger, 'admin-users', true);

// Database query
LogPresets.dbQuery(logger, 'findMany', 'users', 45);

// External API call
LogPresets.externalApi(logger, 'stripe', '/v1/charges', 200, 350);
```

#### Sanitization

Automatically redacts sensitive data:

```typescript
import { sanitizeLogData } from '@/lib/middleware/logger';

const sanitized = sanitizeLogData({
  email: 'user@example.com',
  password: 'secret123',  // Redacted
  token: 'abc123'         // Redacted
});

logger.info('User data', sanitized);
```

### Production Considerations

1. **Log aggregation**: Send logs to centralized service
   - Options: Datadog, Splunk, CloudWatch, Elasticsearch
   - Use log shipping agent or direct API integration

2. **Log retention**: Configure retention policies
   - Development: 7 days
   - Production: 30-90 days (compliance requirements)

3. **Sensitive data**: Always sanitize before logging
   - Passwords, tokens, API keys
   - PII (depending on compliance requirements)

4. **Performance**: Async logging in high-throughput scenarios
   ```typescript
   // Non-blocking log write
   setImmediate(() => logger.info('Async log'));
   ```

5. **Sampling**: Reduce log volume in production
   ```typescript
   // Log 10% of successful requests
   if (statusCode < 400 && Math.random() < 0.1) {
     logger.logRequest(statusCode, meta);
   }
   ```

---

## 📋 Best Practices

### Rate Limiting

1. **Choose appropriate presets** based on operation cost
2. **Use custom key prefixes** to separate different operations
3. **Add Retry-After headers** for better client experience
4. **Monitor rate limit hits** to detect abuse or adjust limits
5. **Implement Redis** for production multi-instance deployments

### Logging

1. **Log at appropriate levels** (don't over-log)
2. **Include contextual metadata** for debugging
3. **Use structured format** for queryability
4. **Sanitize sensitive data** before logging
5. **Log request completion** for performance monitoring
6. **Add request IDs** for distributed tracing
7. **Set up log aggregation** for production

### Combined Usage

```typescript
import { RateLimitPresets } from '@/lib/middleware/rateLimit';
import { createLogger } from '@/lib/middleware/logger';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = RateLimitPresets.expensive(request, 'admin-users');
    if (rateLimitResult) return rateLimitResult;

    // Authentication
    const session = await requireRole('ADMIN');
    if (isErrorResponse(session)) return session;

    // Logging
    const logger = createLogger(request, session);
    logger.info('Creating user');

    // Business logic
    const data = await parseBody(request, createUserSchema);
    const user = await prisma.user.create({ data });

    // Log success
    logger.logRequest(201, { userId: user.id });

    return successResponse({ user }, 201);
  } catch (error) {
    // Log error
    const logger = createLogger(request);
    logger.error('Failed to create user', error);
    logger.logRequest(500);

    return handleApiError(error);
  }
}
```

---

## 🔧 Configuration

### Environment Variables

```bash
# Logging
LOG_LEVEL=info  # debug, info, warn, error
NODE_ENV=production  # Disables debug logs in production

# Rate limiting (for Redis-based implementation)
REDIS_URL=redis://localhost:6379
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

### Customization

#### Custom Rate Limit Preset

```typescript
export const customRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,  // 5 minutes
  maxRequests: 50,
  message: 'Custom rate limit exceeded'
});
```

#### Custom Log Format

```typescript
// Extend Logger class
class CustomLogger extends Logger {
  logCustomEvent(eventType: string, data: Record<string, unknown>): void {
    this.info(`Custom event: ${eventType}`, { eventType, ...data });
  }
}
```

---

## 📚 References

- [Rate Limiting Algorithms](https://en.wikipedia.org/wiki/Rate_limiting)
- [Structured Logging Best Practices](https://www.loggly.com/ultimate-guide/node-logging-basics/)
- [Upstash Rate Limit](https://upstash.com/docs/oss/sdks/ts/ratelimit/overview)
- [Winston Logger (Alternative)](https://github.com/winstonjs/winston)

---

**Last Reviewed**: 2026-02-01
**Next Review**: 2026-05-01
**Maintainer**: Équipe Nexus Réussite
