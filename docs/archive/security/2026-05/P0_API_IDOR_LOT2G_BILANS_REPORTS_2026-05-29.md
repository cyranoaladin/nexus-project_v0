# P0-004 Lot 2G — Bilans/reports visibility

## Résumé

- Objectif : réduire les risques IDOR et les fuites de données pédagogiques sensibles sur les PDF bilans parent et les rapports coach.
- Routes auditées :
  - `app/api/parent/bilans/[id]/pdf/route.ts`
  - `app/api/coach/sessions/[sessionId]/report/route.ts`
  - `app/api/coach/eaf-stage-printemps/students/[studentId]/report/route.ts`
  - `app/api/coach/maths-premiere-stage-printemps/students/[studentId]/report/route.ts`
- Routes modifiées :
  - `app/api/parent/bilans/[id]/pdf/route.ts`
  - `app/api/coach/sessions/[sessionId]/report/route.ts`
  - `app/api/coach/eaf-stage-printemps/students/[studentId]/report/route.ts`
  - `app/api/coach/maths-premiere-stage-printemps/students/[studentId]/report/route.ts`
- Routes non modifiées :
  - `app/api/stages/[stageSlug]/bilans/route.ts` : déjà renforcée en Lot 2F, régression relancée.
  - `app/api/coach/students/[studentId]/generated-reports/**` : déjà renforcée en Lot 2C, régression relancée.
  - `app/api/bilans/**` génériques : déjà traitées au Lot 1, régressions relancées.
- Risques traités :
  - erreur PDF parent trop bavarde;
  - projection trop large des rapports de session coach;
  - exposition inutile de l'email élève dans les rapports coach spécialisés.

## Justification du lot

| Route | Avant | Risque | Décision |
|---|---|---|---|
| `app/api/parent/bilans/[id]/pdf/route.ts` | Auth parent et ownership présents, mais erreur PDF retournait `details: error.message` et logguait l'exception complète. | Fuite de chemin local, détail moteur PDF ou message interne lors d'une erreur de génération. | Corriger la gestion d'erreur et ajouter une preuve de non-fuite. |
| `app/api/coach/sessions/[sessionId]/report/route.ts` | Ownership session vérifié, mais le GET retournait l'objet Prisma `report` avec relations `student`, `coach`, `session`. | Fuite PII et notes internes si les relations sont incluses dans la requête. | Sanitizer de réponse pour retirer les relations imbriquées. |
| `app/api/coach/eaf-stage-printemps/students/[studentId]/report/route.ts` | Guard coach et scope existants, mais la projection élève incluait `email`. | PII inutile dans une réponse coach de bilan pédagogique. | Retirer `email` du `select` et de la réponse. |
| `app/api/coach/maths-premiere-stage-printemps/students/[studentId]/report/route.ts` | Guard coach et scope existants, mais la projection élève incluait `email`. | PII inutile dans une réponse coach de bilan pédagogique. | Retirer `email` du `select` et de la réponse. |

## Corrections

- PDF parent :
  - conservation des contrôles existants `auth`, rôle parent, ownership enfant et `isPublished`;
  - suppression du champ `details` dans la réponse 500;
  - log réduit au nom de l'erreur.
- Rapport session coach :
  - ajout d'une projection de sortie qui retire `student`, `coach` et `session` du rapport retourné;
  - logs d'erreur GET/POST réduits au nom de l'erreur.
- Rapports stage coach EAF et Maths première :
  - retrait de `email` dans le `select` Prisma;
  - retrait de `student.email` dans la réponse JSON.

## Tests

- Tests ciblés Lot 2G : 4 suites, 57 tests OK.
  - `__tests__/api/parent.bilans.pdf.access.test.ts`
  - `__tests__/api/coach.sessions.report.route.test.ts`
  - `__tests__/api/coach.eaf-stage-printemps.report.test.ts`
  - `__tests__/api/coach.maths-premiere-stage-printemps.report.test.ts`
- Régressions bilans/reports : 4 suites, 31 tests OK.
  - `__tests__/api/stages.bilans.idor.test.ts`
  - `__tests__/api/coach.generated-reports.route.test.ts`
  - `__tests__/api/bilans.id.route.test.ts`
  - `__tests__/api/bilans.idor.test.ts`
- `node scripts/security/audit-api-guards.mjs` : inventaire régénéré, 164 routes.
- `npm run typecheck` : OK.
- `npm run build` : OK.
- `npm run test:unit -- --runInBand` : 449 suites, 5940 tests OK.
- `test:integration` : non lancé, DB test `127.0.0.1:5435` fermée.

## Risques résiduels

- `app/api/admin/stages/[stageId]/**` reste à traiter dans Lot 2F-bis — Admin stages.
- Centralisation des projections bilans/reports à planifier en P1 si le périmètre continue à s'élargir.
- Revue complémentaire des exports PDF hors périmètre Lot 2G à planifier si l'inventaire résiduel montre encore des routes dynamiques sans preuve.

## Déploiement

- Statut : non déployé production.
- Déploiement à planifier séparément après push et CI verte.
