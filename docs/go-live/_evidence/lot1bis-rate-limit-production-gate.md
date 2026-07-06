# Gate rate limiting production

## État local

Le code expose `getRateLimitRuntimeMode()` avec modes `redis`, `upstash`, `memory`. Les tests `__tests__/lib/rate-limit.distributed.test.ts` prouvent :

- `RATE_LIMIT_DISABLE=1` ne bypass pas en `NODE_ENV=production` ;
- Upstash est utilisé si `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` sont présents ;
- Redis est utilisé si `REDIS_URL` est présent ;
- Redis prime sur Upstash si les deux sont présents ;
- fallback mémoire existe si Redis échoue.

## État production

À vérifier, aucun secret lu.

## Variables attendues

- `REDIS_URL` ou
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Ne jamais afficher les valeurs.

## Healthcheck attendu

`GET /api/internal/health` doit retourner `checks.redis.detail = redis` ou `upstash`. Si `detail = memory`, le go-live large est interdit.

## Test 429 attendu

Sur une route publique sensible (`/api/bilan-gratuit`, `/api/assessments/submit`, `/api/student/activate`), envoyer plus de requêtes que le preset autorisé depuis la même IP/test key doit retourner `429 RATE_LIMIT_EXCEEDED`.

## Décision

Go-live large interdit tant que le mode distribué n’est pas prouvé en production réelle par healthcheck et test 429. Bêta contrôlée possible uniquement avec volume limité, monitoring manuel et réserve formelle.
