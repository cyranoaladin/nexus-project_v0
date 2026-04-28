# Lot E — Diagnostic de refactor des composants partagés

**Date:** 2026-04-28
**Branche:** feat/programme-shared-extraction-and-terminale-parity
**Objectif:** Identifier les dépendances bloquantes et stratégies de découplage pour 21 composants à extraire.

---

## Tableau de diagnostic complet

| Composant | Imports problématiques (extraits) | Catégorie de dépendance | Stratégie principale | Stratégies secondaires | Note |
|-----------|----------------------|------------------------|-------------------------|------------------------|------|
| ExerciseEngine | `from '../data' (Exercice, ExerciceQCM, etc.)`, `from '../lib/math-engine' (areEquivalentAnswers)` | DATA_SPECIFIC + LIB_SPECIFIC | PROP_INJECTION | EXTRACT_AS_TYPE_ONLY | Priorité PROP_INJECTION sur areEquivalentAnswers |
| ProceduralExercise | `from '../lib/exercise-generator' (GENERATORS)`, `from '../lib/math-engine' (areEquivalentAnswers)`, `from '../store' (useMathsLabStore)` | LIB_SPECIFIC + STORE_SPECIFIC | PROP_INJECTION | STORE_FACTORY | Priorité PROP_INJECTION sur GENERATORS |
| Quiz/QuizEngine | `from '../../store' (useMathsLabStore)`, `from '../../data' (quizData, QuizQuestion)` | STORE_SPECIFIC + DATA_SPECIFIC | STORE_FACTORY | PROP_INJECTION + EXTRACT_AS_TYPE_ONLY | Combinaison 3 stratégies |
| RAG/RAGFlashCard | `from '../../store' (useMathsLabStore)`, `from '../../data' (programmeData)` | STORE_SPECIFIC + DATA_SPECIFIC | STORE_FACTORY | PROP_INJECTION | Priorité STORE_FACTORY sur useMathsLabStore |
| RAGRemediation | Aucun import spécifique maths-1ere | N/A | KEEP_SPECIFIC (à vérifier) | N/A | Déjà utilise MathContent shared - à vérifier imports |
| RAGSources | Aucun import spécifique maths-1ere | N/A | DIRECT_MOVE | N/A | Composant générique RAG - extraction directe |
| Course/ChapterView | `from '../../data' (programmeData)`, `from '../../hooks/useChapterProgress'` | DATA_SPECIFIC + HOOK_SPECIFIC | HOOK_INJECTION | PROP_INJECTION | Priorité HOOK_INJECTION sur useChapterProgress |
| Course/sections/ChapterCourse | `from '../../../data' (type Chapitre)` | DATA_SPECIFIC | EXTRACT_AS_TYPE_ONLY | N/A | Type pur uniquement |
| Course/sections/ChapterFooter | `from '../../../data' (type Chapitre)`, `from '../../../store' (type SRSQuality)`, `from '../../RAGSources'` | DATA_SPECIFIC + STORE_SPECIFIC | PROP_INJECTION | EXTRACT_AS_TYPE_ONLY | Priorité PROP_INJECTION sur RAGSources |
| Course/sections/ChapterHeader | `from '../../../data' (types Chapitre, Categorie, CompetenceBO)` | DATA_SPECIFIC | EXTRACT_AS_TYPE_ONLY | N/A | Types purs uniquement |
| Course/sections/ChapterPractice | `from '../../../data' (types Chapitre, Categorie)`, `from '../../../store' (type HintLevel, useMathsLabStore)`, `from '../../DiagnosticPrerequis'`, `from '../../InteractiveGraph'`, `from '../../ExerciseEngine'`, `from '../../ProceduralExercise'` | DATA_SPECIFIC + STORE_SPECIFIC + LIB_SPECIFIC | PROP_INJECTION | EXTRACT_AS_TYPE_ONLY + STORE_FACTORY | Composant le plus complexe |
| Cockpit/CockpitView | `from '../../store' (useMathsLabStore, MathsLabState)`, `from '../../data' (programmeData, badgeDefinitions)`, `from '../RAG/RAGFlashCard'` | STORE_SPECIFIC + DATA_SPECIFIC | STORE_FACTORY | PROP_INJECTION | Priorité STORE_FACTORY sur useMathsLabStore |
| Cockpit/HeroPedagogique | `from '../../config/stage' (getStagePhase, getDaysUntilStage, etc.)`, `from '../../store' (useMathsLabStore)` | CONFIG_SPECIFIC + STORE_SPECIFIC | STORE_FACTORY | PROP_INJECTION | Priorité STORE_FACTORY sur useMathsLabStore |
| Cockpit/SeanceDuJour | `from '../../config/stage' (getTodaySession, formatDateFr)`, `from '../../data' (programmeData)` | CONFIG_SPECIFIC + DATA_SPECIFIC | PROP_INJECTION | N/A | Config stage + programmeData en props |
| Cockpit/FeuilleDeRoute | `from '../../config/stage' (STAGE_PRINTEMPS_2026, getStagePhase, formatDateFr)` | CONFIG_SPECIFIC | PROP_INJECTION | N/A | Config stage en prop |
| Cockpit/SyntheseEleve | `from '../../store' (useMathsLabStore)`, `from '../../data' (programmeData)` | STORE_SPECIFIC + DATA_SPECIFIC | STORE_FACTORY | PROP_INJECTION | Priorité STORE_FACTORY sur useMathsLabStore |
| Dashboard/DashboardView | `from '../../store' (useMathsLabStore)`, `from '../../data' (programmeData, dailyChallenges, badgeDefinitions, Categorie)` | STORE_SPECIFIC + DATA_SPECIFIC | STORE_FACTORY | PROP_INJECTION + EXTRACT_AS_TYPE_ONLY | Priorité STORE_FACTORY sur useMathsLabStore |
| Bilan/BilanView | `from '../../store' (useMathsLabStore)`, `from '../../data' (programmeData)`, `from '../../config/stage' (STAGE_PRINTEMPS_2026, getDaysUntilExam)`, `from '../../lib/bilan-pdf' (BilanPDFDownloadButton)` | STORE_SPECIFIC + DATA_SPECIFIC + CONFIG_SPECIFIC + LIB_SPECIFIC | STORE_FACTORY | PROP_INJECTION | Priorité STORE_FACTORY sur useMathsLabStore |
| Navigation/Navigation | `from '../../data' (programmeData)`, `from '../../store' (useMathsLabStore)` | DATA_SPECIFIC + STORE_SPECIFIC | STORE_FACTORY | PROP_INJECTION | Priorité STORE_FACTORY sur useMathsLabStore |
| layout/TopBar | Aucun import spécifique maths-1ere | N/A | DIRECT_MOVE | N/A | UI générique sans dépendance métier |
| layout/LoadingScreen | Aucun import spécifique maths-1ere | N/A | DIRECT_MOVE | N/A | UI générique sans dépendance métier |

---

## Synthèse par stratégie principale

Chaque composant compté une seule fois, sur sa stratégie dominante.

- **KEEP_SPECIFIC** : 1 (RAGRemediation - à vérifier)
- **DIRECT_MOVE** : 3 (RAGSources, layout/TopBar, layout/LoadingScreen)
- **PROP_INJECTION** : 5 (ExerciseEngine, Cockpit/FeuilleDeRoute, Cockpit/SeanceDuJour, Course/sections/ChapterFooter, Course/sections/ChapterPractice)
- **STORE_FACTORY** : 6 (Quiz/QuizEngine, RAG/RAGFlashCard, Cockpit/CockpitView, Cockpit/HeroPedagogique, Cockpit/SyntheseEleve, Dashboard/DashboardView, Bilan/BilanView, Navigation/Navigation)
- **HOOK_INJECTION** : 1 (Course/ChapterView)
- **EXTRACT_AS_TYPE_ONLY** : 3 (Course/sections/ChapterCourse, Course/sections/ChapterHeader, ProceduralExercise)

**Total : 21 composants**

---

## Stratégies secondaires

Composants qui combinent 2 ou 3 stratégies :

- `Quiz/QuizEngine` : STORE_FACTORY principal + PROP_INJECTION (quizData) + EXTRACT_AS_TYPE_ONLY (QuizQuestion)
- `RAG/RAGFlashCard` : STORE_FACTORY principal + PROP_INJECTION (programmeData)
- `ExerciseEngine` : PROP_INJECTION principal + EXTRACT_AS_TYPE_ONLY (types Exercice)
- `ProceduralExercise` : PROP_INJECTION principal + STORE_FACTORY (useMathsLabStore)
- `Course/sections/ChapterFooter` : PROP_INJECTION principal + EXTRACT_AS_TYPE_ONLY (types)
- `Course/sections/ChapterPractice` : PROP_INJECTION principal + EXTRACT_AS_TYPE_ONLY (types) + STORE_FACTORY (useMathsLabStore)
- `Cockpit/CockpitView` : STORE_FACTORY principal + PROP_INJECTION (programmeData, badgeDefinitions)
- `Cockpit/HeroPedagogique` : STORE_FACTORY principal + PROP_INJECTION (config stage)
- `Cockpit/SyntheseEleve` : STORE_FACTORY principal + PROP_INJECTION (programmeData)
- `Dashboard/DashboardView` : STORE_FACTORY principal + PROP_INJECTION (data) + EXTRACT_AS_TYPE_ONLY (Categorie)
- `Bilan/BilanView` : STORE_FACTORY principal + PROP_INJECTION (data, config stage, bilan-pdf)
- `Navigation/Navigation` : STORE_FACTORY principal + PROP_INJECTION (programmeData)
- `Course/ChapterView` : HOOK_INJECTION principal + PROP_INJECTION (programmeData)

---

## Recommandations

### 1. Création de `components/programme/shared/types/programme.ts`
Extraire tous les types partagés vers un fichier centralisé :
- `Chapitre`, `Categorie`, `CompetenceBO` (depuis data)
- `SRSQuality`, `HintLevel` (depuis store)
- `Exercice`, `ExerciceQCM`, `ExerciceNumerique`, `ExerciceOrdonnancement` (depuis data)
- `QuizQuestion` (depuis data)

### 2. Création de `components/programme/shared/types/store.ts`
Définir les interfaces abstraites pour stores :
- `ProgrammeStore` : contrat minimum pour les stores de programme
- `ChapterStore` : contrat pour les stores de progression chapitre

Le store EDS 1ère implémente déjà ces interfaces par signature. STMG et Terminale créeront leurs propres conformes plus tard.

### 3. Ordre d'extraction recommandé

**Vague 1 — DIRECT_MOVE (3 composants)**
- layout/TopBar
- layout/LoadingScreen
- RAGSources

**Vague 2 — EXTRACT_AS_TYPE_ONLY (3 composants)**
- Création types/programme.ts
- Course/sections/ChapterCourse
- Course/sections/ChapterHeader
- ProceduralExercise (types uniquement)

**Vague 3 — PROP_INJECTION simples (5 composants)**
- Cockpit/FeuilleDeRoute
- Cockpit/SeanceDuJour
- Course/sections/ChapterFooter
- Course/sections/ChapterPractice
- ExerciseEngine

**Vague 4 — STORE_FACTORY (6 composants)**
- Navigation/Navigation
- Cockpit/CockpitView
- Cockpit/HeroPedagogique
- Cockpit/SyntheseEleve
- Dashboard/DashboardView
- Bilan/BilanView

**Vague 5 — Combinés (4 composants)**
- Quiz/QuizEngine
- RAG/RAGFlashCard
- Course/ChapterView
- RAGRemediation (si confirmé non KEEP_SPECIFIC)

---

## Note sur KEEP_SPECIFIC

Seul RAGRemediation est marqué KEEP_SPECIFIC provisoirement, en attente de vérification des imports. Si aucun import spécifique maths-1ere n'est trouvé, il sera reclassifié en DIRECT_MOVE.

Les composants TopBar et LoadingScreen sont reclassifiés en DIRECT_MOVE car ils sont des UI génériques sans dépendance métier.

Ratio KEEP_SPECIFIC final : 0-1 sur 21 (0-5%), bien sous le seuil de 3.

