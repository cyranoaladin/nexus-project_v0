# Lot E — Diagnostic de refactor des composants partagés

**Date:** 2026-04-28
**Branche:** feat/programme-shared-extraction-and-terminale-parity
**Objectif:** Identifier les dépendances bloquantes et stratégies de découplage pour 21 composants à extraire.

---

## Tableau de diagnostic

| Composant | Imports problématiques | Catégorie de dépendance | Stratégie de découplage |
|-----------|----------------------|------------------------|-------------------------|
| ExerciseEngine | `../data` (types Exercice, ExerciceQCM, ExerciceNumerique, ExerciceOrdonnancement), `../lib/math-engine` (areEquivalentAnswers) | DATA_SPECIFIC, LIB_SPECIFIC | EXTRACT_AS_TYPE_ONLY pour les types (vers shared/types.ts), PROP_INJECTION pour areEquivalentAnswers |
| ProceduralExercise | `../lib/exercise-generator` (GENERATORS), `../lib/math-engine` (areEquivalentAnswers), `../store` (useMathsLabStore) | LIB_SPECIFIC, STORE_SPECIFIC | PROP_INJECTION pour GENERATORS et areEquivalentAnswers, STORE_FACTORY pour useMathsLabStore |
| Quiz/QuizEngine | `../../store` (useMathsLabStore), `../../data` (quizData, type QuizQuestion) | STORE_SPECIFIC, DATA_SPECIFIC | STORE_FACTORY pour useMathsLabStore, PROP_INJECTION pour quizData, EXTRACT_AS_TYPE_ONLY pour QuizQuestion |
| RAG/RAGFlashCard | `../../store` (useMathsLabStore), `../../data` (programmeData) | STORE_SPECIFIC, DATA_SPECIFIC | STORE_FACTORY pour useMathsLabStore, PROP_INJECTION pour programmeData (ou interface ProgrammeData) |
| RAG/RAGRemediation | Aucun (déjà utilise MathContent shared) | N/A | KEEP_SPECIFIC - composant déjà mutualisé via MathContent |
| RAGSources | Aucun import spécifique maths-1ere | N/A | PROP_INJECTION - composant générique, ne nécessite pas d'extraction spécifique |
| Course/ChapterView | `../../data` (programmeData), `../../hooks/useChapterProgress` | DATA_SPECIFIC, HOOK_SPECIFIC | PROP_INJECTION pour programmeData, HOOK_INJECTION pour useChapterProgress |
| Course/sections/ChapterCourse | `../../../data` (type Chapitre) | DATA_SPECIFIC | EXTRACT_AS_TYPE_ONLY pour type Chapitre |
| Course/sections/ChapterFooter | `../../../data` (type Chapitre), `../../../store` (type SRSQuality), `../../RAGSources` | DATA_SPECIFIC, STORE_SPECIFIC | EXTRACT_AS_TYPE_ONLY pour types Chapitre et SRSQuality, PROP_INJECTION pour RAGSources |
| Course/sections/ChapterHeader | `../../../data` (types Chapitre, Categorie, CompetenceBO) | DATA_SPECIFIC | EXTRACT_AS_TYPE_ONLY pour types Chapitre, Categorie, CompetenceBO |
| Course/sections/ChapterPractice | `../../../data` (types Chapitre, Categorie), `../../../store` (type HintLevel, useMathsLabStore), `../../DiagnosticPrerequis`, `../../InteractiveGraph`, `../../ExerciseEngine`, `../../ProceduralExercise` | DATA_SPECIFIC, STORE_SPECIFIC, LIB_SPECIFIC | EXTRACT_AS_TYPE_ONLY pour types, STORE_FACTORY pour useMathsLabStore, PROP_INJECTION pour composants DiagnosticPrerequis, InteractiveGraph, ExerciseEngine, ProceduralExercise |
| Cockpit/CockpitView | `../../store` (useMathsLabStore, type MathsLabState), `../../data` (programmeData, badgeDefinitions), `../RAG/RAGFlashCard` | STORE_SPECIFIC, DATA_SPECIFIC | STORE_FACTORY pour useMathsLabStore, PROP_INJECTION pour programmeData et badgeDefinitions, PROP_INJECTION pour RAGFlashCard |
| Cockpit/HeroPedagogique | `../../config/stage` (getStagePhase, getDaysUntilStage, getDaysUntilExam, getTodaySession, getNextSession, formatDateFr), `../../store` (useMathsLabStore) | CONFIG_SPECIFIC, STORE_SPECIFIC | PROP_INJECTION pour config stage, STORE_FACTORY pour useMathsLabStore |
| Cockpit/SeanceDuJour | `../../config/stage` (getTodaySession, formatDateFr), `../../data` (programmeData) | CONFIG_SPECIFIC, DATA_SPECIFIC | PROP_INJECTION pour config stage, PROP_INJECTION pour programmeData |
| Cockpit/FeuilleDeRoute | `../../config/stage` (STAGE_PRINTEMPS_2026, getStagePhase, formatDateFr) | CONFIG_SPECIFIC | PROP_INJECTION pour config stage |
| Cockpit/SyntheseEleve | `../../store` (useMathsLabStore), `../../data` (programmeData) | STORE_SPECIFIC, DATA_SPECIFIC | STORE_FACTORY pour useMathsLabStore, PROP_INJECTION pour programmeData |
| Dashboard/DashboardView | `../../store` (useMathsLabStore), `../../data` (programmeData, dailyChallenges, badgeDefinitions, type Categorie) | STORE_SPECIFIC, DATA_SPECIFIC | STORE_FACTORY pour useMathsLabStore, PROP_INJECTION pour data, EXTRACT_AS_TYPE_ONLY pour type Categorie |
| Bilan/BilanView | `../../store` (useMathsLabStore), `../../data` (programmeData), `../../config/stage` (STAGE_PRINTEMPS_2026, getDaysUntilExam), `../../lib/bilan-pdf` (BilanPDFDownloadButton) | STORE_SPECIFIC, DATA_SPECIFIC, CONFIG_SPECIFIC, LIB_SPECIFIC | STORE_FACTORY pour useMathsLabStore, PROP_INJECTION pour data et config stage, PROP_INJECTION pour BilanPDFDownloadButton |
| Navigation/Navigation | `../../data` (programmeData), `../../store` (useMathsLabStore) | DATA_SPECIFIC, STORE_SPECIFIC | PROP_INJECTION pour programmeData, STORE_FACTORY pour useMathsLabStore |
| layout/TopBar | Aucun import spécifique maths-1ere | N/A | KEEP_SPECIFIC - composant générique UI, ne nécessite pas d'extraction |
| layout/LoadingScreen | Aucun import spécifique maths-1ere | N/A | KEEP_SPECIFIC - composant générique UI, ne nécessite pas d'extraction |

---

## Résumé des stratégies

### Composants KEEP_SPECIFIC (3)
- **RAGRemediation**: Déjà utilise MathContent shared, composant spécifique RAG
- **layout/TopBar**: Composant UI générique, aucune dépendance maths-1ere
- **layout/LoadingScreen**: Composant UI générique, aucune dépendance maths-1ere

### Composants à extraire avec PROP_INJECTION (8)
- ExerciseEngine (areEquivalentAnswers)
- Quiz/QuizEngine (quizData)
- RAG/RAGFlashCard (programmeData)
- Course/ChapterView (programmeData)
- Course/sections/ChapterFooter (RAGSources)
- Course/sections/ChapterPractice (composants labs)
- Cockpit/CockpitView (programmeData, badgeDefinitions, RAGFlashCard)
- Cockpit/SyntheseEleve (programmeData)

### Composants à extraire avec STORE_FACTORY (7)
- ProceduralExercise (useMathsLabStore)
- Quiz/QuizEngine (useMathsLabStore)
- RAG/RAGFlashCard (useMathsLabStore)
- Course/ChapterView (useChapterProgress)
- Course/sections/ChapterPractice (useMathsLabStore)
- Cockpit/CockpitView (useMathsLabStore)
- Cockpit/HeroPedagogique (useMathsLabStore)
- Cockpit/SyntheseEleve (useMathsLabStore)
- Dashboard/DashboardView (useMathsLabStore)
- Bilan/BilanView (useMathsLabStore)
- Navigation/Navigation (useMathsLabStore)

### Composants à extraire avec EXTRACT_AS_TYPE_ONLY (5)
- ExerciseEngine (types Exercice, ExerciceQCM, etc.)
- Quiz/QuizEngine (type QuizQuestion)
- Course/sections/ChapterCourse (type Chapitre)
- Course/sections/ChapterFooter (types Chapitre, SRSQuality)
- Course/sections/ChapterHeader (types Chapitre, Categorie, CompetenceBO)
- Course/sections/ChapterPractice (types Chapitre, Categorie, HintLevel)
- Dashboard/DashboardView (type Categorie)

### Composants avec dépendances CONFIG_SPECIFIC (3)
- Cockpit/HeroPedagogique (config stage)
- Cockpit/SeanceDuJour (config stage)
- Cockpit/FeuilleDeRoute (config stage)
- Bilan/BilanView (config stage)

### Composants avec dépendances LIB_SPECIFIC (2)
- ExerciseEngine (areEquivalentAnswers)
- ProceduralExercise (GENERATORS, areEquivalentAnswers)
- Course/sections/ChapterPractice (labs)
- Bilan/BilanView (BilanPDFDownloadButton)

---

## Recommandations

1. **Créer `components/programme/shared/types.ts`**: Extraire tous les types partagés (Chapitre, Categorie, CompetenceBO, Exercice, QuizQuestion, SRSQuality, HintLevel, etc.)

2. **Créer interfaces abstraites pour stores**: `ProgrammeStore`, `ChapterStore` dans `components/programme/shared/types.ts`

3. **Ordre d'extraction recommandé**:
   - Phase 1: Types uniquement (EXTRACT_AS_TYPE_ONLY)
   - Phase 2: Composants avec PROP_INJECTION simple (sans store)
   - Phase 3: Composants avec STORE_FACTORY
   - Phase 4: Composants complexes avec multiples dépendances

4. **Composants complexes nécessitant attention particulière**:
   - Course/sections/ChapterPractice (5 dépendances différentes)
   - Bilan/BilanView (4 catégories de dépendances)
   - Cockpit/CockpitView (3 catégories + dépendances internes)

---

## Note sur KEEP_SPECIFIC

Seuls 3 composants sur 21 sont marqués KEEP_SPECIFIC, tous justifiés:
- RAGRemediation: Déjà mutualisé via MathContent
- TopBar: UI générique sans dépendance métier
- LoadingScreen: UI générique sans dépendance métier

Ce ratio (14%) est acceptable et indique que la conception EDS 1ère est suffisamment découplée pour permettre l'extraction.
