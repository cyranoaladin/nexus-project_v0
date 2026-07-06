# Lot 12 — Command log audit Nexus decision

## Baseline

- Date locale : 2026-07-03 23:38:18 CET
- Branche : `feat/lot4-accessors-runtime`
- Commit court : `db8545a19`
- Node : `v20.20.0`
- npm : `10.8.2`
- Entrées `git status --short --untracked-files=all` : 306
- Fichiers suivis modifiés : 130
- Fichiers non suivis : 176
- Staging Git initial : vide (`git diff --cached --name-only` = 0 fichier)
- Diff `.env` : aucune sortie

## Fichiers lus

- `AGENTS.md`
- `docs/go-live/25_LOT11_HUMAN_COMMIT_RUNBOOK.md`
- `docs/go-live/24_LOT10_HUMAN_COMMIT_DRY_RUN.md`
- `docs/go-live/23_LOT9_RC_MANIFEST_VALIDATION.md`
- `docs/go-live/api-security-matrix.full.md`
- `docs/go-live/05_API_SECURITY_MATRIX.md`
- `docs/go-live/02_P0_P1_BACKLOG.md`
- `docs/go-live/04_TEST_MATRIX.md`
- `docs/go-live/_evidence/lot11-human-commit-runbook.md`
- `docs/go-live/_evidence/lot11-human-commit-runbook-proof.md`
- `docs/go-live/_evidence/lot11-human-review-pending-files.md`
- `docs/go-live/_evidence/lot11-final-human-commit-register.md`
- `docs/go-live/_evidence/lot10-final-human-commit-register.md`
- `docs/go-live/_evidence/lot8-release-candidate-file-manifest-clean.md`
- `docs/go-live/_evidence/lot8-release-candidate-commit-plan-clean.md`
- `__tests__/scripts/release-candidate-human-commit-runbook.test.ts`
- `docs/audits/audit-nexus-reussite.md`

## Commandes exécutées

```bash
source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && node -v
source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm -v
git rev-parse --abbrev-ref HEAD
git rev-parse --short HEAD
git status --short --untracked-files=all
git diff --name-only
git diff --stat
git diff --cached --name-only
git diff --name-only | rg '(^|/)\\.env($|\\.)' || true
rg -n "^\\| P1 \\|" docs/go-live/api-security-matrix.full.md
git ls-files --error-unmatch docs/audits/audit-nexus-reussite.md >/dev/null 2>&1 && echo TRACKED_IN_GIT || if test -f docs/audits/audit-nexus-reussite.md; then echo PRESENT_UNTRACKED_IN_WORKTREE; else echo ABSENT; fi
rg -n "173|178|route|P0|P1|P2|OK|sécur|secur|faille|trou|go-live|ready|prêt|pret|ClicToPay|Redis|Upstash|429|ContactLead" docs/audits/audit-nexus-reussite.md
sed -n '1,130p' docs/audits/audit-nexus-reussite.md
sed -n '130,235p' docs/audits/audit-nexus-reussite.md
if [ -n "${NEXUS_HEALTH_AUTH:-}" ]; then echo "NEXUS_HEALTH_AUTH_PRESENT"; else echo "NEXUS_HEALTH_AUTH_ABSENT"; fi
if [ "${NEXUS_ALLOW_RATE_LIMIT_PROD_PROBE:-}" = "true" ]; then echo "RL_PROBE_ALLOWED"; else echo "RL_PROBE_NOT_ALLOWED"; fi
if [ -n "${DATABASE_URL:-}" ]; then echo "DATABASE_URL_PRESENT"; else echo "DATABASE_URL_ABSENT"; fi
if [ "${NEXUS_ALLOW_CONTACT_LEAD_DRY_RUN_DB:-}" = "true" ]; then echo "CONTACT_LEAD_DRY_RUN_ALLOWED"; else echo "CONTACT_LEAD_DRY_RUN_NOT_ALLOWED"; fi
```

## Résultats clés

- `docs/audits/audit-nexus-reussite.md` : `PRESENT_UNTRACKED_IN_WORKTREE`.
- Le fichier est présent dans le working tree comme fichier non suivi. Il n'est pas inclus dans les commits standards et ne doit pas être considéré comme audit courant de la RC.
- Audit nexus : mentionne `173 routes API`.
- Audit nexus : mentionne une sécurité des routes classée "sans trou".
- RC actuelle : `178` routes, `6` P1 ouverts.
- Runtime : `NEXUS_HEALTH_AUTH_ABSENT`, `RL_PROBE_NOT_ALLOWED`, `DATABASE_URL_ABSENT`, `CONTACT_LEAD_DRY_RUN_NOT_ALLOWED`.

## Gates Lot 12

```bash
source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run typecheck
source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run lint
source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run test:unit -- --runInBand __tests__/scripts/release-candidate-human-commit-runbook.test.ts
source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run check:docs-archive
git diff --cached --name-only
git diff --name-only | rg '(^|/)\\.env($|\\.)' || true
rg -n "^\\| P1 \\|" docs/go-live/api-security-matrix.full.md
```

Résultats :

- `typecheck` : OK.
- `lint` : OK avec warnings existants sous seuil `--max-warnings 300`.
- Test runbook : OK, 1 suite passée, 5 tests passés.
- `check:docs-archive` : OK.
- Staging Git final : vide.
- Diff `.env` final : aucune sortie.
- P1 final : 6 routes visibles.
- Entrées `git status --short --untracked-files=all` après création des preuves Lot 12 : 313.

## Correction documentaire — 2026-07-03 23:47:03 CET

Fichiers corrigés :

- `docs/go-live/04_TEST_MATRIX.md`
- `docs/go-live/26_LOT12_AUDIT_NEXUS_DECISION.md`
- `docs/go-live/_evidence/lot12-audit-nexus-human-decision-command-log.md`
- `docs/go-live/_evidence/lot12-audit-nexus-reussite-review.md`
- `docs/go-live/_evidence/lot12-human-review-decision-files.md`

Commandes de correction/vérification :

```bash
git ls-files --error-unmatch docs/audits/audit-nexus-reussite.md >/dev/null 2>&1 && echo TRACKED_IN_GIT || if test -f docs/audits/audit-nexus-reussite.md; then echo PRESENT_UNTRACKED_IN_WORKTREE; else echo ABSENT; fi
rg -n "PRESENT_UNTRACKED_IN_WORKTREE|1 suite passée, 5 tests passés|Ne remplace pas les preuves runtime Redis/Upstash, 429 et ContactLead DB" docs/go-live/04_TEST_MATRIX.md docs/go-live/26_LOT12_AUDIT_NEXUS_DECISION.md docs/go-live/_evidence/lot12-audit-nexus-human-decision-command-log.md docs/go-live/_evidence/lot12-audit-nexus-reussite-review.md docs/go-live/_evidence/lot12-human-review-decision-files.md
```

Résultats :

- `docs/audits/audit-nexus-reussite.md` : `PRESENT_UNTRACKED_IN_WORKTREE`.
- `04_TEST_MATRIX.md` aligné : statut `OK`, résultat `1 suite passée, 5 tests passés`.
- Formulation ambiguë supprimée des documents Lot 12 concernés.
- Staging Git resté vide.
- Audit Nexus maintenu hors commits standards.

## Validation correction — 2026-07-03 23:49:08 CET

Commandes exécutées sous Node 20 :

```bash
source /home/alaeddine/.nvm/nvm.sh
nvm use 20.20.0 >/dev/null

npm run typecheck
npm run lint
npm run test:unit -- --runInBand __tests__/scripts/release-candidate-human-commit-runbook.test.ts
npm run check:docs-archive
git diff --cached --name-only
git diff --name-only | rg '(^|/)\\.env($|\\.)' || true
rg -n "^\\| P1 \\|" docs/go-live/api-security-matrix.full.md
rg -n "EXISTS_IN_REP[O]|existe dans le dépôt comme fichier non suiv[i]|existe comme fichier non suiv[i]|À relancer Lot 1[2]" docs/go-live/04_TEST_MATRIX.md docs/go-live/26_LOT12_AUDIT_NEXUS_DECISION.md docs/go-live/_evidence/lot12-audit-nexus-human-decision-command-log.md docs/go-live/_evidence/lot12-audit-nexus-reussite-review.md docs/go-live/_evidence/lot12-human-review-decision-files.md || true
```

Résultats :

- `typecheck` : OK.
- `lint` : OK avec warnings existants sous seuil `--max-warnings 300`.
- Test runbook : OK, 1 suite passée, 5 tests passés.
- `check:docs-archive` : OK.
- Staging Git : vide.
- Diff `.env` : aucune sortie.
- P1 : 6 visibles.
- Anciennes formulations ambiguës : aucune sortie.
- Aucun `git add` réel, aucun commit, aucune PR.

## Limites

- Aucun secret lu.
- Aucun `.env` modifié.
- Aucun `git add` réel.
- Aucun commit.
- Aucune PR.
- Aucune preuve Redis/Upstash ou 429 runtime exécutée faute de variables/autorisation.
