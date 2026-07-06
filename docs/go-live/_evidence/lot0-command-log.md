# Lot 0 command log

## Date / contexte

- Date locale : 2026-07-02 14:46:53 CET
- Branche : `feat/lot4-accessors-runtime`
- Commit court : `db8545a19`
- Statut initial Git : fichiers non suivis préexistants `docs/audits/audit-nexus-reussite.md`, `rapport_audit_2_07_2026.md`
- Rapport d'audit racine utilisé : `rapport_audit_2_07_2026.md`
- Audit secondaire lu : `docs/audits/audit-nexus-reussite.md`

## Commandes exécutées

| Statut | Objectif | Commande exacte | Résultat résumé |
| --- | --- | --- | --- |
| OK | Confirmer répertoire | `pwd` | `/home/alaeddine/Bureau/nexus-project_v0` |
| OK | Branche courante | `git rev-parse --abbrev-ref HEAD` | `feat/lot4-accessors-runtime` |
| OK | Commit court | `git rev-parse --short HEAD` | `db8545a19` |
| OK | État Git initial | `git status --short` | 2 fichiers non suivis préexistants |
| OK | Version Node | `node -v` | `v22.21.0` |
| OK | Version npm | `npm -v` | `11.6.3` |
| OK | TypeScript | `npm run typecheck` | `tsc --noEmit` OK |
| OK | Lint | `npm run lint` | OK avec warnings ; `next lint` déprécié |
| OK | Tests unitaires | `npm run test:unit -- --runInBand` | 504 suites passées, 1 skipped ; 6345 tests passés, 4 skipped |
| OK | Build production local | `npm run build` | Next build OK, 143 pages générées, assets standalone copiés |
| OK | Inventaire API guards | `node scripts/security/audit-api-guards.mjs` | A écrit `docs/security/API_GUARD_INVENTORY.md` avec 176 routes |
| OK | Site map | `npm run audit:site-map` | 290 routes, 412 edges, 0 link finding, 13 public orphan entries |
| OK | Hardcoded values | `npm run check:no-hardcoded` | 0 hardcoded values outside canonical sources |
| OK | Archives docs | `npm run check:docs-archive` | OK, pas de fichiers audit/report historiques à la racine de `docs/` |
| OK | Bundle public | `npm run check:bundle-weight` | Toutes les routes surveillées dans baseline + 5 kB |
| ÉCHEC | Smoke public Playwright ciblé | `npx playwright test e2e/pages-public-homepage.spec.ts e2e/pages-public-offres.spec.ts e2e/pages-public-bilan-gratuit.spec.ts --project=chromium` | 18 tests passés, 4 échoués |

## Erreurs et limites observées

- `npm run lint` passe mais remonte de nombreux warnings : `any`, variables inutilisées, hooks, props React dans tests.
- `npm run build` passe mais indique que le lint est sauté ; preuve dans `next.config.mjs` avec `eslint.ignoreDuringBuilds`.
- Les tests unitaires passent mais produisent beaucoup de logs console sur chemins d'erreur simulés DB/SMTP/API. Les logs complets ne sont pas recopiés pour éviter bruit et données sensibles.
- Le smoke Playwright public ciblé échoue sur trois attentes de messages validation `/bilan-gratuit` (`Prénom requis`, `Email invalide`) et une attente homepage de nombre de liens WhatsApp (`2` attendus, `3` reçus).
- L'inventaire API est statique : il détecte des indices de guards, pas une preuve d'absence de vulnérabilité.
- La production réelle n'a pas été interrogée dans ce lot.
- Aucun fichier `.env` n'a été lu ou modifié.
- Aucune migration DB, `db:push`, `prisma migrate dev` ou commande destructive n'a été lancée.

## Addendum Lot 0-bis — 2026-07-02 18:33 CET

Contexte : le Lot 0-bis a requalifié l'échec Playwright initial, aligné les validations sur Node 20 et régénéré une matrice API exploitable.

### Baseline environnement Lot 0-bis

- Répertoire : `/home/alaeddine/Bureau/nexus-project_v0`
- Branche : `feat/lot4-accessors-runtime`
- Commit court : `db8545a19`
- Node local par défaut : `v22.21.0`
- npm local par défaut : `11.6.3`
- Runtime CI/Docker : Node 20 (`.github/workflows/ci.yml`, `Dockerfile.prod`)
- Runtime de validation Lot 0-bis : `nvm use 20.20.0`, npm `10.8.2`

### Commandes finales Lot 0-bis

| Statut | Objectif | Commande exacte | Résultat résumé |
| --- | --- | --- | --- |
| OK | TypeScript sous runtime cible | `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run typecheck` | `tsc --noEmit` OK |
| OK | Lint sous runtime cible | `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run lint` | Code 0 ; warnings existants sous `--max-warnings 300` |
| OK | Tests unitaires sous runtime cible | `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run test:unit -- --runInBand` | 504 suites passées, 1 skipped ; 6345 tests passés, 4 skipped |
| OK | Build production sous runtime cible | `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run build` | Next build OK ; 143 pages statiques générées ; assets standalone copiés |
| OK | Régénérer inventaire API guards | `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && node scripts/security/audit-api-guards.mjs` | `docs/security/API_GUARD_INVENTORY.md` écrit avec 176 routes |
| OK | Régénérer matrice API go-live | `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && node scripts/go-live/generate-api-security-matrix.mjs` | 176 routes : 44 P0, 42 P1, 62 P2, 28 OK |
| OK | Site-map | `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run audit:site-map` | 290 routes, 412 edges, 0 link finding, 13 public orphan entries |
| OK | Hardcoded pricing officiel | `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run check:no-hardcoded` | 0 hardcoded values outside canonical sources selon script |
| OK | Placement archives docs | `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run check:docs-archive` | OK, aucun audit/report historique à `docs/` racine |
| OK | Poids bundle | `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run check:bundle-weight` | Toutes les routes surveillées dans baseline + 5 kB |
| OK | Smoke public ciblé | `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npx playwright test e2e/pages-public-homepage.spec.ts e2e/pages-public-offres.spec.ts e2e/pages-public-bilan-gratuit.spec.ts --project=chromium` | 24 passed |

### Réserves Lot 0-bis

- Le smoke Playwright final a loggé un warning Prisma `P2021` : table locale `public.business_configs` absente pendant le refresh passif de configuration. Le smoke public n'échoue pas, mais la baseline DB e2e doit être traitée avant Gate B.
- `npm run audit:site-map` passe mais remonte 13 entrées publiques orphelines à qualifier.
- `npm run check:no-hardcoded` passe, mais le triage manuel confirme des reliquats activables à traiter : HTML historique racine et `components/ui/specialized-packs.tsx`.
- L'inventaire API et la matrice sont statiques : les 44 P0 restent ouverts pour le Lot 1.
- Aucun fichier `.env` n'a été lu ou modifié ; aucune migration destructive n'a été lancée.

## Fichiers modifiés par commandes

- `docs/security/API_GUARD_INVENTORY.md` régénéré par `node scripts/security/audit-api-guards.mjs`.
- `docs/architecture/SITE_MAP.md`, `docs/architecture/SITE_GRAPH.mmd`, `docs/architecture/SSOT_MAP.md` ont été générés par `npm run audit:site-map`; Git ne signale pas de delta suivi au moment de la vérification intermédiaire.

## Fichiers créés Lot 0

- `docs/go-live/00_EXECUTIVE_STATE.md`
- `docs/go-live/01_ACTION_PLAN.md`
- `docs/go-live/02_P0_P1_BACKLOG.md`
- `docs/go-live/03_RELEASE_GATES.md`
- `docs/go-live/04_TEST_MATRIX.md`
- `docs/go-live/05_API_SECURITY_MATRIX.md`
- `docs/go-live/api-security-matrix.full.md`
- `docs/go-live/06_BUSINESS_LOGIC_DECISIONS.md`
- `docs/go-live/07_ENV_INFRA_CHECKLIST.md`
- `docs/go-live/08_MARKETING_CONTENT_CHECKLIST.md`
- `docs/go-live/09_CODEX_NEXT_LOT_PROMPTS.md`
- `docs/go-live/_evidence/lot0-command-log.md`

## Limites de l'audit Lot 0

- Pas de smoke production réel.
- Pas de Playwright exécuté.
- Pas de test de restauration backup.
- Pas de vérification Redis/Upstash runtime.
- Pas de vérification SMTP/Telegram/RAG/ClicToPay avec secrets réels.
- Pas de correction fonctionnelle volontairement, sauf régénération documentaire demandée.
