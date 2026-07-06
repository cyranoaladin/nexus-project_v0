# Lot 1-quater — P1 avant / après

## Synthèse

| Priorité | Avant Lot 1-quater | Après Lot 1-quater | Delta |
| --- | ---: | ---: | ---: |
| P0 | 0 | 0 | 0 |
| P1 | 37 | 12 | -25 |
| P2 | 112 | 137 | +25 |
| OK | 27 | 27 | 0 |
| Total | 176 | 176 | 0 |

## P1 fermés par correction de code

| Route | Correction | Tests |
| --- | --- | --- |
| `/api/assistante/credit-requests` | Zod strict décision approve/reject | `assistant.credit-requests.route.test.ts` |
| `/api/assistante/quotes/pdf` | Zod strict devis PDF | `assistante.quotes.pdf.route.test.ts` |
| `/api/assistante/students/credits` | Zod strict query/body, montant borné | `assistant.students.credits.route.test.ts` |
| `/api/assistante/subscription-requests` | Query/body Zod, pagination bornée | `assistant.subscription-requests.route.test.ts` |
| `/api/assistante/subscriptions` | Body Zod strict | `assistant.subscriptions.route.test.ts` |
| `/api/parent/children` | Zod strict + retrait token brut réponse | `parent.children.route.test.ts`, `parent.children.activation.route.test.ts`, no-leak |
| `/api/parent/subscription-requests` | Query/body Zod strict | Tests existants parent subscriptions à couvrir plus largement |
| `/api/parent/subscriptions` | Body Zod strict | Tests existants parent subscriptions à couvrir plus largement |
| `/api/eleve/bilan-diagnostic-maths-terminale` | Body Zod aligné types métier | `eleve.bilan-diagnostic-maths-terminale.security.test.ts` |
| `/api/student/automatismes/attempts` | Body Zod strict | Couverture à renforcer |
| `/api/student/automatismes/check-answer` | Body Zod strict | Couverture à renforcer |
| `/api/student/nexus-index` | Query Zod + rôle explicite | Couverture existante route student nexus-index |
| `/api/student/survival/*` | Params/body Zod strict | Couverture à renforcer |
| `/api/student/trajectory` | Query Zod + rôle explicite | `student.trajectory.route.test.ts` existant |
| `/api/coach/students/[studentId]/notes` | Params/body Zod strict | Tests route notes existants + no-leak indirect |
| `/api/coach/students/[studentId]/survival-mode` | Params/body Zod strict | Tests route survival-mode existants |
| `/api/coach/trajectory` | Body Zod + assignment coach | `coach.trajectory.security.test.ts`, no-leak |
| `/api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-*` | Params Zod strict | Tests régénération hérités |
| `/api/stages/[stageSlug]/reservations/[reservationId]/confirm` | Params Zod strict avant DB | `stages/confirm.test.ts`, no-leak |
| `/api/bilan-gratuit/dismiss` | Payload optionnel strict | Couverture à compléter |
| `/api/programme/maths-1ere-stmg/stage-progress` | Rôle ELEVE explicite + body Zod | Tests programme existants |

## P1 restants

| Route | Raison |
| --- | --- |
| `/api/payments/clictopay/webhook` | Intégration volontairement désactivée, `501`, reste P1 tant que webhook complet non implémenté |
| `/api/assessments/submit` | Route publique sensible ; token/session produit à arbitrer |
| `/api/bilan-gratuit` | Route publique sensible ; crée encore comptes inactifs |
| `/api/lamis/teacher-report` | Route publique/pédagogique sensible, à requalifier produit |
| `/api/stages/[stageSlug]/inscrire` | Route publique sensible malgré Zod/rate limit |
| `/api/student/activate` | Activation publique sensible par token |
| Routes admin P1 restantes | Hors priorité fonctionnelle Lot 1-quater, à fermer Lot 1-quinquies |

## Décision

La baisse P1 est réelle et provient de code/tests. Les P1 restants bloquent bêta élargie et go-live large.
