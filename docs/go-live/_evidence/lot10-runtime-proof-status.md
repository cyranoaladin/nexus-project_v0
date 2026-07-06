# Lot 10 — Runtime proof status

| Variable / autorisation | Résultat | Décision |
|---|---|---|
| `NEXUS_HEALTH_AUTH` | `ABSENT` | Redis/Upstash non prouvé |
| `NEXUS_ALLOW_RATE_LIMIT_PROD_PROBE` | `NOT_ALLOWED` | 429 runtime non exécuté |
| `DATABASE_URL` | `ABSENT` | ContactLead DB dry-run non prouvé |
| `NEXUS_ALLOW_CONTACT_LEAD_DRY_RUN_DB` | `NOT_ALLOWED` | Dry-run DB non exécuté |

Aucune valeur secrète n'a été lue ni écrite.
