# Acceptation Lot 0-bis

Date locale : 2026-07-02 18:33 CET  
Branche : `feat/lot4-accessors-runtime`  
Commit court : `db8545a19`

## Verdict

Lot 0-bis ACCEPTÉ AVEC RÉSERVES.

Ce verdict signifie que la baseline Lot 0 est maintenant exploitable pour lancer le Lot 1 sécurité. Il ne signifie pas que Nexus Réussite est go-live large.

## Critères Lot 0-bis

| Critère | Statut | Preuve |
| --- | --- | --- |
| Échecs Playwright publics corrigés ou requalifiés | OK | `docs/go-live/_evidence/playwright-public-smoke-triage.md` |
| Smoke Playwright ciblé vert | OK | 24/24 sous Node 20, relance finale 2026-07-02 18:33 CET |
| Node local vs CI/Docker clarifié | OK | Local par défaut Node 22.21.0 ; CI/Docker Node 20 ; validations rejouées sous `nvm use 20.20.0` |
| Matrice API exploitable | OK | `docs/go-live/api-security-matrix.full.md`, 176 routes, Top 20 Lot 1 |
| Occurrences TND classées | OK | `docs/go-live/_evidence/hardcoded-pricing-triage.md` |
| Pricing vs entitlement prouvé/infirmé | OK | Écart confirmé 0/4/8 vs 4/8/16 |
| GA/consentement clair | OK avec réserve | GA désactivé par défaut ; aucune CMP complète ; activation interdite sans consentement |
| Tunnel bilan gratuit clair | OK avec réserve | UI lead, API création comptes inactifs + activation ; décision produit requise |
| Aucun secret exposé | OK | Aucun `.env` lu ou modifié ; aucune valeur secrète copiée |
| Aucune migration destructive | OK | Aucune commande Prisma destructive lancée |

## Commandes finales Lot 0-bis

| Statut | Commande | Résultat |
| --- | --- | --- |
| OK | `npm run typecheck` sous Node 20.20.0 | `tsc --noEmit` OK |
| OK | `npm run lint` sous Node 20.20.0 | Code 0, warnings existants sous `--max-warnings 300` |
| OK | `npm run test:unit -- --runInBand` sous Node 20.20.0 | 504 suites passées, 1 skipped ; 6345 tests passés, 4 skipped |
| OK | `npm run build` sous Node 20.20.0 | Build Next OK, 143 pages générées, assets standalone copiés |
| OK | `node scripts/security/audit-api-guards.mjs` | `docs/security/API_GUARD_INVENTORY.md` régénéré avec 176 routes |
| OK | `node scripts/go-live/generate-api-security-matrix.mjs` | Matrice 176 routes : 44 P0, 42 P1, 62 P2, 28 OK |
| OK | `npm run audit:site-map` | 290 routes, 412 edges, 0 link finding, 13 public orphan entries |
| OK | `npm run check:no-hardcoded` | 0 hardcoded values outside canonical sources selon script |
| OK | `npm run check:docs-archive` | Aucun audit/report historique à `docs/` racine |
| OK | `npm run check:bundle-weight` | Toutes les routes surveillées dans baseline + 5 kB |
| OK | `npx playwright test e2e/pages-public-homepage.spec.ts e2e/pages-public-offres.spec.ts e2e/pages-public-bilan-gratuit.spec.ts --project=chromium` sous Node 20.20.0 | 24 passed |

## Réserves bloquantes go-live large

- 44 P0 API restent ouverts et seulement triés statiquement.
- Le tunnel `/bilan-gratuit` crée des comptes inactifs alors que la promesse marketing reste un bilan gratuit bas-friction.
- Aucune CMP complète n'est présente ; GA ne doit pas être activé avant consentement.
- ClicToPay reste non activable côté API et est masqué des pages publiques, mais la chaîne paiement/facturation/entitlements reste P0.
- Le delta pricing/entitlement est confirmé.
- Le fichier HTML historique racine et `components/ui/specialized-packs.tsx` restent à neutraliser/migrer avant campagne large.

## Décisions provisoires

- Campagne marketing payante : NON AUTORISÉE tant que le tunnel bilan n'est pas aligné lead-only ou explicitement assumé avec consentement et copy.
- Marketing public organique / pré-campagne : AUTORISABLE AVEC RÉSERVES si GA reste désactivé, ClicToPay reste masqué et les formulaires sont surveillés.
- Bêta contrôlée plateforme : AUTORISABLE AVEC RÉSERVES seulement hors paiement carte, avec comptes sélectionnés et surveillance manuelle.
- Go-live large : NON AUTORISÉ.

## Prochain lot recommandé

Lot 1 — sécurité API, IDOR, ownership, documents/factures/bilans, rate limiting distribué, avec priorité sur le Top 20 de `api-security-matrix.full.md`.
# Mise à jour Lot 1 — 2026-07-02

Lot 0-bis reste accepté avec réserves. Lot 1 a fermé les P0 API statiques (`44 -> 0`) et ajouté des tests IDOR/no-leak/rate-limit ciblés. Les réserves structurantes restent :

- rate limiting distribué non prouvé sur production réelle ;
- 56 P1 API à durcir avant bêta élargie ;
- `/api/bilan-gratuit` encore ambigu côté produit car création de comptes inactifs ;
- ClicToPay toujours non activable sans Lot paiement complet.

Voir `docs/go-live/11_LOT1_SECURITY_CLOSURE.md`.
