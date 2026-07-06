# Lot 6 — Redis/Upstash authenticated proof

## Objectif

Prouver que le runtime réel utilise Redis ou Upstash pour le rate limiting distribué.

## Commande de présence credential

```bash
if [ -n "${NEXUS_HEALTH_AUTH:-}" ]; then echo "NEXUS_HEALTH_AUTH_PRESENT"; else echo "NEXUS_HEALTH_AUTH_ABSENT"; fi
```

Résultat : `NEXUS_HEALTH_AUTH_ABSENT`.

## Healthcheck authentifié

NON EXÉCUTÉ.

Cause : aucun credential `NEXUS_HEALTH_AUTH` disponible dans l'environnement local. La valeur d'un éventuel token ne doit jamais être affichée ni écrite dans un fichier.

Commande attendue quand le credential est disponible :

```bash
curl -sS \
  -H "Authorization: Bearer ${NEXUS_HEALTH_AUTH}" \
  https://nexusreussite.academy/api/internal/health \
  | jq '{
      rateLimit: .runtime.rateLimit,
      businessConfig: .runtime.businessConfig,
      redisCheck: .checks.redis,
      businessConfigCheck: .checks.businessConfig
    }'
```

## Contrôle sans auth

Commande :

```bash
curl -sS -o /tmp/nexus-health-unauth-lot6.json -w "%{http_code}\n" https://nexusreussite.academy/api/internal/health
```

Résultat : `401`.

Interprétation : l'endpoint est protégé, mais cela ne prouve pas Redis/Upstash.

## Critères attendus

```json
{
  "rateLimit": {
    "mode": "redis ou upstash",
    "distributed": true,
    "goLiveLarge": "allowed"
  },
  "redisCheck": {
    "ok": true
  }
}
```

## Décision

- `REDIS_UPSTASH_PROOF = NOT_PROVEN`
- `BETA_ELARGIE = NO`
- `GO_LIVE_LARGE = NO`
