# P0-004 — Audit global de clôture Sécurité API / IDOR

## Résumé exécutif
- Date : 2026-05-29
- Inventaire API : 164 routes scannées par `node scripts/security/audit-api-guards.mjs`
- Lots P0 déployés : Lot 1, Lot 2A, Lot 2B, Lot 2C, Lot 2D, Lot 2E, Lot 2F, Lot 2G, Lot 2F-bis
- P0 statiques restants : 42
- Vrais P0 ouverts : 0 identifié dans le périmètre API/IDOR audité
- Faux positifs : 42 P0 statiques classés par heuristique malgré guards manuels, routes publiques volontaires durcies ou couverture par lots/tests
- P1/P2 résiduels : centralisation des projections, anti-abus public renforcé, logs/PII, CAPTCHA/rate limit distribué, gouvernance RGPD, monitoring, CSP/CORS
- Verdict : P0-004 clôturable côté API/IDOR sous réserve de validation humaine. Go-live large non automatiquement autorisé.

## Lots traités
| Lot | Famille | Commit runtime | Déployé | Tests | Statut |
|---|---|---|---|---|---|
| Lot 1 | Documents, factures, assessments/bilans dynamiques, sessions | `1f37eeb0e` | Oui | tests documents/factures/assessments/bilans/sessions | Fermé |
| Lot 2A | Payments / webhooks / subscriptions | `e3c07144b` | Oui | 17 suites ciblées, 98 tests serveur OK | Fermé |
| Lot 2B | Admin users / assistante students-coaches | `8ce959366` | Oui | 7 suites ciblées, 93 tests serveur OK | Fermé |
| Lot 2C | NPC reports/submissions/documents/files | `6d7677ba6` | Oui | 9 suites, 104 tests serveur OK | Fermé |
| Lot 2D | Messages / conversations | `fa4355b61`, `ae31a8a77`, `499d5d3bb` | Oui | tests messages + projections + E2E navbar CI | Fermé |
| Lot 2E | Assessments submit/test/predict | `5f1d25965`, `9e00e27ce` | Oui | 6 suites, 56 tests + CI integration fix | Fermé |
| Lot 2F | Stages reservations public hardening | `6237a6be3` | Oui | 8 suites, 61 tests | Fermé |
| Lot 2G | Bilans/reports visibility | `dd1e519b6` | Oui | 4 suites, 57 tests + 4 suites régression | Fermé |
| Lot 2F-bis | Admin stages | `802acb911` | Oui | 5 suites, 35 tests serveur OK | Fermé |

## Matrice finale des familles
| Famille | P0 statiques | Vrais P0 ouverts | Faux positifs | P1/P2 | Décision |
|---|---:|---:|---:|---:|---|
| Documents / fichiers / uploads / downloads | 5 | 0 | 5 | 3 | Fermé P0; projections/visibilité à centraliser en P1 |
| Factures / payments / webhooks | 5 | 0 | 5 | 3 | Fermé P0; paiement carte réel reste interdit tant que provider complet absent |
| Messages / conversations / ARIA | 0 | 0 | 0 | 4 | Fermé P0 |
| Assessments | 1 | 0 | 1 | 5 | Fermé P0; `submit` public accepté avec rate limit |
| Stages / reservations / admin stages | 11 | 0 | 11 | 8 | Fermé P0 |
| Bilans / reports / generated reports / NPC | 16 | 0 | 16 | 10 | Fermé P0; centralisation projections et anti-abus IA en P1 |
| Admin / assistante / users / students / coaches | 13 | 0 | 13 | 12 | Fermé P0; logs et projections admin à réduire en P1 |

## Détail des P0 statiques restants
| Route | Inventaire | Statut après audit | Preuve | Décision |
|---|---|---|---|---|
| `app/api/admin/invoices/[id]/route.ts` | P0 finance | Fermé | Lot 1 + Lot 2A; tests `admin.invoices.id` | Faux positif guard manuel |
| `app/api/admin/invoices/[id]/send/route.ts` | P0 finance | Fermé | Lot 1 + Lot 2A; tests `admin.invoices.send` | Faux positif guard manuel |
| `app/api/admin/stages/[stageId]/coaches/route.ts` | P0 admin stages | Fermé | Lot 2F-bis; stage/coach relation testée | Faux positif guard manuel |
| `app/api/admin/stages/[stageId]/route.ts` | P0 admin stages | Fermé | Lot 2F-bis; stage existence/mutation testées | Faux positif guard manuel |
| `app/api/admin/stages/[stageId]/sessions/[sessionId]/route.ts` | P0 admin stages | Fermé | Lot 2F-bis; `stageId + sessionId` testé | Faux positif guard manuel |
| `app/api/admin/stages/[stageId]/sessions/route.ts` | P0 admin stages | Fermé | Lot 2F-bis; coach assigné au stage testé | Faux positif guard manuel |
| `app/api/assessments/submit/route.ts` | P0 public pédagogique | Fermé | Lot 2E; Zod, rate limit, `studentId` ignoré | Public volontaire durci |
| `app/api/assistante/assignments/[id]/route.ts` | P0 assistante | Fermé | Lot 2B; ownership/relations assistante testés | Faux positif guard manuel |
| `app/api/assistante/coaches/manage/[id]/route.ts` | P0 assistante | Fermé | Lot 2B; manage coach validé et testé | Faux positif guard manuel |
| `app/api/assistante/students/[studentId]/documents/route.ts` | P0 documents | Fermé | Lot 2B; `localPath` absent, scopes testés | Faux positif guard manuel |
| `app/api/assistante/students/[studentId]/route.ts` | P0 assistante | Fermé | Lot 2B; route student detail scoped | Faux positif guard manuel |
| `app/api/bilan-gratuit/route.ts` | P0 public write | Fermé P0, P1 anti-abus | CSRF, body size, rate limit, Zod; public produit | Public volontaire, renforcer anti-abus en P1 |
| `app/api/coach/eaf-stage-printemps/students/[studentId]/report/regenerate/route.ts` | P0 coach report | Fermé | Route exige coach et `assertCoachCanAccessStudent`; Lot 2G couvre la famille reports | Faux positif guard manuel |
| `app/api/coach/eaf-stage-printemps/students/[studentId]/report/route.ts` | P0 coach report | Fermé | Lot 2G; PII email retirée, tests report | Faux positif guard manuel |
| `app/api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-parent/route.ts` | P0 coach generation | Fermé P0, P1 erreurs IA | Coach assignment requis; bilan chargé par `studentId`; pas d'accès public | Faux positif guard manuel |
| `app/api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-student/route.ts` | P0 coach generation | Fermé P0, P1 erreurs IA | Coach assignment requis; bilan chargé par `studentId`; pas d'accès public | Faux positif guard manuel |
| `app/api/coach/maths-premiere-stage-printemps/students/[studentId]/report/route.ts` | P0 coach report | Fermé | Lot 2G; PII email retirée, tests report | Faux positif guard manuel |
| `app/api/coach/nsi-pratique-2026/students/[studentId]/progress/route.ts` | P0 coach progress | Fermé P0, P1 projection | `requireAnyRole`, `isCoachAssignedToStudent`, no-auth refusé | Faux positif guard manuel |
| `app/api/coach/sessions/[sessionId]/report/route.ts` | P0 coach session report | Fermé | Lot 2G; relation coach/session et projection testées | Faux positif guard manuel |
| `app/api/coach/students/[studentId]/bilan-diagnostic-maths-terminale/route.ts` | P0 coach bilan | Fermé P0, P1 projection | `assertCoachCanAccessStudent` avant lecture/mutation | Faux positif guard manuel |
| `app/api/coach/students/[studentId]/documents/route.ts` | P0 documents coach | Fermé | Lot 1; assignation coach et tests documents | Faux positif guard manuel |
| `app/api/coach/students/[studentId]/eaf-preparation-report/route.ts` | P0 coach report | Fermé P0, P1 projection | `assertCoachCanAccessStudent`, schema strict | Faux positif guard manuel |
| `app/api/coach/students/[studentId]/eaf-preparation-report/validate/route.ts` | P0 coach report | Fermé P0, P1 projection | `assertCoachCanAccessStudent`, completion check | Faux positif guard manuel |
| `app/api/coach/students/[studentId]/generated-reports/[reportId]/download/route.ts` | P0 generated reports | Fermé | Lot 2C; `studentId + reportId`, aucun PDF hors scope | Faux positif guard manuel |
| `app/api/coach/students/[studentId]/generated-reports/[reportId]/generate/route.ts` | P0 static | Non route active | Méthodes inventoriées `-`; pas de handler HTTP actif à exposer | Bruit inventaire |
| `app/api/coach/students/[studentId]/generated-reports/[reportId]/regenerate/route.ts` | P0 generated reports | Fermé | Lot 2C; payloads internes exclus | Faux positif guard manuel |
| `app/api/coach/students/[studentId]/generated-reports/route.ts` | P0 generated reports | Fermé | Lot 2C; projections sans `contextJson`, `llmJson`, `latexSource` | Faux positif guard manuel |
| `app/api/documents/[id]/route.ts` | P0 document | Fermé | Lot 1; lecture fichier après owner/staff | Faux positif guard manuel |
| `app/api/invoices/[id]/pdf/route.ts` | P0 invoice PDF | Fermé | Lot 1 + Lot 2A; token/scope tests | Faux positif guard manuel |
| `app/api/invoices/[id]/receipt/pdf/route.ts` | P0 receipt PDF | Fermé | Lot 1 + Lot 2A; token/scope tests | Faux positif guard manuel |
| `app/api/npc/files/[...path]/route.ts` | P0 file/path | Fermé | Lot 2C; auth avant disque, traversal sans 200 | Faux positif guard manuel |
| `app/api/parent/bilans/[id]/pdf/route.ts` | P0 parent PDF | Fermé | Lot 2G; no-auth 401, erreur générique | Faux positif guard manuel |
| `app/api/payments/clictopay/webhook/route.ts` | P0 webhook | Fermé pour P0 API | Lot 2A; non product-ready `501`, signature invalide testée | Commercial carte interdit hors P0 |
| `app/api/stages/[stageSlug]/bilans/route.ts` | P0 stage bilan | Fermé | Lot 2F; IDOR stage bilan testé | Faux positif guard manuel |
| `app/api/stages/[stageSlug]/inscrire/route.ts` | P0 public write | Fermé | Lot 2F; schema strict, rate limit, réponse minimale | Public volontaire durci |
| `app/api/stages/[stageSlug]/reservations/[reservationId]/confirm/route.ts` | P0 confirm | Fermé | Lot 1 + Lot 2F; `stageSlug + reservationId` | Faux positif guard manuel |
| `app/api/stages/[stageSlug]/reservations/route.ts` | P0 reservations listing | Fermé | Lot 2F; staff-only, projection safe | Faux positif guard manuel |
| `app/api/stages/[stageSlug]/route.ts` | P0 public catalog | Fermé | Lot 2F; catalogue public sans PII/bilans/pdfUrl | Public volontaire |
| `app/api/stages/route.ts` | P0 public catalog | Fermé | Lot 2F; catalogue public sans PII/bilans/pdfUrl | Public volontaire |
| `app/api/stages/submit-diagnostic/route.ts` | P0 public write | Fermé | Lot 2F; `reservationId + email`, rate limit, erreurs génériques | Public volontaire durci |
| `app/api/student/activate/route.ts` | P0 token public | Fermé P0, P1 logs | Token d'activation requis; pas d'IDOR sans token | Public tokenisé volontaire |
| `app/api/student/automatismes/series/[id]/route.ts` | P0 student dynamic | Fermé | ELEVE auth; contenu statique filtré sans réponses | Bruit inventaire |

## Faux positifs principaux
| Route | Pourquoi faux positif | Preuve existante | Amélioration possible de l’inventaire |
|---|---|---|---|
| Routes avec `requireRole`, `requireAnyRole`, `auth()` ou helpers RBAC | Le script voit des paramètres dynamiques mais ne comprend pas toujours le helper métier | Lots 1, 2B, 2C, 2G, 2F-bis | Détecter `assertCoachCanAccessStudent`, `isCoachAssignedToStudent`, `buildInvoiceScopeWhere` |
| Routes publiques volontaires `stages`, `assessments/submit`, `bilan-gratuit` | Absence d'auth volontaire, compensée par validation/rate limit/réponse minimale | Lots 2E/2F et lecture manuelle | Ajouter une annotation `public-intentional` documentée |
| Generated reports / NPC files | Guards manuels et vérification avant disque non inférés | Lot 2C tests fichiers/traversal | Détecter les fonctions de lecture sécurisée et checks `studentId + reportId` |
| Admin stages dynamiques | Staff/admin détecté mais relation stage/session/coach non inférée | Lot 2F-bis tests 5 suites | Détecter checks `stageId`, `sessionId`, `stageCoach` |

## P1/P2 résiduels
| Sujet | Risque | Recommandation | Priorité |
|---|---|---|---|
| Routes publiques d'inscription/bilan gratuit | Spam, création de comptes, abuse distribué | CAPTCHA ou rate limit distribué, monitoring d'anomalies | P1 |
| Paiement carte ClicToPay réel | Provider non complet / signature / idempotence | Garder paiement carte commercial désactivé jusqu'au lot provider | P1 |
| Projections coach/admin | Sur-exposition à un rôle autorisé | Centraliser projections par audience | P1 |
| Logs PII/erreurs IA | Erreurs ou payloads trop détaillés dans certains chemins non P0 | Politique logger + snapshots sans email/téléphone/contenu | P1 |
| Gouvernance RGPD | Conservation/export/suppression données élèves/documents | Procédure DSAR, rétention, audit trail | P1 |
| CSP/CORS/monitoring/runtime minimal | Surface XSS/ops non API-IDOR | Traiter hors P0-004 API | P1 |
| Inventaire statique bruyant | 42 faux P0 après audit | Ajouter annotations ou détection helpers | P2 |

## Décision go-live
- Go-live large : NON autorisé automatiquement par cet audit.
- Bêta contrôlée : maintenue.
- Conditions restantes : validation humaine, validation produit/ops/RGPD/monitoring, décision explicite sur paiement carte et anti-abus public.
- Recommandation : P0-004 clôturable côté API/IDOR sous réserve de validation humaine; bêta élargie possible après validation produit/ops/RGPD/monitoring.

## Prochaines actions
- Valider humainement la clôture P0-004 API/IDOR.
- Ouvrir P1 anti-abus public : CAPTCHA/rate limit distribué pour inscriptions, bilan gratuit, contact et IA coûteuse.
- Ouvrir P1 logs/PII : snapshots et politique de redaction.
- Ouvrir P1 projections : helper centralisé par audience pour documents/bilans/reports/admin.
- Ouvrir P1 paiement carte provider complet avant toute activation commerciale.
