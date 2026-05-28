# P0-004 Lot 2C — NPC reports/submissions/documents

Date : 2026-05-29

## Verdict

| Groupe | Statut | Tests | Risque résiduel |
|---|---|---|---|
| NPC submissions | Corrigé | OK | Les routes restent classées P1/P0 par inventaire statique car plusieurs guards sont manuels. |
| NPC documents metadata | Corrigé | OK | Les champs de chemin sont stockés en DB mais ne sont plus projetés dans les réponses API. |
| NPC uploads | Corrigé | OK | Antivirus et inspection contenu réel restent P1. |
| NPC files/download | Corrigé | OK | Lecture fichier conditionnée à une ressource `CopyPage` exacte et autorisée. |
| Generated reports coach | Corrigé | OK | Route coach-only; parent/élève devront passer par des routes dédiées filtrées si le produit les expose plus tard. |
| AI jobs NPC | Audité surface API | OK | Aucun endpoint jobs NPC public identifié; les jobs restent manipulés indirectement via generate/upload avec guards. |

Go-live large : toujours non autorisé tant que P0-004 global reste ouvert.
Bêta contrôlée : maintenue sous surveillance.

## Inventaire manuel avant correction

| Groupe | Route | Méthodes | Données sensibles | Guard actuel | Ownership attendu | Accès fichier ? | Champs sensibles exposés ? | Verdict |
|---|---|---|---|---|---|---|---|---|
| NPC submissions | `app/api/npc/submissions/route.ts` | GET, POST | Copies élèves, rapport, job IA | Auth + rôles manuels | Coach assigné, élève owner, parent child-owner, staff | Non | GET incluait `report`, `aiJob`, `storedFilePath`, `ocrText` | KO — champs internes exposés |
| NPC documents | `app/api/npc/submissions/[submissionId]/documents/route.ts` | GET, POST | Documents copy pages, chemins, OCR | Auth + `canReadSubmission` / `canManageSubmissionDocuments` | Submission owner/coach/staff | POST écrit fichier après auth | GET/POST retournaient `originalFilePath`, `convertedFilePaths`, `ocrText` | KO — champs internes exposés |
| NPC document detail | `app/api/npc/submissions/[submissionId]/documents/[documentId]/route.ts` | PATCH, DELETE | Document ciblé, chemin disque | Auth + `canManageSubmissionDocuments` | `submissionId + documentId` | DELETE lit le chemin après auth | PATCH retournait document complet | KO — champs internes exposés |
| NPC generate | `app/api/npc/submissions/[submissionId]/generate/route.ts` | POST | Job IA, submission | Auth + `canManageSubmissionDocuments` | Coach assigné/staff | Non | Pas de payload IA retourné | OK — génération limitée coach/staff |
| NPC upload legacy | `app/api/npc/uploads/route.ts` | POST | Upload fichier, submission, chemin | Auth après parsing multipart | Owner student/parent/coach/staff | Écrit fichier | Réponse retournait `filePath`; parsing avant auth | KO — auth tardive + chemin exposé |
| NPC files | `app/api/npc/files/[...path]/route.ts` | GET | Fichier disque | Auth + permission RBAC | Ressource document liée + owner | Oui | Autorisation basée sur préfixe chemin, pas DB | KO — IDOR/path resource possible |
| Generated reports list | `app/api/coach/students/[studentId]/generated-reports/route.ts` | GET, POST | Rapports IA, context, LaTeX | `requireRole(COACH)` + assignment | Coach assigné | Non | `findMany` retournait tout le modèle | KO — champs internes exposés |
| Generated report download | `app/api/coach/students/[studentId]/generated-reports/[reportId]/download/route.ts` | GET | PDF rapport | `requireRole(COACH)` + assignment | Coach assigné + report lié au student | Oui | Lecture après report lookup et student match | OK — fichier lu après autorisation |
| Generated report regenerate | `app/api/coach/students/[studentId]/generated-reports/[reportId]/regenerate/route.ts` | POST | Regeneration IA, rapport complet | `requireRole(COACH)` + assignment | Coach assigné + report lié via job processor | Non direct | Réponse retournait le report complet | KO — champs internes exposés |
| EAF report | `app/api/coach/eaf-stage-printemps/students/[studentId]/report/route.ts` | GET, POST | Bilan coach EAF | `requireRole(COACH)` + assignment | Coach assigné | Non | Route coach-only; données nécessaires au workflow coach | OK — coach assigné confirmé |
| EAF regenerate | `app/api/coach/eaf-stage-printemps/students/[studentId]/report/regenerate/route.ts` | POST | Regeneration parent markdown | `requireRole(COACH)` + assignment | Coach assigné + bilan coach | Non | Ne retourne pas markdown complet | OK — coach assigné confirmé |

## Routes auditées

| Route | Méthode | Avant | Après | Test | Statut |
|---|---|---|---|---|---|
| `app/api/npc/submissions/route.ts` | GET/POST | GET exposait `report`, `aiJob`, `storedFilePath`, `ocrText` | Projection minimale sans chemins/OCR/job/report | Tests ciblés NPC | Corrigé |
| `app/api/npc/submissions/[submissionId]/documents/route.ts` | GET/POST | Retour chemins/OCR | Projection documents sans `originalFilePath`, `convertedFilePaths`, `ocrText` | `__tests__/api/npc.documents.route.test.ts` | Corrigé |
| `app/api/npc/submissions/[submissionId]/documents/[documentId]/route.ts` | PATCH/DELETE | PATCH retournait document complet | PATCH retourne document projeté; DELETE garde auth avant suppression fichier | `__tests__/api/npc.documents.route.test.ts` | Corrigé |
| `app/api/npc/submissions/[submissionId]/generate/route.ts` | POST | Coach/staff déjà enforced | Confirmé; pas de payload IA retourné | `__tests__/api/npc.generate.test.ts` | OK |
| `app/api/npc/uploads/route.ts` | POST | `formData()` avant auth; `filePath` retourné | Auth/RBAC avant parsing multipart; réponse sans chemin | `__tests__/api/npc.uploads.route.test.ts` | Corrigé |
| `app/api/npc/files/[...path]/route.ts` | GET | Autorisation par préfixe de chemin | Lookup exact `CopyPage` puis `canReadSubmission`, lecture disque après autorisation | `__tests__/api/npc.files.route.test.ts` | Corrigé |
| `app/api/coach/students/[studentId]/generated-reports/route.ts` | GET/POST | Reports complets | Projection sans `contextJson`, `llmJson`, `validatedJson`, `latexSource` | `__tests__/api/coach.generated-reports.route.test.ts` | Corrigé |
| `app/api/coach/students/[studentId]/generated-reports/[reportId]/download/route.ts` | GET | Report match déjà avant lecture | Test ajouté pour confirmer aucune lecture si autre student | `__tests__/api/coach.generated-reports.route.test.ts` | OK |
| `app/api/coach/students/[studentId]/generated-reports/[reportId]/regenerate/route.ts` | POST | Report complet retourné | Projection sans payloads IA/LaTeX | `__tests__/api/coach.generated-reports.route.test.ts` | Corrigé |

## Corrections réalisées

### Submissions

- Les listes NPC ne retournent plus `storedFilePath`, `ocrText`, `ocrError`, `report` ni `aiJob`.
- La projection ne conserve que les métadonnées nécessaires au cockpit.
- Les filtres owner existants sont conservés : coach assigné, élève owner, parent child-owner, staff.

### Documents / files

- Les réponses documents ne retournent plus `originalFilePath`, `convertedFilePaths` ni `ocrText`.
- `PATCH` document retourne une projection filtrée.
- `DELETE` garde l'ordre sécurisé : auth, ownership submission, lookup `documentId + submissionId`, puis suppression DB/fichier.

### Path traversal

- `app/api/npc/files/[...path]/route.ts` rejette les chemins vides, absolus, `..`, doubles slashs et backslashs avant accès disque.
- La route exige maintenant une ressource `CopyPage` dont `originalFilePath` ou `convertedFilePaths` correspond exactement au chemin demandé.
- `readSecureFile` durcit le contrôle `startsWith` avec séparateur pour éviter les préfixes de répertoire ambigus.

### Uploads

- `auth()` et le check RBAC de base sont exécutés avant `request.formData()`.
- La réponse legacy upload ne retourne plus `filePath`.
- La validation type/taille/extension existante reste active via `validateUploadedFile`.
- Le fichier est lu avec `new Response(file).arrayBuffer()` pour rester compatible avec l'environnement de test et runtime.

### Reports visibility

- Les generated reports coach ne retournent plus `contextJson`, `llmJson`, `validatedJson` ni `latexSource`.
- La régénération ne retourne plus le rapport complet brut.
- Les routes restent coach-only avec `assertCoachCanAccessStudent`.

### Generated reports

- Download confirmé : `reportId` doit appartenir au `studentId` de l'URL avant lecture PDF.
- Regenerate confirmé : accès coach assigné avant génération; le processor refuse un `reportId` incohérent avec `studentId`.

### AI jobs

- Aucun endpoint jobs NPC public dédié n'a été trouvé dans `app/api`.
- Les créations jobs NPC passent par `generate` ou upload OCR, sous auth/ownership.
- Les réponses ne retournent pas `inputData` ou `outputData`.

## Champs sensibles

- `storedFilePath` : non retourné par submissions/documents.
- `originalFilePath` : non retourné par documents.
- `convertedFilePaths` : non retourné par documents.
- `rawAiOutput` : non exposé par les routes auditées.
- `validatedAiOutput` : non exposé par les routes auditées.
- `diagnostic` : non exposé dans les routes NPC corrigées.
- `ocrText` : non retourné par submissions/documents.
- `coachNotes` : non exposé par les routes auditées.
- `latexSource` : non retourné par generated reports.
- `contextJson` : non retourné par generated reports.
- `llmJson` : non retourné par generated reports.
- `validatedJson` : non retourné par generated reports.

## Tests exécutés

```bash
npm test -- --runInBand \
  __tests__/api/npc.documents.route.test.ts \
  __tests__/api/npc.uploads.route.test.ts \
  __tests__/api/npc.files.route.test.ts \
  __tests__/api/npc.generate.test.ts \
  __tests__/api/coach.generated-reports.route.test.ts \
  __tests__/npc/storage.test.ts \
  __tests__/npc/file-validator.test.ts \
  __tests__/npc/rbac.test.ts \
  __tests__/lib/reports/stage/reportStorage.test.ts
```

Résultat : 9 suites, 104 tests OK.

```bash
npm run typecheck
```

Résultat : OK.

```bash
npm run test:unit -- --runInBand
```

Résultat : 445 suites, 5904 tests OK.

```bash
npm run build
```

Résultat : OK.

```bash
(timeout 2 bash -c '</dev/tcp/127.0.0.1/5435' && echo 'db_test_5435:open') || echo 'db_test_5435:closed'
```

Résultat : `db_test_5435:closed`. `npm run test:integration -- --runInBand` n'a pas été lancé car la DB test locale est indisponible.

Les warnings Jest de mocks dupliqués sous `.next/standalone` restent un bruit connu lié à l'artefact local. Les warnings Chutes indiquent seulement l'absence de clé IA dans l'environnement de test.

## Inventaire après patch

Commande :

```bash
node scripts/security/audit-api-guards.mjs
```

Résultat : `docs/security/API_GUARD_INVENTORY.md` régénéré, 164 routes scannées.

## Risques résiduels

- Antivirus upload et inspection contenu réel à planifier en P1.
- Centralisation plus formelle des projections report/submission à faire en P1 si d'autres audiences NPC sont ajoutées.
- Les routes parent/élève NPC dédiées restent à auditer si elles apparaissent dans Lot 2D/2E ou une future surface.
- DB test d'intégration `127.0.0.1:5435` indisponible.
- P0-004 global reste ouvert : messages/conversations et assessments submit/test.

## Prochain lot recommandé

- Lot 2D : messages/conversations.
- Lot 2E : assessments submit/test.
- P1 : antivirus upload, centralisation report visibility, audit trail IA, consolidation `assistant`/`assistante`.

## Déploiement

Non déployé en production dans ce cycle.

Déploiement recommandé après validation :

1. Préflight prod Git/PM2/health.
2. Backup applicatif minimal.
3. `git pull --ff-only origin main`.
4. `npm run typecheck`.
5. Tests ciblés Lot 2C.
6. `npm run build`.
7. `pm2 startOrReload ecosystem.config.js --env production --update-env`.
8. Smoke : public, `/api/health`, routes NPC sans auth, traversal sur `/api/npc/files`, chemins sensibles, logs.
