# Lot 6 — Rate limit 429 runtime proof

## Objectif

Obtenir une preuve 429 réelle sur staging/production via `/api/internal/rate-limit-probe`, sans test bruyant ni destructif.

## Préconditions vérifiées

```bash
if [ -n "${NEXUS_HEALTH_AUTH:-}" ]; then echo "AUTH_PRESENT"; else echo "AUTH_ABSENT"; fi
if [ "${NEXUS_ALLOW_RATE_LIMIT_PROD_PROBE:-}" = "true" ]; then echo "RL_PROBE_ALLOWED"; else echo "RL_PROBE_NOT_ALLOWED"; fi
```

Résultats :

- `AUTH_ABSENT`
- `RL_PROBE_NOT_ALLOWED`

## Test runtime

NON EXÉCUTÉ.

Cause : pas de credential healthcheck et pas d'autorisation explicite `NEXUS_ALLOW_RATE_LIMIT_PROD_PROBE=true`.

Commande autorisée uniquement avec credential et fenêtre confirmée :

```bash
for i in 1 2 3 4 5 6; do
  curl -sS \
    -o "/tmp/nexus-rl-probe-${i}.json" \
    -w "attempt=${i} status=%{http_code}\n" \
    -H "Authorization: Bearer ${NEXUS_HEALTH_AUTH}" \
    https://nexusreussite.academy/api/internal/rate-limit-probe
done
```

## Preuve locale disponible

- Route `app/api/internal/rate-limit-probe/route.ts` protégée par policy admin.
- Test unitaire `__tests__/api/internal.rate-limit-probe.test.ts` couvre `401`, `200` sous limite et `429` après dépassement local.

## Décision

- `RUNTIME_429_PROOF = NOT_EXECUTED`
- Bêta élargie interdite.
- Go-live large interdit.
