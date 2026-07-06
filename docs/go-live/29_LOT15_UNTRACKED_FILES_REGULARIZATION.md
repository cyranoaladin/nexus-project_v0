# Lot 15 — Régularisation des fichiers non suivis

## Verdict

ACCEPTÉ AVEC RÉSERVES.

## Synthèse

Date d'exécution : 2026-07-06.

Lot 15 régularise les 39 fichiers non suivis restés après Lot 14.

Décision d'inventaire :

- 37 fichiers `INCLUDE` commités.
- 2 fichiers `EXCLUDE` maintenus hors staging.
- 0 fichier `REVIEW`.

## Fichiers inclus

Les trois tests release manquants ont été commités :

- `__tests__/scripts/release-candidate-manifest-consistency.test.ts`
- `__tests__/scripts/release-candidate-git-add-dry-run-plan.test.ts`
- `__tests__/scripts/release-candidate-human-commit-runbook.test.ts`

Les preuves release Lots 9 à 13 ont été commités :

- `docs/go-live/23_LOT9_RC_MANIFEST_VALIDATION.md`
- `docs/go-live/24_LOT10_HUMAN_COMMIT_DRY_RUN.md`
- `docs/go-live/25_LOT11_HUMAN_COMMIT_RUNBOOK.md`
- `docs/go-live/26_LOT12_AUDIT_NEXUS_DECISION.md`
- `docs/go-live/27_LOT13_FINAL_PRECOMMIT_CHECK.md`
- `docs/go-live/_evidence/lot9-*`
- `docs/go-live/_evidence/lot10-*`
- `docs/go-live/_evidence/lot11-*`
- `docs/go-live/_evidence/lot12-*`
- `docs/go-live/_evidence/lot13-*`

## Fichiers exclus

Les fichiers suivants restent hors RC :

- `docs/audits/audit-nexus-reussite.md`
- `rapport_audit_2_07_2026.md`

## Commits Lot 15

| Message | Hash |
|---|---|
| `test(go-live): include release validation tests` | `c774ed34f` |
| `docs(go-live): include remaining release evidence` | `edcb0faa2` |

## Matrice API

Les 6 P1 restent visibles et non requalifiés :

- `/api/payments/clictopay/webhook`
- `/api/assessments/submit`
- `/api/bilan-gratuit`
- `/api/lamis/teacher-report`
- `/api/stages/[stageSlug]/inscrire`
- `/api/student/activate`

## Décisions

| Domaine | Décision |
|---|---|
| Local commits | LOCAL_COMMITS_COMPLETE |
| Push review | READY_FOR_PUSH_REVIEW |
| Bêta contrôlée | BETA_CONTROLEE_ALLOWED_WITH_RESERVES |
| Bêta élargie | BETA_ELARGIE_BLOCKED |
| Go-live large | GO_LIVE_LARGE_BLOCKED |

## Réserves

- Redis/Upstash staging/production reste `NOT_PROVEN`.
- Le test 429 runtime réel reste `NOT_PROVEN`.
- Le dry-run DB ContactLead hors production reste `NOT_PROVEN`.
- ClicToPay reste désactivé.
- Aucun push, aucune PR, aucun déploiement, aucune migration.
