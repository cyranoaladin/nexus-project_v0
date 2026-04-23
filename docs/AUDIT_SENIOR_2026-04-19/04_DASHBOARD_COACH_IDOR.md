# AXE 4 — Dashboard coach et IDOR

> Audit 2026-04-19. Périmètre lu uniquement. Aucune modification applicative.

---

## 1. Conclusion exécutive

Deux failles IDOR confirmées sur `/api/stages/[stageSlug]/bilans` :
une en lecture (tout coach authentifié lit tous les bilans de n'importe quel stage),
une en écriture (tout coach authentifié peut créer ou écraser le bilan d'un élève sur un stage auquel il n'est pas affecté).

Le flux session report (`/api/coach/sessions/[sessionId]/report`) est correctement protégé avec vérification `coachId === coachUserId` sur le `SessionBooking`.

La disponibilité coach est persistée en base (`CoachAvailability`) mais le GET expose la dispo de n'importe quel coach à tout utilisateur authentifié (choix produit acceptable pour la réservation, mais non documenté comme intentionnel).

Aucun test IDOR ne couvre les routes stage/bilan ni coach/stages.

---

## 2. Findings

### F-AXE4-01 — IDOR lecture confirmé : GET `/api/stages/[stageSlug]/bilans` (P0)

**Preuve code.** La route vérifie le rôle via `requireAnyRole(['ADMIN', 'ASSISTANTE', 'COACH'])` (L25 de `app/api/stages/[stageSlug]/bilans/route.ts`), puis charge tous les bilans du stage sans aucun filtrage par coach :

```typescript
// app/api/stages/[stageSlug]/bilans/route.ts:34-41
const bilans = await prisma.stageBilan.findMany({
  where: { stageId: stage.id },
  // ← Pas de filtre coachId
  include: { student: {...}, coach: {...} },
});
```

Conséquence : Coach A peut lire tous les bilans du stage de Coach B en appelant `GET /api/stages/{slug}/bilans`. Il n'a besoin que du slug du stage (visible dans l'URL du dashboard).

**Impact utilisateur.** Un coach non affecté au stage accède aux bilans individuels, incluant `contentEleve`, `contentParent`, `scoreGlobal`, `domainScores`, `strengths` et `areasForGrowth` de chaque élève. Seul `contentInterne` est exclu (L43 : `safeBilans` retire `contentInterne`).

**Effort.** S — ajouter un filtre `coachId` pour les COACH, laisser ADMIN/ASSISTANTE sans filtre.

### F-AXE4-02 — IDOR écriture confirmé : POST `/api/stages/[stageSlug]/bilans` (P0)

**Preuve code.** La route POST vérifie le rôle et récupère le `coachProfile` du coach courant (L73-76), mais ne vérifie jamais que ce coach est affecté au stage via `StageCoach`. Elle utilise directement le `coachProfile.id` dans l'upsert :

```typescript
// app/api/stages/[stageSlug]/bilans/route.ts:69-79
const stage = await prisma.stage.findUnique({ where: { slug: stageSlug } });
if (!stage) return ...;

const coachProfile = await prisma.coachProfile.findUnique({
  where: { userId: sessionOrError.user.id },
});
// ← Pas de vérification : ce coach est-il affecté à ce stage ?

const bilan = await prisma.stageBilan.upsert({
  where: { stageId_studentId: { stageId: stage.id, studentId: parsed.data.studentId } },
  create: { ..., coachId: coachProfile.id, ... },
  update: { ... },
});
```

De plus, le `studentId` fourni dans le body n'est pas validé contre la liste des élèves inscrits au stage. Un coach peut injecter n'importe quel `studentId` existant dans le système.

**Impact utilisateur.** Coach A peut créer ou écraser le bilan d'un élève sur le stage de Coach B. L'upsert (`stageId_studentId` unique) écrase le bilan existant sans contrôle d'auteur. Cela constitue une corruption de données.

**Effort.** S — vérifier l'existence d'un `StageCoach` pour `(stageId, coachId)` et valider le `studentId` contre les réservations confirmées du stage.

### F-AXE4-03 — GET `/api/coaches/availability` expose la dispo de tout coach à tout utilisateur authentifié (P2)

**Preuve code.** L'endpoint GET n'exige qu'une authentification (`session?.user`) et accepte un `coachId` en query param, sans restriction de rôle pour les non-COACH :

```typescript
// app/api/coaches/availability/route.ts:248-259
const coachId = searchParams.get('coachId') || session.user.id;

// Only coaches can view their own availability, others can view any coach's
if (session.user.role === 'COACH' && coachId !== session.user.id) {
  return ... 403;
}
```

Un PARENT ou un ELEVE peut interroger `GET /api/coaches/availability?coachId=xxx` et obtenir la grille de disponibilité complète de n'importe quel coach.

**Impact utilisateur.** Exposition de la grille horaire personnelle du coach. Si c'est un choix produit (pour la réservation), il doit être documenté. Si non voulu, il faut restreindre aux rôles staff + parent.

**Effort.** XS — ajouter une vérification de rôle ou documenter le choix.

### F-AXE4-04 — Le flux session report est correctement protégé (constat positif)

**Preuve code.** Le POST sur `/api/coach/sessions/[sessionId]/report` (L59-64) compare `sessionBooking.coachId !== coachUserId` avant de permettre l'écriture, et retourne 403 explicitement. Le GET (L235-246) vérifie que l'appelant est le coach, l'élève, le parent ou le staff.

```typescript
// app/api/coach/sessions/[sessionId]/report/route.ts:59-64
if (sessionBooking.coachId !== coachUserId) {
  return NextResponse.json(
    { error: 'Forbidden: You are not the coach for this session' },
    { status: 403 }
  );
}
```

**Tests existants.** Le test `coach.sessions.report.route.test.ts` (L96-106) couvre le scénario "403 when coach does not own session". Ce flux est sécurisé.

### F-AXE4-05 — `/api/coach/dashboard` expose les crédits élèves aux coachs (P2)

**Preuve code.** Le dashboard coach (L150-161) charge le solde de crédits de chaque élève via `creditTransactions.reduce(...)` et le renvoie dans `creditBalance`. L'affichage UI ne l'utilise pas actuellement (non visible dans `app/dashboard/coach/page.tsx` ni `coach/students/page.tsx`), mais la donnée est dans la réponse JSON.

```typescript
// app/api/coach/dashboard/route.ts:157-161
const creditMap = new Map(
  studentEntities.map(se => [
    se.userId,
    { id: se.id, grade: se.grade, balance: se.creditTransactions.reduce((t, tr) => t + tr.amount, 0) }
  ])
);
```

**Impact utilisateur.** Un coach connaît le solde de crédits de ses élèves. Selon la politique produit, c'est soit pertinent (le coach sait si l'élève peut booker), soit une fuite d'information commerciale.

**Effort.** XS — supprimer `creditBalance` du payload ou le garder avec justification produit documentée.

### F-AXE4-06 — `coach/sessions/` et `coach/students/` sont des vues dérivées du même endpoint (P3 dette)

**Preuve code.** Les deux pages (`app/dashboard/coach/sessions/page.tsx:51`, `app/dashboard/coach/students/page.tsx:32`) appellent `fetch('/api/coach/dashboard')` et extraient respectivement `todaySessions`+`weekSessions` et `students`. Il n'existe pas d'endpoint dédié `/api/coach/sessions` ni `/api/coach/students`.

**Impact utilisateur.** Chaque sous-page re-fetche le dashboard complet. Le coach charge la liste d'élèves et les sessions même quand il n'en a besoin que d'une partie.

**Effort.** M — découper en endpoints dédiés ou accepter la dette.

### F-AXE4-07 — `/api/coach/stages` bien cloisonné (constat positif)

**Preuve code.** L'endpoint filtre par `coachProfile.id` via `StageCoach.findMany({ where: { coachId: coachProfile.id } })` (L19). Les sessions sont filtrées par `coachId` (L25). Les bilans sont filtrés par `coachId` (L38). Un coach ne voit que ses propres stages, ses propres séances, et ses propres bilans.

### F-AXE4-08 — Aucun test de couverture pour `/api/stages/[stageSlug]/bilans` (P1)

**Preuve.** `find_by_name` sur `__tests__` ne retourne aucun fichier de test pour `stages.bilans`, `stage-bilans`, ni `stageSlug.bilans`. `grep_search bilans` dans `__tests__` ne matche que des tests de bilan diagnostique et de stage admin, pas de la route bilans spécifiquement.

**Impact.** Les failles IDOR F-AXE4-01 et F-AXE4-02 n'ont aucun filet de non-régression.

### F-AXE4-09 — La page bilan coach (`coach/stages/[stageSlug]/bilan/[studentId]`) n'a qu'un guard UI sans vérification API (P2)

**Preuve code.** Le guard client-side dans `app/dashboard/coach/stages/[stageSlug]/bilan/[studentId]/page.tsx` (L65) fait :
```typescript
if (status === 'authenticated' && session?.user?.role !== 'COACH') router.push('/dashboard');
```
Mais la route API `GET /api/stages/{slug}/bilans` derrière accepte tout COACH sans vérifier l'affectation au stage. Un coach peut donc naviguer manuellement à `/dashboard/coach/stages/autre-stage/bilan/nimporte-quel-studentId` et accéder aux données.

### F-AXE4-10 — Le contrat Zod `sessionReportSchema` et `reportSubmissionSchema` sont alignés (constat positif)

**Preuve code.** Les deux schémas dans `lib/validation/session-report.ts` ont exactement les mêmes champs obligatoires (`summary`, `topicsCovered`, `performanceRating`, `progressNotes`, `recommendations`, `attendance`) et les mêmes champs optionnels (`engagementLevel`, `homeworkAssigned`, `nextSessionFocus`). Le formulaire (`session-report-form.tsx`) utilise `sessionReportSchema` via `zodResolver`, et l'API utilise `reportSubmissionSchema` via `safeParse`. Pas de divergence.

---

## 3. Tableau surface → garde attendue → garde réelle → verdict

| Surface | Garde attendue | Garde réelle | Verdict |
|---|---|---|---|
| `GET /api/stages/{slug}/bilans` | COACH ne voit que les bilans de son stage | Tout COACH voit tous les bilans du stage | **IDOR lecture P0** |
| `POST /api/stages/{slug}/bilans` | COACH n'écrit que sur ses propres stages/élèves | Tout COACH crée/écrase le bilan de n'importe quel élève de n'importe quel stage | **IDOR écriture P0** |
| `POST /api/coach/sessions/{id}/report` | COACH n'écrit que sur ses propres sessions | Vérifié via `sessionBooking.coachId !== coachUserId` → 403 | **OK** |
| `GET /api/coach/sessions/{id}/report` | Seuls coach, élève, parent, staff voient le report | Vérifié via multi-condition L235-246 | **OK** |
| `GET /api/coach/stages` | COACH ne voit que ses stages | Filtré par `coachProfile.id` | **OK** |
| `GET /api/coach/dashboard` | COACH ne voit que ses élèves/sessions | Filtré par `coachUserId` | **OK** |
| `GET /api/coaches/availability` | Dispo propre pour COACH, publique pour réservation | Tout authentifié peut lire n'importe quel coach | **P2 — à documenter** |
| `POST /api/coaches/availability` | Seul le COACH écrit sa propre dispo | Vérifié via `session.user.role === 'COACH'` + `session.user.id` | **OK** |
| `DELETE /api/coaches/availability` | Seul le COACH supprime sa propre dispo | Vérifié via `coachId: session.user.id` dans findFirst | **OK** |

---

## 4. Scénarios IDOR exécutés (analyse statique)

L'analyse ci-dessous est basée sur le code source. En l'absence d'un dataset e2e avec 2 coachs distincts assignés à des stages différents, les scénarios sont déduits du code mais non exécutés en runtime. La preuve est le code lui-même.

| # | Scénario | Requête | Résultat attendu | Résultat réel (code) | Sévérité | Preuve |
|---|---|---|---|---|---|---|
| S1 | Coach A lit les bilans du stage de Coach B | `GET /api/stages/printemps-2026/bilans` | 403 ou bilans filtrés | **200 avec TOUS les bilans du stage** | P0 | `route.ts:34` — aucun filtre `coachId` |
| S2 | Coach A écrit un bilan pour un élève non assigné | `POST /api/stages/autre-stage/bilans { studentId: "stu-B" }` | 403 | **200 success** — upsert exécuté | P0 | `route.ts:69-107` — pas de check `StageCoach` |
| S3 | Coach A écrase le bilan de Coach B | `POST /api/stages/printemps-2026/bilans { studentId: "stu-B" }` | 403 | **200** — upsert écrase le bilan existant, le `coachId` n'est PAS mis à jour dans l'`update` | P0 | `route.ts:95-106` — `update` ne touche pas `coachId` |
| S4 | Coach A accède à la session de Coach B | `POST /api/coach/sessions/session-B/report` | 403 | **403** — vérifié via `coachId !== coachUserId` | OK | `report/route.ts:59-64` |
| S5 | Coach A voit les élèves de Coach B | `GET /api/coach/dashboard` | Ses propres élèves | Ses propres élèves | OK | `dashboard/route.ts:129-132` |
| S6 | ELEVE lit la dispo de Coach A | `GET /api/coaches/availability?coachId=coachA` | 403 ou 200 si réservation | **200** — aucun filtrage rôle | P2 | `availability/route.ts:248-259` |
| S7 | Coach A accède à un stage non assigné via `/api/coach/stages` | `GET /api/coach/stages` | Seulement ses stages | Seulement ses stages (filtré par StageCoach) | OK | `coach/stages/route.ts:19` |

---

## 5. Couverture de tests existante

| Fichier de test | Couvre | IDOR testé ? |
|---|---|---|
| `__tests__/security/idor.test.ts` | `resolveAccess`, tokens signés, guards | Non — aucun scénario coach/stage/bilan |
| `__tests__/api/coach.sessions.report.route.test.ts` | POST/GET report | **OUI** — test "403 when coach does not own session" (L96) |
| `__tests__/api/coach.dashboard.route.test.ts` | GET dashboard | Non — pas de test cross-coach |
| `__tests__/api/coaches.availability.route.test.ts` | Availability | À vérifier — probable test basique |
| `__tests__/api/admin.stages.route.test.ts` | Admin stages CRUD | Non — ne teste pas `/api/stages/{slug}/bilans` |

**Tests manquants critiques :**
1. `__tests__/api/stages.bilans.route.test.ts` — IDOR lecture + écriture
2. `__tests__/security/idor.test.ts` — scénarios S1/S2/S3 ci-dessus
3. `__tests__/api/coach.dashboard.cross-coach.test.ts` — isolation entre coachs

---

## 6. Documentation vs réalité

| Fonctionnalité (docs/21_GUIDE_DASHBOARDS.md) | Documentée ? | Implémentée ? | Verdict |
|---|---|---|---|
| Planning du jour | Oui ("planning du jour") | Oui — `todaySessions` | OK |
| Élèves | Oui ("élèves") | Oui — `students` (30 derniers jours) | OK |
| Disponibilité | Oui ("disponibilité") | Oui — `CoachAvailability` en DB | OK |
| Soumission rapport | Oui ("soumission rapport") | Oui — `SessionReportDialog` | OK |
| Stages/bilans | **Non documenté** | Implémenté — `/dashboard/coach/stages` | **Gap doc** |
| API `/api/coach/stages` | **Non documenté** | Implémenté | **Gap doc** |
| API `/api/stages/{slug}/bilans` | **Non documenté** | Implémenté | **Gap doc** |
| Crédits élève côté coach | **Non documenté** | Exposé dans le payload JSON | **Gap doc** |

---

## 7. Remédiation ordonnée

### Priorité P0 — IDOR (effort total S, 3-4h)

1. **GET `/api/stages/[stageSlug]/bilans`** — pour le rôle COACH, ajouter un filtre : vérifier que le coach courant est affecté au stage via `StageCoach`, puis filtrer les bilans par `coachId`. ADMIN et ASSISTANTE gardent l'accès complet.

2. **POST `/api/stages/[stageSlug]/bilans`** — ajouter 2 gardes :
   - Vérifier que le coach est affecté au stage via `StageCoach.findFirst({ where: { stageId, coachId: coachProfile.id } })`.
   - Vérifier que le `studentId` correspond à une réservation confirmée du stage via `StageReservation.findFirst({ where: { stageId, studentId } })`.
   - Garder le bypass pour ADMIN/ASSISTANTE.

3. **Écrire `__tests__/api/stages.bilans.idor.test.ts`** couvrant les scénarios S1, S2, S3.

### Priorité P1 — Tests (effort S, 2h)

4. Enrichir `__tests__/security/idor.test.ts` avec une section "IDOR — Coach/Stage/Bilan" testant les gardes ajoutées.
5. Ajouter `__tests__/api/stages.bilans.route.test.ts` avec tests CRUD complets (auth, validation Zod, 404, 200).

### Priorité P2 — Hygiène (effort XS-S, 2h)

6. Documenter la politique d'exposition de disponibilité coach (intentionnel pour réservation parent ?) ou restreindre le GET aux rôles `COACH` + staff + `PARENT`.
7. Décider si `creditBalance` doit être exposé au coach dans `/api/coach/dashboard`, et documenter la décision.
8. Mettre à jour `docs/21_GUIDE_DASHBOARDS.md` pour refléter `/dashboard/coach/stages`, les APIs de bilan, et le périmètre réel.

### Priorité P3 — Optimisation (effort M)

9. Découper `/api/coach/dashboard` en endpoints dédiés pour éviter le double-fetch par `coach/sessions` et `coach/students`.

---

## 8. Prompt Windsurf dédié — LOT 3

```
Contexte : Nexus Réussite repo local (/home/alaeddine/Bureau/nexus-project_v0).
Audit 2026-04-19 — LOT 3 Coach IDOR.
Voir docs/AUDIT_SENIOR_2026-04-19/04_DASHBOARD_COACH_IDOR.md pour les preuves.

Tâche : Corriger les 2 failles IDOR sur /api/stages/[stageSlug]/bilans et écrire les tests de non-régression.

SOUS-LOT 3a — IDOR lecture GET bilans :
1. Dans `app/api/stages/[stageSlug]/bilans/route.ts`, handler GET :
   - Si le rôle est COACH, récupérer le coachProfile du user courant
   - Vérifier qu'un StageCoach existe pour (stageId, coachProfile.id) → sinon 403
   - Filtrer les bilans par coachId: coachProfile.id
   - ADMIN et ASSISTANTE restent sans filtre
2. Écrire `__tests__/api/stages.bilans.idor.test.ts` scénario S1

SOUS-LOT 3b — IDOR écriture POST bilans :
3. Dans `app/api/stages/[stageSlug]/bilans/route.ts`, handler POST :
   - Si le rôle est COACH :
     a. Vérifier StageCoach.findFirst({ where: { stageId, coachId: coachProfile.id } }) → sinon 403
     b. Vérifier que parsed.data.studentId correspond à une StageReservation du stage avec richStatus CONFIRMED → sinon 404
   - ADMIN et ASSISTANTE gardent le bypass
4. Écrire tests S2 et S3 dans le même fichier

SOUS-LOT 3c — Tests IDOR existants :
5. Enrichir `__tests__/security/idor.test.ts` avec une section coach/stage/bilan

SOUS-LOT 3d — Documentation :
6. Mettre à jour `docs/21_GUIDE_DASHBOARDS.md` section Coach
7. Documenter la politique availability dans un commentaire en tête de `app/api/coaches/availability/route.ts`

Contraintes :
- Ne pas modifier la prod
- `npm test -- --runInBand __tests__/api/stages.bilans.idor.test.ts __tests__/security/idor.test.ts` doit passer
- `npm run build` doit passer
- Ne pas toucher aux routes session report (déjà sécurisées)
```
