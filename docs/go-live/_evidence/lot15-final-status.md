# Lot 15 — Final status

Date : 2026-07-06.

## Statut

| Domaine | Statut | Preuve | Décision |
|---|---|---|---|
| Fichiers non suivis initiaux | 39 | `git ls-files --others --exclude-standard` | Inventoriés |
| INCLUDE | 37 | `docs/go-live/_evidence/lot15-untracked-files-inventory.md` | Commités |
| EXCLUDE | 2 | `docs/go-live/_evidence/lot15-untracked-files-decision-proof.md` | Maintenus hors staging |
| REVIEW | 0 | `docs/go-live/_evidence/lot15-untracked-files-review-leftovers.md` | NONE |
| Tests release | COMMITTED | `c774ed34f` | OK |
| Preuves release | COMMITTED | `edcb0faa2` | OK |
| Documentation Lot 15 | COMMITTED | `a775c4e60` | OK |
| Gates finales | PASSED | typecheck, lint, unit, build, audit API, matrice, site-map, no-hardcoded, docs-archive, bundle-weight | OK |
| P1 | 6 | `docs/go-live/api-security-matrix.full.md` | Non requalifiés |
| Staging Git | EMPTY | `git diff --cached --name-only` | OK |

## Fichiers restants hors staging

- `docs/audits/audit-nexus-reussite.md`
- `rapport_audit_2_07_2026.md`

## Gates finales

- `npm run typecheck` : PASSED.
- `npm run lint` : PASSED avec warnings existants sous seuil.
- `npm run test:unit -- --runInBand` : PASSED, 541 suites passées, 1 skipped ; 6531 tests passés, 4 skipped.
- `npm run build` : PASSED.
- `node scripts/security/audit-api-guards.mjs` : PASSED, 178 routes.
- `node scripts/go-live/generate-api-security-matrix.mjs` : PASSED, `P0=0`, `P1=6`, `P2=144`, `OK=28`.
- `npm run audit:site-map` : PASSED.
- `npm run check:no-hardcoded` : PASSED.
- `npm run check:docs-archive` : PASSED.
- `npm run check:bundle-weight` : PASSED.

## Décisions finales

- `LOCAL_COMMITS_COMPLETE`
- `READY_FOR_PUSH_REVIEW`
- `BETA_CONTROLEE_ALLOWED_WITH_RESERVES`
- `BETA_ELARGIE_BLOCKED`
- `GO_LIVE_LARGE_BLOCKED`

## Réserves maintenues

- Redis/Upstash runtime non prouvé.
- 429 runtime réel non prouvé.
- ContactLead DB dry-run non prouvé.
- ClicToPay disabled.
