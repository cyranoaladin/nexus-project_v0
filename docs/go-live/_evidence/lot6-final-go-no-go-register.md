# Lot 6 — Final go/no-go register

| Domaine | Statut | Preuve | Décision |
| --- | --- | --- | --- |
| Redis/Upstash | NON PROUVÉ | `NEXUS_HEALTH_AUTH_ABSENT`; healthcheck sans auth `401` | `BETA_ELARGIE_BLOCKED`, `GO_LIVE_LARGE_BLOCKED` |
| 429 runtime | NON PROUVÉ | `AUTH_ABSENT`, `RL_PROBE_NOT_ALLOWED`; test local unitaire seulement | `BETA_ELARGIE_BLOCKED`, `GO_LIVE_LARGE_BLOCKED` |
| ContactLead dry-run DB | NON PROUVÉ | `DATABASE_URL_ABSENT`, `CONTACT_LEAD_DRY_RUN_NOT_ALLOWED`; fixture OK seulement | `GO_LIVE_LARGE_BLOCKED` |
| ClicToPay | DISABLED | Contrat Lot 5 : init/webhook désactivés, carte non disponible | Paiement manuel uniquement |
| BusinessConfig | OK local / NON PROUVÉ runtime | Tests locaux et build OK ; healthcheck authentifié indisponible | Production à vérifier avant élargissement |
| Public E2E | OK local | `24 passed` public + `1 passed` assessment sur port `3012` | Condition bêta contrôlée satisfaite localement |
| P1 register | OK | 6 P1 maintenus dans matrice | Aucun maquillage P1 |
| Worktree RC | OK avec réserve | Audit Lot 6 créé ; rapport racine non suivi à exclure | Revue humaine avant commit |

## Décision finale Lot 6

- `BETA_CONTROLEE_ALLOWED_WITH_RESERVES`
- `BETA_ELARGIE_BLOCKED`
- `GO_LIVE_LARGE_BLOCKED`

## Conditions de levée

1. Fournir `NEXUS_HEALTH_AUTH` sans l'afficher.
2. Exécuter le healthcheck authentifié et obtenir `mode=redis|upstash`, `distributed=true`, `goLiveLarge=allowed`, `checks.redis.ok=true`.
3. Autoriser une fenêtre de test 429 staging/production avec `NEXUS_ALLOW_RATE_LIMIT_PROD_PROBE=true`.
4. Fournir une DB non production et autoriser `NEXUS_ALLOW_CONTACT_LEAD_DRY_RUN_DB=true`.
5. Rejouer les gates finales Node 20 et Playwright critiques.
