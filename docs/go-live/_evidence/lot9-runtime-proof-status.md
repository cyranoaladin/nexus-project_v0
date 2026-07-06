# Lot 9 — Statut preuves runtime

## Variables vérifiées sans afficher de valeur

| Variable / flag | Résultat | Commande exécutée |
|---|---|---|
| `NEXUS_HEALTH_AUTH` | `NEXUS_HEALTH_AUTH_ABSENT` | présence uniquement, valeur non affichée |
| `NEXUS_ALLOW_RATE_LIMIT_PROD_PROBE` | `RL_PROBE_NOT_ALLOWED` | comparaison à `true`, valeur non affichée |
| `DATABASE_URL` | `DATABASE_URL_ABSENT` | présence uniquement, valeur non affichée |
| `NEXUS_ALLOW_CONTACT_LEAD_DRY_RUN_DB` | `CONTACT_LEAD_DRY_RUN_NOT_ALLOWED` | comparaison à `true`, valeur non affichée |

## Exécution runtime

- Healthcheck authentifié Redis/Upstash : non exécuté.
- Test `429` staging/production : non exécuté.
- Dry-run DB ContactLead : non exécuté.

Cause : variables/autorisation absentes.

## Décision

Redis/Upstash, le `429` runtime réel et le dry-run DB ContactLead restent non prouvés. Bêta élargie et go-live large restent bloqués.
