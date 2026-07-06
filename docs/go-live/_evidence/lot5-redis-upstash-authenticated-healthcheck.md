# Lot 5 — Redis/Upstash authenticated healthcheck

## Objectif

Prouver le mode runtime Redis/Upstash sur staging/production, ou maintenir un blocage formel.

## Vérification locale sans secret

Commande :

`if [ -n "${NEXUS_HEALTH_AUTH:-}" ]; then echo "NEXUS_HEALTH_AUTH_PRESENT"; else echo "NEXUS_HEALTH_AUTH_ABSENT"; fi`

Résultat : `NEXUS_HEALTH_AUTH_ABSENT`.

## Production sans secret

Commande non authentifiée :

`curl -sS -o /tmp/nexus-internal-health-lot5.txt -w "%{http_code}\n" https://nexusreussite.academy/api/internal/health`

Résultat : `401`.

## État local

Commande Node locale :

`npx tsx -e "...getRateLimitProductionGate..."`

Résultat : `mode=memory`, `decision=blocked`.

## Critères non prouvés

- `runtime.rateLimit.mode = redis` ou `upstash` : NON PROUVÉ.
- `runtime.rateLimit.distributed = true` : NON PROUVÉ.
- `runtime.rateLimit.goLiveLarge = allowed` : NON PROUVÉ.
- `checks.redis.ok = true` : NON PROUVÉ.

## Procédure manuelle sûre

À exécuter uniquement avec un token/cookie admin/monitoring non affiché :

```bash
curl -sS \
  -H "Authorization: Bearer ${NEXUS_HEALTH_AUTH}" \
  https://nexusreussite.academy/api/internal/health \
  | jq '{runtime: .runtime.rateLimit, businessConfig: .runtime.businessConfig, checks: {redis: .checks.redis, businessConfig: .checks.businessConfig}}'
```

Ne jamais copier la valeur de `NEXUS_HEALTH_AUTH`.

## Décision

Redis/Upstash runtime NON PROUVÉ.

- BÊTA ÉLARGIE : INTERDITE.
- GO-LIVE LARGE : INTERDIT.

