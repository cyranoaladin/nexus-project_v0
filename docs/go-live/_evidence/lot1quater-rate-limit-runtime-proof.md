# Lot 1-quater — Preuve rate limiting distribué

## État code

- `lib/rate-limit/index.ts` expose `getRateLimitRuntimeMode()` : `redis`, `upstash`, `memory`.
- `getRateLimitProductionGate()` ajoute une décision explicite : `memory` => `blocked`, `redis/upstash` => `allowed`.
- `RATE_LIMIT_DISABLE=1` reste ignoré en production par le code existant et les tests hérités.

## État tests

- `__tests__/lib/rate-limit.distributed.test.ts` couvre `RATE_LIMIT_DISABLE=1` en production, Redis, Upstash et fallback mémoire.
- `__tests__/lib/rate-limit.production-gate.test.ts` couvre la décision `memory` bloquante.
- `__tests__/api/internal.health.rate-limit.test.ts` couvre le healthcheck interne : `memory` => 503/degraded, `redis` => mode explicite.

## État production/staging

À vérifier. Aucun secret lu, aucun accès runtime externe utilisé dans ce lot.

## Healthcheck attendu

`GET /api/internal/health` doit retourner :

- `runtime.rateLimit.mode = redis` ou `upstash` pour go-live large ;
- `runtime.rateLimit.distributed = true` ;
- `runtime.rateLimit.goLiveLarge = allowed`.

En mode `memory`, le healthcheck doit rester dégradé et `goLiveLarge = blocked`.

## Test 429 attendu

Sur staging/production, une route publique sensible doit être appelée jusqu'au dépassement du preset attendu et retourner `429` avec headers `Retry-After` et `X-RateLimit-*`.

## Verdict

GO-LIVE LARGE INTERDIT tant que `redis` ou `upstash` n'est pas vérifié sur staging/production.
