# Lot 1-quinquies — Fermeture finale P1 API

## Verdict

ACCEPTÉ AVEC RÉSERVES.

## Synthèse

Le Lot 1-quinquies maintient `P0=0` et réduit l'inventaire statique de `P1=12` à `P1=6` sur 176 routes. Les six P1 restants sont des routes publiques sensibles ou un webhook paiement volontairement désactivé : ils ne sont pas masqués en P2/OK.

Le rate limiting distribué reste non prouvé en staging/production. Le code local expose `memory`, `redis`, `upstash`, bloque le go-live large en mode `memory`, et le healthcheck production sans secret répond `401 Unauthorized`; aucun mode Redis/Upstash runtime n'a donc été vérifié.

Toutes les commandes finales Node 20 du lot sont vertes : typecheck, lint, unit tests, build, audit API, génération matrice, site-map, hardcoding, archive docs, bundle-weight et smoke Playwright public ciblé.

## Matrice API avant/après

| Priorité | Avant Lot 1-quinquies | Après Lot 1-quinquies |
| --- | ---: | ---: |
| P0 | 0 | 0 |
| P1 | 12 | 6 |
| P2 | 137 | 143 |
| OK | 27 | 27 |
| Total | 176 | 176 |

## P1 fermés

| Route | Statut après | Preuve |
| --- | --- | --- |
| `/api/admin/config` | P2 | Zod strict PATCH, tests `admin.config.route` |
| `/api/admin/config/rollback` | P2 | Zod strict, tests rollback |
| `/api/admin/directeur/stats` | P2 | `requireRole(UserRole.ADMIN)`, Zod query strict, rate limit, tests |
| `/api/admin/recompute-ssn` | P2 | `requireRole(UserRole.ADMIN)`, Zod body strict, rate limit, tests |
| `/api/admin/subscriptions` | P2 | Query/body stricts, pagination bornée, projections explicites, tests |
| `/api/admin/test-email` | P2 | ADMIN-only, body strict, réponse sans email destinataire, tests |

## P1 restants

| Route | Raison du maintien P1 |
| --- | --- |
| `/api/payments/clictopay/webhook` | Route paiement publique maintenue désactivée ; signature requise mais intégration complète non activée |
| `/api/assessments/submit` | Route publique pédagogique sensible ; Zod/rate limit présents mais décision token/session/auth à arbitrer |
| `/api/bilan-gratuit` | Route durcie en sortie mais crée encore des comptes inactifs ; dette produit/RGPD Lot 3 |
| `/api/lamis/teacher-report` | Route publique pédagogique sensible ; flux public à arbitrer |
| `/api/stages/[stageSlug]/inscrire` | Inscription publique volontaire ; Zod/rate limit présents, réponse doublon sans ID |
| `/api/student/activate` | Activation publique par token ; Zod/rate limit présents, reste sensible par nature |

## Décisions

- Bêta contrôlée : autorisable uniquement avec routes P1 publiques surveillées et ClicToPay absent du parcours public.
- Bêta élargie : interdite tant que les six P1 restants ne sont pas arbitrés/fermés et que Redis/Upstash n'est pas prouvé.
- Go-live large : interdit tant que Redis/Upstash runtime n'est pas prouvé, ClicToPay webhook incomplet, et `/api/bilan-gratuit` crée des comptes sans décision produit/RGPD finale.

## Prochain lot recommandé

Lot 2 produit/RGPD : transformer `/api/bilan-gratuit` en tunnel lead-only ou mode explicite `lead_only/account_activation`, arbitrer les routes publiques pédagogiques, puis Lot paiement pour ClicToPay complet ou suppression durable du parcours carte.
