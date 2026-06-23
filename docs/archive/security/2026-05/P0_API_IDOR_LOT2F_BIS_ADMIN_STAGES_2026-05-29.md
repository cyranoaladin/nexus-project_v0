# P0-004 Lot 2F-bis — Admin stages

## Résumé

- Objectif : durcir les routes dynamiques de gestion admin/staff des stages contre les accès non autorisés, les mismatches `stageId/sessionId`, les assignations coach hors stage et les payloads permissifs.
- Routes auditées :
  - `app/api/admin/stages/[stageId]/route.ts`
  - `app/api/admin/stages/[stageId]/coaches/route.ts`
  - `app/api/admin/stages/[stageId]/sessions/route.ts`
  - `app/api/admin/stages/[stageId]/sessions/[sessionId]/route.ts`
- Routes modifiées :
  - `app/api/admin/stages/[stageId]/route.ts`
  - `app/api/admin/stages/[stageId]/coaches/route.ts`
  - `app/api/admin/stages/[stageId]/sessions/route.ts`
  - `app/api/admin/stages/[stageId]/sessions/[sessionId]/route.ts`
- Risques traités :
  - stage inexistant non vérifié avant listing/mutation;
  - suppression d'association coach silencieuse quand elle appartient à un autre stage;
  - création ou modification de séance avec un coach non assigné au stage;
  - chronologie partielle invalide sur PATCH session;
  - logs d'erreurs trop détaillés.

## Règle métier retenue

- ADMIN only :
  - détail/mutation/suppression logique d'un stage;
  - listing, assignation et retrait des coachs d'un stage.
- ADMIN + ASSISTANTE :
  - listing et création des séances de stage;
  - modification et suppression des séances de stage.
- Justification :
  - les réglages structurants du stage et les affectations coach restent réservés à `ADMIN`;
  - la gestion du planning de séances est opérationnelle et reste ouverte à `ASSISTANTE`, avec cohérence `stageId/sessionId` et coach assigné au stage.

## Justification du lot

| Route | Avant | Risque | Décision |
|---|---|---|---|
| `app/api/admin/stages/[stageId]/route.ts` | ADMIN only et Zod partiel; DELETE ne vérifiait pas explicitement le stage avant update. | 500 sur stage inexistant et logs internes plus bavards. | Ajouter 404 explicite avant suppression logique et réduire les logs. |
| `app/api/admin/stages/[stageId]/coaches/route.ts` | ADMIN only; POST vérifiait stage/coach; DELETE retournait succès même si aucune association supprimée. | Retrait silencieux d'un coach d'un autre stage ou association inexistante. | Vérifier stage en GET/DELETE et retourner 404 si aucune association `stageId + coachId`. |
| `app/api/admin/stages/[stageId]/sessions/route.ts` | ADMIN/ASSISTANTE; stage vérifié en POST; coach existant vérifié. | Listing stage inexistant silencieux; séance possible avec coach non assigné au stage. | Vérifier stage en GET et exiger `StageCoach(stageId, coachId)` si coach fourni. |
| `app/api/admin/stages/[stageId]/sessions/[sessionId]/route.ts` | ADMIN/ASSISTANTE; mismatch `stageId + sessionId` déjà vérifié. | PATCH pouvait assigner un coach non rattaché au stage; `endAt` seul pouvait devenir antérieur au `startAt` existant. | Exiger coach assigné et valider la chronologie finale complète. |

## Corrections

- `DELETE /api/admin/stages/[stageId]` vérifie désormais l'existence du stage avant le comptage des réservations et l'update logique.
- `GET /api/admin/stages/[stageId]/coaches` vérifie l'existence du stage avant de lister.
- `DELETE /api/admin/stages/[stageId]/coaches` vérifie l'existence du stage et refuse si `deleteMany(stageId, coachId)` ne supprime aucune association.
- `GET /api/admin/stages/[stageId]/sessions` vérifie l'existence du stage avant de lister.
- `POST /api/admin/stages/[stageId]/sessions` vérifie que le coach fourni existe et est assigné au stage.
- `PATCH /api/admin/stages/[stageId]/sessions/[sessionId]` vérifie la chronologie finale complète avec les dates existantes et exige que le coach fourni soit assigné au stage.
- Logs d'erreur admin stages réduits à `error.name` ou `unknown`.

## Tests

- Tests ciblés Lot 2F-bis : 4 suites, 22 tests OK.
  - `__tests__/api/admin.stages.id.access.test.ts`
  - `__tests__/api/admin.stages.coaches.access.test.ts`
  - `__tests__/api/admin.stages.sessions.access.test.ts`
  - `__tests__/api/admin.stages.sessions.id.access.test.ts`
- Régression admin stages existante :
  - `__tests__/api/admin.stages.route.test.ts` : 13 tests OK.
- `node scripts/security/audit-api-guards.mjs` : inventaire régénéré, 164 routes.

## Risques résiduels

- Les routes restent staff/admin; un audit global final P0-004 devra confirmer que le bruit P0 statique restant est documenté ou déclassé.
- Les projections admin conservent volontairement des données opérationnelles de stage; une réduction plus stricte peut être planifiée en P1 si le besoin produit le permet.
- Rate limiting des mutations admin non traité dans ce lot, à garder en P1 si nécessaire.

## Déploiement

- Statut : non déployé production.
- Déploiement à planifier séparément après push et CI verte.
