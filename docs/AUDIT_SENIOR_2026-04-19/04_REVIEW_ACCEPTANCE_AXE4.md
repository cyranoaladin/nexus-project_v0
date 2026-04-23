# Revue d'acceptation AXE 4 — Dashboard Coach + IDOR

> Reviewer : Claude (revue critique du draft Windsurf `04_DASHBOARD_COACH_IDOR.md`)
> Date : 2026-04-19. Repo : `cyranoaladin/nexus-project_v0`. Branch : `main`.

---

## 1. Résumé exécutif

Le draft Windsurf est **globalement exact** sur les findings P0. Les deux IDOR bilans (lecture + écriture) sont confirmés par relecture directe du code source avec des preuves ligne par ligne.

Corrections apportées à cette revue :

- **Aggravation** du finding écriture : le draft sous-estime l'impact de l'upsert. L'`update` ne touche pas `coachId`, créant une corruption silencieuse où le contenu est écrasé mais l'attribution reste au coach original.
- **Finding additionnel** : le GET `/api/stages/{slug}/bilans` ignore le query param `?studentId=` que la page bilan passe pourtant — la surface d'attaque est encore plus large car l'API retourne systématiquement TOUS les bilans.
- **Rétrogradation** de F-AXE4-05 (`creditBalance`) de P2 à **P3 hygiène** — c'est un choix produit discutable, pas une faille sécurité.
- **Rétrogradation** de F-AXE4-03 (availability) de P2 à **P3 documentation** — le comportement est intentionnel pour le parcours de réservation parent.
- Le verdict "OK" sur session report est **confirmé** — ownership check solide en écriture et lecture multi-rôle.

---

## 2. Tableau finding Windsurf → verdict reviewer

| # Windsurf | Finding Windsurf | Sévérité Windsurf | Mon verdict | Sévérité finale | Justification |
|---|---|---|---|---|---|
| F-AXE4-01 | IDOR lecture GET bilans | P0 | **Confirmé** | **P0** | Aucun filtre `coachId` sur `findMany` L34. Le `?studentId=` de la page est ignoré. |
| F-AXE4-02 | IDOR écriture POST bilans | P0 | **Confirmé + aggravé** | **P0** | Pas de check `StageCoach`, pas de validation `studentId` vs réservation, `update` n'inclut pas `coachId` → corruption d'attribution silencieuse |
| F-AXE4-03 | GET availability exposée à tout authentifié | P2 | **Requalifié** | **P3 doc** | Comportement intentionnel (booking parent). Le code L253-254 commente l'intention. Juste besoin de documentation formelle. |
| F-AXE4-04 | Session report protégé (OK) | OK | **Confirmé** | **OK** | POST L59: `coachId !== coachUserId` → 403. GET L235-241: multi-condition solide. Tests L96: 403 couvert. |
| F-AXE4-05 | `creditBalance` exposé au coach | P2 | **Requalifié** | **P3 hygiène** | Donnée dans le JSON L172 mais non rendue dans le UI. Pas exploitable en soi. Choix produit à documenter. |
| F-AXE4-06 | Double-fetch dashboard | P3 | **Confirmé** | **P3 dette** | `coach/sessions` et `coach/students` re-fetchent `/api/coach/dashboard`. Perf uniquement. |
| F-AXE4-07 | `/api/coach/stages` bien cloisonné | OK | **Confirmé** | **OK** | `StageCoach.findMany({ where: { coachId } })` L19-20. Sessions filtrées L25. Bilans filtrés L38. |
| F-AXE4-08 | Aucun test pour bilans stage | P1 | **Confirmé** | **P1** | `find_by_name *bilan*` dans `__tests__/` : 0 fichier couvre `/api/stages/{slug}/bilans` |
| F-AXE4-09 | Page bilan coach : guard UI seul | P2 | **Confirmé + précisé** | **P2** | Le guard client L65 redirige les non-COACH, mais ne vérifie pas l'affectation au stage. Le vrai risque est API-side (F-AXE4-01/02). |
| F-AXE4-10 | Contrat Zod aligné | OK | **Confirmé** | **OK** | `sessionReportSchema` L21-31 et `reportSubmissionSchema` L39-49 : champs identiques, contraintes identiques. |
| — (nouveau) | GET bilans ignore `?studentId=` | — | **Nouveau finding** | **P2** | La page L78 passe `?studentId=` mais le handler GET ne lit aucun `searchParams`. Faux sentiment de filtrage. |

---

## 3. Findings confirmés — détail avec preuves

### F-REVIEW-01 : IDOR lecture GET `/api/stages/[stageSlug]/bilans` — **P0 confirmé**

**Preuve code directe :**

```
@/home/alaeddine/Bureau/nexus-project_v0/app/api/stages/[stageSlug]/bilans/route.ts:25-45
```

- L25 : `requireAnyRole(['ADMIN', 'ASSISTANTE', 'COACH'])` — vérifie le rôle, pas l'affectation
- L34-35 : `prisma.stageBilan.findMany({ where: { stageId: stage.id } })` — aucun filtre `coachId`
- L43 : `safeBilans` retire `contentInterne` mais expose `contentEleve`, `contentParent`, `scoreGlobal`, `domainScores`, `strengths`, `areasForGrowth`, `nextSteps`, `student.user.firstName/lastName`, `coach.pseudonym`

**Scénario d'exploitation :**
1. Coach A est authentifié (rôle COACH)
2. Coach A connaît ou devine le slug du stage de Coach B (visible dans URLs, prévisible : `printemps-2026`, `fevrier-2026`)
3. `GET /api/stages/printemps-2026/bilans` → 200 avec TOUS les bilans du stage, y compris ceux de Coach B
4. Chaque bilan contient le nom complet de l'élève, ses scores, ses forces et faiblesses

**Aggravation vs draft Windsurf :** Le handler GET ne lit aucun `searchParams`. La page bilan (`bilan/[studentId]/page.tsx` L78) passe `?studentId=${studentId}` mais l'API l'ignore complètement. Ce qui signifie que même la page dédiée à un seul étudiant reçoit TOUS les bilans du stage, pas seulement celui de l'étudiant ciblé.

**Sévérité : P0 — fuite de données pédagogiques individuelles entre coachs.**

---

### F-REVIEW-02 : IDOR écriture POST `/api/stages/[stageSlug]/bilans` — **P0 confirmé + aggravé**

**Preuve code directe :**

```
@/home/alaeddine/Bureau/nexus-project_v0/app/api/stages/[stageSlug]/bilans/route.ts:56-113
```

Trois contrôles manquants :

**a) Pas de vérification StageCoach (coach → stage) :**
- L69-71 : `prisma.stage.findUnique({ where: { slug } })` — vérifie que le stage existe
- L73-76 : `prisma.coachProfile.findUnique({ where: { userId } })` — vérifie que le coach existe
- **Absent** : `prisma.stageCoach.findFirst({ where: { stageId, coachId: coachProfile.id } })` — jamais exécuté

Le modèle `StageCoach` existe (schema L966-977, `@@unique([stageId, coachId])`). La donnée est là mais le handler ne l'utilise pas.

**b) Pas de validation studentId vs réservation :**
- L9 : `studentId: z.string().min(1)` — Zod valide le format mais pas l'inscription
- L79-82 : `upsert` avec `stageId_studentId` — si le `studentId` n'a pas de bilan existant, un nouveau est créé sans vérifier qu'il est inscrit au stage
- **Absent** : `prisma.stageReservation.findFirst({ where: { stageId, studentId, richStatus: 'CONFIRMED' } })`

**c) L'`update` n'inclut pas `coachId` — corruption d'attribution :**
- L80-93 (`create`) : `coachId: coachProfile.id` — attribution correcte à la création
- L95-106 (`update`) : **`coachId` absent** — si un bilan existe déjà (créé par Coach B), Coach A peut écraser tout le contenu (`contentEleve`, `contentParent`, `scoreGlobal`, etc.) mais le `coachId` en base restera celui de Coach B

Conséquence : Coach B apparaît comme l'auteur d'un bilan dont le contenu a été écrit par Coach A. C'est une corruption de données avec fausse attribution.

**Scénario d'exploitation :**
1. Coach B rédige et publie un bilan pour l'élève X sur le stage `printemps-2026`
2. Coach A (pas assigné au stage) appelle :
   ```
   POST /api/stages/printemps-2026/bilans
   { "studentId": "id-eleve-X", "contentEleve": "texte malveillant", "contentParent": "texte falsifié", "isPublished": true }
   ```
3. Résultat : 200 success. Le bilan est écrasé. `coachId` reste celui de Coach B.
4. L'élève et le parent voient un bilan falsifié attribué à Coach B.

**Sévérité : P0 — corruption de données pédagogiques avec fausse attribution.**

---

### F-REVIEW-03 : Aucun test pour `/api/stages/{slug}/bilans` — **P1 confirmé**

**Preuve :**

Recherche exhaustive dans `__tests__/` :

| Pattern recherché | Résultat |
|---|---|
| `find_by_name *bilan*` dans `__tests__/` | 10 fichiers — tous concernent les bilans diagnostiques (`bilan-gratuit`, `bilan-pallier2-maths`, `bilan-renderer`, `bilan-generator`), aucun ne concerne `stageBilan` |
| `find_by_name *stage*` dans `__tests__/` | 11 résultats — `admin.stages.route.test.ts` (CRUD admin), `stages-list.test.ts`, `stage-capacity.test.ts`, `stages-layout-metadata.test.ts` — aucun ne teste la route `/api/stages/{slug}/bilans` |
| `grep bilans __tests__/api/admin.stages.route.test.ts` | 2 matches — dans le mock data, pas des tests de la route bilans |

**Verdict : 0 test couvre la route `/api/stages/[stageSlug]/bilans`** — ni auth, ni RBAC, ni IDOR, ni validation Zod, ni 404.

---

### F-REVIEW-04 : Page bilan ignore le cloisonnement API — **P2 confirmé**

**Preuve code :**

```
@/home/alaeddine/Bureau/nexus-project_v0/app/dashboard/coach/stages/[stageSlug]/bilan/[studentId]/page.tsx:63-66
```
```typescript
if (status === 'unauthenticated') router.push('/auth/signin');
if (status === 'authenticated' && session?.user?.role !== 'COACH') router.push('/dashboard');
```

Le guard client vérifie uniquement le rôle COACH, pas l'affectation au stage. Un coach peut naviguer manuellement à `/dashboard/coach/stages/autre-stage/bilan/nimporte-quel-studentId` et l'API répondra 200 (car F-REVIEW-01 et F-REVIEW-02 sont ouverts).

De plus, L76-78 :
```typescript
const [stagesRes, bilanRes] = await Promise.all([
  fetch('/api/coach/stages'),
  fetch(`/api/stages/${stageSlug}/bilans?studentId=${studentId}`),
]);
```

Le premier fetch (`/api/coach/stages`) est bien filtré par coach, mais le second (`/api/stages/{slug}/bilans`) ne l'est pas. La page affiche le résultat de la première API pour le contexte (nom de l'élève) et le résultat de la seconde pour le bilan. Si le stage n'est pas assigné au coach, `stagesRes` ne contiendra pas le stage mais `bilanRes` retournera quand même les bilans.

**Sévérité : P2 — le vrai risque est API-side (F-REVIEW-01/02). Le guard UI est un confort, pas une sécurité.**

---

## 4. Findings requalifiés

### F-AXE4-03 (Windsurf P2) → P3 documentation

**Preuve code :**

```
@/home/alaeddine/Bureau/nexus-project_v0/app/api/coaches/availability/route.ts:253-259
```
```typescript
// Only coaches can view their own availability, others can view any coach's availability
if (session.user.role === 'COACH' && coachId !== session.user.id) {
  return NextResponse.json(
    { error: 'You can only view your own availability' },
    { status: 403 }
  );
}
```

Le commentaire L253 documente l'intention : les non-COACH (parents, élèves) peuvent consulter la disponibilité de tout coach pour le parcours de réservation. C'est un choix produit cohérent. Le risque est uniquement l'absence de documentation formelle.

**Verdict : P3 — besoin de documentation, pas de fix sécurité.**

---

### F-AXE4-05 (Windsurf P2) → P3 hygiène

**Preuve code :**

```
@/home/alaeddine/Bureau/nexus-project_v0/app/api/coach/dashboard/route.ts:151-172
```

Le `creditBalance` (L172) est calculé et inclus dans le payload JSON. Cependant :
- Il n'est pas rendu dans `app/dashboard/coach/students/page.tsx` (pas de référence à `creditBalance` dans le composant)
- Il n'est pas rendu dans `app/dashboard/coach/page.tsx`
- L'information (solde de crédits d'un élève) pourrait être pertinente pour le coach dans un contexte métier

Ce n'est pas une faille sécurité (le coach voit déjà les données de SES propres élèves via le filtre `coachUserId` L19). C'est un choix produit sur la granularité des données exposées.

**Verdict : P3 — hygiène de payload. Retirer ou documenter.**

---

## 5. Findings session report — verdict détaillé

### POST `/api/coach/sessions/[sessionId]/report` — **OK confirmé**

**Chaîne de contrôle vérifiée ligne par ligne :**

| Étape | Ligne | Contrôle | Résultat |
|---|---|---|---|
| Auth | L14-21 | `session.user.role !== 'COACH'` | 401 si non-COACH |
| Validation | L27-37 | `reportSubmissionSchema.safeParse(body)` | 400 si invalide |
| Existence | L41-57 | `sessionBooking.findFirst({ where: { id: sessionId } })` | 404 si absent |
| **Ownership** | **L59-64** | **`sessionBooking.coachId !== coachUserId`** | **403 si non-propriétaire** |
| Status | L66-74 | `['CONFIRMED', 'IN_PROGRESS'].includes(status)` | 400 si statut incompatible |
| Idempotence | L76-88 | `sessionReport.findUnique({ where: { sessionId } })` | 409 si déjà existant |
| Transaction | L112-155 | Create report + update booking + notification | Atomique |

**Le contrôle d'ownership L59 est la garde critique.** Le `sessionBooking.coachId` est un champ côté serveur, non manipulable par le client. Le `coachUserId` vient de la session authentifiée. La comparaison est correcte.

### GET `/api/coach/sessions/[sessionId]/report` — **OK confirmé**

**Chaîne de contrôle :**

| Étape | Ligne | Contrôle | Résultat |
|---|---|---|---|
| Auth | L197-204 | `!session` | 401 |
| Report lookup | L208-222 | `findUnique({ where: { sessionId } })` | 200 `{ report: null }` si absent |
| Session lookup | L224-233 | `findUnique({ where: { id: sessionId } })` | 404 si absent |
| **Authorization** | **L235-246** | **coachId ∨ studentId ∨ parentId ∨ ADMIN ∨ ASSISTANTE** | **403 sinon** |

**Observation mineure :** Si le report existe mais l'appelant n'est pas autorisé, il reçoit 403. Si le report n'existe pas, il reçoit 200 `{ report: null }`. Cela révèle l'existence d'un report à un utilisateur non autorisé (oracle booléen). Sévérité très basse — pas de fuite de contenu.

### Alignement contrat Zod — **OK confirmé**

```
@/home/alaeddine/Bureau/nexus-project_v0/lib/validation/session-report.ts:21-31
```
vs
```
@/home/alaeddine/Bureau/nexus-project_v0/lib/validation/session-report.ts:39-49
```

Champs obligatoires identiques : `summary` (min 20), `topicsCovered` (min 10), `performanceRating` (int 1-5), `progressNotes` (min 10), `recommendations` (min 10), `attendance` (boolean).
Champs optionnels identiques : `engagementLevel`, `homeworkAssigned`, `nextSessionFocus`.
Contraintes de validation identiques.

Le formulaire (`session-report-form.tsx` L37) utilise `sessionReportSchema` via `zodResolver`. L'API (report `route.ts` L27) utilise `reportSubmissionSchema` via `safeParse`. Pas de divergence.

---

## 6. Couverture de tests — diff exact

### Tests existants

| Fichier | Route couverte | IDOR testé ? | Qualité |
|---|---|---|---|
| `coach.sessions.report.route.test.ts` (231 lignes) | POST+GET `/api/coach/sessions/{id}/report` | **OUI** — L96: 403 quand coach ≠ propriétaire | Bonne — 7 cas POST, 5 cas GET |
| `coach.dashboard.route.test.ts` (126 lignes) | GET `/api/coach/dashboard` | NON — pas de test cross-coach | Basique — 3 cas seulement |
| `coaches.availability.route.test.ts` (78 lignes) | POST+GET+DELETE `/api/coaches/availability` | NON — pas de test cross-coach GET | Minimal — 4 cas |
| `security/idor.test.ts` (180 lignes) | `resolveAccess`, tokens signés, guards | NON — aucun scénario coach/stage/bilan | Générique — pas de test route-specific |
| `admin.stages.route.test.ts` (259 lignes) | CRUD `/api/admin/stages/*` | NON — admin seulement | N/A pour IDOR coach |

### Tests manquants

| Priorité | Fichier à créer | Scénarios |
|---|---|---|
| **P0** | `__tests__/api/stages.bilans.idor.test.ts` | Coach A GET bilans stage de Coach B → 403 ; Coach A POST bilan stage non-assigné → 403 ; Coach A POST studentId non-inscrit → 404 ; Coach A upsert bilan existant de Coach B → 403 ; Coach A GET ses bilans → 200 filtré ; Coach A POST son stage/élève → 200 ; ADMIN GET tout → 200 ; Non-auth → 401 ; ELEVE → 403 |
| **P1** | `__tests__/api/stages.bilans.route.test.ts` | Validation Zod (400) ; Stage introuvable (404) ; CoachProfile introuvable (404) ; Création réussie (200) ; Upsert update (200) ; `isPublished` + `publishedAt` |
| **P2** | Section dans `security/idor.test.ts` | Scénarios IDOR coach/stage/bilan intégrés aux tests de sécurité génériques |
| **P2** | `coaches.availability.route.test.ts` enrichi | COACH A GET dispo de COACH B → 403 ; PARENT GET dispo de COACH → 200 |
| **P3** | `coach.dashboard.route.test.ts` enrichi | Coach A ne voit pas les sessions/élèves de Coach B |

### Tests prioritaires à écrire en premier (LOT 3)

9 cas dans `stages.bilans.idor.test.ts` :

```
T1: Coach A (assigné Stage X) GET /api/stages/stage-Y/bilans → 403
T2: Coach A POST bilan sur Stage Y (non assigné) → 403
T3: Coach A POST bilan pour studentId non inscrit au stage → 404
T4: Coach A GET /api/stages/stage-X/bilans → 200 + bilans filtrés par coachId
T5: Coach A POST bilan sur Stage X pour élève inscrit → 200
T6: ADMIN GET /api/stages/stage-Y/bilans → 200 complet (pas de filtre)
T7: ASSISTANTE POST bilan bypass → 200
T8: Non authentifié GET bilans → 401
T9: ELEVE GET bilans → 403
```

---

## 7. Prompt Windsurf de remédiation LOT 3 — version corrigée

Corrections par rapport au draft Windsurf :
- Ajout de la vérification `coachId` dans le bloc `update` de l'upsert (corruption d'attribution)
- Ajout du filtrage par `studentId` query param sur GET
- Précision sur la validation `studentId` vs `StageReservation.richStatus === 'CONFIRMED'`
- Ajout du `studentId` discriminant sur GET (optionnel, pour la page bilan)

```
Contexte : Nexus Réussite repo local (/home/alaeddine/Bureau/nexus-project_v0).
Audit 2026-04-19 — LOT 3 Coach IDOR.
Voir docs/AUDIT_SENIOR_2026-04-19/04_REVIEW_ACCEPTANCE_AXE4.md pour les preuves validées.

Tâche : Corriger les 2 failles IDOR P0 sur /api/stages/[stageSlug]/bilans et écrire les tests.

═══ SOUS-LOT 3a — IDOR lecture GET bilans ═══

Fichier : `app/api/stages/[stageSlug]/bilans/route.ts`, handler GET.

Changements requis :
1. Après L32 (stage lookup), si le rôle du user est COACH :
   a. Récupérer le coachProfile : `prisma.coachProfile.findUnique({ where: { userId: sessionOrError.user.id } })`
      → si null : retourner 404 "Profil coach introuvable"
   b. Vérifier l'affectation : `prisma.stageCoach.findFirst({ where: { stageId: stage.id, coachId: coachProfile.id } })`
      → si null : retourner 403 "Accès refusé : vous n'êtes pas affecté à ce stage"
   c. Filtrer les bilans : ajouter `coachId: coachProfile.id` dans le `where` du `findMany`
2. Si le rôle est ADMIN ou ASSISTANTE : pas de filtre coachId (comportement actuel)
3. Optionnel mais recommandé : lire `searchParams.get('studentId')` et ajouter un filtre
   `studentId` dans le `where` si présent (la page bilan le passe déjà)

═══ SOUS-LOT 3b — IDOR écriture POST bilans ═══

Fichier : `app/api/stages/[stageSlug]/bilans/route.ts`, handler POST.

Changements requis :
1. Après L76 (coachProfile lookup), si le rôle du user est COACH :
   a. Vérifier l'affectation : `prisma.stageCoach.findFirst({ where: { stageId: stage.id, coachId: coachProfile.id } })`
      → si null : retourner 403 "Accès refusé : vous n'êtes pas affecté à ce stage"
   b. Vérifier l'inscription de l'élève : `prisma.stageReservation.findFirst({ where: { stageId: stage.id, studentId: parsed.data.studentId, richStatus: 'CONFIRMED' } })`
      → si null : retourner 404 "Élève non inscrit à ce stage"
2. Si le rôle est ADMIN ou ASSISTANTE : bypass ces 2 vérifications
3. CRITIQUE — Dans le bloc `update` (L95-106), AJOUTER `coachId: coachProfile.id`
   Ceci empêche la corruption d'attribution : si un bilan existe déjà (créé par
   un autre coach), seul le coach affecté au stage peut le mettre à jour, et le
   coachId sera mis à jour avec l'auteur réel de la modification.

═══ SOUS-LOT 3c — Tests IDOR ═══

Créer : `__tests__/api/stages.bilans.idor.test.ts`

Mock setup :
- `jest.mock('@/auth')` et `jest.mock('@/lib/prisma')` avec prisma client mocké
- Importer `GET, POST` depuis `@/app/api/stages/[stageSlug]/bilans/route`

Cas de test (9) :
T1: mockAuth COACH (id: 'c-A'), stageCoach.findFirst → null
    → GET retourne 403
T2: mockAuth COACH (id: 'c-A'), stageCoach.findFirst → null
    → POST retourne 403
T3: mockAuth COACH (id: 'c-A'), stageCoach.findFirst → { id: 'sc-1' },
    stageReservation.findFirst → null
    → POST retourne 404
T4: mockAuth COACH (id: 'c-A'), stageCoach.findFirst → { id: 'sc-1' },
    stageBilan.findMany → [bilan filtrée]
    → GET retourne 200 avec bilans du coach uniquement
T5: mockAuth COACH (id: 'c-A'), stageCoach.findFirst → { id: 'sc-1' },
    stageReservation.findFirst → { id: 'r-1' }, stageBilan.upsert → success
    → POST retourne 200
T6: mockAuth ADMIN, pas de check stageCoach
    → GET retourne 200 avec tous les bilans
T7: mockAuth ASSISTANTE
    → POST retourne 200 (bypass)
T8: mockAuth → null
    → GET retourne 401
T9: mockAuth ELEVE
    → GET retourne 403

Enrichir : `__tests__/security/idor.test.ts` — nouvelle section
"IDOR Prevention — Coach/Stage/Bilan Layer" avec les scénarios T1, T2, T3.

═══ SOUS-LOT 3d — Documentation ═══

1. `docs/21_GUIDE_DASHBOARDS.md` — ajouter section "### Coach — Stages et Bilans"
   documentant :
   - `/dashboard/coach/stages` — liste des stages assignés au coach
   - `/dashboard/coach/stages/[stageSlug]/bilan/[studentId]` — éditeur de bilan
   - `GET /api/coach/stages` — stages du coach (filtré par StageCoach)
   - `GET /api/stages/{slug}/bilans` — bilans du stage (filtré par coachId pour COACH)
   - `POST /api/stages/{slug}/bilans` — création/mise à jour bilan (vérifie affectation + inscription)
   - Politique : COACH voit/modifie uniquement ses bilans sur ses stages. ADMIN/ASSISTANTE voient tout.

2. `app/api/coaches/availability/route.ts` — ajouter en tête du fichier :
   ```
   /**
    * POLICY: GET availability is readable by any authenticated user.
    * This is intentional to support the parent/student booking flow.
    * Coaches are restricted to viewing only their own availability (403 otherwise).
    * Staff (ADMIN, ASSISTANTE) can view any coach's availability.
    */
   ```

Contraintes :
- Ne pas modifier la prod
- `npm test -- --runInBand __tests__/api/stages.bilans.idor.test.ts` → 9/9 pass
- `npm test -- --runInBand __tests__/security/idor.test.ts` → all pass
- `npm run build` → 0 erreurs
- Ne pas toucher aux routes session report (déjà sécurisées)
- Chaque sous-lot = 1 commit séparé avec message conventionnel
```

---

## 8. Matrice récapitulative finale

| Surface | Garde attendue | Garde réelle | Verdict | Sévérité |
|---|---|---|---|---|
| GET `/api/stages/{slug}/bilans` | COACH ne voit que ses bilans | Tout COACH voit tous les bilans du stage | **IDOR lecture** | **P0** |
| POST `/api/stages/{slug}/bilans` | COACH n'écrit que sur ses stages/élèves | Tout COACH crée/écrase n'importe quel bilan | **IDOR écriture + corruption attribution** | **P0** |
| GET `/api/stages/{slug}/bilans?studentId=` | Filtre par élève | Param ignoré | **Faux filtrage** | **P2** |
| POST `/api/coach/sessions/{id}/report` | Ownership coach | `coachId !== coachUserId` → 403 | **OK** | — |
| GET `/api/coach/sessions/{id}/report` | Multi-rôle | coach ∨ student ∨ parent ∨ staff | **OK** | — |
| GET `/api/coach/stages` | Stages du coach | `StageCoach.findMany({ coachId })` | **OK** | — |
| GET `/api/coach/dashboard` | Données du coach | `coachUserId` filter | **OK** | — |
| GET `/api/coaches/availability` | Publique pour booking | COACH restricted, others open | **OK (à documenter)** | P3 |
| `creditBalance` dans dashboard | Non requis UI | Présent dans payload | **Hygiène** | P3 |
| Tests route bilans | Tests IDOR | 0 test | **Gap critique** | P1 |

---

## 9. Décision d'acceptation

Le draft Windsurf AXE 4 est **accepté avec corrections mineures**.

**Accepté tel quel :** F-AXE4-01, F-AXE4-02, F-AXE4-04, F-AXE4-07, F-AXE4-08, F-AXE4-09, F-AXE4-10.
**Requalifié :** F-AXE4-03 (P2→P3), F-AXE4-05 (P2→P3).
**Aggravé :** F-AXE4-02 (ajout corruption d'attribution via `update` sans `coachId`).
**Ajouté :** Finding `?studentId=` ignoré sur GET (P2).

Le LOT 3 corrigé dans la section 7 ci-dessus est **prêt à exécuter**. L'AXE 4 peut être clôturé et le passage à l'AXE 5 peut commencer.
