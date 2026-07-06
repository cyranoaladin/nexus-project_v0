# Lot 4 — Redis/Upstash runtime proof

## Local

Commande sûre exécutée :

`npx tsx -e "...getRateLimitProductionGate..."`

Résultat : `mode=memory`, `gate.ok=false`, `decision=blocked`.

## Staging

À vérifier. Aucun environnement staging authentifié accessible sans secret dans cette session.

## Production

`NEXUS_HEALTH_AUTH` absent de l'environnement local de vérification.

Commande sans secret :

`curl -sS -o /tmp/nexus-internal-health-lot4.txt -w "%{http_code}\n" https://nexusreussite.academy/api/internal/health`

Résultat : `401`.

## Healthcheck authentifié attendu

- `runtime.rateLimit.mode = redis` ou `upstash`
- `runtime.rateLimit.distributed = true`
- `runtime.rateLimit.goLiveLarge = allowed`

## Test 429 réel

Non exécuté : aucun staging/auth disponible et le code Lot 4 n'est pas déployé. Ne pas polluer les quotas production sans fenêtre dédiée.

## Résultat

Redis/Upstash NON PROUVÉ.

## Décision

BÊTA ÉLARGIE INTERDITE. GO-LIVE LARGE INTERDIT.
