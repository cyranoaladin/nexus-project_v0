# AXE 2 — Routing ambigu, doublons et RBAC de surface

> Audit 2026-04-19. Toutes les preuves citent un fichier et un numéro de ligne.
> Aucune modification effectuée.

---

## 1. Carte de routage réelle

### 1.1 Comptages réels vs artefacts générés

| Source | Pages | API routes | Date |
|--------|-------|-----------|------|
| `find app -name page.tsx` (aujourd'hui) | **86** | — | 2026-04-19 |
| `find app/api -name route.ts` (aujourd'hui) | — | **92** | 2026-04-19 |
| `docs/tests/ROUTE_DIFF.md` | 73 | 80 | 2026-02-22 |
| `docs/_generated/routes.json` | à vérifier | à vérifier | généré |

**ROUTE_DIFF.md est obsolète (57 jours).** Les comptages sont sous-estimés de 13 pages et 12 routes API. Il doit être régénéré.

**Divergence critique dans ROUTE_DIFF.md :** `/programme/*` est listé comme "route documentée absente du code" — FAUX. `app/programme/maths-1ere/page.tsx` et `app/programme/maths-terminale/page.tsx` existent tous les deux en ce moment sur `main`.

### 1.2 Inventaire complet des pages (86 routes)

#### Pages publiques (44)

| Route | Fichier source | Type | Middleware | Note |
|-------|---------------|------|-----------|------|
| `/` | `app/page.tsx` | page | aucun | homepage |
| `/accompagnement-scolaire` | `app/accompagnement-scolaire/page.tsx` | page | aucun | |
| `/academy` | `app/academy/page.tsx` | page | aucun | |
| `/academies-hiver` | `app/academies-hiver/page.tsx` | page | aucun | dead — 301 → `/stages` via `next.config.mjs` |
| `/access-required` | `app/access-required/page.tsx` | page | aucun | |
| `/assessments/[id]/processing` | `app/assessments/[id]/processing/page.tsx` | page | aucun | auth requise côté client |
| `/assessments/[id]/result` | `app/assessments/[id]/result/page.tsx` | page | aucun | |
| `/auth/activate` | `app/auth/activate/page.tsx` | page | redirect si connecté |
| `/auth/mot-de-passe-oublie` | `app/auth/mot-de-passe-oublie/page.tsx` | page | redirect si connecté |
| `/auth/reset-password` | `app/auth/reset-password/page.tsx` | page | redirect si connecté |
| `/auth/signin` | `app/auth/signin/page.tsx` | page | redirect si connecté |
| `/bilan-gratuit` | `app/bilan-gratuit/page.tsx` | page | aucun | |
| `/bilan-gratuit/assessment` | `app/bilan-gratuit/assessment/page.tsx` | page | aucun | |
| `/bilan-gratuit/confirmation` | `app/bilan-gratuit/confirmation/page.tsx` | page | aucun | |
| `/bilan-pallier2-maths` | `app/bilan-pallier2-maths/page.tsx` | page | aucun | |
| `/bilan-pallier2-maths/confirmation` | `app/bilan-pallier2-maths/confirmation/page.tsx` | page | aucun | |
| `/bilan-pallier2-maths/dashboard` | `app/bilan-pallier2-maths/dashboard/page.tsx` | page | aucun | |
| `/bilan-pallier2-maths/resultat/[id]` | `app/bilan-pallier2-maths/resultat/[id]/page.tsx` | page | aucun | |
| `/conditions` | `app/conditions/page.tsx` | redirect | aucun | `redirect('/conditions-generales')` côté serveur — **voir F-P2-03** |
| `/conditions-generales` | `app/conditions-generales/page.tsx` | page | aucun | |
| `/consulting` | `app/consulting/page.tsx` | page | aucun | |
| `/contact` | `app/contact/page.tsx` | page | aucun | |
| `/education` | `app/education/page.tsx` | page | aucun | mort — 301 → `/accompagnement-scolaire` via `next.config.mjs` ET fichier page toujours présent |
| `/equipe` | `app/equipe/page.tsx` | page | aucun | |
| `/famille` | `app/famille/page.tsx` | page | aucun | |
| `/maths-1ere` | `app/maths-1ere/page.tsx` | page | aucun | |
| `/mentions-legales` | `app/mentions-legales/page.tsx` | page | aucun | |
| `/notre-centre` | `app/notre-centre/page.tsx` | page | aucun | |
| `/offres` | `app/offres/page.tsx` | page | aucun | |
| `/planning_stage_printemps` | `app/planning_stage_printemps/page.tsx` | page | aucun | |
| `/plateforme-aria` | `app/plateforme-aria/page.tsx` | page | aucun | |
| `/programme/maths-1ere` | `app/programme/maths-1ere/page.tsx` | page | aucun | présent dans ROUTE_DIFF comme "absent" — **artefact obsolète** |
| `/programme/maths-terminale` | `app/programme/maths-terminale/page.tsx` | page | aucun | idem |
| `/session/video` | `app/session/video/page.tsx` | page | aucun | |
| `/stages` | `app/stages/page.tsx` | page | aucun | |
| `/stages/dashboard-excellence` | `app/stages/dashboard-excellence/page.tsx` | page | aucun | |
| `/stages/fevrier-2026` | `app/stages/fevrier-2026/page.tsx` | page | aucun | **doublon hardcodé** |
| `/stages/fevrier-2026/bilan/[reservationId]` | `app/stages/fevrier-2026/bilan/[reservationId]/page.tsx` | page | aucun | doublon |
| `/stages/fevrier-2026/diagnostic` | `app/stages/fevrier-2026/diagnostic/page.tsx` | page | aucun | doublon |
| `/stages/[stageSlug]` | `app/stages/[stageSlug]/page.tsx` | page | aucun | |
| `/stages/[stageSlug]/bilan/[reservationId]` | `app/stages/[stageSlug]/bilan/[reservationId]/page.tsx` | page | aucun | |
| `/stages/[stageSlug]/diagnostic` | `app/stages/[stageSlug]/diagnostic/page.tsx` | page | aucun | |
| `/stages/[stageSlug]/inscription` | `app/stages/[stageSlug]/inscription/page.tsx` | page | aucun | |
| `/studio` | `app/studio/page.tsx` | page | aucun | |

#### Pages admin (hors dashboard) (2)

| Route | Fichier source | Middleware | Garde locale | Note |
|-------|---------------|-----------|-------------|------|
| `/admin/directeur` | `app/admin/directeur/page.tsx` | ADMIN (L38 middleware.ts) | aucune | **voir F-P1-01** |
| `/admin/stages/fevrier-2026` | `app/admin/stages/fevrier-2026/page.tsx` | ADMIN (L38 middleware.ts) | aucune | |

#### Dashboard ADMIN (9)

| Route | Fichier source | Middleware | Garde locale |
|-------|---------------|-----------|-------------|
| `/dashboard/admin` | `app/dashboard/admin/page.tsx` | ADMIN prefix (L30,48) | useSession (client) |
| `/dashboard/admin/activities` | `app/dashboard/admin/activities/page.tsx` | ADMIN prefix | — |
| `/dashboard/admin/analytics` | `app/dashboard/admin/analytics/page.tsx` | ADMIN prefix | — |
| `/dashboard/admin/documents` | `app/dashboard/admin/documents/page.tsx` | ADMIN prefix | — |
| `/dashboard/admin/facturation` | `app/dashboard/admin/facturation/page.tsx` | ADMIN prefix | — |
| `/dashboard/admin/stages` | `app/dashboard/admin/stages/page.tsx` | ADMIN prefix | — |
| `/dashboard/admin/subscriptions` | `app/dashboard/admin/subscriptions/page.tsx` | ADMIN prefix | — |
| `/dashboard/admin/tests` | `app/dashboard/admin/tests/page.tsx` | ADMIN prefix | — |
| `/dashboard/admin/users` | `app/dashboard/admin/users/page.tsx` | ADMIN prefix | — |

#### Dashboard ASSISTANTE (11)

| Route | Fichier source | Middleware |
|-------|---------------|-----------|
| `/dashboard/assistante` | `app/dashboard/assistante/page.tsx` | ASSISTANTE prefix |
| `/dashboard/assistante/coaches` | `app/dashboard/assistante/coaches/page.tsx` | ASSISTANTE prefix |
| `/dashboard/assistante/credit-requests` | `app/dashboard/assistante/credit-requests/page.tsx` | ASSISTANTE prefix |
| `/dashboard/assistante/credits` | `app/dashboard/assistante/credits/page.tsx` | ASSISTANTE prefix |
| `/dashboard/assistante/docs` | `app/dashboard/assistante/docs/page.tsx` | ASSISTANTE prefix |
| `/dashboard/assistante/paiements` | `app/dashboard/assistante/paiements/page.tsx` | ASSISTANTE prefix |
| `/dashboard/assistante/stages` | `app/dashboard/assistante/stages/page.tsx` | ASSISTANTE prefix |
| `/dashboard/assistante/stages/planning` | `app/dashboard/assistante/stages/planning/page.tsx` | ASSISTANTE prefix |
| `/dashboard/assistante/students` | `app/dashboard/assistante/students/page.tsx` | ASSISTANTE prefix |
| `/dashboard/assistante/subscription-requests` | `app/dashboard/assistante/subscription-requests/page.tsx` | ASSISTANTE prefix |
| `/dashboard/assistante/subscriptions` | `app/dashboard/assistante/subscriptions/page.tsx` | ASSISTANTE prefix |

#### Dashboard COACH (6)

| Route | Fichier source | Middleware |
|-------|---------------|-----------|
| `/dashboard/coach` | `app/dashboard/coach/page.tsx` | COACH prefix |
| `/dashboard/coach/availability` | `app/dashboard/coach/availability/page.tsx` | COACH prefix |
| `/dashboard/coach/sessions` | `app/dashboard/coach/sessions/page.tsx` | COACH prefix |
| `/dashboard/coach/stages` | `app/dashboard/coach/stages/page.tsx` | COACH prefix |
| `/dashboard/coach/stages/[stageSlug]/bilan/[studentId]` | `app/dashboard/coach/stages/[stageSlug]/bilan/[studentId]/page.tsx` | COACH prefix |
| `/dashboard/coach/students` | `app/dashboard/coach/students/page.tsx` | COACH prefix |

#### Dashboard ELEVE (5)

| Route | Fichier source | Middleware |
|-------|---------------|-----------|
| `/dashboard/eleve` | `app/dashboard/eleve/page.tsx` | ELEVE prefix |
| `/dashboard/eleve/mes-sessions` | `app/dashboard/eleve/mes-sessions/page.tsx` | ELEVE prefix |
| `/dashboard/eleve/ressources` | `app/dashboard/eleve/ressources/page.tsx` | ELEVE prefix |
| `/dashboard/eleve/sessions` | `app/dashboard/eleve/sessions/page.tsx` | ELEVE prefix |
| `/dashboard/eleve/stages` | `app/dashboard/eleve/stages/page.tsx` | ELEVE prefix |

#### Dashboard PARENT (6)

| Route | Fichier source | Middleware |
|-------|---------------|-----------|
| `/dashboard/parent` | `app/dashboard/parent/page.tsx` | PARENT prefix |
| `/dashboard/parent/abonnements` | `app/dashboard/parent/abonnements/page.tsx` | PARENT prefix |
| `/dashboard/parent/children` | `app/dashboard/parent/children/page.tsx` | PARENT prefix |
| `/dashboard/parent/paiement` | `app/dashboard/parent/paiement/page.tsx` | PARENT prefix |
| `/dashboard/parent/paiement/confirmation` | `app/dashboard/parent/paiement/confirmation/page.tsx` | PARENT prefix |
| `/dashboard/parent/ressources` | `app/dashboard/parent/ressources/page.tsx` | PARENT prefix |
| `/dashboard/parent/stages` | `app/dashboard/parent/stages/page.tsx` | PARENT prefix |

#### Routes partagées dashboard (2)

| Route | Fichier source | Middleware | Note |
|-------|---------------|-----------|------|
| `/dashboard` | `app/dashboard/page.tsx` | auth requis (L13-18) | redirect client selon rôle — **voir F-P1-02** |
| `/dashboard/trajectoire` | `app/dashboard/trajectoire/page.tsx` | auth seulement (L46 exception) | **voir F-P1-03** |

### 1.3 Divergences entre code réel et artefacts générés

| Artefact | Affirmation | Réalité | Verdict |
|----------|-------------|---------|---------|
| `ROUTE_DIFF.md` (2026-02-22) | 73 pages | 86 pages | **Obsolète — +13 pages** |
| `ROUTE_DIFF.md` | 80 API routes | 92 routes | **Obsolète — +12 routes** |
| `ROUTE_DIFF.md` | `/programme/*` absent du code | Présent (`maths-1ere`, `maths-terminale`) | **Faux positif** |
| `ROUTE_DIFF.md` | `/admin/directeur` non documenté | Présent et actif | Correct mais stale |

---

## 2. Doublons et surfaces concurrentes

### F-P1-01 — `app/(dashboard)/` route group : squelette mort

**Fichier :** `app/(dashboard)/` (répertoire)
**Contenu :** Sous-dossiers `admin/`, `dashboard/eleve/`, `student/eleve/` — **zéro fichier `.tsx` ou `.ts`**

```bash
find 'app/(dashboard)' -type f   → (aucun résultat)
```

Ce route group est un squelette vide issu d'un refactoring abandonné. Il n'expose aucune route, ne cause pas de conflit de routing actif, mais génère de la confusion dans l'arborescence.

**Décision :** Supprimer `app/(dashboard)/` entièrement.
**Impact :** Zéro — aucun fichier actif, aucun test à mettre à jour.
**Effort :** XS

---

### F-P1-02 — Double logique de redirection `/dashboard`

**Fichiers :**
- `middleware.ts` L29-51 : `rolePrefixMap` → redirige `/dashboard/X` si préfixe wrong
- `app/dashboard/page.tsx` L21-38 : `switch(session.user.role)` → `router.push(...)` côté client

`app/dashboard/page.tsx` est un composant client (`'use client'`) qui re-implémente exactement la même table de dispatch que le middleware. La page `/dashboard` s'affiche une fraction de seconde (spinner) avant que le `useEffect` déclenche la redirection.

**Problème :** La redirection côté client crée un flash de la page de chargement. Le middleware ne redirige pas `/dashboard` exactement (il redirige `/dashboard/X` vers le bon préfixe, mais `/dashboard` n'est pas intercepté avant la page).

**Décision :** Convertir `app/dashboard/page.tsx` en Server Component qui fait un `redirect()` direct, ou ajouter `/dashboard` (exact match) dans le middleware pour rediriger immédiatement sans flash.
**Impact :** UX (suppression du spinner), aucun impact sécurité (le middleware protège déjà l'authentification).
**Effort :** S

---

### F-P1-03 — `/dashboard/trajectoire` : exception middleware non bornée par rôle

**Fichier middleware :** `middleware.ts` L44-51
```typescript
if (pathname.startsWith('/dashboard') &&
    pathname !== '/dashboard' &&
    !pathname.startsWith('/dashboard/trajectoire')) {   // ← exception L46
  // ... enforce role prefix
}
```

**Fichier API :** `app/api/student/trajectory/route.ts` L34
```typescript
if (!['ELEVE', 'PARENT', 'ADMIN', 'ASSISTANTE'].includes(role)) {
  return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
}
```

**Gap :** Le middleware laisse passer tout utilisateur authentifié vers `/dashboard/trajectoire`, y compris le rôle COACH. Mais l'API rejette COACH avec 403. Résultat concret : un COACH qui navigue vers `/dashboard/trajectoire` voit la page chargée puis l'état d'erreur "Impossible de charger la trajectoire".

**Problème secondaire :** La page calcule `backLink` avec une logique binaire (L90) :
```typescript
const backLink = userRole === 'PARENT' ? '/dashboard/parent' : '/dashboard/eleve';
```
Un ADMIN ou ASSISTANTE qui atteindrait cette page serait renvoyé vers `/dashboard/eleve`, ce qui est incorrect.

**Décision :**
- Soit étendre l'API pour accepter COACH (lecture de la trajectoire d'un élève assigné) — changement fonctionnel à valider.
- Soit exclure COACH de l'exception middleware (ajouter `role !== 'COACH'` dans la condition L46).
- Soit ajouter un guard explicite dans la page pour COACH et ADMIN/ASSISTANTE sans `?studentId`.
- Le `backLink` doit couvrir tous les rôles (ADMIN → `/dashboard/admin`, COACH → `/dashboard/coach`).

**Effort :** S (correction défensive) / M (si extension fonctionnelle COACH)

---

### F-P1-04 — `/admin/directeur` : surface hors pattern dashboard

**Fichiers :**
- `app/admin/directeur/page.tsx` : dashboard directeur (KPIs, SSN, radar)
- `app/dashboard/admin/page.tsx` : dashboard admin opérationnel (users, revenus, sessions)

**Ce ne sont PAS des doublons fonctionnels.** Les deux pages ont des contenus distincts :
- `/admin/directeur` : vue stratégique (SSN, cohortes, alertes pédagogiques)
- `/dashboard/admin` : vue opérationnelle (users, revenus, abonnements)

**Problème d'architecture :** `/admin/directeur` est hors du pattern de routage dashboard. Aucun layout dashboard ne l'entoure, aucun menu de navigation ne le référence. La page se ferme via "Retour au Dashboard" qui pointe vers `/dashboard` (L355), pas vers `/dashboard/admin`.

**Protection :** Correcte — le middleware L38 bloque les non-ADMIN sur `/admin/*`. L'API `/api/admin/directeur/stats` a une garde inline ADMIN-only (L43-53).

**Décision :** Déplacer vers `/dashboard/admin/directeur` pour normaliser sous le pattern dashboard. Créer un redirect 308 de `/admin/directeur` → `/dashboard/admin/directeur`.
**Effort :** S

---

### F-P1-05 — `/dashboard/eleve/mes-sessions` vs `/dashboard/eleve/sessions` : non-doublon, nommage confus

**Fichiers :**
- `app/dashboard/eleve/mes-sessions/page.tsx` : liste des sessions existantes (lecture)
- `app/dashboard/eleve/sessions/page.tsx` : formulaire de réservation de session (écriture)

**Ce ne sont PAS des doublons.** Fonctions complémentaires :
- `mes-sessions` → afficher l'historique et les sessions à venir (appelle `/api/student/sessions`)
- `sessions` → réserver une nouvelle session (appelle `/api/sessions/book`)

**Problème :** Le nommage est trompeur. `sessions` désigne la création, pas la liste. Un développeur ou un utilisateur cherchant "mes sessions" pourrait atterrir sur le mauvais.

**Décision :** Renommer `sessions` → `reserver` (ou `nouvelle-session`) pour lever l'ambiguïté. Redirect 308 de `/dashboard/eleve/sessions` → `/dashboard/eleve/reserver`.
**Effort :** S

---

### F-P2-01 — `/stages/fevrier-2026` : pages hardcodées dupliquant le pattern dynamique

**Fichiers dupliquant `[stageSlug]` :**
- `app/stages/fevrier-2026/page.tsx`
- `app/stages/fevrier-2026/bilan/[reservationId]/page.tsx`
- `app/stages/fevrier-2026/diagnostic/page.tsx`
- `app/admin/stages/fevrier-2026/page.tsx`

`/stages/fevrier-2026` serait normalement servi par `/stages/[stageSlug]`. La présence d'une route statique hardcodée signifie que Next.js lui donnera **priorité sur le segment dynamique** pour ce slug.

**Impact :** Si `/stages/fevrier-2026` n'est plus actif en prod, c'est du dead code. S'il l'est, la mise à jour requiert de modifier deux endroits.

**Décision :** Vérifier si ces pages ont un contenu différent du dynamique. Si identique → supprimer et laisser `[stageSlug]` gérer. Si spécifique → documenter explicitement.
**Effort :** S

---

### F-P2-02 — `app/education/page.tsx` : page morte sous redirect 301

**Fichier :** `app/education/page.tsx`
**Redirect dans `next.config.mjs` L47-52 :**
```javascript
{ source: '/education', destination: '/accompagnement-scolaire', permanent: true }
```

Next.js exécute les redirects AVANT de servir la page. Le fichier `app/education/page.tsx` ne sera donc jamais rendu. C'est du dead code.

**Décision :** Supprimer `app/education/page.tsx`.
**Effort :** XS

---

### F-P2-03 — `/conditions` : double redirect (next.config + Server Component)

**Fichier :** `app/conditions/page.tsx` L3 : `redirect('/conditions-generales')`
**`next.config.mjs` :** Pas de redirect pour `/conditions`.

La page `/conditions` fait un redirect serveur vers `/conditions-generales`. C'est correct mais redondant avec la logique qui devrait être dans `next.config.mjs`. Le Server Component `redirect()` est moins performant qu'un redirect HTTP 301 configuré.

**Décision :** Optionnel — migrer vers `next.config.mjs`. Pas critique.
**Effort :** XS

---

## 3. Matrice rôle × route réellement accessible

### 3.1 Mécanismes de protection en jeu

| Mécanisme | Fichier | Niveau | Fiabilité |
|-----------|---------|--------|----------|
| Middleware NextAuth | `middleware.ts` | Serveur (Edge) | **Seule source fiable pour les pages** |
| Garde centralisée API | `lib/guards.ts` | Serveur | Fiable quand utilisée |
| Garde inline API | inline `auth()` + cast manuel | Serveur | Fonctionnel mais non-typé |
| Garde client page | `useSession` + `router.push` | Client | **Non fiable seul** — flash possible |

### 3.2 Matrice pages dashboard

| Route | non-auth | ELEVE | PARENT | COACH | ASSISTANTE | ADMIN | Échec | Preuve |
|-------|----------|-------|--------|-------|-----------|-------|-------|--------|
| `/dashboard` | redirect signin | ✓ | ✓ | ✓ | ✓ | ✓ | redirect `/auth/signin` | `middleware.ts` L21-25 |
| `/dashboard/eleve/*` | redirect signin | ✓ | 403→redirect | 403→redirect | 403→redirect | 403→redirect | redirect `rolePrefixMap[role]` | `middleware.ts` L47-50 |
| `/dashboard/parent/*` | redirect signin | redirect | ✓ | redirect | redirect | redirect | redirect `rolePrefixMap[role]` | `middleware.ts` L47-50 |
| `/dashboard/coach/*` | redirect signin | redirect | redirect | ✓ | redirect | redirect | redirect `rolePrefixMap[role]` | `middleware.ts` L47-50 |
| `/dashboard/assistante/*` | redirect signin | redirect | redirect | redirect | ✓ | redirect | redirect `rolePrefixMap[role]` | `middleware.ts` L47-50 |
| `/dashboard/admin/*` | redirect signin | redirect | redirect | redirect | redirect | ✓ | redirect `rolePrefixMap[role]` | `middleware.ts` L47-50 |
| `/dashboard/trajectoire` | redirect signin | ✓ | ✓ | ✓⚠ | ✓ | ✓ | redirect `/auth/signin` | `middleware.ts` L46 exception |
| `/admin/directeur` | redirect signin | redirect | redirect | redirect | redirect | ✓ | redirect `rolePrefixMap[role]` | `middleware.ts` L38-41 |
| `/admin/stages/fevrier-2026` | redirect signin | redirect | redirect | redirect | redirect | ✓ | redirect `rolePrefixMap[role]` | `middleware.ts` L38-41 |

**⚠ COACH sur `/dashboard/trajectoire`** : accès page autorisé par middleware, mais l'API `/api/student/trajectory` retourne 403. La page affiche l'état d'erreur.

### 3.3 Matrice API routes admin (garde effective)

| Endpoint | ELEVE | PARENT | COACH | ASSISTANTE | ADMIN | Mécanisme | Type garde |
|----------|-------|--------|-------|-----------|-------|-----------|-----------|
| `/api/admin/dashboard` | 403 | 403 | 403 | 403 | ✓ | `requireRole(ADMIN)` | centralisé |
| `/api/admin/analytics` | 403 | 403 | 403 | 403 | ✓ | `requireRole(ADMIN)` | centralisé |
| `/api/admin/activities` | 403 | 403 | 403 | 403 | ✓ | `requireRole(ADMIN)` | centralisé |
| `/api/admin/users` | 403 | 403 | 403 | 403 | ✓ | `requireRole(ADMIN)` | centralisé |
| `/api/admin/users/search` | 403 | 403 | 403 | ✓ | ✓ | `requireAnyRole([ADMIN,ASSISTANTE])` | centralisé |
| `/api/admin/subscriptions` | 403 | 403 | 403 | 403 | ✓ | `requireRole(ADMIN)` | centralisé |
| `/api/admin/test-email` | 403 | 403 | 403 | 403 | ✓ | `requireRole(ADMIN)` | centralisé |
| `/api/admin/recompute-ssn` | 403 | 403 | 403 | 403 | ✓ | inline `auth()` + cast string | **non centralisé** |
| `/api/admin/directeur/stats` | 403 | 403 | 403 | 403 | ✓ | inline `auth()` + cast string | **non centralisé** |
| `/api/admin/invoices` (GET/POST) | 403 | 403 | 403 | ✓ | ✓ | inline `auth()` + cast string | **non centralisé** |
| `/api/admin/invoices/[id]` (PATCH) | 403 | 403 | 403 | ✓ | ✓ | inline `auth()` + `canPerformStatusAction()` | **non centralisé** |
| `/api/admin/invoices/[id]/send` (POST) | 403 | 403 | 403 | ✓ | ✓ | inline `auth()` + `canPerformStatusAction()` | **non centralisé** |
| `/api/student/trajectory` | ✓ | ✓ | **403** | ✓ | ✓ | inline `auth()` + allowlist | non centralisé |

### 3.4 Cohérence `lib/guards.ts` vs inline auth

**Problème détecté :** Les routes `/api/admin/invoices*`, `/api/admin/recompute-ssn`, `/api/admin/directeur/stats`, et `/api/student/trajectory` n'utilisent pas `requireRole`/`requireAnyRole` de `lib/guards.ts`. Elles utilisent `await auth()` directement avec un cast de type non typé :

```typescript
const userRole = (session.user as { role?: string }).role;
if (userRole !== 'ADMIN') { ... }  // comparaison string — pas d'enum UserRole
```

**Risque :** Si `UserRole` évolue dans le schéma Prisma, ces comparaisons string ne seront pas détectées par le compilateur TypeScript.

**Verdict :** Fonctionnellement correct (les gardes fonctionnent), mais non-conforme au pattern établi dans `lib/guards.ts` et aux guidelines de `docs/31_RBAC_MATRICE.md`.

---

## 4. Décision d'architecture cible

### 4.1 Branche canonique dashboard

**Décision : `app/dashboard/` est la branche canonique. `app/(dashboard)/` doit être supprimé.**

`app/(dashboard)/` ne contient aucun fichier actif. Sa suppression est sans risque.

### 4.2 Statut `/admin/directeur`

**Décision : Déplacer vers `/dashboard/admin/directeur`.**

Raisons :
- Normalise le pattern de routage (tous les outils admin sous `/dashboard/admin/`)
- Donne accès au layout dashboard (navigation, header)
- Évite la confusion sur la protection (actuellement `/admin/*` middleware, après `/dashboard/admin/*` middleware)

Plan :
1. Créer `app/dashboard/admin/directeur/page.tsx` (copie/déplacement)
2. Ajouter redirect 308 dans `next.config.mjs` : `/admin/directeur` → `/dashboard/admin/directeur`
3. Supprimer `app/admin/directeur/page.tsx`

### 4.3 Statut `/dashboard/trajectoire`

**Décision : Conserver mais corriger le double gap (COACH + backLink).**

La page partagée cross-rôle est un choix produit valide. Les corrections à apporter :

1. Dans `app/dashboard/trajectoire/page.tsx` L90, remplacer la logique binaire par une map complète :
```typescript
const backLinkMap: Record<string, string> = {
  PARENT: '/dashboard/parent',
  COACH: '/dashboard/coach',
  ADMIN: '/dashboard/admin',
  ASSISTANTE: '/dashboard/assistante',
};
const backLink = backLinkMap[userRole ?? ''] ?? '/dashboard/eleve';
```

2. Pour COACH : décider si la page doit afficher une trajectoire (nécessite extension API) ou afficher un état "non applicable". En attendant la décision fonctionnelle, ajouter une redirection COACH dans la page vers `/dashboard/coach`.

### 4.4 Statut `mes-sessions` vs `sessions`

**Décision : Renommer `/dashboard/eleve/sessions` → `/dashboard/eleve/reserver`.**

Les deux pages remplissent des fonctions différentes (liste vs création). Le renommage clarifie l'intention. Redirect 308 `/dashboard/eleve/sessions` → `/dashboard/eleve/reserver`.

### 4.5 Liste des redirects à créer

| Source | Destination | Code | Raison |
|--------|------------|------|--------|
| `/admin/directeur` | `/dashboard/admin/directeur` | 308 | Normalisation pattern |
| `/dashboard/eleve/sessions` | `/dashboard/eleve/reserver` | 308 | Clarté nommage |

### 4.6 Liste des fichiers à supprimer

| Fichier | Raison |
|---------|--------|
| `app/(dashboard)/` (tout le répertoire) | Squelette mort, zéro fichier actif |
| `app/education/page.tsx` | Dead code sous redirect 301 |
| `app/admin/directeur/page.tsx` | Après déplacement vers `/dashboard/admin/directeur` |

### 4.7 Liste des fichiers à déplacer/créer

| Action | Source | Destination |
|--------|--------|------------|
| Déplacer | `app/admin/directeur/page.tsx` | `app/dashboard/admin/directeur/page.tsx` |
| Déplacer | `app/dashboard/eleve/sessions/page.tsx` | `app/dashboard/eleve/reserver/page.tsx` |

### 4.8 Fichiers à migrer (garde inline → centralisée)

| Fichier | Guard actuel | Guard cible |
|---------|-------------|------------|
| `app/api/admin/recompute-ssn/route.ts` | inline ADMIN | `requireRole(UserRole.ADMIN)` |
| `app/api/admin/directeur/stats/route.ts` | inline ADMIN | `requireRole(UserRole.ADMIN)` |
| `app/api/admin/invoices/route.ts` | inline ADMIN+ASSISTANTE | `requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE])` |
| `app/api/admin/invoices/[id]/route.ts` | inline via cast | `requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE])` |
| `app/api/admin/invoices/[id]/send/route.ts` | inline via `canPerformStatusAction()` | `requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE])` |
| `app/api/student/trajectory/route.ts` | inline allowlist | `requireAnyRole([UserRole.ELEVE, UserRole.PARENT, UserRole.ADMIN, UserRole.ASSISTANTE])` |

### 4.9 Ordre recommandé de remédiation

**LOT 1a — Sans risque, suppression dead code (XS, 30 min)**
1. Supprimer `app/(dashboard)/`
2. Supprimer `app/education/page.tsx`
3. Migrer `/conditions` server redirect vers `next.config.mjs`

**LOT 1b — Routing corrections (S, 2h)**
1. Convertir `app/dashboard/page.tsx` en Server Component avec `redirect()` direct
2. Créer `app/dashboard/admin/directeur/page.tsx` (déplacement)
3. Ajouter redirects dans `next.config.mjs`
4. Supprimer `app/admin/directeur/page.tsx` après redirection validée
5. Corriger `backLink` dans `app/dashboard/trajectoire/page.tsx`
6. Ajouter guard COACH dans `/dashboard/trajectoire` page

**LOT 1c — Normalisation gardes API (S, 2h)**
1. Migrer les 6 routes inline vers `requireRole`/`requireAnyRole`
2. Écrire tests manquants pour `/api/admin/invoices*` (3 tests)

**LOT 1d — Nommage `sessions` (S, 1h)**
1. Renommer `dashboard/eleve/sessions/` → `dashboard/eleve/reserver/`
2. Mettre à jour tous les liens internes
3. Ajouter redirect 308

---

## 5. Artefacts générés obsolètes (finding documentaire)

`docs/tests/ROUTE_DIFF.md` est daté du 2026-02-22. Il affirme que `/programme/maths-1ere` et `/programme/maths-terminale` sont absents du code — ce qui est faux. Le rapport est à régénérer via `npm run test:routes` ou l'outil équivalent.

Les comptages dans ce rapport AXE 2 font référence au code sur `main` à la date 2026-04-19 et priment sur tout artefact généré antérieur.
