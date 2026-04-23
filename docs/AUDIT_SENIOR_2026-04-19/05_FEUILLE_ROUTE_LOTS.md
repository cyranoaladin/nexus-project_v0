# Feuille de route — LOTs de remédiation

> Nexus Réussite — Audit 2026-04-19
> Chaque LOT est autonome, testable, exécutable sans dépendance aux LOTs suivants.

---

## LOT 0 — Hygiène repo et secrets (P0 bloquant)

**Objectif :** Supprimer toute trace de secrets et de clés privées de l'historique git, protéger le repo contre les commits accidentels futurs.

**Durée estimée :** 1h

**Prérequis :** `pip install git-filter-repo`, backup du repo, coordination avec les collaborateurs pour re-clonage.

### Fichiers impactés

| Fichier | Action |
|---------|--------|
| `nginx/ssl/privkey.pem` | Supprimer de l'historique git + untrack |
| `nginx/ssl/fullchain.pem` | Supprimer de l'historique git + untrack |
| `parent.json` | Supprimer de l'historique git (déjà untracked) |
| `student.json` | Supprimer de l'historique git (déjà untracked) |
| `get-users-temp.mjs` | Supprimer de l'historique git (déjà untracked) |
| `arborescence.txt` | Untrack |
| `arborescence_complete.txt` | Untrack |
| `prod-tree-2026-04-19.txt` | Untrack |
| `.gitignore` | Ajouter `nginx/ssl/` + `arborescence*.txt` ← DÉJÀ FAIT |
| `scripts/cleanup-repo.sh` | Créé ← DÉJÀ FAIT |
| `scripts/pre-commit-hook.sh` | Créé ← DÉJÀ FAIT |

### Tests à écrire / faire passer

Après exécution de `--apply` :
1. `git log --all --full-history --oneline -- nginx/ssl/privkey.pem` → doit retourner 0 lignes
2. `git log --all --full-history --oneline -- parent.json` → doit retourner 0 lignes
3. `git log --all --full-history --oneline -- student.json` → doit retourner 0 lignes
4. `git log --all --full-history --oneline -- get-users-temp.mjs` → doit retourner 0 lignes
5. `git ls-files nginx/ssl/` → doit retourner vide
6. `.git/hooks/pre-commit` doit exister et être exécutable
7. Test hook : `echo "NEXTAUTH_SECRET=test" > /tmp/secret.env && git add /tmp/secret.env && git commit` → doit être bloqué

### Critères de succès (mesurables)

- `bash scripts/cleanup-repo.sh` en dry-run : aucune ligne `[WARN] SENSIBLE`
- `git log --all --full-history --oneline -- nginx/ssl/privkey.pem | wc -l` == 0
- `git ls-files nginx/ssl/ | wc -l` == 0
- Pre-commit hook actif et bloquant les patterns de secrets
- Certificat SSL régénéré (à vérifier manuellement)
- SMTP_PASSWORD changé (à vérifier manuellement)

### Prompt Windsurf dédié

```
Contexte : Nexus Réussite repo local (/home/alaeddine/Bureau/nexus-project_v0).
Audit 2026-04-19 — LOT 0 Hygiène repo.
Repo authoritative confirmé : cyranoaladin/nexus-project_v0 (voir 00b_REPO_CONSOLIDATION.md).

Tâche : Exécuter le nettoyage complet du repo git sur deux périmètres.

PÉRIMÈTRE 1 — Repo local + GitHub :
1. Lancer `bash scripts/cleanup-repo.sh --apply`
2. Force-push : `git push origin --force --all && git push origin --force --tags`
3. Installer le pre-commit hook : `cp scripts/pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit`
4. Vérifier : `git log --all --full-history --oneline -- nginx/ssl/privkey.pem | wc -l` == 0

PÉRIMÈTRE 2 — Serveur prod 88.99.254.59, répertoire /opt/nexus/ :
5. SSH root@88.99.254.59 → cd /opt/nexus
6. `git fetch origin && git reset --hard origin/main` (après force-push du step 2)
7. `rm -f nginx/ssl/privkey.pem nginx/ssl/fullchain.pem`
8. Vérifier : `ls /opt/nexus/nginx/ssl/` → vide ou absent

PÉRIMÈTRE 3 — Credentials :
9. Générer un nouveau NEXTAUTH_SECRET : `openssl rand -base64 32` → mettre à jour `.env.production`
10. Changer SMTP_PASSWORD sur Hostinger
11. Régénérer RAG_API_TOKEN sur rag-api.nexusreussite.academy
12. Régénérer certificat SSL (Let's Encrypt) + déployer sans le committer dans git

PÉRIMÈTRE 4 — GitHub nexus-reussite-app :
13. Archiver le repo sur GitHub : Settings → Danger Zone → Archive this repository

Contraintes :
- Ne pas committer `.env.production`
- Ne jamais utiliser `--no-verify`
- Documenter chaque action dans un commit propre
- Ne pas modifier /opt/eaf/ (hors scope)
```

---

## LOT 1 — Routing et normalisation RBAC de surface

**Objectif :** Supprimer le dead code de routing, normaliser les gardes API, corriger les incohérences rôle×route.

**Durée estimée :** 4-5h (4 sous-lots indépendants)

### LOT 1a — Dead code routing (XS, 30 min)

**Fichiers :**
- Supprimer `app/(dashboard)/` (répertoire vide — 0 fichier actif)
- Supprimer `app/education/page.tsx` (dead code sous redirect 301)
- Migrer `app/conditions/page.tsx` → règle `next.config.mjs`

**Critères :** `find 'app/(dashboard)' -type f | wc -l == 0` (après suppression), build OK.

### LOT 1b — Redirects et déplacement `/admin/directeur` (S, 2h)

**Fichiers impactés :**
- Créer `app/dashboard/admin/directeur/page.tsx` (déplacement depuis `app/admin/directeur/page.tsx`)
- Ajouter dans `next.config.mjs` redirects :
  - `/admin/directeur` → `/dashboard/admin/directeur` (308)
  - `/dashboard/eleve/sessions` → `/dashboard/eleve/reserver` (308)
- Convertir `app/dashboard/page.tsx` en Server Component avec `redirect()` direct
- Corriger `backLink` dans `app/dashboard/trajectoire/page.tsx` L90 (map complète des rôles)
- Ajouter guard COACH dans `app/dashboard/trajectoire/page.tsx` (redirect `/dashboard/coach`)

**Tests à écrire :**
- `__tests__/routing/trajectoire-coach.test.ts` — vérifie que COACH sur `/dashboard/trajectoire` est redirigé
- `__tests__/routing/admin-directeur-redirect.test.ts` — vérifie 308

**Critères :**
- `curl -I /admin/directeur` → 308 + Location: `/dashboard/admin/directeur`
- COACH naviguant vers `/dashboard/trajectoire` → redirect `/dashboard/coach`
- Aucun flash spinner sur `/dashboard` pour un utilisateur authentifié

### LOT 1c — Normalisation gardes API (S, 2h)

**Fichiers à migrer :**
- `app/api/admin/recompute-ssn/route.ts` : inline → `requireRole(UserRole.ADMIN)`
- `app/api/admin/directeur/stats/route.ts` : inline → `requireRole(UserRole.ADMIN)`
- `app/api/admin/invoices/route.ts` : inline → `requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE])`
- `app/api/admin/invoices/[id]/route.ts` : inline → `requireAnyRole([...])`
- `app/api/admin/invoices/[id]/send/route.ts` : inline → `requireAnyRole([...])`
- `app/api/student/trajectory/route.ts` : inline → `requireAnyRole([...])`

**Tests à écrire :** 3 tests manquants pour `/api/admin/invoices*` (GET, POST, PATCH).

**Critères :**
- `grep -r "session.user as.*role.*string" app/api/` → 0 résultats
- Tests invoices passent

### LOT 1d — Renommage `sessions` → `reserver` (S, 1h)

**Fichiers :**
- Déplacer `app/dashboard/eleve/sessions/page.tsx` → `app/dashboard/eleve/reserver/page.tsx`
- Mettre à jour tous les liens internes pointant vers `/dashboard/eleve/sessions`
- Ajouter redirect 308 dans `next.config.mjs`

**Critères :** `grep -r "/dashboard/eleve/sessions" app/ --include="*.tsx"` → 0 résultats (sauf la définition du redirect)

### Prompt Windsurf dédié LOT 1

```
Contexte : Nexus Réussite repo local (/home/alaeddine/Bureau/nexus-project_v0).
Audit 2026-04-19 — LOT 1 Routing et normalisation RBAC.
Voir docs/AUDIT_SENIOR_2026-04-19/02_ROUTING_ET_DOUBLONS.md pour les détails.

Tâche : Exécuter les 4 sous-lots dans l'ordre suivant :

LOT 1a (dead code) :
1. rm -rf app/(dashboard)/
2. rm app/education/page.tsx
3. Migrer app/conditions/page.tsx → règle next.config.mjs (/conditions → /conditions-generales, 308)
4. Vérifier build : npm run build

LOT 1b (redirects + corrections) :
5. Créer app/dashboard/admin/directeur/page.tsx (copie de app/admin/directeur/page.tsx avec layout dashboard)
6. Supprimer app/admin/directeur/page.tsx après validation
7. Ajouter redirects dans next.config.mjs :
   { source: '/admin/directeur', destination: '/dashboard/admin/directeur', permanent: true }
   { source: '/dashboard/eleve/sessions', destination: '/dashboard/eleve/reserver', permanent: true }
8. Convertir app/dashboard/page.tsx en Server Component : import { redirect } from 'next/navigation'; + switch role → redirect()
9. Corriger backLink dans app/dashboard/trajectoire/page.tsx L90 avec map complète rôles
10. Ajouter : if (userRole === 'COACH') { router.push('/dashboard/coach'); return; }

LOT 1c (gardes API) :
11. Dans chaque route listée, remplacer inline auth() par requireRole/requireAnyRole depuis lib/guards.ts
12. Ajouter isErrorResponse check après chaque garde
13. Écrire tests : __tests__/api/admin.invoices.route.test.ts (GET, POST, PATCH, 401, 403)

LOT 1d (renommage) :
14. mv app/dashboard/eleve/sessions/ app/dashboard/eleve/reserver/
15. Mettre à jour les imports et liens internes
16. Ajouter redirect dans next.config.mjs

Contraintes :
- Ne pas modifier la logique métier des routes, seulement les gardes et la structure
- Chaque sous-lot fait l'objet d'un commit séparé
- npm run build doit passer après chaque sous-lot
- Ne pas toucher aux tests e2e existants avant LOT 1c
```

---

## LOT 2 — Dashboard élève et cockpit pédagogique (P1)

**Objectif :** Réunifier l’expérience élève autour d’un contrat serveur stable, supprimer les champs calculés mais non rendus, et corriger les incohérences de navigation du cockpit Maths Première.

**Durée estimée :** 1,5 à 2 jours

### LOT 2a — Contrat cockpit élève unique (M, 4h)

**Fichiers impactés :**
- `app/api/student/dashboard/route.ts`
- `app/dashboard/eleve/page.tsx`
- `components/dashboard/DashboardPilotage.tsx`
- `components/dashboard/CapActuelCard.tsx`
- `components/dashboard/NextStepCard.tsx`
- `components/dashboard/NexusIndexCard.tsx`
- `components/dashboard/EvolutionCard.tsx`
- `components/dashboard/SynthesisCard.tsx`

**Tâche :** Remplacer le fan-out client par un contrat unique renvoyant en une réponse les données de cockpit nécessaires au rendu initial.

**Tests à écrire :**
- `__tests__/api/student.dashboard.contract.test.ts` — contrat complet avec `nextSession`, `credits`, `badges`, `trajectory`, `nextStep`, `nexusIndex`
- `__tests__/dashboard/eleve.render.test.tsx` — vérifie le rendu des blocs obligatoires quand le payload est complet

**Critères de succès :**
- Le chargement de `/dashboard/eleve` n’émet plus que `GET /api/student/dashboard` côté cockpit métier
- `nextSession`, `credits.balance` et `badges` sont visibles à l’écran
- Aucun composant stratégique ne fetch individuellement son endpoint au montage

### LOT 2b — Rendu des champs manquants et états vides explicites (S, 3h)

**Fichiers impactés :**
- `app/dashboard/eleve/page.tsx`
- `components/dashboard/NexusIndexCard.tsx`
- `components/dashboard/NextStepCard.tsx`
- `components/dashboard/EvolutionCard.tsx`
- `components/dashboard/SynthesisCard.tsx`

**Tâche :** Afficher explicitement les champs déjà calculés mais perdus, et remplacer les échecs silencieux par des états vides instrumentés.

**Tests à écrire :**
- `__tests__/dashboard/eleve.empty-states.test.tsx`
- `__tests__/dashboard/eleve.api-degraded.test.tsx`

**Critères de succès :**
- Un état “pas de donnée” est distingué d’un état “erreur de chargement”
- Les cartes ne retournent plus `null` en silence
- Le dashboard affiche une prochaine séance, un solde de crédits et un compteur de badges quand les données existent

### LOT 2c — Cockpit Maths Première : cohérence navigation et stage (S, 3h)

**Fichiers impactés :**
- `app/programme/maths-1ere/config/stage.ts`
- `app/programme/maths-1ere/components/Cockpit/HeroPedagogique.tsx`
- `app/programme/maths-1ere/components/Cockpit/SeanceDuJour.tsx`
- `app/programme/maths-1ere/data.ts`

**Tâche :** Corriger les ids de chapitres du planning, sécuriser les CTA de séance et aligner les liens cockpit ↔ programme.

**Tests à écrire :**
- `__tests__/programme/maths-1ere.stage-links.test.ts` — tous les `chapitresClés` doivent exister dans `programmeData`
- `e2e/programme/maths-1ere-seance-navigation.spec.ts` — le clic “LANCER LA SÉANCE” doit ouvrir un chapitre existant

**Critères de succès :**
- `suites-numeriques`, `derivation-variations`, `probabilites-conditionnelles` disparaissent du stage config
- Les CTA de séance pointent uniquement vers des `chapId` existants
- Aucun `ChapterView` ne tombe à `null` après navigation depuis le cockpit

### LOT 2d — Garde-fous UX et observabilité (S, 2h)

**Fichiers impactés :**
- `app/dashboard/eleve/page.tsx`
- `components/dashboard/*`
- `e2e/student-dashboard.spec.ts`

**Tâche :** Ajouter instrumentation minimale et assertions réseau/visuelles pour empêcher le retour des placeholders neutres non assumés.

**Tests à écrire :**
- assertion e2e sur le nombre d’appels cockpit
- assertion visuelle sur la présence des blocs obligatoires

**Critères de succès :**
- L’e2e échoue si le cockpit dépasse le budget de requêtes défini
- Les blocs obligatoires du dashboard élève sont contrôlés en test

### Prompt Windsurf dédié LOT 2

```
Contexte : Nexus Réussite repo local (/home/alaeddine/Bureau/nexus-project_v0).
Audit 2026-04-19 — LOT 2 Dashboard élève.
Voir docs/AUDIT_SENIOR_2026-04-19/03_DASHBOARD_ELEVE.md pour les preuves.

Tâche : Réunifier le dashboard élève et supprimer les incohérences cockpit.

SOUS-LOT 2a — contrat unique :
1. Étendre / refondre `app/api/student/dashboard/route.ts` pour inclure le cockpit initial complet
2. Supprimer les fetchs individuels au montage depuis `components/dashboard/*`
3. Adapter `app/dashboard/eleve/page.tsx` pour consommer un seul payload serveur
4. Écrire `__tests__/api/student.dashboard.contract.test.ts`

SOUS-LOT 2b — rendu et empty states :
5. Afficher `nextSession`, `credits.balance`, `badges`
6. Remplacer tous les `return null` silencieux des cartes cockpit par un état explicite
7. Écrire `__tests__/dashboard/eleve.empty-states.test.tsx`

SOUS-LOT 2c — cockpit Première :
8. Corriger dans `app/programme/maths-1ere/config/stage.ts` les ids de chapitres invalides :
   - `suites-numeriques` → `suites`
   - `derivation-variations` → `derivation`
   - `probabilites-conditionnelles` → `probabilites-cond`
9. Ajouter un test de cohérence stage ↔ programme
10. Vérifier le clic “LANCER LA SÉANCE” en e2e

SOUS-LOT 2d — observabilité :
11. Ajouter une assertion e2e sur le budget de requêtes du dashboard élève
12. Vérifier que le dashboard affiche explicitement erreur / vide / data

Contraintes :
- Ne pas modifier la prod
- Ne pas toucher à la logique RAG profonde dans ce LOT
- Préserver `/programme/maths-1ere` tant que le dashboard unifié n’est pas complet et testé
- `npm test -- --runInBand ...` et `npm run build` doivent passer
```

---

## LOT 3 — Dashboard coach — IDOR bilans et cloisonnement (P0)

**Objectif :** Corriger les 2 failles IDOR sur `/api/stages/[stageSlug]/bilans`, ajouter les tests de non-régression, et documenter les choix d'exposition de la disponibilité coach.

**Durée estimée :** 3-4h (4 sous-lots)

**Référence :** `04_DASHBOARD_COACH_IDOR.md` — findings F-AXE4-01 à F-AXE4-10.

### LOT 3a — IDOR lecture GET bilans (S, 1h)

**Fichiers impactés :**
- `app/api/stages/[stageSlug]/bilans/route.ts` — handler GET

**Tâche :** Pour le rôle COACH, ajouter un filtre de propriété :
1. Récupérer le `coachProfile` du user courant
2. Vérifier qu'un `StageCoach` existe pour `(stageId, coachProfile.id)` → sinon 403
3. Filtrer les bilans par `coachId: coachProfile.id`
4. ADMIN et ASSISTANTE gardent l'accès complet (pas de filtre)

**Critères de succès :**
- Coach A appelant `GET /api/stages/stage-de-coach-B/bilans` → 403
- Coach A appelant `GET /api/stages/son-stage/bilans` → 200 avec uniquement ses bilans
- ADMIN appelant `GET /api/stages/n-importe-quel-stage/bilans` → 200 complet

### LOT 3b — IDOR écriture POST bilans (S, 1h)

**Fichiers impactés :**
- `app/api/stages/[stageSlug]/bilans/route.ts` — handler POST

**Tâche :** Ajouter 2 gardes pour le rôle COACH :
1. Vérifier `StageCoach.findFirst({ where: { stageId, coachId: coachProfile.id } })` → sinon 403
2. Vérifier que `parsed.data.studentId` correspond à une `StageReservation` confirmée du stage → sinon 404
3. ADMIN et ASSISTANTE gardent le bypass

**Critères de succès :**
- Coach A postant un bilan sur le stage de Coach B → 403
- Coach A postant un bilan pour un étudiant non inscrit au stage → 404
- Coach A postant un bilan pour son propre stage et un élève inscrit → 200
- Upsert ne peut plus écraser un bilan d'un autre coach (vérification `coachId` dans le `where` de l'update)

### LOT 3c — Tests IDOR (S, 1-2h)

**Fichiers à créer :**
- `__tests__/api/stages.bilans.idor.test.ts`

**Tests à écrire :**

| # | Scénario | Résultat attendu |
|---|----------|-----------------|
| T1 | Coach A GET bilans du stage de Coach B | 403 |
| T2 | Coach A POST bilan sur stage non assigné | 403 |
| T3 | Coach A POST bilan pour studentId non inscrit au stage | 404 |
| T4 | Coach A GET bilans de son propre stage | 200 + bilans filtrés |
| T5 | Coach A POST bilan pour son stage et élève inscrit | 200 |
| T6 | ADMIN GET bilans de n'importe quel stage | 200 complet |
| T7 | ASSISTANTE POST bilan bypass | 200 |
| T8 | Non authentifié GET bilans | 401 |
| T9 | ELEVE GET bilans | 403 |

**Enrichir :**
- `__tests__/security/idor.test.ts` — nouvelle section "IDOR — Coach/Stage/Bilan" avec scénarios T1/T2/T3

**Critères de succès :**
- `npm test -- --runInBand __tests__/api/stages.bilans.idor.test.ts` → 9/9 pass
- `npm test -- --runInBand __tests__/security/idor.test.ts` → all pass
- `npm run build` → 0 erreurs

### LOT 3d — Documentation et hygiène (XS, 30min)

**Fichiers impactés :**
- `docs/21_GUIDE_DASHBOARDS.md` — section Coach
- `app/api/coaches/availability/route.ts` — commentaire en-tête

**Tâche :**
1. Mettre à jour `docs/21_GUIDE_DASHBOARDS.md` section Coach pour refléter :
   - `/dashboard/coach/stages` (page stages + bilans)
   - API `/api/coach/stages` et `/api/stages/{slug}/bilans`
   - Politique d'accès bilans (coach voit uniquement ses bilans, staff voit tout)
2. Documenter la politique d'exposition de la disponibilité coach dans un commentaire JSDoc en tête de `app/api/coaches/availability/route.ts` :
   ```
   // POLICY: GET availability is accessible to any authenticated user.
   // This is intentional to allow parents/students to view coach availability
   // for booking purposes. Coaches can only view their own availability.
   ```
3. Décider si `creditBalance` doit être retiré du payload `/api/coach/dashboard` (ou documenter le choix produit)

**Critères de succès :**
- `docs/21_GUIDE_DASHBOARDS.md` mentionne `/dashboard/coach/stages`, `/api/stages/{slug}/bilans`, politique d'accès
- Le commentaire JSDoc existe dans `availability/route.ts`

### Prompt Windsurf dédié LOT 3

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
2. Écrire `__tests__/api/stages.bilans.idor.test.ts` scénario T1, T4, T6, T8, T9

SOUS-LOT 3b — IDOR écriture POST bilans :
3. Dans `app/api/stages/[stageSlug]/bilans/route.ts`, handler POST :
   - Si le rôle est COACH :
     a. Vérifier StageCoach.findFirst({ where: { stageId, coachId: coachProfile.id } }) → sinon 403
     b. Vérifier que parsed.data.studentId correspond à une StageReservation du stage → sinon 404
   - ADMIN et ASSISTANTE gardent le bypass
4. Écrire tests T2, T3, T5, T7 dans le même fichier

SOUS-LOT 3c — Tests IDOR existants :
5. Enrichir `__tests__/security/idor.test.ts` avec une section coach/stage/bilan (T1, T2, T3)

SOUS-LOT 3d — Documentation :
6. Mettre à jour `docs/21_GUIDE_DASHBOARDS.md` section Coach
7. Documenter la politique availability dans un commentaire JSDoc en tête de `app/api/coaches/availability/route.ts`

Contraintes :
- Ne pas modifier la prod
- `npm test -- --runInBand __tests__/api/stages.bilans.idor.test.ts __tests__/security/idor.test.ts` doit passer
- `npm run build` doit passer
- Ne pas toucher aux routes session report (déjà sécurisées)
```

---

## LOT 4 — Dashboard assistante/admin (P0 + P1 + P2)

> Source : `05_DASHBOARD_ASSISTANTE_ADMIN.md`. 12 findings, 11 remédiations.

### Périmètre

| # | Sévérité | Description | Effort |
|---|----------|-------------|--------|
| R1 | **P0** | Fix IDOR activate-student — vérif parentalité PARENT | 1h |
| R2 | **P1** | ADMIN accès aux 6 routes assistant (`!== 'ASSISTANTE'` → `['ADMIN', 'ASSISTANTE']`) | 30min |
| R3 | **P1** | RBAC + ownership check sur `/api/assessments/predict` | 1h |
| R4 | **P2** | Restreindre `test-email` send_test à ADMIN only + rate limit | 30min |
| R5 | **P2** | `subscriptions` approve dans `$transaction` | 15min |
| R6 | **P2** | Zod schemas pour 3 POST assistant | 1h |
| R7 | **P2** | Refactor credit-requests approve : status au lieu de type mutation | 2h |
| R8 | **P2** | MAJ `31_RBAC_MATRICE.md` + `complete-matrix.test.ts` | 1h |
| R9 | **P3** | Documenter exclusion `/api/*` du middleware | 15min |
| R10 | **P3** | Tests pour `/api/assistant/stages` | 30min |
| R11 | **P3** | Documenter coefficients predictSSN | 15min |

### Sous-lots

**4a — P0 : Fix IDOR activate-student**
Fichier : `app/api/assistant/activate-student/route.ts`
- Après le 403 check (L40), si `session.user.role === 'PARENT'` :
  - Récupérer `parentProfile` avec `children`
  - Vérifier `studentUserId ∈ parentProfile.children.map(c => c.userId)` → sinon 403
- ADMIN/ASSISTANTE : pas de filtre (comportement actuel)
- Tests : PARENT propre enfant → 200, PARENT autre enfant → 403, ADMIN n'importe quel élève → 200

**4b — P1 : ADMIN accès routes assistant**
6 fichiers, 10 occurrences de `session.user.role !== 'ASSISTANTE'` → `!['ADMIN', 'ASSISTANTE'].includes(session.user.role)` :
1. `assistant/credit-requests/route.ts` (L11, L76)
2. `assistant/subscription-requests/route.ts` (L11, L78)
3. `assistant/subscriptions/route.ts` (L11, L119)
4. `assistant/dashboard/route.ts` (L11)
5. `assistant/coaches/route.ts` (L12)
6. `assistant/students/credits/route.ts` (L12)
Tests : ajouter cas ADMIN → 200 dans chaque test file

**4c — P1 : RBAC assessments/predict**
Fichier : `app/api/assessments/predict/route.ts`
- ADMIN/ASSISTANTE/COACH : bypass ownership
- ELEVE : vérifier `student.id === body.studentId`
- PARENT : vérifier `body.studentId ∈ parentProfile.children.map(c => c.id)`
- Autres : 403

**4d — P2 : Fixes mineurs**
- `test-email/route.ts` POST send_test : ADMIN only ou rate limit
- `subscriptions/route.ts` POST : wrapper dans `$transaction`
- Créer `lib/validation/assistant.ts` avec Zod schemas + intégrer

**4e — Documentation**
- MAJ `31_RBAC_MATRICE.md` (test-email, invoices, documents != ADMIN-only)
- MAJ `complete-matrix.test.ts` (séparer admin-only vs admin+assistante shared)
- Documenter dans middleware.ts que `/api/*` est exclu par design

### Prompt Windsurf

```
Contexte : Nexus Réussite repo local (/home/alaeddine/Bureau/nexus-project_v0).
Audit 2026-04-19 — LOT 4 Assistante/Admin RBAC.
Voir docs/AUDIT_SENIOR_2026-04-19/05_DASHBOARD_ASSISTANTE_ADMIN.md.

═══ SOUS-LOT 4a — P0 : Fix IDOR activate-student ═══

Fichier : app/api/assistant/activate-student/route.ts

Changements requis :
1. Après L40 (403 check), si le rôle est PARENT :
   a. Récupérer le parentProfile :
      prisma.parentProfile.findUnique({ where: { userId: session.user.id }, include: { children: true } })
   b. Vérifier que parsed.data.studentUserId est dans parentProfile.children.map(c => c.userId)
      → si non : retourner 403 "Vous ne pouvez activer que vos propres enfants"
2. ADMIN et ASSISTANTE : bypass cette vérification (comportement actuel)

Test : ajouter dans __tests__/api/assistant.activate-student.route.test.ts :
- PARENT active son propre enfant → 200
- PARENT active un élève qui n'est pas son enfant → 403
- ADMIN active n'importe quel élève → 200

═══ SOUS-LOT 4b — P1 : ADMIN accès routes assistant ═══

Fichiers : 6 routes assistant.

Pour chaque fichier, remplacer le pattern :
  if (!session || session.user.role !== 'ASSISTANTE') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
par :
  if (!session || !['ADMIN', 'ASSISTANTE'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

Routes concernées :
1. app/api/assistant/credit-requests/route.ts (GET L11, POST L76)
2. app/api/assistant/subscription-requests/route.ts (GET L11, PATCH L78)
3. app/api/assistant/subscriptions/route.ts (GET L11, POST L119)
4. app/api/assistant/dashboard/route.ts (GET L11)
5. app/api/assistant/coaches/route.ts (GET L12)
6. app/api/assistant/students/credits/route.ts (GET L12)

Tests : dans chaque test file assistant.*.route.test.ts, ajouter :
- ADMIN accède → 200

═══ SOUS-LOT 4c — P1 : RBAC sur /api/assessments/predict ═══

Fichier : app/api/assessments/predict/route.ts

Changements requis :
1. Après L22 (auth check), ajouter un role + ownership check :
   - ADMIN, ASSISTANTE, COACH : accès libre (staff)
   - ELEVE : vérifier que student.id === body.studentId
   - PARENT : vérifier que body.studentId ∈ parentProfile.children.map(c => c.id)
   - Sinon : 403

Tests : ajouter dans assessments.predict.route.test.ts :
- ELEVE prédit pour lui-même → 200
- ELEVE prédit pour un autre élève → 403
- PARENT prédit pour son enfant → 200
- PARENT prédit pour un autre élève → 403
- ADMIN prédit pour n'importe qui → 200

═══ SOUS-LOT 4d — P2 : Fixes mineurs ═══

1. app/api/admin/test-email/route.ts :
   - POST handler L12 : changer ['ADMIN', 'ASSISTANTE'] à ['ADMIN'] pour l'action send_test
   - OU : ajouter RateLimitPresets.expensive avant l'envoi

2. app/api/assistant/subscriptions/route.ts L178-196 :
   - Wrapper subscription.update + creditTransaction.create dans prisma.$transaction

3. Créer lib/validation/assistant.ts avec schemas Zod :
   creditRequestActionSchema, subscriptionActionSchema, subscriptionRequestActionSchema
   Puis les utiliser avec .safeParse(body) dans les 3 routes POST/PATCH assistant

═══ SOUS-LOT 4e — Documentation ═══

1. docs/31_RBAC_MATRICE.md :
   - Corriger la matrice endpoints (test-email, invoices, documents = ADMIN+ASSISTANTE)
   - Supprimer la section "sans preuve de test" (3 tests invoice existent)
   - Ajouter distinction "routes assistant : ASSISTANTE + ADMIN"
   - Documenter que middleware exclut /api/*

2. __tests__/rbac/complete-matrix.test.ts :
   - Séparer adminRoutes (ADMIN only) et sharedRoutes (ADMIN+ASSISTANTE)
   - Corriger tests assistant pour tester les routes réelles (pas juste guards)

Contraintes :
- Ne pas modifier la prod
- npm test -- --runInBand __tests__/api/assistant.activate-student.route.test.ts → pass
- npm test -- --runInBand __tests__/rbac/complete-matrix.test.ts → pass
- npm run build → 0 erreurs
- Chaque sous-lot = 1 commit séparé
```

---

## LOT 5 — Base de données : Supabase exit + raw SQL cleanup (P1)

> Source : `06_PRISMA_PGVECTOR_SUPABASE.md` — AXE 6
> Findings traités : F7, F16, F17, F18, F20, F21, F22, F23, F25

### Périmètre

| Sous-lot | Priorité | Findings | Description |
|---|---|---|---|
| 5a | P0 | F7, F16, F17, F22 | **Supabase exit** — Créer modèle `MathsProgress` dans Prisma, réécrire les API routes et le hook de sync, supprimer le fallback Supabase |
| 5b | P1 | F18, F21 | **Raw SQL → Prisma client typé** — Remplacer 8 usages `$executeRawUnsafe`/`$queryRawUnsafe` injustifiés par des appels Prisma typés |
| 5c | P2 | F20, F23, F25 | **Nettoyage** — Colonne `embedding` legacy, SQL commenté CdC, documentation badges |

### SOUS-LOT 5a — Supabase exit + modèle Prisma progression

| Étape | Fichier(s) | Changement |
|---|---|---|
| 1 | `prisma/schema.prisma` | Créer modèle `MathsProgress` avec `@@unique([userId, level])`, colonne `level` (PREMIERE/TERMINALE), tous les champs de `maths_lab_progress` |
| 2 | `prisma/schema.prisma` | Ajouter relation `mathsProgress MathsProgress[]` sur `User` |
| 3 | migration | `npx prisma migrate dev --name add_maths_progress` |
| 4 | `app/api/programme/maths-1ere/progress/route.ts` | POST : `prisma.mathsProgress.upsert({ where: { userId_level }, ... })`. GET : `prisma.mathsProgress.findUnique(...)`. Supprimer toute réf Supabase. |
| 5 | `app/api/programme/maths-terminale/progress/route.ts` | Idem avec `level: 'TERMINALE'` |
| 6 | `app/programme/maths-1ere/hooks/useProgressionSync.ts` | Hydratation : `fetch GET /api/programme/maths-1ere/progress`. Sync : `fetch POST`. Supprimer fallback `saveProgress()` vers Supabase. |
| 7 | `app/programme/maths-1ere/lib/supabase.ts` | Supprimer ou vider (garder si d'autres modules l'utilisent, sinon supprimer) |

**Tests** :
- `__tests__/api/programme.maths-1ere.progress.route.test.ts` : POST valide → 200 + DB, POST sans auth → 401, GET existant → 200 + data, GET vide → 200 + null
- `__tests__/api/programme.maths-terminale.progress.route.test.ts` : idem

### SOUS-LOT 5b — Raw SQL → Prisma client typé

| # | Fichier | Avant (raw SQL) | Après (Prisma client) |
|---|---------|----------------|----------------------|
| 1 | `lib/core/ssn/computeSSN.ts:192` | `$executeRawUnsafe UPDATE ssn` | `prisma.assessment.update({ where: { id }, data: { ssn } })` |
| 2 | `lib/core/ssn/computeSSN.ts:199` | `$queryRawUnsafe SELECT studentId` | `prisma.assessment.findUnique({ where: { id }, select: { studentId: true } })` |
| 3 | `lib/core/ssn/computeSSN.ts:208` | `$executeRawUnsafe INSERT progression_history` | `prisma.progressionHistory.create({ data: { studentId, ssn } })` |
| 4 | `lib/core/ssn/computeSSN.ts:264` | `$executeRawUnsafe UPDATE ssn (batch)` | `prisma.assessment.update({ where: { id }, data: { ssn } })` |
| 5 | `lib/core/ml/predictSSN.ts:230` | `$queryRawUnsafe SELECT progression_history` | `prisma.progressionHistory.findMany({ where, orderBy, select })` |
| 6 | `lib/core/ml/predictSSN.ts:264` | `$executeRawUnsafe INSERT projection_history` | `prisma.projectionHistory.create({ data: { ... } })` |
| 7 | `lib/core/uai/computeUAI.ts:143` | `$executeRawUnsafe UPDATE uai` | `prisma.assessment.update({ where: { id }, data: { uai } })` |
| 8 | `app/api/assessments/submit/route.ts:147` | `$executeRawUnsafe UPDATE assessmentVersion` | `prisma.assessment.update({ where: { id }, data: { assessmentVersion, engineVersion } })` |
| 9 | `app/api/assessments/submit/route.ts:179` | `$executeRawUnsafe INSERT domain_scores` | `prisma.domainScore.create({ data: { assessmentId, domain, score } })` |
| 10 | `app/api/assessments/[id]/result/route.ts` | 4× `$queryRawUnsafe` | `prisma.assessment.findUnique({ include: { domainScores, skillScores } })` |
| 11 | `app/api/assessments/[id]/export/route.ts` | 4× `$queryRawUnsafe` | idem |
| 12 | Supprimer les TODO NEX-42, NEX-43 | try/catch fallback | Supprimer les blocs try/catch wrapper |
| 13 | Faire transiter les rares cas justifiés par `lib/db-raw.ts` | `prisma.$queryRaw` direct | `dbQuery(prisma, ...)` / `dbExecute(prisma, ...)` |

**Conserver en raw SQL** (justifié) :
- `lib/invoice/sequence.ts` — atomic INSERT ON CONFLICT RETURNING
- `lib/aria.ts` + `rag/route.ts` — opérateur pgvector `<=>`
- `app/api/health/route.ts` — SELECT 1 diagnostic
- `lib/core/uai/computeUAI.ts:121` — `DISTINCT ON` non supporté Prisma

### SOUS-LOT 5c — Nettoyage

| # | Fichier | Changement |
|---|---|---|
| 1 | `prisma/schema.prisma` | Supprimer `embedding Json @default("[]")` de `PedagogicalContent` (garder `embedding_vector`) |
| 2 | migration | `ALTER TABLE pedagogical_contents DROP COLUMN IF EXISTS embedding` |
| 3 | `app/programme/maths-1ere/lib/supabase.ts` | Supprimer le SQL commenté CdC (tables jamais créées) |
| 4 | `docs/ARCHITECTURE_DATA.md` | Créer : source de vérité = PostgreSQL/Prisma, RAG = ChromaDB + pgvector, progression = MathsProgress + localStorage cache, badges = à synchroniser |

### Prompt Windsurf — LOT 5

```
Contexte : Nexus Réussite repo local (/home/alaeddine/Bureau/nexus-project_v0).
Audit 2026-04-19 — LOT 5 Base de données : Supabase exit + raw SQL cleanup.
Voir docs/AUDIT_SENIOR_2026-04-19/06_PRISMA_PGVECTOR_SUPABASE.md.

═══ SOUS-LOT 5a — P0 : Supabase exit + modèle Prisma progression ═══

1. Créer modèle MathsProgress dans prisma/schema.prisma :
   - @@unique([userId, level]), level = "PREMIERE" | "TERMINALE"
   - Tous les champs de MathsLabRow (supabase.ts)
   - Relation User.mathsProgress MathsProgress[]

2. npx prisma migrate dev --name add_maths_progress

3. Réécrire app/api/programme/maths-1ere/progress/route.ts :
   - POST : prisma.mathsProgress.upsert({ where: { userId_level }, create/update })
   - GET  : prisma.mathsProgress.findUnique({ where: { userId_level } })
   - Supprimer toute référence Supabase

4. Idem pour maths-terminale/progress/route.ts

5. Réécrire useProgressionSync.ts :
   - Hydratation : fetch GET API route
   - Sync : fetch POST API route
   - Supprimer fallback saveProgress() vers Supabase
   - Supprimer import supabase.ts

6. Supprimer ou vider supabase.ts

7. Tests : POST 200, POST 401, GET existant, GET vide

═══ SOUS-LOT 5b — P1 : Raw SQL → Prisma client typé ═══

Remplacer 8 usages injustifiés dans :
- computeSSN.ts (3 usages)
- predictSSN.ts (2 usages)
- computeUAI.ts (1 usage, garder DISTINCT ON)
- submit/route.ts (2 usages)
- result/route.ts + export/route.ts (8 usages SELECT)

Supprimer les TODO NEX-42, NEX-43.
Faire transiter les raw SQL justifiés par db-raw.ts.

═══ SOUS-LOT 5c — P2 : Nettoyage ═══

- Supprimer colonne embedding Json legacy
- Supprimer SQL commenté CdC dans supabase.ts
- Créer docs/ARCHITECTURE_DATA.md

Contraintes :
- Ne pas modifier la prod
- npx prisma migrate dev → OK
- npm run build → 0 erreurs
- npm test → pas de régressions
- Chaque sous-lot = 1 commit séparé
```

---

## LOT 6 — RAG/LLM consolidation (P1)

> Source : `07_RAG_LLM_ARCHITECTURE.md` — AXE 7
> Findings traités : F12, F19, F24, F26, F27, F28, F29, F30, F31, F32, F33, F34, F35, F36

### Périmètre

| Sous-lot | Priorité | Findings | Description |
|---|---|---|---|
| 6a | P1 | F26, F27 | **ARIA retrieval → ChromaDB** — Remplacer pgvector+keyword par `ragSearch` (ChromaDB) dans `aria.ts` et `aria-streaming.ts` |
| 6b | P1 | F12, F19, F27, F34 | **Supprimer fallback pgvector RAG route** — Garder ChromaDB seul, corriger labels source |
| 6c | P1 | F28, F30 | **Persister `ragUsed` dans diagnostics** — Corriger le hardcode `false`, alerter si RAG absent |
| 6d | P2 | F29, F31, F32, F36 | **Nettoyage** — PII dans prompts, RBAC RAG route, harmoniser config Ollama, supprimer code mort |
| 6e | P2 | F33, F24 | **Documentation ingestion** — Documenter ou intégrer les scripts d'ingestion ChromaDB/pgvector |

### SOUS-LOT 6a — ARIA retrieval → ChromaDB

| Étape | Fichier(s) | Changement |
|---|---|---|
| 1 | `lib/aria.ts` | Remplacer `searchKnowledgeBase()` : supprimer pgvector raw SQL + keyword fallback, utiliser `ragSearch({ query, section: subject.toLowerCase(), k: 3 })` |
| 2 | `lib/aria.ts` | Supprimer `generateEmbedding()` (plus nécessaire pour ARIA) |
| 3 | `lib/aria.ts` | Reformater le contexte avec `buildRAGContext(hits)` |
| 4 | `lib/aria-streaming.ts` | Remplacer `searchKnowledgeBase()` keyword par `ragSearch()` (même pattern) |
| 5 | `lib/aria-streaming.ts` | Importer `{ ragSearch, buildRAGContext }` from `@/lib/rag-client` |

**Tests** :
- `__tests__/lib/aria.test.ts` : mocker `ragSearch` au lieu de `prisma.pedagogicalContent`
- `__tests__/lib/aria-streaming.test.ts` : idem

### SOUS-LOT 6b — Supprimer fallback pgvector RAG route

| Étape | Fichier(s) | Changement |
|---|---|---|
| 1 | `app/api/programme/maths-1ere/rag/route.ts` | Supprimer Circuit B (pgvector fallback, lignes 118-154) |
| 2 | `app/api/programme/maths-1ere/rag/route.ts` | Supprimer `import { generateEmbedding }` |
| 3 | `app/api/programme/maths-1ere/rag/route.ts` | Remplacer `source: 'chroma'` par `source: 'rag-api'` |
| 4 | `app/programme/maths-1ere/components/RAGSources.tsx` | Mettre à jour `SOURCE_LABEL` et `SOURCE_COLOR` : `'rag-api'` → 'Nexus RAG' |
| 5 | `app/programme/maths-1ere/components/RAG/RAGRemediation.tsx` | Mettre à jour `SOURCE_CONFIG` : `'rag-api'` |

### SOUS-LOT 6c — Persister ragUsed dans diagnostics

| Étape | Fichier(s) | Changement |
|---|---|---|
| 1 | `lib/bilan-generator.ts` | `generateBilans()` retourne `{ eleve, parents, nexus, ragUsed: boolean, ragHitCount: number }` |
| 2 | `app/api/bilan-pallier2-maths/route.ts` | Lire `ragUsed` / `ragHitCount` depuis résultat `generateBilans`, persister dans `prisma.diagnostic.update()` |
| 3 | `app/api/bilan-pallier2-maths/retry/route.ts` | Idem |
| 4 | `app/api/bilan-pallier2-maths/route.ts` | Si `ragUsed === false` et `ragHitCount === 0`, ajouter un `qualityFlag: 'RAG_UNAVAILABLE'` |

### SOUS-LOT 6d — Nettoyage

| Étape | Fichier(s) | Changement |
|---|---|---|
| 1 | `lib/bilan-generator.ts` | PII : remplacer `${data.identity.firstName} ${data.identity.lastName}` par `[Prénom] [NOM]` dans `prepareLLMContext()`. Ré-injecter après génération. |
| 2 | `app/api/programme/maths-1ere/rag/route.ts` | Ajouter vérification rôle ELEVE (comme ARIA chat) |
| 3 | `.env.example` | Harmoniser `OLLAMA_MODEL=llama3.2:latest` |
| 4 | `lib/ollama-client.ts` | Supprimer `generateWithFallback()` (code mort) |
| 5 | `app/programme/maths-1ere/components/RAG/RAGFlashCard.tsx` | Lire `data.source` de la réponse API, afficher badge source |

### SOUS-LOT 6e — Documentation ingestion

| Étape | Fichier(s) | Changement |
|---|---|---|
| 1 | `docs/ARCHITECTURE_RAG.md` | Créer : diagramme retrieval, collections ChromaDB, processus d'ingestion, modèles embedding |
| 2 | Si scripts accessibles | Copier ou référencer les scripts d'ingestion ChromaDB dans `scripts/rag/` |
| 3 | `lib/aria.ts` | Ajouter commentaire expliquant la désactivation pgvector (référence audit AXE 7) |

### Prompt Windsurf — LOT 6

```
Contexte : Nexus Réussite repo local (/home/alaeddine/Bureau/nexus-project_v0).
Audit 2026-04-19 — LOT 6 RAG/LLM consolidation.
Voir docs/AUDIT_SENIOR_2026-04-19/07_RAG_LLM_ARCHITECTURE.md.

═══ SOUS-LOT 6a — P1 : ARIA retrieval → ChromaDB ═══

1. lib/aria.ts :
   - Remplacer searchKnowledgeBase() par :
     import { ragSearch, buildRAGContext } from '@/lib/rag-client';
     const hits = await ragSearch({ query, section: subject.toLowerCase(), k: 3 });
   - Supprimer generateEmbedding() (plus besoin pour ARIA)
   - Reformater le contexte avec buildRAGContext(hits)
   - Garder signature generateAriaResponse() inchangée

2. lib/aria-streaming.ts :
   - Remplacer searchKnowledgeBase() par ragSearch() (même pattern que aria.ts)
   - Importer { ragSearch, buildRAGContext } from '@/lib/rag-client'

3. Tests : mocker ragSearch au lieu de prisma.pedagogicalContent

═══ SOUS-LOT 6b — P1 : Supprimer fallback pgvector RAG route ═══

1. app/api/programme/maths-1ere/rag/route.ts :
   - Supprimer Circuit B (pgvector fallback) lignes 118-154
   - Supprimer import generateEmbedding
   - Si ChromaDB échoue → retourner { hits: [], source: 'none' }

2. Corriger le label source :
   - Remplacer source: 'chroma' par source: 'rag-api'
   - Mettre à jour SOURCE_LABEL/SOURCE_COLOR dans RAGSources.tsx et RAGRemediation.tsx

═══ SOUS-LOT 6c — P1 : Persister ragUsed dans diagnostics ═══

1. lib/bilan-generator.ts → generateBilans() :
   - Retourner { eleve, parents, nexus, ragUsed, ragHitCount }

2. app/api/bilan-pallier2-maths/route.ts :
   - Lire ragUsed / ragHitCount, persister dans diagnostic
   - Ajouter qualityFlag RAG_UNAVAILABLE si ragUsed=false

3. app/api/bilan-pallier2-maths/retry/route.ts : idem

═══ SOUS-LOT 6d — P2 : Nettoyage ═══

1. PII : remplacer données nominatives par placeholders dans prepareLLMContext()
2. RAG route : ajouter vérification rôle ELEVE
3. .env.example : harmoniser OLLAMA_MODEL=llama3.2:latest
4. Supprimer generateWithFallback() de ollama-client.ts
5. RAGFlashCard.tsx : afficher badge source

═══ SOUS-LOT 6e — P2 : Documentation ═══

1. Créer docs/ARCHITECTURE_RAG.md
2. Documenter les processus d'ingestion ChromaDB
3. Ajouter commentaire audit dans aria.ts

Contraintes :
- Ne pas modifier la prod
- npm run build → 0 erreurs
- npm test → pas de régressions
- Chaque sous-lot = 1 commit séparé
```

---

## LOT 7 — Couverture pédagogique Maths 1ère (P1/P2)

> Réf. AXE 8 — `08_COUVERTURE_PEDAGOGIQUE_MATHS_1ERE.md`
> Findings : F37-F48 (12 findings). Effort total estimé : ~23h.
> Objectif : amener le module du statut « prêt pour démo » à « prêt pour stage réel ».

### LOT 7.1 — Bugs bloquants stage (P1, ~2h)

| Tâche | Fichier | Finding |
|-------|---------|---------|
| Corriger `suites-numeriques` → `suites`, `derivation-variations` → `derivation`, `probabilites-conditionnelles` → `probabilites-cond` | `config/stage.ts` | F9 |
| Résoudre dynamiquement `catKey` dans SeanceDuJour (lookup dans `programmeData`) | `components/Cockpit/SeanceDuJour.tsx` | F44 |
| Persister le score examen blanc : ajouter `recordExamResult(sujetId, autoScore, exScore)` au store et l'appeler dans ExamenBlancView | `store.ts` + `components/Examen/ExamenBlancView.tsx` | F41 |

### LOT 7.2 — Diagnostics prérequis (P1, ~4h)

| Tâche | Fichier | Finding |
|-------|---------|---------|
| Ajouter `prerequisDiagnostic` (2-3 questions chacun) pour les 15 chapitres manquants | `data.ts` | F38 |
| Exploiter `remediation` → navigation vers chapitre cible dans le composant | `components/DiagnosticPrerequis.tsx` | F43 |
| Ajouter un avertissement visuel si `prerequis` non complétés (soft-lock, pas bloquant) | `components/Course/sections/ChapterPractice.tsx` | F39 |

### LOT 7.3 — Exercices procéduraux (P2, ~6h)

| Tâche | Fichier | Finding |
|-------|---------|---------|
| Créer générateurs pour : `exponentielle`, `trigonometrie`, `produit-scalaire`, `equations-droites`, `geometrie-vectorielle`, `equations-cercles`, `variables-aleatoires`, `suites-limites`, `variations-courbes`, `algo-fibonacci-syracuse`, `algo-newton`, `algorithmique-python` | `lib/exercise-generator.ts` | F37 |
| Exporter dans `GENERATORS` map pour chaque chapId | `lib/exercise-generator.ts` | F37 |

### LOT 7.4 — Sujets blancs supplémentaires (P2, ~4h)

| Tâche | Fichier | Finding |
|-------|---------|---------|
| Créer `SUJET_BLANC_2` (thèmes : exponentielle, géométrie, algorithmique) | `config/exam.ts` | F40 |
| Créer `SUJET_BLANC_3` (thèmes : trigonométrie, suites, probabilités) | `config/exam.ts` | F40 |
| Ajouter sélecteur de sujet dans l'accueil ExamenBlancView | `components/Examen/ExamenBlancView.tsx` | F40 |

### LOT 7.5 — RAG ciblée par erreur (P2, ~3h)

| Tâche | Fichier | Finding |
|-------|---------|---------|
| Enrichir payload RAG : inclure `questionRatee`, `reponseEleve`, `erreurType` | `components/Examen/ExamenBlancView.tsx`, `components/ExerciseEngine.tsx` | F42 |
| Exploiter `remediation` des diagnostics pour orienter la requête RAG | `components/DiagnosticPrerequis.tsx` | F43 |

### LOT 7.6 — Vue enseignant et bilan (P2, ~4h)

| Tâche | Fichier | Finding |
|-------|---------|---------|
| Brancher données groupe sur API `/api/programme/maths-1ere/groupe` (même avec données mock multi-élèves depuis store) | `components/Enseignant/TeacherView.tsx` | F46 |
| Supprimer le rendu `activeTab === 'programme'` orphelin (lignes 299-340) | `components/Enseignant/TeacherView.tsx` | F47 |
| Ajouter export PDF bilan via `react-pdf` ou `html2canvas` | `components/Bilan/BilanView.tsx` | F48 |

### Prompt Windsurf LOT 7

```
Contexte : module Maths 1ère (`app/programme/maths-1ere/`).
Référence audit : `docs/AUDIT_SENIOR_2026-04-19/08_COUVERTURE_PEDAGOGIQUE_MATHS_1ERE.md`.

SOUS-LOT 7.1 (P1) :
1. Dans `config/stage.ts`, remplacer les chapitresClés invalides :
   - `suites-numeriques` → `suites`
   - `derivation-variations` → `derivation`  
   - `probabilites-conditionnelles` → `probabilites-cond`
2. Dans `components/Cockpit/SeanceDuJour.tsx:87`, remplacer le hardcode `'algebre'` par un lookup dynamique :
   ```ts
   const catKey = Object.entries(programmeData).find(([, cat]) =>
     cat.chapitres.some(c => c.id === session.chapitresClés[0])
   )?.[0] ?? 'algebre';
   ```
3. Dans `store.ts`, ajouter :
   - `examResults: Record<string, { autoScore: number; exScore: number; total: number; date: string }>` au state
   - `recordExamResult(sujetId, autoScore, exScore)` action
4. Dans `ExamenBlancView.tsx`, appeler `recordExamResult` quand l'utilisateur termine la correction.

SOUS-LOT 7.2 (P1) :
5. Dans `data.ts`, ajouter `prerequisDiagnostic` (2-3 questions QCM) pour chaque chapitre manquant (15 chapitres). Modèle : copier le format de `probabilites-cond` lignes 1018-1021.
6. Dans `DiagnosticPrerequis.tsx`, quand score < 70%, afficher un bouton "Revoir [chapTitre]" qui redirige vers le chapitre `remediation`.
7. Dans `ChapterPractice.tsx`, avant le diagnostic, vérifier si les `prerequis` du chapitre sont dans `store.completedChapters`. Si non, afficher un warning non bloquant.

SOUS-LOT 7.3 (P2) :
8. Dans `lib/exercise-generator.ts`, ajouter des générateurs pour les 12 chapitres manquants. Exporter chacun dans la map `GENERATORS`.

SOUS-LOT 7.4 (P2) :
9. Dans `config/exam.ts`, créer SUJET_BLANC_2 et SUJET_BLANC_3 (même structure que SUJET_BLANC_1).
10. Dans `ExamenBlancView.tsx`, ajouter un sélecteur de sujet dans le mode accueil.

Vérification :
- tsc --noEmit → 0 erreurs
- npm run build → 0 erreurs
- Chaque sous-lot = 1 commit séparé
```

---

## LOT 8 — Consolidation Bilan Canonique (P0/P1)

> Réf. AXE 9 — `09_BILANS_DUPLIQUES.md`
> Findings : F49-F54 (6 findings). Effort total estimé : ~35h.
> Objectif : unifier 6 systèmes de bilan parallèles sous un modèle canonique unique.

### Contexte

Le produit possède 6 implémentations de bilan sans schéma commun :
- `Diagnostic` table (Pallier 2 Maths)
- `Assessment` table (QCM universel + Bilan Gratuit)
- `StageBilan` table (bilan post-stage manuel coach)
- Store Zustand local (Maths 1ère BilanView)
- `StageReservation.scoringResult` (Legacy)
- 3 générateurs LLM : `lib/bilan-generator.ts`, `lib/assessments/generators/index.ts`, `lib/diagnostics/bilan-renderer.ts`

### LOT 8.1 — Schéma et Migration (Sprint 1, ~8h)

| Tâche | Fichier(s) concernés | Description |
|-------|---------------------|-------------|
| Créer table `Bilan` canonique | `prisma/schema.prisma` | Schéma unifié : id, publicShareId, type, sourceData, scores (global/confidence/readiness/domains), renders (student/parents/nexus), relations (studentId, stageId, coachId), status, timestamps |
| Migration Diagnostic → Bilan | `prisma/migrations/` | Migrer données `Diagnostic` vers `Bilan` avec mapping type='DIAGNOSTIC_PRE_STAGE' |
| Migration Assessment → Bilan | `prisma/migrations/` | Migrer données `Assessment` vers `Bilan` avec mapping type='ASSESSMENT_QCM' |
| Migration StageBilan → Bilan | `prisma/migrations/` | Migrer données `StageBilan` vers `Bilan` avec mapping type='STAGE_POST' |
| Script de migration données | `scripts/migrate-bilans.ts` | Script TypeScript idempotent pour migration prod |
| Définir interfaces canoniques | `lib/bilan/types.ts` | Types TypeScript : `CanonicalBilan`, `BilanType`, `BilanScores`, `BilanRenders` |

### LOT 8.2 — Générateur Canonique (Sprint 1-2, ~10h)

| Tâche | Fichier(s) concernés | Description |
|-------|---------------------|-------------|
| Créer générateur unifié | `lib/bilan/generator.ts` | Fusionner logique des 3 générateurs existants ; supporter LLM + fallback template |
| Prompts unifiés par audience | `lib/bilan/prompts.ts` | 3 prompts système : eleve (bienveillant/tutoiement), parents (professionnel/vouvoiement), nexus (technique/tableaux) |
| Renderer Markdown canonique | `lib/bilan/renderer.ts` | Adapter `renderEleveBilan/renderParentsBilan/renderNexusBilan` de bilan-renderer.ts |
| Scoring normalisé multi-source | `lib/bilan/scoring.ts` | Unifier scoring V1/V2/Assessment en scoring canonique |
| Déprécier legacy | `lib/bilan-generator.ts` | Ajouter @deprecated, rediriger vers lib/bilan/generator.ts |
| Déprécier legacy | `lib/assessments/generators/index.ts` | Ajouter @deprecated, rediriger vers lib/bilan/generator.ts |
| Déprécier legacy | `lib/diagnostics/bilan-renderer.ts` | Ajouter @deprecated, rediriger vers lib/bilan/renderer.ts |

### LOT 8.3 — API Consolidées (Sprint 2, ~8h)

| Tâche | Fichier(s) concernés | Description |
|-------|---------------------|-------------|
| CRUD bilans canoniques | `app/api/bilans/route.ts` | GET (liste), POST (créer) |
| GET/PUT/DELETE bilan par ID | `app/api/bilans/[id]/route.ts` | Accès avec vérification ownership |
| Export PDF/MD universel | `app/api/bilans/[id]/export/route.ts` | Export canonique pour tous les types |
| Endpoint de génération | `app/api/bilans/generate/route.ts` | Génération async bilan (LLM) |
| Adapter bilan-pallier2-maths | `app/api/bilan-pallier2-maths/route.ts` | Utiliser lib/bilan/generator.ts au lieu de lib/bilan-generator.ts |
| Adapter assessments/submit | `app/api/assessments/submit/route.ts` | Appeler BilanGenerator.generate() unifié |
| Adapter stages bilans | `app/api/stages/[stageSlug]/bilans/route.ts` | Lire/écrire dans table Bilan au lieu de StageBilan |

### LOT 8.4 — UI Composants Canoniques (Sprint 3, ~6h)

| Tâche | Fichier(s) concernés | Description |
|-------|---------------------|-------------|
| Visualiseur tri-destinataire | `components/bilan/BilanViewer.tsx` | Composant unifié : tabs Élève/Parent/Nexus |
| Tabs réutilisables | `components/bilan/BilanTabs.tsx` | Onglets avec icônes et descriptions |
| Boutons export | `components/bilan/BilanExport.tsx` | Export PDF + Partage (shareId/token) |
| Header scores | `components/bilan/BilanScoreHeader.tsx` | Affichage normalisé des scores |
| Refactor Maths 1ère | `app/programme/maths-1ere/components/Bilan/BilanView.tsx` | Utiliser composants canoniques |
| Refactor StageBilanCard | `components/stages/StageBilanCard.tsx` | Utiliser composants canoniques |
| Refactor TeacherView bilan | `app/programme/maths-1ere/components/Enseignant/TeacherView.tsx` | Utiliser composants canoniques |

### LOT 8.5 — Migration Legacy (Sprint 3-4, ~3h)

| Tâche | Fichier(s) concernés | Description |
|-------|---------------------|-------------|
| Migrer StageReservation scoring | `scripts/migrate-legacy.ts` | Extraire scoringResult JSON → table Bilan |
| Retirer BilanClient legacy | `app/stages/fevrier-2026/bilan/[reservationId]/BilanClient.tsx` | Redirect vers nouveau système |
| Nettoyage code legacy | `app/stages/fevrier-2026/` | Marquer comme @deprecated, planifier suppression |

### Prompt Windsurf LOT 8

```
Contexte : consolidation des 6 systèmes de bilan sous un modèle canonique.
Référence audit : `docs/AUDIT_SENIOR_2026-04-19/09_BILANS_DUPLIQUES.md`.

SOUS-LOT 8.1 (Schéma) :
1. Dans `prisma/schema.prisma`, créer model `Bilan` :
   - id, publicShareId: String @unique
   - type: Enum('DIAGNOSTIC_PRE_STAGE', 'STAGE_POST', 'ASSESSMENT_QCM', 'CONTINUOUS')
   - subject, grade: String
   - sourceData: Json
   - scores: Json { global, confidence, readiness, domains:[] }
   - renders: Json { student, parents, nexus }
   - studentId, stageId, coachId: relations
   - status: Enum('PENDING', 'SCORING', 'GENERATING', 'COMPLETED', 'FAILED')
   - errorCode, retryCount
   - createdAt, updatedAt, publishedAt
2. Générer migration : npx prisma migrate dev --name add_bilan_canonique
3. Créer `lib/bilan/types.ts` avec interfaces CanonicalBilan, BilanScores, BilanRenders

SOUS-LOT 8.2 (Générateur) :
4. Créer `lib/bilan/prompts.ts` : 3 prompts AUDIENCE_PROMPTS canoniques (eleve/parents/nexus)
5. Créer `lib/bilan/renderer.ts` : export renderAllBilans(scoring, context) → {eleve, parents, nexus}
6. Créer `lib/bilan/generator.ts` : class BilanGenerator.generate(bilanId) unifié
   - Supporte LLM_MODE='live'|'stub'|'off'
   - Fallback template si LLM fails
   - Persiste dans table Bilan
7. Marquer @deprecated dans : lib/bilan-generator.ts, lib/assessments/generators/index.ts, lib/diagnostics/bilan-renderer.ts

SOUS-LOT 8.3 (API) :
8. Créer `app/api/bilans/route.ts` : GET list (avec filtres), POST create
9. Créer `app/api/bilans/[id]/route.ts` : GET (vérifier ownership), PUT update, DELETE
10. Créer `app/api/bilans/[id]/export/route.ts` : export PDF via react-pdf ou html2canvas
11. Modifier `app/api/bilan-pallier2-maths/route.ts` : utiliser lib/bilan/generator.ts
12. Modifier `app/api/assessments/submit/route.ts` : appeler BilanGenerator.generate(assessmentId)

SOUS-LOT 8.4 (UI) :
13. Créer `components/bilan/BilanTabs.tsx` : tabs Élève/Parent/Nexus avec icons
14. Créer `components/bilan/BilanViewer.tsx` : afficheur markdown + scores
15. Refactor `components/stages/StageBilanCard.tsx` : utiliser BilanViewer

Contraintes :
- Maintien backward-compat : URLs existantes redirect vers nouvelles
- Préservation données : migration sans perte
- Tri-destinataire conservé partout
- tsc --noEmit → 0 erreurs
- npm run build → 0 erreurs
- Chaque sous-lot = 1 commit séparé
```

---

## LOT 9 — Tests : Vraie Couverture (P0/P1)

> Réf. AXE 10 — `10_TESTS_VRAIE_COUVERTURE.md`
> Findings : T1-T10 (10 findings). Effort total estimé : ~40h.
> Objectif : transformer la couverture trompeuse (4541 tests sur mocks) en couverture protectrice sur les surfaces critiques.

### Contexte

Le projet dispose de **4541 tests Jest** mais :
- **21% seulement des findings P0/P1 sont testés**
- Les tests RBAC testent les guards `lib/guards.ts`, pas les routes réelles
- **IDOR complètement non testé** : aucun test ne vérifie l'isolation coach/stage
- **Prisma entièrement mocké** : `jest.setup.js:46-78` — les tests ne touchent pas la vraie base
- **Parentalité/Ownership non testés** : `activate-student` et `predict SSN` ne vérifient pas les relations réelles
- **E2E superficiel** : 3 seules suites Playwright, aucun test stage bilans coach

### LOT 9.1 — Tests IDOR Réels (Sprint 1, ~10h)

| Tâche | Fichier(s) | Description |
|-------|-----------|-------------|
| Créer tests IDOR stage bilans | `__tests__/api/stages.bilans.idor.test.ts` | Test GET/POST avec coach non-assigné → 403 |
| Corriger test activate-student | `__tests__/api/assistant.activate-student.route.test.ts` | Ajouter vérification parentalité (PARENT sans lien → 403) |
| Corriger test predict SSN | `__tests__/api/assessments.predict.route.test.ts` | Ajouter vérification ownership (wrong student → 403) |
| Créer tests IDOR génériques | `__tests__/security/idor-real.test.ts` | Test isolation ressources par rôle (coach, parent, élève) |
| Créer test bilans isolation | `__tests__/api/bilans.isolation.test.ts` | Test qu'un parent ne voit que ses bilans |

### LOT 9.2 — Tests DB Non Mockés (Sprint 1-2, ~8h)

| Tâche | Fichier(s) | Description |
|-------|-----------|-------------|
| Activer tests DB dans CI | `jest.config.js` | Retirer `<rootDir>/__tests__/db/` de testPathIgnorePatterns |
| Créer tests raw SQL | `__tests__/db/raw-sql-safety.test.ts` | Test requêtes SQL critiques (SSN, UAI, DomainScore) |
| Créer tests Prisma réel | `__tests__/db/prisma-integration.test.ts` | Test relations FK, contraintes, transactions |
| Créer tests collision 1ère/Terminale | `__tests__/db/progression-isolation.test.ts` | Test isolation user_id + grade dans Supabase |
| Créer tests double écriture | `__tests__/db/dual-write.test.ts` | Test cohérence Zustand/Supabase |

### LOT 9.3 — E2E Critiques (Sprint 2-3, ~10h)

| Tâche | Fichier(s) | Description |
|-------|-----------|-------------|
| E2E coach stage bilans | `__tests__/e2e/coach-stage-bilans.spec.ts` | Flow complet : login coach → dashboard stages → création bilan → vérification isolation |
| E2E activate-student | `__tests__/e2e/activate-student.spec.ts` | Flow parent → activation élève → tentative activation autre élève (doit échouer) |
| E2E predict SSN | `__tests__/e2e/predict-ssn.spec.ts` | Flow coach → prédiction SSN élève assigné → tentative autre élève (doit échouer) |
| E2E diagnostic complet | `__tests__/e2e/diagnostic-complete.spec.ts` | Flow bilan → soumission → scoring → résultat → partage |
| E2E IDOR traversal | `__tests__/e2e/idor-traversal.spec.ts` | Test systématique : coach A tente accès ressources coach B |

### LOT 9.4 — Tests RAG/LLM Intégration (Sprint 3, ~6h)

| Tâche | Fichier(s) | Description |
|-------|-----------|-------------|
| Tests RAG réels | `__tests__/integration/rag-pgvector.test.ts` | Test avec vraie base pgvector (pas de mock) |
| Tests ChromaDB | `__tests__/integration/chromadb.test.ts` | Test avec vrai ChromaDB (si disponible en test) |
| Tests ARIA streaming | `__tests__/integration/aria-streaming.test.ts` | Test streaming réel (si LLM disponible) |
| Tests LLM resilience | `__tests__/integration/llm-fallback.test.ts` | Test fallback Ollama down → template |
| Tests embeddings | `__tests__/integration/embeddings.test.ts` | Test cohérence embeddings (pgvector vs ChromaDB) |

### LOT 9.5 — Tests Sécurité & Secrets (Sprint 4, ~6h)

| Tâche | Fichier(s) | Description |
|-------|-----------|-------------|
| Test détection secrets | `__tests__/security/secrets-leak.test.ts` | Scan privkey.pem, tokens, credentials dans le repo |
| Test credentials exposure | `__tests__/security/credentials-exposure.test.ts` | Vérification .env.* exposés, clés en dur |
| Test XSS/Injection | `__tests__/security/xss-injection.test.ts` | Protection XSS dans inputs, sanitization |
| Test CSRF | `__tests__/security/csrf-real.test.ts` | Validation CSRF tokens sur mutations |
| Test rate limiting | `__tests__/security/rate-limiting-real.test.ts` | Test protection abuse API |

### Prompt Windsurf LOT 9

```
Contexte : amélioration de la couverture de tests réelle sur les surfaces critiques sécurité.
Référence audit : `docs/AUDIT_SENIOR_2026-04-19/10_TESTS_VRAIE_COUVERTURE.md`.

SOUS-LOT 9.1 (P0) — Tests IDOR réels :
1. Créer `__tests__/api/stages.bilans.idor.test.ts` :
   - GET /api/stages/stage-a/bilans avec coach assigné à stage-a → 200
   - GET /api/stages/stage-b/bilans avec coach assigné à stage-a → 403
   - POST /api/stages/stage-b/bilans avec coach non-assigné → 403
   - Utiliser VRAIE base de données (npm run test:db:setup)

2. Modifier `__tests__/api/assistant.activate-student.route.test.ts` :
   - Ajouter test : PARENT tente d'activer élève qui n'est pas son enfant → 403
   - Mock prisma.parentProfile.findFirst pour retourner null (pas de lien)
   - Vérifier que initiateStudentActivation n'est pas appelé

3. Modifier `__tests__/api/assessments.predict.route.test.ts` :
   - Ajouter test : user authentifié tente predict sur studentId d'un autre → 403
   - Vérifier ownership via prisma.student.findFirst({ where: { userId: session.user.id } })

SOUS-LOT 9.2 (P1) — Tests DB réels :
4. Dans `jest.config.js`, retirer `<rootDir>/__tests__/db/` de testPathIgnorePatterns
5. Créer `__tests__/db/raw-sql-safety.test.ts` :
   - Lister toutes les utilisations $executeRawUnsafe
   - Vérifier qu'aucune n'accepte d'input utilisateur non sanitizé

SOUS-LOT 9.3 (P1) — E2E critiques :
6. Créer `__tests__/e2e/coach-stage-bilans.spec.ts` :
   - Flow : login coach → dashboard stages → sélection stage assigné → création bilan
   - Tentative accès stage non-assigné → redirect 403

Contraintes :
- Les tests IDOR doivent utiliser la vraie base (pas de mock Prisma)
- Utiliser `npm run test:db:setup` pour créer la base de test
- Chaque test doit nettoyer ses données (afterEach)
- Les tests E2E doivent utiliser Playwright avec base de test isolée
- Documenter les nouveaux tests dans TESTING.md

Vérification :
- npm run test:db → tous les nouveaux tests passent
- npm run test (unit) → pas de régression (4541 tests)
- npm run test:e2e → nouveaux tests E2E passent
- Couverture IDOR : 100% des routes stage bilans
```
