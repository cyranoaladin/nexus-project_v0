# P0-004 Lot 2B — Admin users / Assistante students-coaches

Date : 2026-05-29

## Verdict

| Groupe | Statut | Tests | Risque résiduel |
|---|---|---|---|
| Admin users | Audité, corrigé partiel | OK | `GET /api/admin/users` reste admin-only; les logs admin users gardent des métadonnées opérationnelles à revoir en P1 logs/PII. |
| Admin users search | Corrigé | OK | Recherche limitée à 10 résultats, champs minimaux, désormais admin-only. |
| Assistante students | Audité | OK | Liste et détail staff-only; pagination existante. |
| Assistante student documents | Corrigé | OK | `localPath` supprimé des réponses; accès disque non réalisé dans cette route metadata. |
| Student activation | Corrigé | OK | Parent owner-scoped conservé via service; URL/token brut retiré de la réponse API. |
| Assistante coaches/manage | Corrigé | OK | Gestion coach autorisée ADMIN/ASSISTANTE; subjects validés par enum. |
| Assignments coach-élève | Corrigé | OK | Doublon actif coach/élève refusé pour tout type d'affectation. |

Lot 2B est corrigé et testé localement. Non déployé en production dans ce cycle.

Go-live large : toujours non autorisé tant que P0-004 global reste ouvert.
Bêta contrôlée : maintenue sous surveillance.

## Inventaire manuel avant correction

| Groupe | Route | Méthodes | Données sensibles | Guard actuel | Ownership/staff attendu | Champs sensibles exposés ? | Verdict |
|---|---|---|---|---|---|---|---|
| Admin users | `app/api/admin/users/route.ts` | GET, POST, PATCH, DELETE | Comptes, rôles, profils | `requireRole(ADMIN)` | Admin-only | Select sans password/token dans réponses | OK — admin-only confirmé |
| Admin users search | `app/api/admin/users/search/route.ts` | GET | PII élèves/parents | ADMIN/ASSISTANTE | Admin-only strict pour éviter énumération | Select minimal | KO — rôle insuffisant |
| Assistante students | `app/api/assistante/students/route.ts` | GET, POST | Données mineurs, parents | ADMIN/ASSISTANTE | Staff-only | Select user sans password/token | OK — staff-only confirmé |
| Assistante student detail | `app/api/assistante/students/[studentId]/route.ts` | GET | Dossier élève, crédits, abonnements | ADMIN/ASSISTANTE | Staff-only + `Student.id` existant | Select user sans password/token | OK — staff-only confirmé |
| Assistante student documents | `app/api/assistante/students/[studentId]/documents/route.ts` | GET, POST | Documents élève, chemins locaux | ADMIN/ASSISTANTE | Staff-only avant document lookup | `localPath` retourné avant patch | KO — champs sensibles exposés |
| Student activation | `app/api/assistante/activate-student/route.ts` | POST | Activation compte, token brut | ADMIN/ASSISTANTE/PARENT | Staff ou parent owner-scoped via service | `activationUrl` retournée | KO — token brut exposé |
| Assistante coaches | `app/api/assistante/coaches/route.ts` | GET | Profils coachs, affectations | ADMIN/ASSISTANTE | Staff-only | Select user sans password/token | OK — staff-only confirmé |
| Coach management | `app/api/assistante/coaches/manage/route.ts` | GET, POST | Création coach, password initial | ADMIN/ASSISTANTE | Staff-only + payload validé | GET utilisait `user: true` mais réponse formattée | KO — validation subject insuffisante |
| Coach management detail | `app/api/assistante/coaches/manage/[id]/route.ts` | PUT, DELETE | Profil coach, password reset, suppression | ASSISTANTE seule | ADMIN/ASSISTANTE | Réponse minimale | KO — rôle insuffisant + subject libre |
| Assignments | `app/api/assistante/assignments/route.ts` | GET, POST | Affectations coach-élève | ADMIN/ASSISTANTE | Staff-only + coach/student existants | Pas de secrets | KO — doublon actif partiellement bloqué |
| Assignment detail | `app/api/assistante/assignments/[id]/route.ts` | GET, PATCH | Affectation ciblée | ADMIN/ASSISTANTE | Staff-only + assignment existante | Pas de secrets | OK — staff-only confirmé |

## Routes auditées

| Route | Méthode | Avant | Après | Test | Statut |
|---|---|---|---|---|---|
| `app/api/admin/users/route.ts` | GET/POST/PATCH/DELETE | Admin-only déjà présent | Confirmé, réponses sans password/token | `__tests__/api/admin-users.test.ts` | OK |
| `app/api/admin/users/search/route.ts` | GET | ADMIN/ASSISTANTE | ADMIN-only, query trim, 10 résultats | `__tests__/api/admin.users.search.route.test.ts` | Corrigé |
| `app/api/assistante/students/route.ts` | GET/POST | Staff-only | Confirmé | `__tests__/api/assistante-assignments.test.ts` | OK |
| `app/api/assistante/students/[studentId]/route.ts` | GET | Staff-only + 404 si absent | Confirmé | Lecture manuelle, inventaire | OK |
| `app/api/assistante/students/[studentId]/documents/route.ts` | GET/POST | Staff-only mais retourne `localPath` | `localPath` retiré via select + sanitization défensive | `__tests__/api/documents-access.test.ts` | Corrigé |
| `app/api/assistante/activate-student/route.ts` | POST | Retourne `activationUrl` tokenisée | Réponse sans URL/token brut | `__tests__/api/assistant.activate-student.route.test.ts` | Corrigé |
| `app/api/assistante/coaches/route.ts` | GET | Staff-only | Confirmé | `__tests__/api/assistante-assignments.test.ts` | OK |
| `app/api/assistante/coaches/manage/route.ts` | GET/POST | GET fetch `user: true`; POST subject libre | Select user minimal; schema Zod + enum Subject | `__tests__/api/assistant.coaches.route.test.ts` | Corrigé |
| `app/api/assistante/coaches/manage/[id]/route.ts` | PUT/DELETE | ASSISTANTE seule; subject libre | ADMIN/ASSISTANTE; enum Subject; Zod non loggué | `__tests__/api/assistant.coaches.id.route.test.ts` | Corrigé |
| `app/api/assistante/assignments/route.ts` | GET/POST | Doublon actif refusé seulement pour PRIMARY | Tout doublon actif coach/élève refusé | `__tests__/api/assistante-assignments.test.ts` | Corrigé |
| `app/api/assistante/assignments/[id]/route.ts` | GET/PATCH | Staff-only + 404 | Confirmé | `__tests__/api/assistante-assignments.test.ts` | OK |

## Corrections réalisées

### Admin users search

- `app/api/admin/users/search/route.ts` passe de `ADMIN/ASSISTANTE` à `ADMIN` uniquement.
- La recherche conserve un seuil minimal de 2 caractères et une limite de 10 résultats.
- Les champs retournés restent minimaux : `id`, `firstName`, `lastName`, `email`, `role`.

### Documents assistante

- `app/api/assistante/students/[studentId]/documents/route.ts` utilise un `select` explicite sans `localPath`.
- Une sanitization défensive retire `localPath` même si un mock ou futur changement Prisma le réintroduit.
- Le document créé par POST est aussi retourné sans `localPath`.

### Activation élèves

- `app/api/assistante/activate-student/route.ts` ne retourne plus `activationUrl`.
- Le service conserve la logique d'ownership parent existante; parent reste accepté seulement si le service valide le lien parent/enfant.
- Les doubles activations restent traitées par le service, avec erreur contrôlée selon résultat.

### Coach management

- `app/api/assistante/coaches/manage/route.ts` valide la création par Zod.
- `subjects` doit appartenir à l'enum `Subject`.
- GET ne fait plus `include user: true`; il sélectionne uniquement les champs nécessaires.
- `app/api/assistante/coaches/manage/[id]/route.ts` accepte `ADMIN` et `ASSISTANTE`.
- PUT valide aussi `subjects` par enum et ne loggue plus le détail Zod du payload invalide.

### Assignments coach-élève

- `app/api/assistante/assignments/route.ts` refuse tout doublon actif coach/élève, pas seulement `PRIMARY`.
- Les validations existantes coach/student présents, subject enum, assignment inexistant 404 et staff-only sont conservées.

## Champs sensibles

- `password` : jamais retourné par les routes auditées.
- `activationToken` : jamais retourné; `activationUrl` supprimée de la réponse activation.
- Reset tokens : non retournés par les routes auditées.
- Hash/secrets : non retournés.
- `localPath` document : supprimé des réponses assistante documents.

## Activation élèves

- Acteurs autorisés : ADMIN, ASSISTANTE, et PARENT uniquement via contrôle parent/enfant dans `initiateStudentActivation`.
- Réponse API : succès, nom élève, message; pas d'URL/token brut.
- Logs : aucun token brut ajouté.
- Idempotence/déjà activé : gérée par `initiateStudentActivation`; la route relaie une erreur contrôlée.

## Assignments coach-élève

- Staff-only : ADMIN/ASSISTANTE.
- Coach : vérifié via `coachProfile.findUnique`.
- Élèves : vérifiés via `student.findMany` et comparaison des IDs attendus.
- Subjects : enum `Subject`.
- Doublons actifs : refusés pour tout type d'affectation avec `409 Conflict`.
- Assignment `[id]` inexistant : `404`.

## Tests exécutés

```bash
npm test -- --runInBand \
  __tests__/api/admin-users.test.ts \
  __tests__/api/admin.users.search.route.test.ts \
  __tests__/api/assistant.activate-student.route.test.ts \
  __tests__/api/assistant.coaches.route.test.ts \
  __tests__/api/assistant.coaches.id.route.test.ts \
  __tests__/api/documents-access.test.ts \
  __tests__/api/assistante-assignments.test.ts
```

Résultat : 7 suites, 93 tests passés.

```bash
npm run typecheck
```

Résultat : OK.

```bash
npm run test:unit -- --runInBand
```

Résultat : 443 suites, 5894 tests passés.

```bash
npm run build
```

Résultat : OK.

Intégration :

```bash
(timeout 2 bash -c '</dev/tcp/127.0.0.1/5435' && echo 'db_test_5435:open') || echo 'db_test_5435:closed'
```

Résultat : `db_test_5435:closed`; `npm run test:integration -- --runInBand` non lancé car la DB test est indisponible.

Les warnings Jest de mocks dupliqués sous `.next/standalone` sont un bruit connu lié à l'artefact local. Certains tests simulent volontairement des erreurs DB et produisent des logs attendus.

## Inventaire après patch

Commande :

```bash
node scripts/security/audit-api-guards.mjs
```

Résultat : `docs/security/API_GUARD_INVENTORY.md` régénéré, 164 routes scannées.

## Risques résiduels

- Consolidation de nommage `assistant`/`assistante` à planifier en P1.
- Logs admin users à revoir en P1 logs/PII, notamment métadonnées de recherche et erreurs de validation.
- Pagination/limites avancées sur certaines listes staff à durcir en P1.
- Audit P0-004 global encore ouvert : NPC, messages/conversations, assessments submit/test.
- DB test d'intégration `127.0.0.1:5435` à rendre disponible.

## Prochain lot recommandé

Lot 2C :

1. NPC submissions.
2. NPC reports.
3. NPC documents/files.
4. Jobs IA exposés, si routes API actives.

Puis :
- Lot 2D : messages/conversations.
- Lot 2E : assessments submit/test.

## Déploiement

Non déployé en production dans ce cycle.

Déploiement recommandé après validation :

1. Préflight prod Git/PM2/health.
2. Backup applicatif minimal.
3. `git pull --ff-only origin main`.
4. `npm run typecheck`.
5. Tests ciblés Lot 2B.
6. `npm run build`.
7. `pm2 startOrReload ecosystem.config.js --env production --update-env`.
8. Smoke : public, `/api/health`, routes admin/assistante sans auth, routes staff avec non-auth refusé, chemins sensibles.
