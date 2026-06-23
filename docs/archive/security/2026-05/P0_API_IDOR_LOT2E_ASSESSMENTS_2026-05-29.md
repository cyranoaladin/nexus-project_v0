# P0-004 Lot 2E — Assessments submit/test

## Résumé
- Objectif : fermer les risques résiduels sur les routes `assessments/submit`, `assessments/test` et `assessments/predict`, puis confirmer les protections existantes sur les routes dynamiques `result`, `status` et `export`.
- Routes auditées : `app/api/assessments/**/route.ts`.
- Routes modifiées : `submit`, `test`, `predict`, `result`, `status`, `export`.
- Routes non modifiées fonctionnellement : `result`, `status`, `export` conservent leur ownership Lot 1; seuls les logs d'erreur ont été réduits.
- Risques traités : endpoint test public, soumission publique non bornée côté coût, `assessmentVersion` non validé, fuite d'erreur interne, confusion `Student.id` / `User.id` sur `predict`, logs trop bavards.

## Justification du lot
| Route | Méthode | Public/Auth | Données manipulées | Risque IDOR | Guard actuel avant patch | Ownership actuel avant patch | Test existant | Décision |
|---|---|---|---|---|---|---|---|---|
| `app/api/assessments/submit/route.ts` | POST | Public volontaire | réponses élève, email, nom, score, bilan, génération coûteuse | écriture abusive / rattachement `studentId` client / coût | Zod partiel | aucun ownership car public | oui | Corriger |
| `app/api/assessments/test/route.ts` | GET | Public avant patch | compte assessments, IDs récents, statut | énumération pédagogique | aucun | aucun | oui | Corriger |
| `app/api/assessments/predict/route.ts` | POST | Auth | prédiction SSN, historique élève | parent/coach sur mauvais élève | RBAC manuel | confusion d'identifiants | oui | Corriger |
| `app/api/assessments/[id]/result/route.ts` | GET | Auth | résultat, scoring, analyse | lecture résultat tiers | auth | `buildAssessmentAccessWhere` | oui | Auditer, logs |
| `app/api/assessments/[id]/status/route.ts` | GET | Auth | statut processing / score résumé | lecture statut tiers | auth | `buildAssessmentAccessWhere` | oui | Auditer, logs |
| `app/api/assessments/[id]/export/route.ts` | GET | Auth | PDF bilan | export PDF tiers | auth | `buildAssessmentAccessWhere` | oui | Auditer, logs |

Décision : Lot 2E confirmé. Les documents/factures/bilans critiques avaient été traités au Lot 1 et restent parfois visibles comme P0 par l'inventaire statique quand les guards manuels ne sont pas détectables. Le résiduel explicitement documenté après Lot 2D était `assessments submit/test`.

## Matrice route par route
| Route | Méthode | Avant | Après | Risque | Test |
|---|---|---|---|---|---|
| `app/api/assessments/submit/route.ts` | POST | public, pas de rate limit route, `assessmentVersion` lu hors schéma, email loggué, erreur interne renvoyée | rate limit `expensive`, `assessmentVersion` Zod, `studentId` client ignoré, logs sans email, 500 générique | coût abusif / fuite / payload malveillant | `__tests__/api/assessments-submit.test.ts` |
| `app/api/assessments/test/route.ts` | GET | public, expose count et IDs récents | `ADMIN` uniquement, 401/403 avant Prisma, 500 générique | énumération / endpoint test prod | `__tests__/api/assessments.test.route.test.ts` |
| `app/api/assessments/predict/route.ts` | POST | payload non Zod, parent vérifié via `Student.userId`, coach via session passée | Zod borné, parent via `Student.id`, coach via assignation active `CoachStudentAssignment` | IDOR parent/coach / coût calcul | `__tests__/api/assessments.predict.route.test.ts` |
| `app/api/assessments/[id]/result/route.ts` | GET | ownership présent, log erreur complet | ownership inchangé, log réduit au type d'erreur | fuite logs | `__tests__/api/assessments.result.route.test.ts` |
| `app/api/assessments/[id]/status/route.ts` | GET | ownership présent, log erreur complet | ownership inchangé, log réduit au type d'erreur | fuite logs | `__tests__/api/assessments.status.route.test.ts` |
| `app/api/assessments/[id]/export/route.ts` | GET | ownership présent, log erreur complet | ownership inchangé, log réduit au type d'erreur | fuite logs PDF | `__tests__/api/assessments.export.route.test.ts` |

## Corrections
- `submit` applique `guardRateLimit` avec preset `expensive`.
- `submitAssessmentSchema` borne `assessmentVersion` et empêche les versions suspectes comme traversal.
- `submit` ne lit plus de champs hors schéma pour choisir la version de questionnaire.
- `submit` ignore les champs extra comme `studentId` et ne les persiste pas.
- `submit`, `test`, `predict`, `result`, `status` et `export` réduisent les logs d'erreur au nom de l'erreur.
- `test` est passé en endpoint `ADMIN` only.
- `test` ne renvoie plus de hint Prisma ou message d'exception.
- `predict` valide le payload par Zod et vérifie l'ownership sur `Student.id`.
- `predict` vérifie les coachs via une assignation active.

## Tests
- Tests ciblés Lot 2E : 6 suites, 56 tests OK.
- Scénarios ajoutés : endpoint test non-auth/staff refusé, rate limit submit, `studentId` tiers ignoré, `assessmentVersion` invalide refusé, 500 sans détail interne, bounds `predict`, ownership parent/coach corrigé.
- Routes dynamiques `result/status/export` relancées pour confirmer les protections IDOR existantes.

## Inventaire après patch
- `node scripts/security/audit-api-guards.mjs` exécuté.
- Inventaire régénéré : 164 routes.
- `assessments/test` passe de public critique à guard manuel `ADMIN`.
- `assessments/submit` reste classé P0 par design car public, mais avec validation/rate-limit et sans ownership client.

## Risques résiduels
- `assessments/submit` reste public par décision produit; un vrai durcissement P1 devrait ajouter CAPTCHA ou contrôle anti-abus plus riche.
- Pas de `test:integration` tant que la DB test `127.0.0.1:5435` est fermée.
- Les documents/factures/bilans peuvent rester bruyants dans l'inventaire statique malgré les corrections Lot 1; un passage de consolidation d'inventaire est recommandé.

## Déploiement
- Statut : non déployé production.
- Déploiement à planifier séparément après CI verte.
