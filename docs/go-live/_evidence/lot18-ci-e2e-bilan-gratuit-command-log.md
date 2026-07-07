# Lot 18 — CI E2E bilan gratuit command log

Date locale : 2026-07-07.

## Baseline

| Commande | Resultat |
|---|---|
| `git branch --show-current` | `feat/lot4-accessors-runtime` |
| `git rev-parse --short HEAD` | `8aec67023` |
| `git status --short --untracked-files=all` | deux exclusions connues + reliquat local Lot 16 restaure avant correction |
| `git diff --cached --name-only` | sortie vide |
| `git diff --name-only \| rg '(^\|/)\\.env($\|\\.)' \|\| true` | sortie vide |
| `rg -n "parentId\|studentId\|/api/bilan-gratuit\|Soumission complète" e2e __tests__ app lib scripts` | test obsolète localise dans `e2e/real/pages/04-bilan-gratuit.spec.ts` |
| `rg -n "^\\| P1 \\|" docs/go-live/api-security-matrix.full.md` | 6 P1 visibles |

## GitHub PR #58

| Commande | Resultat |
|---|---|
| `gh pr view 58 --json number,title,state,isDraft,headRefName,headRefOid,baseRefName,url` | PR `#58`, draft, branche `feat/lot4-accessors-runtime`, HEAD `8aec67023` |
| `gh pr checks 58` | `E2E Tests` failed, `CI Success` failed par synthese ; autres checks principaux passent |
| `gh pr view 58 --json statusCheckRollup` | confirme `E2E Tests = FAILURE`, `Security Scan/Lint/TypeScript/Integration/Build/Unit = SUCCESS` |
| helper `gh-fix-ci` `inspect_pr_checks.py --json` | non utilisable localement : ce `gh` ne supporte pas `gh pr checks --json` |

## Analyse source

Fichier CI reel :

- `e2e/real/pages/04-bilan-gratuit.spec.ts`

Le chemin `e2e/04-bilan-gratuit.spec.ts` n'existe pas dans ce repo.

Assertions obsoletes supprimees :

- `expect(body.parentId).toBeTruthy()`
- `expect(body.studentId).toBeTruthy()`

Assertions ajoutees :

- `expect(body.success).toBe(true)`
- `expect(body.message).toBeTruthy()`
- `expect(body).not.toHaveProperty('parentId')`
- `expect(body).not.toHaveProperty('studentId')`
- `expect(body).not.toHaveProperty('token')`
- `expect(body).not.toHaveProperty('assessmentToken')`
- `expect(body).not.toHaveProperty('leadEmailHash')`
- `expect(JSON.stringify(body)).not.toMatch(/parentId|studentId|token|assessmentToken|leadEmailHash/i)`

## Verifications executees

| Commande | Resultat |
|---|---|
| `npm run typecheck` sous Node 20 | PASSED |
| `npm run lint` sous Node 20 | PASSED avec warnings existants sous seuil |
| `npm run test:unit -- --runInBand __tests__/api/bilan-gratuit.product-rgpd.test.ts` sous Node 20 | PASSED, 8 tests |
| `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3012 npx playwright test e2e/pages-public-bilan-assessment-token.spec.ts --project=chromium --reporter=line` sous Node 20 | PASSED, 1 test |
| `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3012 npx playwright test e2e/04-bilan-gratuit.spec.ts --project=chromium --reporter=line` sous Node 20 | FAILED, `No tests found` car ce chemin n'existe pas dans le repo |
| `NEXTAUTH_URL=http://127.0.0.1:3012 REUSE_EXISTING_SERVER=true npx playwright test --config=playwright.ci.config.ts e2e/real/pages/04-bilan-gratuit.spec.ts --project=chromium --reporter=line` sous Node 20 | 6 passed, 1 failed car DB E2E locale absente |

## Echec local non bloquant pour le correctif

Le run local CI-config du fichier `04-bilan-gratuit` atteint la soumission et retourne `HTTP 500` parce que le serveur local ne peut pas joindre `127.0.0.1:5435`.

Preuve serveur :

```txt
Can't reach database server at `127.0.0.1:5435`
```

Decision : ne pas lancer de migration, ne pas creer de DB, ne pas modifier l'API. La correction cible l'assertion obsolete qui faisait echouer GitHub CI avec une DB E2E disponible.
