# Lot 12 — Décision audit Nexus

## Verdict

ACCEPTÉ AVEC RÉSERVES.

## Synthèse

Lot 12 arbitre le fichier `docs/audits/audit-nexus-reussite.md` avant exécution humaine du runbook de commits.

Décision : `EXCLUDE_FROM_STANDARD_COMMITS`.

Le fichier est présent dans le working tree comme fichier non suivi. Il n'est pas inclus dans les commits standards et ne doit pas être considéré comme audit courant de la RC. Il contient des éléments business utiles, mais mentionne `173 routes API` et une sécurité des routes "sans trou", alors que la RC actuelle indique `178` routes et `6` P1 ouverts.

## Matrice actuelle

| Priorité | Nombre |
|---|---:|
| P0 | 0 |
| P1 | 6 |
| P2 | 144 |
| OK | 28 |
| Total | 178 |

Les 6 P1 restent visibles :

- `/api/payments/clictopay/webhook`
- `/api/assessments/submit`
- `/api/bilan-gratuit`
- `/api/lamis/teacher-report`
- `/api/stages/[stageSlug]/inscrire`
- `/api/student/activate`

## Décision audit Nexus

`docs/audits/audit-nexus-reussite.md` reste hors commits standards.

Options acceptables après décision humaine explicite :

- l'exclure définitivement de la RC ;
- l'inclure comme audit historique avec en-tête explicite `HISTORICAL / STALE COUNTS` ;
- le réécrire avant inclusion pour aligner `178` routes, `6` P1, Redis/Upstash non prouvé, 429 runtime non exécuté et ClicToPay disabled.

## Verrouillage runbook

Le runbook Lot 11 reste exploitable et ne doit pas être modifié pour inclure cet audit dans les commits standards. La décision humaine séparée est documentée dans :

- `docs/go-live/_evidence/lot12-audit-nexus-reussite-review.md`
- `docs/go-live/_evidence/lot12-human-review-decision-files.md`
- `docs/go-live/_evidence/lot12-runbook-lock-proof.md`

Gate ciblée Lot 12 : `__tests__/scripts/release-candidate-human-commit-runbook.test.ts` passée, 1 suite / 5 tests.

## Décisions

| Domaine | Décision |
|---|---|
| Human execution | READY_FOR_HUMAN_EXECUTION |
| Bêta contrôlée | BETA_CONTROLEE_ALLOWED_WITH_RESERVES |
| Bêta élargie | BETA_ELARGIE_BLOCKED |
| Go-live large | GO_LIVE_LARGE_BLOCKED |

## Réserves

- Redis/Upstash staging/production non prouvé.
- Test 429 runtime réel non exécuté.
- ContactLead dry-run DB non production non exécuté.
- ClicToPay reste disabled.
- Les 6 P1 publics/paiement restent ouverts et visibles.
