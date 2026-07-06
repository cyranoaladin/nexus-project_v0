# Lot 1 — Rate limiting runtime

## Code vérifié

- `lib/rate-limit/index.ts`
- `lib/rate-limit/redis-store.ts`
- `lib/rate-limit/upstash-store.ts`
- `app/api/internal/health/route.ts`
- `__tests__/lib/rate-limit.distributed.test.ts`

## Constats

- `RATE_LIMIT_DISABLE=1` est ignoré en `NODE_ENV=production`.
- Le runtime choisit `redis` si `REDIS_URL` est présent, sinon `upstash` si les variables REST Upstash sont présentes, sinon `memory`.
- Le healthcheck interne expose le mode dans `checks.redis.detail`.
- Le mode `memory` rend le healthcheck dégradé et reste bloquant pour go-live large.

## Routes renforcées dans Lot 1

- `/api/student/activate` : `guardRateLimitAsync`, preset `auth`, suffixe `student-activate`.
- `/api/lamis/teacher-report` : `guardRateLimitAsync`, preset `api`, suffixe `lamis-teacher-report`.

## Tests

- `__tests__/lib/rate-limit.distributed.test.ts` couvre production + `RATE_LIMIT_DISABLE=1`, Redis, Upstash et fallback mémoire.
- `__tests__/api/student.activate.route.test.ts` couvre 429 GET/POST.
- `__tests__/api/lamis.teacher-report.route.test.ts` couvre 429 GET/POST.

## Réserve

Le rate limiting distribué n’est pas prouvé sur production réelle dans Lot 1. Aucune valeur de secret Redis/Upstash n’a été lue ni affichée.
