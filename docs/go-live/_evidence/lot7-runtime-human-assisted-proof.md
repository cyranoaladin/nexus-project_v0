# Lot 7 — Preuves runtime assistees humainement

## Variables verifiees sans afficher de valeur

| Variable / flag | Resultat | Impact |
|---|---|---|
| `NEXUS_HEALTH_AUTH` | `ABSENT` | Healthcheck authentifie non executable |
| `NEXUS_ALLOW_RATE_LIMIT_PROD_PROBE` | `NOT_ALLOWED` | Test 429 production/staging non autorise |
| `DATABASE_URL` | `ABSENT` | Dry-run DB ContactLead non executable |
| `NEXUS_ALLOW_CONTACT_LEAD_DRY_RUN_DB` | `NOT_ALLOWED` | Dry-run DB ContactLead non autorise |

## Healthcheck public sans authentification

- URL : `https://nexusreussite.academy/api/internal/health`
- Statut observe : `401`
- Interpretation : protection attendue de la route interne ; ne prouve pas Redis/Upstash.

## Redis/Upstash

Statut : `NON PROUVÉ`

Preuve manquante :

- `runtime.rateLimit.mode = redis` ou `upstash`
- `runtime.rateLimit.distributed = true`
- `runtime.rateLimit.goLiveLarge = allowed`
- `checks.redis.ok = true`

Decision : `BETA_ELARGIE_BLOCKED` et `GO_LIVE_LARGE_BLOCKED`.

## 429 runtime

Statut : `NON EXÉCUTÉ`

Cause :

- `NEXUS_HEALTH_AUTH_ABSENT`
- `RL_PROBE_NOT_ALLOWED`

Decision : test 429 reel a executer uniquement avec credential et fenetre autorisee.

## ContactLead dry-run DB

Statut : `NON EXÉCUTÉ`

Cause :

- `DATABASE_URL_ABSENT`
- `CONTACT_LEAD_DRY_RUN_NOT_ALLOWED`

Decision : dry-run DB non production requis avant beta elargie/go-live large.

## Secrets

Aucune valeur de secret, token, cookie, DSN ou `.env` n'a ete lue ou ecrite dans les documents.
