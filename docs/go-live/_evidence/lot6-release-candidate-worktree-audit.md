# Lot 6 — Release candidate worktree audit

## Synthèse

- `git status --porcelain --untracked-files=all` : `261` entrées.
- `git diff --name-only` : `130` fichiers suivis modifiés.
- `git ls-files --others --exclude-standard` : `131` fichiers non suivis.
- `git diff --stat` : `130 files changed, 3269 insertions(+), 1258 deletions(-)`.
- Diff `.env` : aucun.
- Artefacts à exclure détectés : `rapport_audit_2_07_2026.md` non suivi.
- Après création des artefacts Lot 6 : `268` entrées `git status --short --untracked-files=all`.

## Classification release candidate

| Fichier / groupe | Type | Inclure release candidate | Raison |
| --- | --- | ---: | --- |
| `app/api/**` modifiés Lots 1-5 | Code API sécurité | Oui | Corrections ownership, projections, rate limit, P1/P2 |
| `app/api/internal/rate-limit-probe/route.ts` | Code runtime | Oui | Sonde 429 protégée nécessaire aux preuves staging |
| `app/api/internal/health/route.ts` | Code runtime | Oui | Expose rateLimit/businessConfig sans secret |
| `lib/rate-limit/index.ts` | Code runtime | Oui | Gate memory vs redis/upstash |
| `lib/config/snapshot.ts` | Code runtime | Oui | BusinessConfig production gate |
| `lib/assessments/public-token.ts` | Code sécurité | Oui | Token assessment signé et binding lead |
| `app/bilan-gratuit/assessment/**` | Front public critique | Oui | Empêche token libre par query params |
| `scripts/maintenance/contact-leads-retention.ts` | Script maintenance | Oui | Purge/anonymisation dry-run ContactLead |
| `scripts/go-live/generate-api-security-matrix.mjs` | Script pilotage | Oui | Génère matrice API exploitable |
| `scripts/security/audit-api-guards.mjs` | Script audit | Oui avec revue | Modifié par lots précédents ; tests classification associés |
| `__tests__/**` ajoutés/modifiés | Tests | Oui | Gates de sécurité, no-leak, runtime, paiement |
| `e2e/pages-public-bilan-assessment-token.spec.ts` | Test Playwright | Oui | Preuve E2E assessment sans token URL/HTML |
| `docs/go-live/**` | Documentation release | Oui | Preuves et décisions go/no-go |
| `docs/go-live/20_LOT6_STAGING_RELEASE_CANDIDATE_GO_NO_GO.md` et `_evidence/lot6-*` | Documentation release Lot 6 | Oui | Preuves runtime absentes, worktree audit, go/no-go final |
| `docs/security/API_GUARD_INVENTORY.md` | Inventaire généré | Oui | Source de vérité statique actuelle |
| `docs/audits/audit-nexus-reussite.md` | Documentation audit | À vérifier | Non demandé dans Lot 6 ; inclure seulement si relié aux preuves précédentes |
| `rapport_audit_2_07_2026.md` | Rapport racine non suivi | Non | Ne doit pas être modifié/inclus sans décision explicite |
| `.env*` | Secrets/env | Non | Jamais inclure |
| `test-results/`, `playwright-report/`, `.next/`, `node_modules/` | Artefacts générés | Non | Jamais inclure |
| `build-output.log` | Artefact build | À vérifier | Inclure seulement si nécessaire au `check:bundle-weight`, sinon exclure |

## Décision

Préparer une release candidate sans commit automatique. La sélection doit être revue humainement avant commit, en excluant explicitement le rapport racine non suivi et tout artefact généré non nécessaire.
