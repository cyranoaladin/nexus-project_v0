# Lot 7 — Registre final decisionnel

| Condition | Statut | Preuve | Decision |
|---|---|---|---|
| P0 | `0` | `docs/go-live/api-security-matrix.full.md` | `OK` |
| P1 | `6` | Matrice : ClicToPay webhook, assessment submit, bilan gratuit, Lamis, stage inscrire, student activate | `BETA_CONTROLEE_ALLOWED_WITH_RESERVES` uniquement |
| Redis/Upstash | `NON PROUVÉ` | `NEXUS_HEALTH_AUTH_ABSENT`, healthcheck public `401` | `BETA_ELARGIE_BLOCKED`, `GO_LIVE_LARGE_BLOCKED` |
| 429 runtime | `NON PROUVÉ` | `RL_PROBE_NOT_ALLOWED` | `BETA_ELARGIE_BLOCKED`, `GO_LIVE_LARGE_BLOCKED` |
| ContactLead dry-run DB | `NON PROUVÉ` | `DATABASE_URL_ABSENT`, dry-run DB non autorise | `GO_LIVE_LARGE_BLOCKED` |
| ClicToPay | `DISABLED` | Docs Lot 5/Lot 6 + routes `501/P1` | Paiement manuel uniquement |
| BusinessConfig | `DÉGRADÉ SI FALLBACK PROD NON OPT-IN` | Gate Lot 4/Lot 5/Lot 6 | Controle runtime requis |
| Security scripts audit | `ACCEPTED` | `lot7-security-scripts-audit.md`, tests scripts verts | Inclure avec tests de regression |
| Worktree RC | `NOT_READY` | `276` entrees git finales, manifest et plan de commit créés | Revue humaine avant commit/PR |
| Gates finales | `OK` | Typecheck, lint, unit, build, audit API, matrice, site-map, checks, Playwright publics verts | RC techniquement testée localement |

## Decision globale

- Bêta controlee : `BETA_CONTROLEE_ALLOWED_WITH_RESERVES`
- Bêta elargie : `BETA_ELARGIE_BLOCKED`
- Go-live large : `GO_LIVE_LARGE_BLOCKED`

Condition de levee minimale pour beta elargie :

1. Healthcheck Redis/Upstash authentifie prouve.
2. Test 429 runtime reel execute sur staging ou fenetre autorisee.
3. Dry-run ContactLead DB non production execute sans PII.
4. Acceptation humaine explicite des 6 P1 publics/paiement.
