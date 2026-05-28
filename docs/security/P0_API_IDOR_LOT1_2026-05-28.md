# P0-004 API IDOR Lot 1

Date : 2026-05-28

## Verdict

| Groupe | Statut | Tests | Risque résiduel |
|---|---|---|---|
| Documents | Audité, non modifié | OK | Helper multi-rôle `DocumentVisibilityScope` à centraliser. |
| Factures | Audité, non modifié | OK | Scope parent basé sur `customerEmail`, acceptable court terme. |
| Bilans / assessments | Corrigé | OK | Routes `assessments/submit` et `assessments/test` hors Lot 1. |
| Coach-students | Audité, non modifié | OK | Fallback session legacy à revoir en Lot 2. |
| Sessions | Corrigé | OK | Routes parent/staff additionnelles à continuer en Lot 2. |
| Stages reservations | Corrigé partiellement | OK | Admin stages dynamiques encore à auditer. |

Go-live large : non autorisé tant que le reste de P0-004 n'est pas trié.
Bêta contrôlée : maintenue sous surveillance.

## Tableau de travail avant correction

| Groupe | Route | Méthodes | Risque inventaire | Guard actuel | Ownership actuel | Verdict manuel |
|---|---|---|---|---|---|---|
| Documents | `app/api/documents/[id]/route.ts` | GET | P0 statique | `auth()` manuel | owner `document.userId` ou staff avant `readFile` | OK — ownership confirmé, non modifié |
| Documents | `app/api/student/documents/[id]/download/route.ts` | GET | P2 statique | `requireRole(ELEVE)` | `findFirst({ id, userId })` avant disque | OK — ownership confirmé |
| Documents | `app/api/coach/students/[studentId]/documents/route.ts` | GET, POST | P0 statique | `requireRole(COACH)` | `assertCoachCanAccessStudent` + scopes coach | OK — ownership confirmé |
| Factures | `app/api/admin/invoices/[id]/route.ts` | PATCH | P0 statique | auth + policy staff | staff-only | OK — staff only confirmé |
| Factures | `app/api/admin/invoices/[id]/send/route.ts` | POST | P0 statique | auth + policy staff | staff-only | OK — staff only confirmé |
| Factures | `app/api/invoices/[id]/pdf/route.ts` | GET | P0 statique | token ou auth | `buildInvoiceScopeWhere` | OK — ownership confirmé |
| Factures | `app/api/invoices/[id]/receipt/pdf/route.ts` | GET | P0 statique | token ou auth | `buildInvoiceScopeWhere` | OK — ownership confirmé |
| Assessments | `app/api/assessments/[id]/result/route.ts` | GET | P0 avant patch | aucun | aucun | KO — ownership absent |
| Assessments | `app/api/assessments/[id]/status/route.ts` | GET | P0 avant patch | aucun | aucun, `errorDetails` sélectionné | KO — ownership absent |
| Assessments | `app/api/assessments/[id]/export/route.ts` | GET | P0 avant patch | aucun | aucun | KO — ownership absent |
| Bilans | `app/api/bilans/[id]/route.ts` | GET, PUT, DELETE | P0 manuel | rôle large | GET/PUT sans ownership | KO — ownership absent |
| Bilans | `app/api/bilans/[id]/export/route.ts` | GET, POST | P0 manuel | rôle large | ownership absent; rôle lu depuis `request.user` inexistant | KO — ownership absent |
| Coach-students | `app/api/coach/students/[studentId]/route.ts` | GET | P2 statique | `requireRole(COACH)` | `assertCoachCanAccessStudent` | OK — ownership confirmé |
| Sessions | `app/api/sessions/book/route.ts` | POST | P2 statique | parent/élève + feature | parent ownership OK, élève pouvait choisir autre `studentId` | KO — ownership absent côté élève |
| Sessions | `app/api/sessions/cancel/route.ts` | POST | P1 statique | rôle élève/coach/assistante | participant/staff | OK — ownership confirmé |
| Sessions | `app/api/sessions/video/route.ts` | POST | P1 statique | auth manuel | participant parent/élève/coach | OK — ownership confirmé |
| Stages | `app/api/stages/[stageSlug]/reservations/route.ts` | GET | P0 statique | admin/assistante | staff-only | OK — staff only confirmé |
| Stages | `app/api/stages/[stageSlug]/reservations/[reservationId]/confirm/route.ts` | POST | P0 statique | admin/assistante | staff-only, mais `stageSlug` ignoré | À corriger — cohérence ressource dynamique |

## Corrections réalisées

### Helper ownership

- Fichier : `lib/security/ownership.ts`
- Ajoute des builders de filtres Prisma pour `Assessment` et `Bilan`.
- Règles couvertes :
  - staff `ADMIN` / `ASSISTANTE` : accès global;
  - élève : `student.userId === session.user.id` ou email legacy pour assessments/bilans liés par email;
  - parent : enfant via `student.parent.userId`;
  - coach : bilan produit ou assignation active `CoachStudentAssignment`;
  - bilans élève/parent : uniquement publiés;
  - contenu interne `nexusMarkdown`, `errorDetails`, `sourceData`, `analysisJson` supprimé pour les rôles non internes.

### Assessments

- Routes corrigées :
  - `app/api/assessments/[id]/result/route.ts`
  - `app/api/assessments/[id]/status/route.ts`
  - `app/api/assessments/[id]/export/route.ts`
- Avant : accès par `id` brut sans auth/ownership.
- Après : `auth()` obligatoire, recherche via `buildAssessmentAccessWhere`, `401` si non authentifié, `404` si hors scope.
- Durcissement supplémentaire : `status` ne sélectionne plus `errorDetails`; erreurs 500 ne retournent plus le message interne.

### Bilans

- Routes corrigées :
  - `app/api/bilans/[id]/route.ts`
  - `app/api/bilans/[id]/export/route.ts`
- Avant : rôle large mais pas d'ownership; export lisait un `request.user` inexistant; `audience=nexus` pouvait exposer le rendu interne.
- Après : filtres `buildBilanReadWhere` / `buildBilanWriteWhere`; export Nexus refusé aux rôles non internes; `audience=all` est réduit à l'audience autorisée pour parent/élève.

### Sessions

- Route corrigée :
  - `app/api/sessions/book/route.ts`
- Avant : un `ELEVE` authentifié pouvait transmettre un autre `studentId`.
- Après : un `ELEVE` ne peut réserver que pour `session.user.id`; `PARENT` conserve la vérification enfant existante.

### Stages reservations

- Route corrigée :
  - `app/api/stages/[stageSlug]/reservations/[reservationId]/confirm/route.ts`
- Avant : staff-only, mais la réservation était cherchée par `reservationId` seul.
- Après : la réservation est cherchée par `reservationId` et `stage.slug`.

## Tests exécutés

```bash
npm run typecheck
npm test -- --runInBand \
  __tests__/api/assessments.result.route.test.ts \
  __tests__/api/assessments.status.route.test.ts \
  __tests__/api/assessments.export.route.test.ts \
  __tests__/api/bilans.id.route.test.ts \
  __tests__/api/sessions.book.route.test.ts \
  __tests__/api/stages/confirm.test.ts \
  __tests__/api/documents.id.route.test.ts \
  __tests__/api/admin.invoices.id.route.test.ts \
  __tests__/api/admin.invoices.send.route.test.ts \
  __tests__/api/invoices.pdf.route.test.ts \
  __tests__/api/invoices.receipt.pdf.route.test.ts \
  __tests__/api/coach.sessions.report.route.test.ts
```

Résultats :
- TypeScript : exit 0.
- Tests ciblés : 12 suites, 102 tests passés.

Notes :
- Jest signale des mocks dupliqués dans `.next/standalone`; ce bruit existait à cause de l'artefact de build local et n'est pas lié au patch applicatif.
- Plusieurs tests existants déclenchent volontairement des logs d'erreur sur chemins DB/FS simulés.

## Inventaire

Commande :

```bash
node scripts/security/audit-api-guards.mjs
```

Résultat après patch :
- 164 routes scannées.
- P0 : 43.
- P1 : 40.
- P2 : 59.
- OK : 22.

Interprétation : l'inventaire est statique. Les routes documents/factures gardent parfois un risque P0 statique car leurs guards manuels ne sont pas pleinement reconnus par le script, mais elles ont été vérifiées manuellement et par tests dans ce lot.

## Risques résiduels

- P0-004 reste ouvert hors Lot 1 : routes NPC reports/submissions, payments, subscriptions, admin users, assistante students/coaches, messages.
- `assessments/submit` et `assessments/test` restent P0 dans l'inventaire et doivent être traitées dans le prochain lot ou explicitement reclassées.
- Le helper documents multi-rôle avec `DocumentVisibilityScope` n'est pas encore centralisé.
- Les endpoints factures parent reposent encore sur `customerEmail`; un modèle bénéficiaire explicite serait préférable.
- Aucun changement infra, secret, DB schema ou migration Prisma n'a été réalisé.

## Prochain lot recommandé

P0-004 Lot 2 :

1. `app/api/assessments/submit/route.ts`
2. `app/api/assessments/test/route.ts`
3. Routes NPC `reports/submissions/documents`
4. Routes `payments`, `subscriptions`, `admin/users`
5. Routes `assistante/students`, `assistante/coaches`
6. Routes messages/conversations non ARIA

## Déploiement production

Date : 2026-05-28

### Commit

- Commit précédent production : `5c1f6c031 docs(security): close P0 infrastructure hardening`.
- Commit déployé : `1f37eeb0e fix(security): enforce API ownership checks lot 1`.
- Branche : `main`.

### Backup pré-déploiement

- Chemin : `/root/nexus-backups/p0-004-lot1-deploy-20260528233125`.
- Contenu général : HEAD Git avant déploiement, status Git, état PM2, description PM2, ports écoutés, copies ciblées `ecosystem.config.js`, `package.json`, `package-lock.json`.
- Aucun secret n'a été copié volontairement dans ce backup applicatif.

### Vérifications serveur avant reload

```bash
npm run typecheck
npm test -- --runInBand \
  __tests__/api/assessments.result.route.test.ts \
  __tests__/api/assessments.status.route.test.ts \
  __tests__/api/assessments.export.route.test.ts \
  __tests__/api/bilans.id.route.test.ts \
  __tests__/api/bilans/export.test.ts \
  __tests__/api/sessions.book.route.test.ts \
  __tests__/api/stages/confirm.test.ts
npm run build
```

Résultats :
- Typecheck serveur : OK.
- Tests ciblés serveur : 7 suites, 57 tests passés.
- Build production serveur : OK.

Note : le test d'intégration complet n'a pas été relancé sur production. L'échec connu hors périmètre reste l'indisponibilité de la DB de test locale sur `127.0.0.1:5435`.

### Reload PM2

Commande :

```bash
pm2 startOrReload ecosystem.config.js --env production --update-env
pm2 save
```

Résultats :
- `nexus-prod` : online.
- Port applicatif : `127.0.0.1:3001`.
- Pas de retour à `0.0.0.0:3001`.

### Smoke tests production

| Test | Résultat |
|---|---|
| `/` | 200 |
| `/offres` | 200 |
| `/stages` | 200 |
| `/dashboard/eleve` sans auth | 307 |
| `GET /api/health` local | 200 |
| `POST /api/aria/chat` sans auth | 401 |
| `GET /api/assessments/fake-id/result` sans auth | 401 |
| `GET /api/assessments/fake-id/status` sans auth | 401 |
| `GET /api/assessments/fake-id/export` sans auth | 401 |
| `POST /api/sessions/book` sans auth | 401 |
| `/.env` | 404 |
| `/.git/config` | 404 |
| `/.next/standalone/.env` | 404 |
| `/docker-compose.prod.yml` | 404 |
| `/prisma/schema.prisma` | 404 |

Logs récents filtrés : aucune erreur critique applicative nouvelle détectée dans la sortie filtrée.

### Rollback

Rollback prévu uniquement en cas d'échec critique :

```bash
git reset --hard 5c1f6c031
npm run build
pm2 startOrReload ecosystem.config.js --env production --update-env
pm2 status nexus-prod --no-color
curl -sI https://nexusreussite.academy/ | sed -n "1,12p"
curl -sI http://127.0.0.1:3001/api/health | sed -n "1,12p"
```

Rollback non exécuté : les validations post-déploiement sont passées.

### Statut

P0-004 Lot 1 est corrigé et actif en production. P0-004 global reste ouvert; le go-live large reste non autorisé tant que le Lot 2 n'est pas traité.
