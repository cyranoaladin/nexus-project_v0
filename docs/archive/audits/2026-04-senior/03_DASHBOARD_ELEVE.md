# AXE 3 — Dashboard élève et cockpit pédagogique

> Audit 2026-04-19. Périmètre lu uniquement. Aucune modification applicative.

## 1. Conclusion

Le produit expose en réalité deux expériences élève distinctes qui ne partagent ni le même contrat de données, ni la même source de vérité.

`/dashboard/eleve` est un dashboard généraliste alimenté par `/api/student/dashboard`, puis complété par un fan-out client vers `/api/student/trajectory`, `/api/me/next-step` et `/api/student/nexus-index` via `components/dashboard/*` ([app/dashboard/eleve/page.tsx](/home/alaeddine/Bureau/nexus-project_v0/app/dashboard/eleve/page.tsx:112), [components/dashboard/DashboardPilotage.tsx](/home/alaeddine/Bureau/nexus-project_v0/components/dashboard/DashboardPilotage.tsx:73)).

`/programme/maths-1ere` est un cockpit pédagogique autonome piloté par Zustand persistant + synchronisation Supabase, sans dépendre du contrat `/api/student/dashboard` ([app/programme/maths-1ere/components/MathsRevisionClient.tsx](/home/alaeddine/Bureau/nexus-project_v0/app/programme/maths-1ere/components/MathsRevisionClient.tsx:42), [app/programme/maths-1ere/components/Cockpit/CockpitView.tsx](/home/alaeddine/Bureau/nexus-project_v0/app/programme/maths-1ere/components/Cockpit/CockpitView.tsx:24), [app/programme/maths-1ere/store.ts](/home/alaeddine/Bureau/nexus-project_v0/app/programme/maths-1ere/store.ts:309)).

Conséquence directe : plusieurs données existent côté API sans être rendues dans le dashboard élève classique, tandis que la progression Maths Première vit dans un modèle parallèle non Prisma.

## 2. Findings

### F-AXE3-01 — Le dashboard élève ne rend pas plusieurs champs déjà fournis par son API

Preuve code. `/api/student/dashboard` renvoie `nextSession`, `allSessions`, `credits.balance` et `badges` ([app/api/student/dashboard/route.ts](/home/alaeddine/Bureau/nexus-project_v0/app/api/student/dashboard/route.ts:127), [app/api/student/dashboard/route.ts](/home/alaeddine/Bureau/nexus-project_v0/app/api/student/dashboard/route.ts:139), [app/api/student/dashboard/route.ts](/home/alaeddine/Bureau/nexus-project_v0/app/api/student/dashboard/route.ts:152), [app/api/student/dashboard/route.ts](/home/alaeddine/Bureau/nexus-project_v0/app/api/student/dashboard/route.ts:159)).

Preuve UI. `app/dashboard/eleve/page.tsx` n’affiche que `recentSessions`, les boutons “Mes Matières”, les stats ARIA et des actions rapides. Aucun rendu de `nextSession`, `credits`, `badges`, notifications ou bilan actuel ([app/dashboard/eleve/page.tsx](/home/alaeddine/Bureau/nexus-project_v0/app/dashboard/eleve/page.tsx:221), [app/dashboard/eleve/page.tsx](/home/alaeddine/Bureau/nexus-project_v0/app/dashboard/eleve/page.tsx:275), [app/dashboard/eleve/page.tsx](/home/alaeddine/Bureau/nexus-project_v0/app/dashboard/eleve/page.tsx:326)).

Impact utilisateur. Le cockpit demandé dans le cahier d’audit n’existe pas sur la route élève canonique. Des données calculées côté serveur sont perdues avant rendu.

Effort. M. LOT recommandé : LOT 2.

### F-AXE3-02 — Le cockpit Maths Première est découplé du dashboard élève canonique

Preuve code. Le cockpit Maths Première est composé de `HeroPedagogique`, `SeanceDuJour`, `SyntheseEleve`, `FeuilleDeRoute` et `RAGFlashCard`, tous branchés sur `useMathsLabStore()` et non sur `/api/student/dashboard` ([app/programme/maths-1ere/components/Cockpit/CockpitView.tsx](/home/alaeddine/Bureau/nexus-project_v0/app/programme/maths-1ere/components/Cockpit/CockpitView.tsx:23), [app/programme/maths-1ere/components/Cockpit/HeroPedagogique.tsx](/home/alaeddine/Bureau/nexus-project_v0/app/programme/maths-1ere/components/Cockpit/HeroPedagogique.tsx:21), [app/programme/maths-1ere/components/Cockpit/SyntheseEleve.tsx](/home/alaeddine/Bureau/nexus-project_v0/app/programme/maths-1ere/components/Cockpit/SyntheseEleve.tsx:12), [app/programme/maths-1ere/components/Cockpit/FeuilleDeRoute.tsx](/home/alaeddine/Bureau/nexus-project_v0/app/programme/maths-1ere/components/Cockpit/FeuilleDeRoute.tsx:14)).

Impact utilisateur. Le “dashboard élève” et le “cockpit pédagogique Première” peuvent diverger sans alerte. Il n’existe pas de source unique pour la progression, les priorités et la séance à venir.

Effort. M. LOT recommandé : LOT 2 puis LOT 5.

### F-AXE3-03 — La progression Première a une double source de vérité avec fallback direct navigateur → Supabase

Preuve code. L’état local est stocké dans Zustand persistant (`persist(...)`) ([app/programme/maths-1ere/store.ts](/home/alaeddine/Bureau/nexus-project_v0/app/programme/maths-1ere/store.ts:309)). La synchro tente d’abord `POST /api/programme/maths-1ere/progress`, puis bascule en écriture directe navigateur vers Supabase via `saveProgress(userId, payload)` ([app/programme/maths-1ere/hooks/useProgressionSync.ts](/home/alaeddine/Bureau/nexus-project_v0/app/programme/maths-1ere/hooks/useProgressionSync.ts:98), [app/programme/maths-1ere/hooks/useProgressionSync.ts](/home/alaeddine/Bureau/nexus-project_v0/app/programme/maths-1ere/hooks/useProgressionSync.ts:105), [app/programme/maths-1ere/lib/supabase.ts](/home/alaeddine/Bureau/nexus-project_v0/app/programme/maths-1ere/lib/supabase.ts:128)). L’API serveur elle-même persiste aussi dans `maths_lab_progress` via `SUPABASE_SERVICE_ROLE_KEY` ([app/api/programme/maths-1ere/progress/route.ts](/home/alaeddine/Bureau/nexus-project_v0/app/api/programme/maths-1ere/progress/route.ts:58), [app/api/programme/maths-1ere/progress/route.ts](/home/alaeddine/Bureau/nexus-project_v0/app/api/programme/maths-1ere/progress/route.ts:82)).

Preuve manuelle. Lors d’un test local le 2026-04-19, le cockpit a affiché le message `Échec de sauvegarde. La progression sera réessayée automatiquement.`, message émis par `useProgressionSync` ([app/programme/maths-1ere/hooks/useProgressionSync.ts](/home/alaeddine/Bureau/nexus-project_v0/app/programme/maths-1ere/hooks/useProgressionSync.ts:112)).

Impact utilisateur. Risque d’état divergent entre cache local, API serveur et table Supabase. Le design actuel empêche de considérer Prisma comme source canonique de progression.

Effort. L. LOT recommandé : LOT 5, avec stabilisation minimale en LOT 2.

### F-AXE3-04 — Le dashboard élève a un fan-out HTTP confirmé, pas un cockpit serveur consolidé

Preuve code. `DashboardPilotage` déclenche plusieurs composants qui fetchent chacun leur endpoint: `CapActuelCard` et `TrajectoireCard` vers `/api/student/trajectory`, `NextStepCard` vers `/api/me/next-step`, `NexusIndexCard`, `EvolutionCard` et `SynthesisCard` vers `/api/student/nexus-index` ([components/dashboard/DashboardPilotage.tsx](/home/alaeddine/Bureau/nexus-project_v0/components/dashboard/DashboardPilotage.tsx:74), [components/dashboard/CapActuelCard.tsx](/home/alaeddine/Bureau/nexus-project_v0/components/dashboard/CapActuelCard.tsx:40), [components/dashboard/TrajectoireCard.tsx](/home/alaeddine/Bureau/nexus-project_v0/components/dashboard/TrajectoireCard.tsx:31), [components/dashboard/NextStepCard.tsx](/home/alaeddine/Bureau/nexus-project_v0/components/dashboard/NextStepCard.tsx:136), [components/dashboard/NexusIndexCard.tsx](/home/alaeddine/Bureau/nexus-project_v0/components/dashboard/NexusIndexCard.tsx:79), [components/dashboard/EvolutionCard.tsx](/home/alaeddine/Bureau/nexus-project_v0/components/dashboard/EvolutionCard.tsx:32), [components/dashboard/SynthesisCard.tsx](/home/alaeddine/Bureau/nexus-project_v0/components/dashboard/SynthesisCard.tsx:118)).

Preuve manuelle. Capture réseau Playwright locale du 2026-04-19 sur `/dashboard/eleve` : 22 requêtes API, 8 uniques, dont `GET /api/student/dashboard`, `GET /api/student/trajectory`, `GET /api/me/next-step`, `GET /api/student/nexus-index`.

Impact utilisateur. Le temps de chargement dépend de plusieurs endpoints concurrents. La page peut afficher un état partiel sans erreur globale.

Effort. M. LOT recommandé : LOT 2.

### F-AXE3-05 — Plusieurs cartes élève échouent silencieusement ou retombent sur des placeholders neutres

Preuve code. `NextStepCard`, `NexusIndexCard`, `EvolutionCard` et `SynthesisCard` ignorent les erreurs réseau et affichent soit `null`, soit `Aucune donnée disponible`, soit des métriques à zéro ([components/dashboard/NextStepCard.tsx](/home/alaeddine/Bureau/nexus-project_v0/components/dashboard/NextStepCard.tsx:144), [components/dashboard/NexusIndexCard.tsx](/home/alaeddine/Bureau/nexus-project_v0/components/dashboard/NexusIndexCard.tsx:88), [components/dashboard/NexusIndexCard.tsx](/home/alaeddine/Bureau/nexus-project_v0/components/dashboard/NexusIndexCard.tsx:114), [components/dashboard/EvolutionCard.tsx](/home/alaeddine/Bureau/nexus-project_v0/components/dashboard/EvolutionCard.tsx:52), [components/dashboard/SynthesisCard.tsx](/home/alaeddine/Bureau/nexus-project_v0/components/dashboard/SynthesisCard.tsx:147)).

Preuve manuelle. Le dashboard élève e2e affiche `Ressources disponibles`, un indice à 0 et une synthèse neutre alors que rien n’indique à l’utilisateur si l’état est attendu, vide ou dégradé.

Impact utilisateur. Les trous de données sont masqués par des placeholders premium-lite, ce qui rend le diagnostic produit plus difficile.

Effort. S. LOT recommandé : LOT 2.

### F-AXE3-06 — Le widget RAG du cockpit ne remonte pas la provenance documentaire visible à l’élève

Preuve code. `RAGFlashCard` affiche seulement un badge de type et un extrait, sans source, document d’origine ni lien de vérification ([app/programme/maths-1ere/components/RAG/RAGFlashCard.tsx](/home/alaeddine/Bureau/nexus-project_v0/app/programme/maths-1ere/components/RAG/RAGFlashCard.tsx:174), [app/programme/maths-1ere/components/RAG/RAGFlashCard.tsx](/home/alaeddine/Bureau/nexus-project_v0/app/programme/maths-1ere/components/RAG/RAGFlashCard.tsx:187)).

Preuve route. L’API RAG mélange deux circuits. Elle interroge d’abord l’API externe via `ragSearch(...)` puis renvoie `source: 'chroma'` “for UI consistency”, avant fallback pgvector sur `pedagogical_contents` ([app/api/programme/maths-1ere/rag/route.ts](/home/alaeddine/Bureau/nexus-project_v0/app/api/programme/maths-1ere/rag/route.ts:84), [app/api/programme/maths-1ere/rag/route.ts](/home/alaeddine/Bureau/nexus-project_v0/app/api/programme/maths-1ere/rag/route.ts:109), [app/api/programme/maths-1ere/rag/route.ts](/home/alaeddine/Bureau/nexus-project_v0/app/api/programme/maths-1ere/rag/route.ts:118)).

Preuve complémentaire. `lib/rag-client.ts` conserve encore `ressources_pedagogiques_terminale` comme collection par défaut ([lib/rag-client.ts](/home/alaeddine/Bureau/nexus-project_v0/lib/rag-client.ts:90), [lib/rag-client.ts](/home/alaeddine/Bureau/nexus-project_v0/lib/rag-client.ts:186)).

Impact utilisateur. Impossible de vérifier, dans le cockpit lui-même, si la remédiation provient du bon corpus. Le chemin de provenance est opaque.

Effort. M. LOT recommandé : LOT 6.

### F-AXE3-07 — Le diagnostic de prérequis ne couvre que 4 chapitres sur 16

Preuve code. `DiagnosticPrerequis` n’est rendu que si `chap.prerequisDiagnostic` existe ([app/programme/maths-1ere/components/Course/sections/ChapterPractice.tsx](/home/alaeddine/Bureau/nexus-project_v0/app/programme/maths-1ere/components/Course/sections/ChapterPractice.tsx:67)). Dans `data.ts`, seuls `suites`, `derivation`, `exponentielle` et `probabilites-cond` portent ce bloc. `second-degre` n’en a pas ([app/programme/maths-1ere/data.ts](/home/alaeddine/Bureau/nexus-project_v0/app/programme/maths-1ere/data.ts:384), [app/programme/maths-1ere/data.ts](/home/alaeddine/Bureau/nexus-project_v0/app/programme/maths-1ere/data.ts:465)).

Preuve de comptage. Script local du 2026-04-19 : 16 chapitres au total, 4 avec `prerequisDiagnostic`.

Impact utilisateur. Le diagnostic “seconde → première” n’est pas généralisé. Le chapitre d’entrée `second-degre` échappe au mécanisme.

Effort. M. LOT recommandé : LOT 7.

### F-AXE3-08 — Le planning de stage référence des identifiants de chapitres inexistants

Preuve code. `SeanceDuJour` et `HeroPedagogique` s’appuient sur `STAGE_PRINTEMPS_2026` pour proposer la séance et naviguer vers un chapitre ([app/programme/maths-1ere/components/Cockpit/SeanceDuJour.tsx](/home/alaeddine/Bureau/nexus-project_v0/app/programme/maths-1ere/components/Cockpit/SeanceDuJour.tsx:12), [app/programme/maths-1ere/components/Cockpit/HeroPedagogique.tsx](/home/alaeddine/Bureau/nexus-project_v0/app/programme/maths-1ere/components/Cockpit/HeroPedagogique.tsx:27)). Or `stage.ts` utilise `suites-numeriques`, `derivation-variations` et `probabilites-conditionnelles`, qui n’existent pas dans `programmeData`, où les ids sont `suites`, `derivation`, `probabilites-cond` ([app/programme/maths-1ere/config/stage.ts](/home/alaeddine/Bureau/nexus-project_v0/app/programme/maths-1ere/config/stage.ts:124), [app/programme/maths-1ere/config/stage.ts](/home/alaeddine/Bureau/nexus-project_v0/app/programme/maths-1ere/config/stage.ts:177), [app/programme/maths-1ere/config/stage.ts](/home/alaeddine/Bureau/nexus-project_v0/app/programme/maths-1ere/config/stage.ts:203), [app/programme/maths-1ere/data.ts](/home/alaeddine/Bureau/nexus-project_v0/app/programme/maths-1ere/data.ts:384), [app/programme/maths-1ere/data.ts](/home/alaeddine/Bureau/nexus-project_v0/app/programme/maths-1ere/data.ts:465)).

Impact utilisateur. Certaines CTA de séance pointeront vers un chapitre introuvable dès que ces séances deviendront “du jour” ou “prochaine séance”.

Effort. S. LOT recommandé : LOT 2.

## 3. Champs attendus mais non renseignés ou non rendus

| Élément attendu | Statut réel | Preuve |
|---|---|---|
| Prochaine séance sur `/dashboard/eleve` | Calculée par l’API, non rendue | [app/api/student/dashboard/route.ts](/home/alaeddine/Bureau/nexus-project_v0/app/api/student/dashboard/route.ts:127), [app/dashboard/eleve/page.tsx](/home/alaeddine/Bureau/nexus-project_v0/app/dashboard/eleve/page.tsx:221) |
| Crédits restants | Calculés par l’API, non rendus | [app/api/student/dashboard/route.ts](/home/alaeddine/Bureau/nexus-project_v0/app/api/student/dashboard/route.ts:152), [app/dashboard/eleve/page.tsx](/home/alaeddine/Bureau/nexus-project_v0/app/dashboard/eleve/page.tsx:326) |
| Badges récents | Calculés par l’API, non rendus | [app/api/student/dashboard/route.ts](/home/alaeddine/Bureau/nexus-project_v0/app/api/student/dashboard/route.ts:159), [app/dashboard/eleve/page.tsx](/home/alaeddine/Bureau/nexus-project_v0/app/dashboard/eleve/page.tsx:166) |
| Notifications | Absentes du contrat API et absentes du rendu | [app/api/student/dashboard/route.ts](/home/alaeddine/Bureau/nexus-project_v0/app/api/student/dashboard/route.ts:117), [app/dashboard/eleve/page.tsx](/home/alaeddine/Bureau/nexus-project_v0/app/dashboard/eleve/page.tsx:166) |
| Bilan actuel | Absent du contrat API et absent du rendu | [app/api/student/dashboard/route.ts](/home/alaeddine/Bureau/nexus-project_v0/app/api/student/dashboard/route.ts:117), [app/dashboard/eleve/page.tsx](/home/alaeddine/Bureau/nexus-project_v0/app/dashboard/eleve/page.tsx:166) |
| Progression programme Première sur dashboard canonique | Non rendue. Existe seulement dans l’app `/programme/maths-1ere` | [app/dashboard/eleve/page.tsx](/home/alaeddine/Bureau/nexus-project_v0/app/dashboard/eleve/page.tsx:221), [app/programme/maths-1ere/components/Cockpit/CockpitView.tsx](/home/alaeddine/Bureau/nexus-project_v0/app/programme/maths-1ere/components/Cockpit/CockpitView.tsx:35) |

## 4. Requêtes et performance

### 4.1 `/api/student/dashboard`

Mesure locale e2e du 2026-04-19 via Prisma query log reconstituant la requête de la route. Résultat : 7 requêtes SQL, aucune au-dessus de 1 ms sur dataset seed.

1. `students` par `userId`
2. `users`
3. `subscriptions`
4. `sessions`
5. `aria_conversations`
6. `credit_transactions`
7. `student_badges`

Conclusion. N+1 SQL non confirmé sur la route API elle-même dans le dataset seed. En revanche la route charge plusieurs relations distinctes.

### 4.2 `computeNexusIndex`

Mesure locale e2e du 2026-04-19. Résultat : 6 requêtes SQL, aucune au-dessus de 1 ms.

1. `SessionBooking`
2. `session_reports`
3. `aria_conversations` count
4. `aria_messages` count
5. `assessments` count
6. `students`

### 4.3 EXPLAIN ANALYZE des requêtes les plus sollicitées

Base e2e locale `nexus_e2e`, 2026-04-19.

| Requête | Plan | Temps |
|---|---|---|
| `students where userId = ?` | Index Scan `students_userId_key` | 0.052 ms |
| `sessions where studentId = ? order by scheduledAt desc` | Index Scan `sessions_studentId_idx` + sort | 0.040 ms |
| `SessionBooking where status = 'SCHEDULED' and scheduledDate >= now()` | Index Scan `SessionBooking_status_scheduledDate_idx` | 0.043 ms |
| `session_reports where studentId = ?` | Index Scan `session_reports_studentId_createdAt_idx` | 0.045 ms |

Conclusion. Aucun seuil > 200 ms observé sur dataset seed. Vérification prod encore requise sur données réelles.

## 5. Tests manuels effectués

### Test 1 — Dashboard élève classique

Utilisateur. `yasmine.dupont@test.com`

Résultat. La page charge. Le contenu observé confirme `Votre cap actuel`, `Ressources disponibles`, `Indice de trajectoire` à zéro, `Sessions récentes` vide et ARIA à zéro. La page ne montre ni crédits, ni prochaine séance, ni badges.

Capture. `/tmp/axe3-dashboard-eleve-api-login.png`

### Test 2 — Cockpit Maths Première

Utilisateur. `student2.1776628796304@test.com`

Résultat. La page charge. Le contenu observé confirme `Cockpit Pédagogique #Epreuve2026`, le calendrier de stage, `Prochaine séance`, `Rappel Méthode IA`, badges et boutique. Les données proviennent du store local et de `stage.ts`, pas du dashboard API.

Capture. `/tmp/axe3-programme-maths-1ere.png`

### Test 3 — Chapitre `second-degre`

Résultat. Le chapitre a pu être marqué comme maîtrisé puis rechargé avec persistance confirmée. Le diagnostic de prérequis est absent sur ce chapitre car aucun `prerequisDiagnostic` n’est défini pour `second-degre`.

Capture. `/tmp/axe3-programme-cours-second-degre.png`

### Test 4 — Fan-out réseau au chargement

Résultat. Le chargement de `/dashboard/eleve` provoque les appels uniques suivants : `/api/student/dashboard`, `/api/student/trajectory`, `/api/me/next-step`, `/api/student/nexus-index`, en plus du flux NextAuth.

## 6. Décision d’architecture pour la suite

Le dashboard élève canonique doit devenir un cockpit serveur consolidé, avec un contrat unique pour les données “prochaine séance / cap / progression / crédits / synthèse / notifications”.

Le cockpit `/programme/maths-1ere` doit rester la surface pédagogique riche, mais ses indicateurs de haut niveau doivent être recopiés ou agrégés dans le dashboard canonique, pas maintenus comme expérience parallèle sans pont explicite.

La progression Première doit converger vers une seule écriture distante côté serveur. Le fallback direct navigateur → Supabase doit être considéré comme dette d’architecture, pas comme cible.

## 7. Remédiation proposée

### Priorité P1

1. Construire un contrat serveur unique pour le cockpit élève et supprimer le fan-out HTTP côté client.
2. Rendre les champs déjà calculés mais perdus: prochaine séance, crédits, badges, état de progression.
3. Corriger les ids de chapitres dans `STAGE_PRINTEMPS_2026`.

### Priorité P2

1. Étendre `prerequisDiagnostic` à tous les chapitres d’entrée critique, en commençant par `second-degre`.
2. Exposer la provenance documentaire dans le widget RAG cockpit.
3. Remplacer les échecs silencieux par un état vide explicite instrumenté.

### À vérifier manuellement en prod

1. Temps réel sur jeu de données production pour `/api/student/dashboard`, `/api/student/nexus-index` et `/api/me/next-step`.
2. Robustesse du flux Supabase quand `NEXT_PUBLIC_SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont tous deux actifs.
3. Exactitude métier des données de crédit et de séance future sur un élève réel non seed.
