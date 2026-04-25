# Source de vérité — Dashboard Élève

> Branche : `feat/dashboards-premiere-finalization`
> Dernière mise à jour : 2026-04-25

## 1. Endpoint unique

```
GET /api/student/dashboard
```

- Auth : `requireRole(UserRole.ELEVE)` via `lib/guards.ts`
- Ownership : le payload est **toujours** construit avec `session.user.id` — aucun paramètre externe (`studentId`, query string, body) n'est accepté.
- Cache : `Cache-Control: private, max-age=10`
- Header de debug : `X-Payload-Build-Ms` (durée côté serveur)

## 2. Builder : `buildStudentDashboardPayload`

Fichier : `lib/dashboard/student-payload.ts`

### 2.1 Budget queries Prisma (≤ 12)

| # | Appel Prisma | Mode | Conditionnel |
|---|-------------|------|-------------|
| 1 | `prisma.student.findUnique` (avec includes : user, mathsProgress, sessions, ariaConversations, creditTransactions, badges, survivalProgress) | séquentiel | non |
| 2 | `prisma.mathsProgress.findFirst` | parallel | non |
| 3 | `prisma.bilan.findMany` (bilans récents, WHERE studentMarkdown IS NOT NULL) | parallel | non |
| 4 | `prisma.stageReservation.findMany` | parallel | non |
| 5 | `prisma.userDocument.findMany` | parallel | non |
| 6 | `prisma.entitlement.findMany` (via `getUserEntitlements`) | parallel | non |
| 7 | `prisma.trajectory.findFirst` (via `getActiveTrajectory`) | parallel | non |
| 8a | `prisma.user.findUnique` (via `getNextStep`) | parallel | non |
| 8b | `prisma.sessionBooking.findFirst` (via `computeEleveStep` dans `getNextStep`) | parallel (séquentiel dans getNextStep) | non |
| 9 | `prisma.bilan.findMany` (bilans de stage, WHERE type=STAGE_POST) | séquentiel | oui — seulement si des réservations de stage existent |

**Total : 9 sans stages, 10 avec stages.** ✅ (budget ≤ 12)

> **Note importante (évitée)** : `getNextStep(userId)` était appelé deux fois — une fois dans `Promise.all` et une fois dans `buildFeuilleDeRoute`. Ce doublon a été supprimé : le résultat de `getNextStep` est maintenant passé en paramètre à `buildFeuilleDeRoute` (commit du 2026-04-25).

### 2.2 Performances live (2026-04-25, base e2e locale)

| Profil | `X-Payload-Build-Ms` | Taille payload |
|--------|---------------------|----------------|
| EDS Première (student@example.com) | 37ms | 2.2 KB |
| STMG Première (eleve.stmg@nexus-reussite.com) | 15ms | 3.9 KB |
| EDS Première alt (eleve.eds@nexus-reussite.com) | 13ms | 3.4 KB |
| STMG Première survivalMode (eleve.stmg.survival@nexus-reussite.com) | 18ms | 5.1 KB |

p95 estimé : **< 50ms en local** → cible < 400ms en prod largement tenue.

## 3. Type contrat : `EleveDashboardData`

Fichier : `components/dashboard/eleve/types.ts`

17 clés racine :
```
student, cockpit, trackContent, sessionsCount, nextSession, recentSessions,
lastBilan, recentBilans, upcomingStages, pastStages, resources, ariaStats,
badges, trajectory, automatismes, survivalProgress, credits
```

### Règles de gating par profil

| Champ | EDS | STMG |
|-------|-----|------|
| `automatismes` | non-null si MathsProgress existe | toujours null |
| `survivalProgress` | toujours null | non-null si PREMIERE + survivalMode=true |
| `trackContent.specialties` | non-vide | toujours [] |
| `trackContent.stmgModules` | toujours [] | 4 modules (MATHS_STMG, SGN, MANAGEMENT, DROIT_ECO) |

### Comportements track-spécifiques — Mode Survie

En Mode Survie STMG (`student.survivalMode === true` + `gradeLevel === 'PREMIERE'`), les sections
`EleveResources`, `EleveBilans` et `EleveStages` sont **masquées** du dashboard principal via le
conditionnel `{!isSurvivalMode && ...}` dans `app/dashboard/eleve/page.tsx`.

**Justification** : préserver la focalisation sur le rituel quotidien (SurvivalDashboard) et éviter
la dispersion cognitive. Ces données restent accessibles via les pages dédiées
(`/dashboard/eleve/ressources`, `/dashboard/eleve/bilans`, etc.) qui ne sont pas affectées par ce
conditionnel.

**Scope PR** : les sous-pages `/dashboard/eleve/ressources`, `/sessions`, `/mes-sessions` restent
hors scope de cette PR — elles ne sont pas modifiées et continuent à fonctionner en l'état.

### Trajectory — champs payload étendus (Phase 6.B)

Le champ `trajectory` de `EleveDashboardData` a été étendu pour inclure les métadonnées de la
trajectoire active afin d'alimenter `TrajectoireCard` en mode data (SSoT) :

| Champ | Type | Source |
|-------|------|--------|
| `id` | `string \| null` | `trajectoryData?.id ?? null` |
| `title` | `string \| null` | `trajectoryData?.title ?? null` |
| `progress` | `number` | `trajectoryData?.progress ?? 0` (0–100) |
| `daysRemaining` | `number` | `trajectoryData?.daysRemaining ?? 0` |
| `milestones` | `EleveTrajectoryMilestone[]` | mappés via `toTrajectoryMilestone` |
| `nextMilestoneAt` | `string \| null` | premier jalon UPCOMING/IN_PROGRESS |

`DashboardPilotage` reçoit `trajectoryData` en prop et le transmet à `TrajectoireCard data={...}`,
éliminant le fetch interne `/api/student/trajectory` pour les élèves.

### Automatismes — bootstrap MathsProgress (Cas A)

`MathsProgress` est créé automatiquement via `prisma.mathsProgress.upsert` à la première activité
dans les routes `/api/programme/maths-1ere/progress`, `/maths-terminale/progress`,
`/maths-1ere-stmg/progress`. Avant toute activité, `automatismes` est `null` dans le payload.

`AutomatismesDashboardCard` gère les deux états :
- `automatismes === null` → CTA "Lancer une série" (premier exercice)
- `automatismes !== null` → stats (accuracy, bestStreak, totalAttempted) + CTA "Continuer"

## 4. Hypothèses

- **firstName / lastName** : les champs `User.firstName` et `User.lastName` sont `String?` (nullable) dans le schéma Prisma. Pour les utilisateurs ELEVE actifs, on suppose que ces champs sont remplis. Si null (cas d'un User créé par import partiel), le fallback `?? ''` est appliqué — l'API renvoie une chaîne vide et non une erreur. Ce cas ne devrait pas arriver en production (le flux de création ELEVE impose firstName/lastName).
- **Bilans filtrés** : seuls les bilans avec `studentMarkdown IS NOT NULL` sont retournés — les renders exclusifs parents/nexus sont filtrés côté serveur.
- **Stage bilans** : la requête Q9 n'est exécutée que si l'élève a au moins une réservation de stage (optimisation conditionnelle).

## 5. Route de téléchargement des documents

```
GET /api/student/documents/[id]/download
```

- Ownership strict : `WHERE id = params.id AND userId = session.user.id`
- Lit le fichier depuis `UserDocument.localPath` (chemin absolu hors répertoire public)
- `Cache-Control: private, no-store`
- Fallback Content-Type : `application/octet-stream` si `mimeType` null

## 6. Logs et observabilité

### Dashboard route
```typescript
console.error('[dashboard] payload build failed', err);
```
- ✅ Pas de `session.user.id` ni d'email dans les logs
- ✅ Pas de données PII directement exposées
- ⚠️ À surveiller : certains messages d'erreur Prisma peuvent inclure des valeurs de champs (ex : contrainte unique). En production, un middleware de sanitisation des erreurs Prisma est recommandé avant logging (hors scope de cette PR).

### Download route
```typescript
console.error('[documents/download] file read failed', { id: params.id, err });
```
- `id` est l'identifiant de document (opaque, pas de PII)

## 7. Tests

| Fichier | Assertions | Couverture |
|---------|-----------|------------|
| `__tests__/api/student.dashboard.permissions.test.ts` | 8 | Auth (401/403/200/500), headers, ownership horizontal |
| `__tests__/api/student.dashboard.payload.test.ts` | 26 | Profils EDS/STMG Première/Terminale, credits, bilans, resources, trajectory |
| `__tests__/lib/dashboard/student-payload.builders.test.ts` | 21 | Builders internes (toBilan, toResource, toStageItem, toTrajectoryMilestone, toAutomatismesProgress, computeCredits, buildAlertes) |
| `__tests__/api/student.documents.download.test.ts` | 6 | Auth, 404, ownership, streaming avec fichiers réels, 500, mime fallback |
| **Total** | **61** | |
