# ARIA Learning Cockpit — Architecture

> **Statut** : fondation P0 livrée sur `feat/aria-learning-cockpit-foundation`.
> **Base** : `origin/main` = `f80c75778eccb349f33b4f841685bf2d4c90c9ea`.
> **Périmètre** : aucune modification du démonstrateur UTICA, aucune migration
> de production, aucun déploiement.

---

## 1. ARIA aujourd'hui (état constaté sur `main`)

### Cartographie

| Rôle | Fichier |
|---|---|
| Frontend élève **actif** | `components/ui/aria-widget.tsx`, monté par `app/dashboard/eleve/page.tsx` |
| Frontend marketing | `components/ui/aria-chat.tsx`, monté par `app/plateforme-aria/page.tsx` |
| Frontend **orphelin** | `components/ui/aria-embedded-chat.tsx` (0 importeur), `components/ui/aria-feedback.tsx` (0 importeur), `components/ui/aria-comparison.tsx` (0 importeur) |
| API chat canonique | `app/api/aria/chat/route.ts` (POST, SSE + JSON) |
| API historique | `app/api/aria/conversations/route.ts` (GET) |
| API feedback | `app/api/aria/feedback/route.ts` (POST) |
| Service | `lib/aria.ts`, `lib/aria-streaming.ts`, `lib/aria/prompt.ts` |
| RAG | `lib/rag-client.ts` |
| Persistance | `AriaConversation`, `AriaMessage` |

### Dettes confirmées (avec preuve)

| Réf | Constat | Preuve |
|---|---|---|
| **A** | Le gating ARIA ne connaît que deux feature keys : NSI → `aria_nsi`, tout le reste → `aria_maths` | `app/api/aria/chat/route.ts:58` ; `lib/access/features.ts:18-19` |
| **B** | Le RAG ARIA ne transmet ni `gradeLevel` ni `academicTrack` | `lib/aria.ts:18-25`, `lib/aria-streaming.ts:14-22` |
| **C** | `ragSearch()` retombe sur `ressources_pedagogiques_terminale` faute de collection explicite | `lib/rag-client.ts:97-103` |
| **D** | `AriaConversation`/`AriaMessage` ne stockent ni `courseKey`, ni compétence, ni objectif, ni ressource, ni sources RAG, ni instantané de contexte | `prisma/schema.prisma` (modèles ARIA) |
| **E** | La liste des matières est dupliquée dans 5 composants indépendants | `aria-widget.tsx`, `aria-chat.tsx`, `aria-embedded-chat.tsx`, `DevisWorkspace.tsx`, `app/plateforme-aria/page.tsx` |
| **F** | Le widget actif ne charge **pas** l'historique et n'utilise **pas** le SSE pourtant disponible ; le composant orphelin, lui, fait les deux | `aria-widget.tsx` (fetch + `response.json()`) vs `aria-embedded-chat.tsx:60,131` |
| **G** | L'enum `Subject` ne couvre aucun module STMG (`SGN`, `MANAGEMENT`, `DROIT_ECO`) ; ils sont écrasés sur `SES` | `prisma/schema.prisma` ; `lib/dashboard/student-payload.ts:1070-1072` |
| **H** | Double gating non aligné : `requireFeatureApi` (entitlements) **et** `Subscription.ariaSubjects` (JSON) sont vérifiés séparément, avec des sémantiques différentes | `app/api/aria/chat/route.ts:58-104` |
| **I** | `types/enums.ts` a dérivé du schéma Prisma (il manque `QUATRIEME` dans `GradeLevel`, `MATHS_EXPERTES` dans `Subject`) | `types/enums.ts` vs `prisma/schema.prisma` |
| **J** | `lib/programme/official-pdfs.ts` est un **stub vide** : aucune ressource officielle n'est réellement servie | `OFFICIAL_PDFS = Object.freeze({})` |

**Aucune de ces dettes n'est corrigée en P0**, à l'exception de celles que la
nouvelle architecture rend structurellement impossibles côté cockpit
(duplication de la liste des matières, confusion des dimensions d'accès).

---

## 2. ARIA cible

ARIA cesse d'être une fenêtre de chat pour devenir un **poste de travail** :
carte scolaire, plan de travail, ressources, évaluations, trajectoire et
conversations, dérivés du profil réel de l'élève.

---

## 3. Sources de vérité (SSoT)

| Donnée | Porteur | ARIA peut-il écrire ? |
|---|---|---|
| `gradeLevel`, `academicTrack`, `specialties`, `stmgPathway`, `school` | `Student` | **Non, jamais** |
| Droits commerciaux (`Subscription`, `ariaSubjects`, entitlements) | moteur d'entitlement | **Non, jamais** |
| Ressources documentaires | `EleveHub` / `buildHub()` | Non (lecture seule) |
| Trajectoire | `lib/trajectory.ts` | Non (lecture seule) |
| Réglementation d'examen | `lib/exams/catalog.ts` | Non (lecture seule) |
| Préférences de travail ARIA | `AriaLearningProfile` | **Oui — et uniquement cela** |

> Aucune API self-service (ÉLÈVE ou PARENT) ne permet de modifier le profil
> scolaire : seul `PATCH /api/admin/users` (ADMIN) le fait. **P0 n'en crée pas.**
> Le wizard affiche et fait confirmer ; il ne modifie rien. Quand le profil est
> incomplet, l'état `ACADEMIC_PROFILE_INCOMPLETE` est exposé et l'interface
> renvoie l'élève vers l'équipe Nexus.

---

## 4. Modèle curriculum

### Registre — `lib/aria/curriculum/catalog.ts`

Registre canonique **versionné** (`v1`), source de vérité unique des cours.
58 cours couvrant collège, seconde, première et terminale, pour les 8 voies.

Chaque cours porte quatre capacités, chacune adossée à un artefact réel :

| Capacité | Preuve exigée |
|---|---|
| `skillGraph` | définition compilée dans `lib/diagnostics/definitions` (8 existent) |
| `rag` | `RAGSubject` déclaré par `lib/rag-client.ts` (6 existent) |
| `resources` | ressource réellement produite par `buildHub()` |
| `chat` | matière acceptée par `/api/aria/chat` |

Répartition du support :

| Niveau | Cours | Commentaire |
|---|---:|---|
| `FULL` | 5 | skill graph + RAG + chat non approximatif |
| `PARTIAL` | 23 | dont 6 modules STMG (matière approximée en `SES`) et 17 matières en chat généraliste sans base documentaire |
| `RAG_ONLY` | 18 | base documentaire, pas de graphe de compétences |
| `COMING_SOON` | 12 | aucune capacité : collège, EMC, maths expertes, parcours STMG de terminale |
| `RESOURCES_ONLY` | 0 | vocabulaire réservé — aucun cours ne remplit cette condition aujourd'hui |
| `EXTERNAL` | 0 | vocabulaire réservé — idem |

Cours en support complet : `maths-premiere-eds`, `nsi-premiere-eds`,
`maths-premiere-stmg`, `maths-terminale-eds`, `nsi-terminale-eds`.

### Pourquoi des clés `String[]` et non `Subject[]`

`Subject` ne contient ni `SGN`, ni `MANAGEMENT`, ni `DROIT_ECO`, ni
`MATHS_COMPLEMENTAIRES`, ni `EMC`. Utiliser l'enum imposerait une migration
PostgreSQL à chaque nouveau module. `selectedCourseKeys` est donc un
`String[]`, validé contre le catalogue **et** contre la scolarité de l'élève.

### Adaptateur skill graph — `lib/aria/curriculum/skill-graph.ts`

`server-only`. Point d'entrée **unique** ; aucun composant React ne parse de
JSON de programme.

Choix de source déterminant : `programmes/generated/*.skills.generated.json`
**ne contient aucun identifiant** (seulement des libellés de candidats). Les
artefacts exploitables sont `lib/diagnostics/definitions/generated/*.domains.json`,
porteurs de `domainId` / `skillId` / `chapterId` stables.

Les `skillId` étant stables mais **non uniques entre programmes** (`PY_FUNC`,
`ANA_EXP` existent en Première et en Terminale), tous les identifiants exposés
sont préfixés : `<courseKey>:<skillId>`.

### Resolver — `lib/aria/curriculum/resolver.ts`

Fonction **pure et isomorphe** : aucun accès Prisma, aucun accès disque. Elle
dérive la carte depuis `Student` et sépare strictement quatre dimensions :

```
academicallyRelevant   — l'élève suit-il ce cours ?
productSupported       — ARIA sait-il le traiter ?
commerciallyEntitled   — l'abonnement l'ouvre-t-il ?
selectedForAria        — l'élève l'a-t-il retenu ?
```

Une matière peut être suivie sans être outillée (EMC), ou outillée sans être
ouverte commercialement (NSI sans `aria_nsi`). Ces deux cas ne sont **jamais**
confondus.

---

## 5. Modèle de profil

`AriaLearningProfile` (table `aria_learning_profiles`) — modèle **additif**,
relation `1-1` optionnelle depuis `Student`, suppression en cascade.

Il ne duplique **aucune** donnée scolaire. Il porte uniquement :
`targetSession`, `selectedCourseKeys`, `weeklyGoalMinutes`, `learningGoals`,
`preferences`, `curriculumVersion`, `onboardingCompletedAt`.

Le service `lib/aria/profile/service.ts` est le **seul** point d'écriture. Il
n'écrit que dans cette table — garanti par test.

---

## 6. Intégrations

- **Ressources** — `lib/aria/cockpit/resources.ts` ne fait que *filtrer* le Hub.
  Aucun second catalogue de documents. Le rattachement se fait par identifiant
  explicite (indispensable : SGN, Management et Droit-Éco partagent la matière
  `SES`), puis par matière lorsqu'elle n'est pas une approximation.
- **Trajectoire** — projection de `lib/trajectory.ts`. Aucun modèle
  `AriaTrajectory` concurrent.
- **Évaluations** — projection des `recentBilans` réels ; aucun score fabriqué.
- **Examen** — `lib/aria/curriculum/exam-context.ts`, adapter read-only de
  `lib/exams/catalog.ts`. Aucune règle du baccalauréat n'est réécrite. Sans
  session cible, la section n'est pas affichée.
- **Cockpit** — `lib/aria/cockpit/builder.ts` réutilise
  `buildStudentDashboardPayload()` (≈8 requêtes) et n'ajoute qu'une lecture de
  profil : **9 requêtes au total**, sans N+1. Les droits sont déduits du payload
  dashboard, ce qui garantit que cockpit et dashboard affichent les mêmes droits.

---

## 7. RAG

Capacités **réelles** de `lib/rag-client.ts` : `maths`, `nsi`,
`physique_chimie`, `francais`, `svt`, `ses`. Philosophie, Histoire-Géographie,
Anglais et Espagnol n'ont **aucune** capacité RAG prouvée et sont déclarés comme
tels.

Le défaut de collection (`ressources_pedagogiques_terminale`) reste actif en P0.
Les cours de Seconde et de Première portent une note explicite indiquant que la
recherche n'est pas filtrée par niveau.

---

## 8. Agent

`lib/aria/agent/contracts.ts` et `lib/aria/agent/context.ts` ne contiennent que
des types et une fonction pure. **Aucun** branchement LLM, **aucune** écriture
en base, **aucune** génération de réponse en P0. Le pipeline de chat existant
est inchangé.

---

## 9. Sécurité

Les trois nouvelles routes appliquent :

- `requireRole(UserRole.ELEVE)` — les rôles PARENT/COACH/ADMIN/ASSISTANTE sont
  refusés en 403, sans aucun accès base ;
- résolution de l'élève **exclusivement** par `session.user.id → Student.userId` ;
- aucun `studentId` accepté depuis le corps, la query ou l'URL ;
- schéma Zod `.strict()` : toute clé inconnue (`studentId`, `ariaSubjects`,
  `gradeLevel`, `planName`…) provoque un 400 ;
- clés de cours contraintes en kebab-case ASCII dès la frontière HTTP (rejet des
  chemins et séparateurs) ;
- aucune mutation d'abonnement ni d'entitlement possible ;
- projection sans chemin filesystem ni contenu de programme.

---

## 10. Anti-fake

Le cockpit n'affiche jamais de progression, de score, de pourcentage,
d'analyse IA, de citation RAG, d'évaluation à venir ni d'action enseignant
fabriqués. Quand la donnée n'existe pas, un état vide honnête est affiché.
La catégorie `RAG_REFERENCE` reste vide tant que les sources consultées ne sont
pas persistées.

---

## 11. Roadmap

### P0 — Fondation *(livré)*

Contrats, catalogue, adaptateur skill graph, resolver, profil, 3 APIs, cockpit
frontend, squelette agent, documentation.

### P1 — Agent contextuel et RAG sourcé

- unifier la génération streaming / non-streaming (aujourd'hui dupliquée entre
  `lib/aria.ts` et `lib/aria-streaming.ts`, dont une fonction morte) ;
- enveloppe de contexte élève transmise à l'agent ;
- **retrieval conscient du niveau, de la voie et du cours** — suppression du
  repli implicite sur `ressources_pedagogiques_terminale` (dette C) ;
- persistance des citations (extension additive de `AriaMessage`) ;
- alimentation réelle de `RAG_REFERENCE` ;
- historique de conversation dans le cockpit ;
- cartes de sources ;
- alignement du double gating entitlements / `ariaSubjects` (dette H) ;
- feature keys ARIA par matière, remplaçant `NSI → aria_nsi / reste → aria_maths`
  (dette A).

### P2 — Moteur d'apprentissage autonome

`WorkItem` persistants, plan journalier et hebdomadaire, exercices, corrections,
évaluations, preuves de maîtrise, adaptation réelle.

### P3 — Agent pédagogique outillé

Outils **lecture seule** d'abord : `get_curriculum`, `get_skill`,
`search_resources`, `search_rag`, `get_progress`, `get_recent_assessments`,
`get_trajectory`, `get_next_session`.

Puis, après permission explicite : `create_work_item`,
`mark_activity_complete`, `schedule_revision`.

**Aucune mutation autonome silencieuse, à aucun moment.**

---

## 12. Dette assumée en P0

- Les frontends legacy (`aria-chat.tsx`, `aria-embedded-chat.tsx`,
  `aria-feedback.tsx`, `aria-comparison.tsx`) conservent leur propre liste de
  matières. Ils ne sont **pas** supprimés. Leur migration vers le catalogue
  élargirait le périmètre P0 ; elle est à traiter en P1.
- `aria-embedded-chat.tsx` reste orphelin alors qu'il implémente historique et
  SSE, absents du widget actif. Décision de reprise à prendre en P1.
- `types/enums.ts` reste désynchronisé du schéma Prisma. Le cockpit contourne le
  problème en s'appuyant sur les types Prisma (import type-only), mais la
  divergence n'est pas résolue.
- `MATHS_EXPERTES` existe dans Prisma mais pas dans `types/enums.ts` : la
  matière n'est pas transmissible au chat. Le catalogue le déclare honnêtement.
