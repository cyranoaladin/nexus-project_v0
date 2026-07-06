# Lot 12 — Runtime proof status

## Présence des variables

| Variable / autorisation | Statut |
|---|---|
| `NEXUS_HEALTH_AUTH` | ABSENT |
| `NEXUS_ALLOW_RATE_LIMIT_PROD_PROBE=true` | NOT_ALLOWED |
| `DATABASE_URL` | ABSENT |
| `NEXUS_ALLOW_CONTACT_LEAD_DRY_RUN_DB=true` | NOT_ALLOWED |

## Décision

- Redis/Upstash : NOT_PROVEN.
- 429 runtime : NOT_PROVEN.
- ContactLead DB dry-run : NOT_PROVEN.

## Impact

- `BETA_ELARGIE_BLOCKED`.
- `GO_LIVE_LARGE_BLOCKED`.

## Limite

Aucune preuve runtime n'a été forcée et aucun secret n'a été lu.

