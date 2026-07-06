# Lot 15 — Untracked files regularization command log

## Baseline

- Date locale : 2026-07-06 22:19:40 CET
- Branche : `feat/lot4-accessors-runtime`
- Commit initial : `61d54a8eb`
- Node : `v20.20.0`
- npm : `10.8.2`
- `git diff --name-only` : aucune sortie
- `git diff --cached --name-only` : aucune sortie
- `git diff --name-only | rg '(^|/)\.env($|\.)' || true` : aucune sortie
- Fichiers non suivis au départ : 39

## P1 confirmés

- `/api/payments/clictopay/webhook`
- `/api/assessments/submit`
- `/api/bilan-gratuit`
- `/api/lamis/teacher-report`
- `/api/stages/[stageSlug]/inscrire`
- `/api/student/activate`

## Décision d'inventaire

- `INCLUDE` : 37 fichiers.
- `EXCLUDE` : 2 fichiers.
- `REVIEW` : 0 fichier.

## Commandes Lot 15

| Étape | Commande | Statut | Résultat |
|---|---|---|---|
| Baseline | `git ls-files --others --exclude-standard` | PASSED | 39 fichiers non suivis |
| Tests release | `npm run test:unit -- --runInBand __tests__/scripts/release-candidate-manifest-consistency.test.ts __tests__/scripts/release-candidate-git-add-dry-run-plan.test.ts __tests__/scripts/release-candidate-human-commit-runbook.test.ts` | PASSED | 3 suites passées, 15 tests passés |
| Commit tests | `git commit -m "test(go-live): include release validation tests"` | PASSED | `c774ed34f` |
| Docs archive preuves | `npm run check:docs-archive` | PASSED | OK |
| Runbook preuves | `npm run test:unit -- --runInBand __tests__/scripts/release-candidate-human-commit-runbook.test.ts` | PASSED | 1 suite passée, 5 tests passés |
| Commit preuves | `git commit -m "docs(go-live): include remaining release evidence"` | PASSED | `edcb0faa2` |
| Commit documentation Lot 15 | `git commit -m "docs(go-live): record untracked file regularization"` | PASSED | `a775c4e60` |

## Exclusions vérifiées

Avant chaque commit, la commande suivante a retourné une sortie vide :

```bash
git diff --cached --name-only | rg '(^|/)\.env($|\.)|rapport_audit_2_07_2026.md|docs/audits/audit-nexus-reussite.md|(^|/)\.next/|(^|/)node_modules/|(^|/)test-results/|(^|/)playwright-report/' || true
```

## État avant commit documentaire Lot 15

- Staging Git : vide.
- Fichiers restants non suivis métier/release : uniquement documentation Lot 15 et deux fichiers `EXCLUDE`.

## Gates finales Lot 15

| Commande | Statut | Résultat |
|---|---|---|
| `npm run typecheck` | PASSED | `tsc --noEmit` OK |
| `npm run lint` | PASSED | Next lint OK sous seuil `--max-warnings 300` |
| `npm run test:unit -- --runInBand` | PASSED | 541 suites passées, 1 skipped ; 6531 tests passés, 4 skipped |
| `npm run build` | PASSED | Next build OK, 142 pages statiques générées |
| `node scripts/security/audit-api-guards.mjs` | PASSED | 178 routes |
| `node scripts/go-live/generate-api-security-matrix.mjs` | PASSED | `P0=0`, `P1=6`, `P2=144`, `OK=28` |
| `npm run audit:site-map` | PASSED | 292 routes, 413 edges, 0 link finding |
| `npm run check:no-hardcoded` | PASSED | 0 valeur hardcodée hors sources canoniques |
| `npm run check:docs-archive` | PASSED | OK |
| `npm run check:bundle-weight` | PASSED | Toutes les routes dans baseline + 5 kB |

## Régularisation post-gates

Les gates `audit-api-guards` et `generate-api-security-matrix` ont modifié uniquement les timestamps de :

- `docs/security/API_GUARD_INVENTORY.md`
- `docs/go-live/api-security-matrix.full.md`

Ces changements générés sont intégrés au dernier commit documentaire Lot 15 afin de conserver un worktree propre hors exclusions.
