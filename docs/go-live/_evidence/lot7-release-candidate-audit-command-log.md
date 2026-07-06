# Lot 7 — Journal commandes release candidate

## Baseline

- Date locale : 2026-07-03 14:33:55 CET
- Branche : `feat/lot4-accessors-runtime`
- Commit court : `db8545a19`
- Node : `v20.20.0`
- npm : `10.8.2`
- Etat Git initial : `269` entrees `git status --short --untracked-files=all`
- Fichiers suivis modifies : `130`
- Fichiers non suivis : `139`
- Diff `.env` : aucun chemin detecte par `git diff --name-only | rg '(^|/)\\.env($|\\.)' || true`

## P1 initiaux

Commande :

```bash
rg -n "^\\| P1 \\|" docs/go-live/api-security-matrix.full.md
```

Resultat :

- `/api/payments/clictopay/webhook`
- `/api/assessments/submit`
- `/api/bilan-gratuit`
- `/api/lamis/teacher-report`
- `/api/stages/[stageSlug]/inscrire`
- `/api/student/activate`

## Presence variables runtime

Commande executee sans afficher de valeur :

```bash
if [ -n "${NEXUS_HEALTH_AUTH:-}" ]; then echo "NEXUS_HEALTH_AUTH_PRESENT"; else echo "NEXUS_HEALTH_AUTH_ABSENT"; fi
if [ "${NEXUS_ALLOW_RATE_LIMIT_PROD_PROBE:-}" = "true" ]; then echo "RL_PROBE_ALLOWED"; else echo "RL_PROBE_NOT_ALLOWED"; fi
if [ -n "${DATABASE_URL:-}" ]; then echo "DATABASE_URL_PRESENT"; else echo "DATABASE_URL_ABSENT"; fi
if [ "${NEXUS_ALLOW_CONTACT_LEAD_DRY_RUN_DB:-}" = "true" ]; then echo "CONTACT_LEAD_DRY_RUN_ALLOWED"; else echo "CONTACT_LEAD_DRY_RUN_NOT_ALLOWED"; fi
```

Resultat :

- `NEXUS_HEALTH_AUTH_ABSENT`
- `RL_PROBE_NOT_ALLOWED`
- `DATABASE_URL_ABSENT`
- `CONTACT_LEAD_DRY_RUN_NOT_ALLOWED`

## Healthcheck public sans auth

Commande :

```bash
curl -sS -o /tmp/nexus-health-lot7.json -w "%{http_code}\\n" https://nexusreussite.academy/api/internal/health
```

Resultat : `401`

Statut : attendu pour une route interne protegee. Ne prouve pas Redis/Upstash.

## Audit scripts

Commandes :

```bash
git diff -- scripts/security/audit-api-guards.mjs
git diff -- scripts/go-live/generate-api-security-matrix.mjs
git diff -- scripts/check-bundle-weight.sh
```

Resultat resume :

- `scripts/security/audit-api-guards.mjs` modifie depuis les lots precedents : detection reexports, rate limit, ownership helpers, routes staff-only, routes publiques fixes, routes `410/501`.
- `scripts/go-live/generate-api-security-matrix.mjs` est non suivi : generateur de matrice depuis `docs/security/API_GUARD_INVENTORY.md`.
- `scripts/check-bundle-weight.sh` modifie : detection des routes statiques ou dynamiques dans le build output.

Test cible execute :

```bash
source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run test:unit -- --runInBand __tests__/scripts/audit-api-guards.classification.test.ts __tests__/scripts/security-audit-scripts-regression.test.ts
```

Resultat : `2` suites passees, `10` tests passes.

## Gates finales

| Commande | Statut | Résultat |
|---|---|---|
| `npm run typecheck` | OK | `tsc --noEmit` sans erreur |
| `npm run lint` | OK | Warnings existants sous `--max-warnings 300` |
| `npm run test:unit -- --runInBand` | OK | `538` suites passées, `1` skipped ; `6510` tests passés, `4` skipped |
| `npm run build` | OK | Build Next `15.5.12`, `142/142` pages statiques générées, assets standalone copiés |
| `node scripts/security/audit-api-guards.mjs` | OK | `178` routes écrites dans `docs/security/API_GUARD_INVENTORY.md` |
| `node scripts/go-live/generate-api-security-matrix.mjs` | OK | `P0=0`, `P1=6`, `P2=144`, `OK=28` |
| `npm run audit:site-map` | OK | `292` routes, `413` edges, `0` link finding, `13` orphan entries |
| `npm run check:no-hardcoded` | OK | `0` hardcoded value hors sources canoniques |
| `npm run check:docs-archive` | OK | Aucun audit historique à la racine `docs/` |
| `npm run check:bundle-weight` | OK | Toutes les routes dans baseline + `5 kB` |
| Playwright public `homepage/offres/bilan-gratuit` | OK | `24 passed` |
| Playwright assessment token | OK | `1 passed` |

## Worktree final apres gates

- Entrées `git status --short --untracked-files=all` : `276`
- Fichiers suivis modifies : `130`
- Fichiers non suivis : `146`
- Diff `.env` : aucun chemin detecte.

## Limites

- Redis/Upstash staging/production : non prouve, faute de `NEXUS_HEALTH_AUTH`.
- Test 429 runtime reel : non execute, faute de credential et de flag `NEXUS_ALLOW_RATE_LIMIT_PROD_PROBE=true`.
- ContactLead dry-run DB : non execute, faute de `DATABASE_URL` et de flag `NEXUS_ALLOW_CONTACT_LEAD_DRY_RUN_DB=true`.
- Aucun secret lu ou affiche.
- Aucun `.env` modifie.
