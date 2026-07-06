# Lot 15 — Preuve de décision sur fichiers non suivis

Date : 2026-07-06.

## Comptage

- Total fichiers non suivis au départ : 39.
- `INCLUDE` : 37.
- `EXCLUDE` : 2.
- `REVIEW` : 0.

## Fichiers INCLUDE

- `__tests__/scripts/release-candidate-git-add-dry-run-plan.test.ts`
- `__tests__/scripts/release-candidate-human-commit-runbook.test.ts`
- `__tests__/scripts/release-candidate-manifest-consistency.test.ts`
- `docs/go-live/23_LOT9_RC_MANIFEST_VALIDATION.md`
- `docs/go-live/24_LOT10_HUMAN_COMMIT_DRY_RUN.md`
- `docs/go-live/25_LOT11_HUMAN_COMMIT_RUNBOOK.md`
- `docs/go-live/26_LOT12_AUDIT_NEXUS_DECISION.md`
- `docs/go-live/27_LOT13_FINAL_PRECOMMIT_CHECK.md`
- `docs/go-live/_evidence/lot10-final-human-commit-register.md`
- `docs/go-live/_evidence/lot10-git-add-dry-run-plan.md`
- `docs/go-live/_evidence/lot10-git-add-dry-run-proof.md`
- `docs/go-live/_evidence/lot10-human-commit-dry-run-command-log.md`
- `docs/go-live/_evidence/lot10-human-review-pending-files.md`
- `docs/go-live/_evidence/lot10-runtime-proof-status.md`
- `docs/go-live/_evidence/lot11-final-human-commit-register.md`
- `docs/go-live/_evidence/lot11-human-commit-runbook-command-log.md`
- `docs/go-live/_evidence/lot11-human-commit-runbook-proof.md`
- `docs/go-live/_evidence/lot11-human-commit-runbook.md`
- `docs/go-live/_evidence/lot11-human-review-pending-files.md`
- `docs/go-live/_evidence/lot11-runtime-proof-status.md`
- `docs/go-live/_evidence/lot12-audit-nexus-human-decision-command-log.md`
- `docs/go-live/_evidence/lot12-audit-nexus-reussite-review.md`
- `docs/go-live/_evidence/lot12-final-audit-decision-register.md`
- `docs/go-live/_evidence/lot12-human-review-decision-files.md`
- `docs/go-live/_evidence/lot12-runbook-lock-proof.md`
- `docs/go-live/_evidence/lot12-runtime-proof-status.md`
- `docs/go-live/_evidence/lot13-audit-nexus-final-status.md`
- `docs/go-live/_evidence/lot13-final-human-execution-register.md`
- `docs/go-live/_evidence/lot13-final-precommit-command-log.md`
- `docs/go-live/_evidence/lot13-human-execution-checklist.md`
- `docs/go-live/_evidence/lot13-runbook-still-valid-proof.md`
- `docs/go-live/_evidence/lot13-runtime-proof-status.md`
- `docs/go-live/_evidence/lot9-final-release-candidate-register.md`
- `docs/go-live/_evidence/lot9-human-review-checklist.md`
- `docs/go-live/_evidence/lot9-rc-manifest-consistency-proof.md`
- `docs/go-live/_evidence/lot9-rc-manifest-validation-command-log.md`
- `docs/go-live/_evidence/lot9-runtime-proof-status.md`

## Fichiers EXCLUDE

- `docs/audits/audit-nexus-reussite.md`
- `rapport_audit_2_07_2026.md`

## Preuve d'exclusion obligatoire

Les fichiers suivants ne doivent pas être inclus dans les commits Lot 15 :

- `.env*`
- `rapport_audit_2_07_2026.md`
- `docs/audits/audit-nexus-reussite.md`
- `.next/**`
- `node_modules/**`
- `test-results/**`
- `playwright-report/**`

La vérification avant chaque commit utilise :

```bash
git diff --cached --name-only | rg '(^|/)\.env($|\.)|rapport_audit_2_07_2026.md|docs/audits/audit-nexus-reussite.md|(^|/)\.next/|(^|/)node_modules/|(^|/)test-results/|(^|/)playwright-report/' || true
```

## Décision finale

`INCLUDE_RELEASE_TESTS_AND_EVIDENCE`.

`EXCLUDE_STALE_AUDIT_AND_HISTORICAL_REPORT`.

`REVIEW_NONE`.
