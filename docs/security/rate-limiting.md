# Rate Limiting

## Architecture

All rate limiting uses a single unified system in `lib/rate-limit/`.

```
lib/rate-limit/
  index.ts          # Public API: checkRateLimit, guardRateLimit, async distributed guard, rateLimitResponse
  presets.ts        # Named preset configurations
  keys.ts           # Key generation (IP, userId, hash)
  memory-store.ts   # Bounded in-memory store with TTL cleanup
  upstash-store.ts  # Optional Upstash REST backend for distributed limits
```

The legacy `lib/middleware/rateLimit.ts` is a **compatibility facade** that delegates to the unified system. New code should import directly from `@/lib/rate-limit`.

## Runtime modes

| Environment | Backend | Behavior |
|---|---|---|
| Development/test | `MemoryStore` by default | Local counters, `_resetStoreForTests()` supported |
| Development/test with `RATE_LIMIT_DISABLE=1` | Bypass | Allowed only outside production |
| Production with `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Upstash REST | Distributed counters shared by app processes |
| Production without Upstash env | `MemoryStore` fallback | Functional but not distributed; acceptable only for controlled beta until prod env is configured |
| Production with `RATE_LIMIT_DISABLE=1` | Protection remains active | The disable flag is ignored in production |

## Usage

### Quick guard (recommended)

```ts
import { guardRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const blocked = guardRateLimit(request, { preset: 'api' });
  if (blocked) return blocked; // 429 response

  // ... route logic
}
```

### Public write guard (distributed when configured)

Public routes that write data, send email/Telegram, or trigger expensive work should use the async guard:

```ts
import { guardRateLimitAsync } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const blocked = await guardRateLimitAsync(request, {
    preset: 'api',
    keySuffix: 'contact',
  });
  if (blocked) return blocked;

  // ... route logic
}
```

### With userId (authenticated routes)

```ts
const blocked = guardRateLimit(request, {
  preset: 'expensive',
  userId: session.user.id,
});
if (blocked) return blocked;
```

### With sub-scoping

```ts
const blocked = guardRateLimit(request, {
  preset: 'api',
  keySuffix: 'admin-users',
});
if (blocked) return blocked;
```

### Full result (for custom logic)

```ts
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

const result = checkRateLimit(request, { preset: 'auth' });
if (!result.success) return rateLimitResponse(result);
```

## Presets

| Preset | Limit | Window | Use case |
|--------|-------|--------|----------|
| `auth` | 5 | 15 min | Login, password reset |
| `resendActivation` | 3 | 15 min | Resend activation email |
| `api` | 60 | 1 min | Standard API endpoints |
| `expensive` | 10 | 1 hour | Session booking, LLM calls |
| `ai` | 10 | 1 hour | AI/LLM generation |
| `notifyEmail` | 5 | 1 hour | Email notifications |
| `public` | 200 | 1 min | Public high-traffic endpoints |

## Key strategy

- **Public routes**: IP-based (`x-forwarded-for` > `x-real-ip` > `anonymous`)
- **Authenticated routes**: `userId` preferred for fairness
- **PII in keys**: Use `hashForKey()` (SHA-256, truncated to 16 hex chars)

## Response format

429 responses include:

```json
{
  "ok": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Trop de requetes. Veuillez reessayer plus tard."
  }
}
```

Headers: `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

## Intentional limit changes (P0.5)

During unification, two presets were tightened:

- `expensive`: 10 req/**min** → 10 req/**hour** (session booking/cancellation are sensitive operations; 10/hour is sufficient for normal use)
- `api`: 100 req/**min** → 60 req/**min** (more conservative default; still generous for legitimate traffic)

## Limitations

- **In-memory fallback**: Each PM2 worker has its own store. Effective limits are multiplied by worker count. This remains acceptable for development/test and controlled beta fallback only.
- **Distributed production**: Configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to make async guards process-wide.
- **Process restart**: Counters reset on restart (by design for rate limiting).
- **No per-key clearing**: Tests use `_resetStoreForTests()` to reset the full store.

## CI/E2E bypass

Set `RATE_LIMIT_DISABLE=1` to bypass all rate limiting in development/test.

**WARNING**: `RATE_LIMIT_DISABLE=1` is strictly reserved for CI/E2E test environments. In production the flag is ignored and protections remain active.

## Testing

```ts
import { _resetStoreForTests } from '@/lib/rate-limit';

beforeEach(() => {
  _resetStoreForTests();
});
```

## Migration from legacy system

The legacy `lib/middleware/rateLimit.ts` still works via facade. To migrate:

```diff
- import { RateLimitPresets } from '@/lib/middleware/rateLimit';
+ import { guardRateLimit } from '@/lib/rate-limit';

- const rateLimitResult = RateLimitPresets.api(request, 'my-route');
- if (rateLimitResult) return rateLimitResult;
+ const blocked = guardRateLimit(request, { preset: 'api', keySuffix: 'my-route' });
+ if (blocked) return blocked;
```
