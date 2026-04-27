# CHECKLIST QA — Workflow COACH → RESSOURCE → ÉLÈVE (end-to-end)

**Statut** : P1 — à exécuter dès qu'un premier `coach_student_assignments` actif existe en production.
**Créé** : 2026-04-27 (post go-live hardening)
**Lié au runbook** : `docs/deployments/NEXUS_GO_LIVE_HARDENING_2026-04-27.md`

---

## Contexte

Lors du go-live initial, la table `coach_student_assignments` est vide en production.
Le code RBAC (`lib/rbac/coach-student-access.ts::isCoachRattachedToStudent`) fonctionne
mais n'a pas été validé en end-to-end sur un cas réel (coach ↔ élève assigné ↔ ressource).

Cette checklist doit être exécutée dès qu'un premier rattachement coach/élève est créé.

---

## Préconditions

| Élément | Valeur attendue |
|---|---|
| Compte coach de recette | `COACH_EMAIL` présent dans `users` avec `role=COACH` et `CoachProfile` lié |
| Compte élève de recette | `STUDENT_EMAIL` présent dans `users` avec `role=ELEVE` et `Student` lié |
| Assignment actif | 1 ligne dans `coach_student_assignments` avec `status='ACTIVE'`, `coachId`=profile du coach, `studentId`=student id |
| Élève non assigné (contrôle négatif) | `OTHER_STUDENT_EMAIL` — **pas** d'assignment avec le coach |
| Coach non assigné (contrôle négatif) | `OTHER_COACH_EMAIL` — **pas** d'assignment avec l'élève cible |
| Ressource de test | Document créé avec titre `RECETTE - Ressource coach vers élève` |

### Setup DB manuel (à ne faire qu'en staging/recette)

```sql
-- À adapter avec les IDs réels
INSERT INTO coach_student_assignments (id, "coachId", "studentId", "assignmentType", status, "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, '<coach_profile_id>', '<student_id>', 'PRIMARY', 'ACTIVE', NOW(), NOW());
```

---

## Scénario complet

### 1. Connexion coach et liste des élèves

- [ ] Se connecter avec `COACH_EMAIL`
- [ ] Aller sur `/dashboard/coach/students`
- [ ] **L'élève assigné apparaît dans la liste** ✅
- [ ] L'élève non assigné (`OTHER_STUDENT_EMAIL`) **n'apparaît pas** dans la liste ❌
- [ ] HTTP 200, aucune erreur console, aucune erreur Prisma dans les logs

### 2. Dossier élève

- [ ] Cliquer sur l'élève assigné → ouvre `/dashboard/coach/students/[studentId]`
- [ ] Le dossier charge (HTTP 200)
- [ ] Les données élève s'affichent (nom, classe, `academicTrack`)
- [ ] Tentative d'accès direct à `/dashboard/coach/students/<OTHER_STUDENT_ID>` → **403 ou redirect** ❌
- [ ] Logs : aucun `PrismaClientKnownRequestError`, aucun 500

### 3. Dépôt d'une ressource/document

- [ ] Depuis le dossier élève, ajouter une ressource :
  - Titre : `RECETTE - Ressource coach vers élève`
  - Type : au choix (PDF, lien, etc.)
  - `visibilityScope` : `STUDENT` (ou équivalent expliquant la visibilité individuelle)
- [ ] La ressource est créée (HTTP 200/201)
- [ ] En DB : `user_documents` contient une ligne avec :
  - `userId` = `User.id` de l'élève (**pas** `Student.id`)
  - `uploadedById` = coach
  - `visibilityScope` correct

### 4. Connexion élève et visibilité

- [ ] Se déconnecter
- [ ] Se connecter avec `STUDENT_EMAIL`
- [ ] Aller sur le dashboard élève (`/dashboard/eleve`) et/ou la page documents
- [ ] **La ressource `RECETTE - Ressource coach vers élève` apparaît** ✅
- [ ] Pas de 500, pas d'erreur console

### 5. Contrôle négatif élève non concerné

- [ ] Se déconnecter
- [ ] Se connecter avec `OTHER_STUDENT_EMAIL`
- [ ] Aller sur le dashboard élève
- [ ] **La ressource `RECETTE - ...` N'APPARAÎT PAS** ❌
- [ ] Tentative d'accès direct à `/api/student/documents/<document_id>` (si l'endpoint existe) → 403/404

### 6. Contrôle négatif coach non assigné

- [ ] Se déconnecter
- [ ] Se connecter avec `OTHER_COACH_EMAIL`
- [ ] Aller sur `/dashboard/coach/students`
- [ ] L'élève cible **n'apparaît pas**
- [ ] Tentative d'accès direct `/dashboard/coach/students/<target_student_id>` → redirect ou 403
- [ ] Tentative d'accès à la ressource via API → 403

### 7. Logs prod

```bash
docker logs nexus-app-prod --since 10m 2>&1 | grep -iE "error|prisma|fatal|500"
```

- [ ] Aucun 500
- [ ] Aucun `PrismaClientKnownRequestError`
- [ ] Aucun contournement RBAC
- [ ] Aucun stack trace non géré

---

## Critères d'acceptation

| Critère | Doit être |
|---|---|
| Aucun 500 sur toute la séquence | ✅ |
| Aucune erreur Prisma dans les logs | ✅ |
| Aucun document visible par un mauvais élève | ✅ |
| Coach non assigné reçoit 403 ou ne voit pas l'élève | ✅ |
| Ressource liée à `User.id` élève (pas à un `Student.id` par erreur) | ✅ |
| `visibilityScope` respecté côté lecture | ✅ |
| `isCoachRattachedToStudent` utilise le nouveau système `coachStudentAssignment` (pas seulement fallback `sessionBooking`) | ✅ |

---

## Routes / fichiers concernés

| Responsabilité | Fichier |
|---|---|
| RBAC rattachement | `lib/rbac/coach-student-access.ts` (`isCoachRattachedToStudent`, `isCoachAssignedToStudent`) |
| Liste élèves coach | `app/dashboard/coach/students/page.tsx` + `app/api/coach/students/route.ts` |
| Dossier élève | `app/api/coach/students/[studentId]/dossier/route.ts` |
| Notes privées | `app/api/coach/students/[studentId]/notes/route.ts` |
| Mode survie | `app/api/coach/students/[studentId]/survival-mode/route.ts` |
| Documents élève (côté assistante) | `app/api/assistante/students/[studentId]/documents/route.ts` |
| Tests unitaires existants | `__tests__/api/coach.students.*.route.test.ts` (tous pass) |

---

## Automation future

Un spec Playwright squelette est prêt dans :

```
e2e/real/coach-resource-student.spec.ts
```

Il est **skippé par défaut** (`test.describe.skip`) tant que les variables d'env
`TEST_COACH_EMAIL`, `TEST_COACH_PWD`, `TEST_STUDENT_ASSIGNED_EMAIL`,
`TEST_STUDENT_ASSIGNED_PWD`, `TEST_STUDENT_OTHER_EMAIL`, `TEST_STUDENT_OTHER_PWD`
ne sont pas fournies. Pour l'activer après création d'un assignment réel :

```bash
TEST_COACH_EMAIL=coach.recette@nexus.local \
TEST_COACH_PWD=*** \
TEST_STUDENT_ASSIGNED_EMAIL=eleve.assigne@nexus.local \
TEST_STUDENT_ASSIGNED_PWD=*** \
TEST_STUDENT_OTHER_EMAIL=eleve.autre@nexus.local \
TEST_STUDENT_OTHER_PWD=*** \
RUN_COACH_RESOURCE_E2E=1 \
npx playwright test e2e/real/coach-resource-student.spec.ts
```

---

## Signature QA

- **Testé par** : __________________________
- **Date** : __________________________
- **Environnement** : staging / production
- **Statut** : PASS / FAIL / PARTIAL
- **Remarques** : __________________________
