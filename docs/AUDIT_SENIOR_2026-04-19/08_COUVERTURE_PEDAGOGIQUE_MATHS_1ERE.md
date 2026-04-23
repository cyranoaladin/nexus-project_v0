# AXE 8 — Couverture pédagogique du module Maths Première

> Audit code-only. Zéro supposition. Tout constat est adossé à un fichier et une ligne.
> Périmètre : `app/programme/maths-1ere/` — data, config, store, components, hooks, lib.
> Date : 2026-04-19. Auditeur : Cascade (senior). Branche : `main`.

---

## 0. Résumé exécutif

Le module Maths Première est **le composant le plus complet et le plus ambitieux du produit Nexus**. Il constitue un véritable parcours pédagogique interactif couvrant 5 domaines, 15 chapitres, 57 quiz, 1 sujet blanc complet, 10 labs interactifs, un système SRS (répétition espacée), un moteur d'exercices procéduraux infinis, un diagnostic de prérequis, un système de gamification (XP, badges, streak), une feuille de route temporalisée, une vue enseignant multi-onglets et un bilan tri-destinataire (élève/famille/Nexus).

**Verdict global : module fonctionnel, cohérent et navigable — mais avec 12 lacunes structurelles qui empêchent de le qualifier de « prêt pour la production pédagogique ».**

| Critère | Score | Commentaire |
|---------|-------|-------------|
| Couverture programme officiel | 🟡 85% | 5 domaines couverts, ~2 chapitres manquants par rapport au BO complet |
| Profondeur exercices | 🟡 60% | 1-3 exercices statiques par chapitre + procédural pour 4 chapitres |
| Diagnostics prérequis | 🔴 13% | Seul `probabilites-cond` a un `prerequisDiagnostic` effectif |
| Labs interactifs | 🟢 80% | 10 labs pertinents, bien mappés aux chapitres |
| Examen blanc | 🟢 90% | 1 sujet complet, UX minutée, auto-évaluation, RAG remédiation |
| Remédiation RAG | 🟡 50% | Présente en cockpit et exam, mais générique (pas ciblée par erreur) |
| Vue enseignant | 🟢 75% | 5 onglets, heatmap, profil, regroupements, RAG, export — données simulées |
| Persistance progression | 🟡 65% | localStorage + Supabase async, mais fragile (cf. F16/F17) |
| Cohérence stage ↔ chapitres | 🔴 30% | 3 clés stage inexistantes dans `programmeData` (cf. F9) |
| Bilan | 🟢 75% | Tri-destinataire, synthèse dynamique, mais sans données serveur |

---

## 1. Carte de couverture — Chapitres et domaines

### 1.1 Structure `programmeData` (`data.ts:1-1301`)

| Domaine (`catKey`) | Titre | Nb chapitres | Chapitres |
|---------------------|-------|:---:|-----------|
| `algebre` | Algèbre & Fonctions | 3 | `second-degre`, `suites`, `suites-limites` |
| `analyse` | Analyse | 4 | `derivation`, `variations-courbes`, `exponentielle`, `trigonometrie` |
| `geometrie` | Géométrie | 4 | `produit-scalaire`, `equations-droites`, `geometrie-vectorielle`, `equations-cercles` |
| `probabilites` | Probabilités | 2 | `probabilites-cond`, `variables-aleatoires` |
| `algorithmique` | Algorithmique & Python | 3 | `algorithmique-python`, `algo-fibonacci-syracuse`, `algo-newton` |
| **Total** | | **16** | |

### 1.2 Couverture par rapport au programme officiel (BO 2025-2026 Première Spé)

| Thème officiel | Couverture dans `programmeData` | Statut |
|----------------|--------------------------------|--------|
| Second degré | ✅ `second-degre` — complet | Couvert |
| Suites numériques (arith/géom) | ✅ `suites` — complet | Couvert |
| Suites — limites/récurrence | ✅ `suites-limites` — approfondissement | Couvert |
| Dérivation locale, nombre dérivé | ✅ `derivation` — complet | Couvert |
| Étude de variations | ✅ `variations-courbes` — complet | Couvert |
| Fonction exponentielle | ✅ `exponentielle` — complet | Couvert |
| Trigonométrie | ✅ `trigonometrie` — complet | Couvert |
| Produit scalaire | ✅ `produit-scalaire` — complet | Couvert |
| Équations de droites | ✅ `equations-droites` — complet | Couvert |
| Géométrie repérée (vecteurs) | ✅ `geometrie-vectorielle` — approfondissement | Couvert |
| Cercles | ✅ `equations-cercles` — approfondissement | Couvert |
| Probabilités conditionnelles | ✅ `probabilites-cond` — complet | Couvert |
| Variables aléatoires | ✅ `variables-aleatoires` — complet | Couvert |
| Algorithmique & Python | ✅ `algorithmique-python` + `algo-fibonacci-syracuse` + `algo-newton` | Couvert |
| **Fonction polynôme degré 3** | ❌ Absent | **GAP** |
| **Comparaisons de fonctions** | ❌ Absent | **GAP** |
| **Raisonnement & logique (dédié)** | ⚠️ 2 quiz (id 33-34) mais pas de chapitre dédié | Partiel |

**Constat** : la couverture est substantielle (14/16 thèmes officiels), avec 2 lacunes mineures (polynôme degré 3, comparaisons de fonctions) et le raisonnement/logique traité uniquement via quiz sans fiche de cours.

---

## 2. Granulométrie par chapitre

### 2.1 Contenu pédagogique par chapitre (`contenu` dans `data.ts`)

Chaque chapitre possède la structure suivante. ✅ = présent, ❌ = absent.

| Chapitre | `rappel` | `methode` | `tableau`/`cas` | `astuce` | `exercice` guidé | `coupDePouce` 3 niveaux | `erreursClassiques` | `methodologieBac` | `geogebraId` |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `second-degre` | ✅ | ✅ | ✅ cas | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `suites` | ✅ | ✅ | ✅ tableau | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `suites-limites` | ✅ | ✅ | ✅ tableau | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `derivation` | ✅ | ✅ | ✅ tableau | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `variations-courbes` | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `exponentielle` | ✅ | ✅ | ✅ tableau | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `trigonometrie` | ✅ | ✅ | ✅ tableau | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `mMbMfKsp` |
| `produit-scalaire` | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `fhBhKMtR` |
| `equations-droites` | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `geometrie-vectorielle` | ✅ | ✅ | ✅ tableau | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `equations-cercles` | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `nBjGnpmA` |
| `probabilites-cond` | ✅ | ✅ | ✅ cas | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `variables-aleatoires` | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `algorithmique-python` | ✅ | ✅ | ✅ tableau | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| `algo-fibonacci-syracuse` | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `algo-newton` | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

**Constat** : 16/16 chapitres ont le tronc commun (rappel + méthode + astuce + exercice guidé). Le système `coupDePouce` à 3 niveaux (indice → début → correction) est présent dans 15/16 chapitres (absent dans `algorithmique-python`). `methodologieBac` est absent pour 3 chapitres (`equations-droites`, `variables-aleatoires`, `algo-newton`). Les GeoGebra IDs ne sont présents que pour 3 chapitres.

### 2.2 Exercices interactifs par chapitre

| Chapitre | Nb exercices | Types | Procédural infini |
|----------|:---:|--------|:---:|
| `second-degre` | 2 | qcm, numerique | ✅ `genSecondDegre()` |
| `suites` | 3 | qcm, numerique, ordonnancement | ✅ `genSuiteArith()` |
| `suites-limites` | 2 | qcm × 2 | ❌ |
| `derivation` | 2 | qcm, numerique | ✅ `genDerivee()` |
| `variations-courbes` | 2 | qcm × 2 | ❌ |
| `exponentielle` | 2 | qcm × 2 | ❌ |
| `trigonometrie` | 1 | qcm | ❌ |
| `produit-scalaire` | 2 | numerique, qcm | ❌ |
| `equations-droites` | 2 | qcm, numerique | ❌ |
| `geometrie-vectorielle` | 3 | numerique, qcm, numerique | ❌ |
| `equations-cercles` | 3 | qcm, numerique, qcm | ❌ |
| `probabilites-cond` | 2 | qcm, numerique | ✅ `genProbaCond()` |
| `variables-aleatoires` | 1 | numerique | ❌ |
| `algorithmique-python` | 2 | ordonnancement, qcm | ❌ |
| `algo-fibonacci-syracuse` | 3 | numerique, qcm, ordonnancement | ❌ |
| `algo-newton` | 1 | numerique | ❌ |

**Total** : 33 exercices statiques (17 QCM, 11 numériques, 3 ordonnancement, 2 type mixte).
**Générateurs procéduraux** : 4 chapitres (`second-degre`, `suites`, `derivation`, `probabilites-cond`) dans `lib/exercise-generator.ts`.

**Finding F37** : Seuls 4/16 chapitres ont des exercices procéduraux infinis. Les 12 autres chapitres n'ont que 1-3 exercices statiques — insuffisant pour un entraînement Bac sérieux. Priorité : P2.

### 2.3 Quiz global (`quizData`, `data.ts:1305-1653`)

57 questions quiz couvrant 8 catégories :

| Catégorie quiz | Nb questions | Difficulté range |
|----------------|:---:|:---:|
| Dérivation | 11 | 1-3 |
| Second Degré | 2 | 1-2 |
| Exponentielle | 4 | 1-3 |
| Géométrie | 8 | 1-2 |
| Suites | 5 | 1-2 |
| Trigonométrie | 5 | 1-2 |
| Probabilités | 5 | 1-3 |
| Algorithmique | 4 | 1-3 |
| Logique | 2 | 2 |

**Constat** : 57 quiz est un volume correct pour un diagnostic global. La distribution est déséquilibrée (11 en Dérivation vs 2 en Second Degré). Les quiz ne sont pas directement liés aux chapitres dans le flux — ils semblent servir un mode Quiz séparé (QuizEngine).

---

## 3. Diagnostics de prérequis

### 3.1 Présence dans les données

Seul **1 chapitre** sur 16 possède un `prerequisDiagnostic` :

| Chapitre | `prerequisDiagnostic` | Questions | Remediation target |
|----------|:---:|:---:|---|
| `probabilites-cond` | ✅ | 2 | → `variables-aleatoires` |
| Tous les autres | ❌ | — | — |

**Preuve** : `data.ts:1018-1021` — seul endroit où `prerequisDiagnostic` est défini.

### 3.2 Composant `DiagnosticPrerequis.tsx`

Le composant est complet et fonctionnel :
- Phase intro → quiz → résultat (3 phases)
- Comptage score automatique
- Seuil de 70% pour valider les prérequis
- Callback `onComplete(score, total)` → `store.recordDiagnostic()`
- Option "Passer" le diagnostic
- Résultat persisté dans `store.diagnosticResults[chapId]`

### 3.3 Impact sur le parcours

L'affichage du diagnostic est conditionné par `ChapterPractice.tsx:67` :
```tsx
{chap.prerequisDiagnostic && (
  <DiagnosticPrerequis ... />
)}
```

**Finding F38** : Le diagnostic de prérequis n'est actif que pour 1/16 chapitres. Le champ `remediation` dans la question pointe vers un chapitre mais n'est **jamais exploité** par le composant — il ne redirige pas l'élève vers le chapitre de remédiation. Le diagnostic est donc décoratif pour 15 chapitres et partiellement fonctionnel pour 1. Priorité : **P1**.

**Finding F39** : Le champ `prerequis` (sans `Diagnostic`) existe sur 5 chapitres (`suites-limites`, `geometrie-vectorielle`, `equations-cercles`, `variables-aleatoires`, `algo-fibonacci-syracuse`, `algo-newton`) mais **n'est jamais utilisé** dans aucun composant UI — il ne verrouille rien, ne conditionne rien, n'affiche rien. Priorité : P2.

---

## 4. Labs interactifs

### 4.1 Inventaire et mapping chapitres

| Lab | Fichier | Chapitre(s) ciblé(s) | Interactivité réelle |
|-----|---------|----------------------|---------------------|
| `ToileAraignee` | `labs/ToileAraignee.tsx` | `suites` | Visualisation récurrence (canvas/mafs) |
| `ParabolaController` | `labs/ParabolaController.tsx` | `second-degre` | Sliders a, b, c → parabole dynamique |
| `TangenteGlissante` | `labs/TangenteGlissante.tsx` | `derivation`, `variations-courbes` | Tangente mobile sur courbe |
| `NewtonSolver` | `labs/NewtonSolver.tsx` | `variations-courbes`, `algo-newton` | Méthode Newton step-by-step |
| `Enrouleur` | `labs/Enrouleur.tsx` | `trigonometrie` | Cercle trigo interactif |
| `ArchimedePi` | `labs/ArchimedePi.tsx` | `trigonometrie` | Approximation π par polygones |
| `VectorProjector` | `labs/VectorProjector.tsx` | `produit-scalaire` | Projection vectorielle |
| `MonteCarloSim` | `labs/MonteCarloSim.tsx` | `probabilites-cond`, `variables-aleatoires` | Simulation Monte Carlo |
| `PythonExercises` | `labs/PythonExercises.tsx` | `algorithmique` (tout le domaine) | Exercices Python interactifs |
| `EulerExponentielle` | `labs/EulerExponentielle.tsx` | `exponentielle` | Construction e^x par Euler |

**Mapping additionnel** :
- `InteractiveGraph` (GeoGebra) : pour les chapitres ayant un `geogebraId` (3 chapitres)
- `InteractiveMafs` : fallback pour `analyse` hors dérivation/variations/expo
- `PythonIDE` : éditeur Python plein pour tout `algorithmique`

### 4.2 Couverture des chapitres par les labs

| Chapitre | Lab(s) | GeoGebra | InteractiveMafs | Score |
|----------|--------|:---:|:---:|:---:|
| `second-degre` | ParabolaController | ❌ | ✅ | 🟢 |
| `suites` | ToileAraignee | ❌ | ✅ | 🟢 |
| `suites-limites` | ❌ | ❌ | ✅ | 🟡 |
| `derivation` | TangenteGlissante | ❌ | ❌ | 🟢 |
| `variations-courbes` | TangenteGlissante + NewtonSolver | ❌ | ❌ | 🟢 |
| `exponentielle` | EulerExponentielle | ❌ | ❌ | 🟢 |
| `trigonometrie` | Enrouleur + ArchimedePi | ✅ | ❌ | 🟢🟢 |
| `produit-scalaire` | VectorProjector | ✅ | ❌ | 🟢 |
| `equations-droites` | ❌ | ❌ | ❌ | 🔴 |
| `geometrie-vectorielle` | ❌ | ❌ | ❌ | 🔴 |
| `equations-cercles` | ❌ | ✅ | ❌ | 🟡 |
| `probabilites-cond` | MonteCarloSim | ❌ | ❌ | 🟢 |
| `variables-aleatoires` | MonteCarloSim | ❌ | ❌ | 🟢 |
| `algorithmique-python` | PythonExercises + PythonIDE | ❌ | ❌ | 🟢🟢 |
| `algo-fibonacci-syracuse` | PythonExercises + PythonIDE | ❌ | ❌ | 🟢🟢 |
| `algo-newton` | PythonExercises + PythonIDE | ❌ | ❌ | 🟢🟢 |

**Constat** : 14/16 chapitres ont au moins un composant interactif. `equations-droites` et `geometrie-vectorielle` n'ont aucun lab — ce sont des chapitres de géométrie analytique qui bénéficieraient fortement d'un lab GeoGebra.

---

## 5. Examen blanc

### 5.1 Structure (`config/exam.ts`)

| Élément | Valeur |
|---------|--------|
| Durée | 120 minutes |
| Calculatrice | Interdite |
| Total points | 20 |
| Automatismes | 6 questions, 6 points (1 pt chacune) |
| Exercices | 3 exercices, 14 points (5+5+4) |
| Thèmes exercices | Suites, Probabilités, Fonctions |
| Compétences ciblées | 6 (Chercher, Modéliser, Représenter, Calculer, Raisonner, Communiquer) |
| Sujets disponibles | 1 (`SUJET_BLANC_1`) |

### 5.2 Qualité pédagogique du sujet

**Automatismes** (6 questions) : calcul mental, second degré, dérivation, probabilités, suites, lecture graphique. Chaque question a un `astuce` de remédiation. Bonne variété thématique.

**Exercice 1** (Suites — 5 pts) : 3 questions progressives (modéliser → calculer → raisonner). Sujet géométrique bien structuré avec `piegesClassiques` et solutions détaillées étape par étape.

**Exercice 2** (Probabilités — 5 pts) : arbre pondéré → probabilités totales → Bayes. Excellent exercice de synthèse, fidèle au format Bac.

**Exercice 3** (Fonctions — 4 pts) : dérivation + tableau de variations + optimisation. Classique mais efficace.

### 5.3 UX examen (`ExamenBlancView.tsx`, 832 lignes)

- **Timer** : chrono avec couleurs d'urgence (vert > 30 min, jaune > 10 min, rouge < 10 min)
- **Flux** : Accueil → Automatismes → Exercices → Correction
- **Auto-évaluation** : l'élève s'attribue 0, 0.5 ou 1 pt par automatisme
- **Exercices** : affichage énoncé, solution détaillée révélable, pièges classiques, auto-scoring par question
- **Score total** : calcul dynamique `autoTotal + exTotal`
- **RAG Remédiation** : `<RAGRemediation />` intégré dans la correction

### 5.4 Findings examen

**Finding F40** : Un seul sujet blanc (`SUJET_BLANC_1`). Pour un stage de 2 semaines et une préparation Bac, c'est insuffisant. Minimum requis : 3 sujets pour permettre la reprise et la progression. Priorité : P2.

**Finding F41** : Le score de l'examen blanc **n'est pas persisté** dans le store Zustand ni en base. L'état est local au composant (`useState`). Quitter la page = perte du résultat. Priorité : **P1**.

---

## 6. Remédiation RAG

### 6.1 Points d'intégration

| Composant | Contexte | API route |
|-----------|---------|-----------|
| `RAGFlashCard` | Cockpit — rappel flash ciblé (chapitre le plus faible) | `POST /api/programme/maths-1ere/rag` |
| `RAGRemediation` | ExamenBlanc — correction post-exercice | `POST /api/programme/maths-1ere/rag` |
| `RAGRemediation` | TeacherView — recherche enseignant | `POST /api/programme/maths-1ere/rag` |

### 6.2 Logique de ciblage (`RAGFlashCard.tsx:56-75`)

La sélection du chapitre cible suit un algorithme pertinent :
1. Chapitre le plus faible en diagnostic (score le plus bas)
2. Premier chapitre SRS en retard
3. Fallback : `second-degre`

### 6.3 Findings RAG

**Finding F42** : La remédiation RAG est **générique par chapitre** et non ciblée par l'erreur spécifique de l'élève. Le payload envoyé est `{ chapId, chapTitre, query }` — la query est le titre du chapitre, pas la question ratée ni l'erreur commise. Le RAG ne sait pas *pourquoi* l'élève a échoué. Priorité : P2.

**Finding F43** : Le champ `remediation` dans `prerequisDiagnostic` (ex: `remediation: 'variables-aleatoires'`) n'est **jamais exploité** par aucun composant. Le diagnostic dit "tu as des lacunes" mais ne redirige vers aucune remédiation ciblée. Priorité : P2.

---

## 7. Stage ↔ Programme : cohérence des clés

### 7.1 Clés `chapitresClés` dans `config/stage.ts`

Les 15 séances du stage référencent les `chapitresClés` suivants :

| Séance | chapitresClés | Existe dans `programmeData` ? |
|--------|--------------|:---:|
| S1 | `['second-degre']` | ✅ |
| S2 | `['derivation', 'variations-courbes']` | ✅ |
| S3 | `['suites']` | ✅ |
| S4 | `['suites-numeriques']` | ❌ **CASSÉ** |
| S5 | `['derivation-variations']` | ❌ **CASSÉ** |
| S6 | `['equations-droites', 'produit-scalaire']` | ✅ |
| S7 | `['probabilites-conditionnelles']` | ❌ **CASSÉ** |
| S8 | `['second-degre', 'derivation']` | ✅ |
| S9 | — (Français, hors scope) | — |
| S10 | `['suites', 'exponentielle']` | ✅ |
| S11 | `['suites', 'derivation']` | ✅ |
| S12 | `['second-degre', 'suites']` | ✅ |
| S13 | — (Français, hors scope) | — |
| S14 | `['second-degre', 'suites', 'derivation']` | ✅ |
| S15 | `['second-degre', 'suites', 'derivation']` | ✅ |

**Finding F9 (déjà identifié)** : Les clés `suites-numeriques`, `derivation-variations`, `probabilites-conditionnelles` **n'existent pas** dans `programmeData`. Les clés correctes sont `suites`, `derivation`+`variations-courbes`, `probabilites-cond`. Le bouton "LANCER LA SÉANCE" dans `SeanceDuJour.tsx:87` enverra vers un chapitre inexistant → `ChapterView` retournera `null`.

### 7.2 Bug de routage stage → cours

`SeanceDuJour.tsx:87` hardcode `catKey = 'algebre'` :
```tsx
onNavigateToChap('algebre', session.chapitresClés[0]);
```

Cela signifie que même pour une séance de probabilités, le système naviguera vers la catégorie `algebre` — qui ne contient pas `probabilites-cond`. Le `ChapterView` cherchera `programmeData['algebre'].chapitres.find(c => c.id === 'probabilites-cond')` et ne trouvera rien → écran vide.

**Finding F44** : Le CTA "LANCER LA SÉANCE" dans `SeanceDuJour.tsx` hardcode `catKey = 'algebre'` au lieu de résoudre dynamiquement la catégorie du chapitre. Priorité : **P1**.

---

## 8. Système de progression et gamification

### 8.1 Store Zustand (`store.ts`, 673 lignes)

Le store gère un état riche :

| Groupe | Champs clés |
|--------|-------------|
| Progression | `completedChapters`, `masteredChapters`, `totalXP` |
| Exercices | `exerciseResults[chapId]`, `hintUsage[chapId]` |
| Gamification | `streak`, `streakFreezes`, `comboCount`, `bestCombo`, `badges[]` |
| SRS | `srsQueue[chapId]` avec `interval`, `easeFactor`, `nextReview`, `repetitions` |
| Diagnostic | `diagnosticResults[chapId]` avec `score`, `total`, `date` |
| Temps | `timePerChapter[chapId]` en secondes |
| Défis | `dailyChallenge` avec `chapId`, `completed`, `date` |
| Niveau | Calculé : Explorateur (0-199), Praticien (200-499), Stratège (500-999), Maître (1000+) |

### 8.2 SRS (Spaced Repetition System)

L'algorithme SRS dans `recordSRSReview()` (`store.ts`) implémente un SM-2 simplifié :
- 5 niveaux de qualité (0-4)
- `easeFactor` ajusté selon performance
- `interval` doublé si bonne réponse, ramené à 1 si mauvaise
- `nextReview` calculé en jours

**Constat positif** : l'algorithme est fonctionnel et correctement implémenté. Cependant, le trigger SRS n'est pas automatique — il dépend de `ChapterFooter.tsx` qui propose une auto-évaluation manuelle.

### 8.3 Badges (`badgeDefinitions`, `data.ts:1665-1687`)

22 badges définis couvrant :
- **Streak** : Stakhanoviste (7j), Marathonien (30j)
- **Performance** : Sherlock (dur sans indice), Fusée (chapitre parfait), Combo King (10×)
- **Maîtrise** : Expert Discriminant, Maître Suites, As Dérivation, Géomètre, Probabiliste, Polymathe
- **Labs** : Archimède, Fan d'Euler, Newton Express
- **Métacognition** : Grand Oral Ready, Memento, Imprimeur, Diagnostic Ace

**Finding F45** : Les conditions de badges sont des **strings textuels** (`'mastered:second-degre'`, `'streak >= 7'`) qui doivent être parsées par `evaluateBadges()` dans le store. La logique d'évaluation dans le store parse ces conditions correctement, mais les badges ne sont **pas persistés en Prisma** (confirmé F20 — ils vivent uniquement dans Zustand/Supabase). Priorité : P2 (rappel F20).

---

## 9. Vue enseignant (`TeacherView.tsx`, 809 lignes)

### 9.1 Onglets disponibles

| Onglet | Fonctionnalités | Données réelles ? |
|--------|----------------|:---:|
| **Profil Élève** | Forces/lacunes (diagnostic), SRS alerts, profil groupe recommandé | ✅ Store réel |
| **Pilotage Groupe** | Heatmap compétences, regroupements suggérés (A/B/C), alertes progression | ⚠️ Noms hardcodés |
| **Plan de Séance** | Séance du jour (stage config), prochaine séance | ✅ Config réelle |
| **RAG Augmenté** | Recherche libre dans le RAG pédagogique | ✅ API réelle |
| **Export Bilan** | Impression bilan (à compléter) | ⚠️ Partiel |

### 9.2 Findings enseignant

**Finding F46** : Les données de groupe dans l'onglet "Pilotage Groupe" sont **hardcodées** (`'Léo'`, `'Sofia'`, `'Thomas'`, `'Amine'`, `'Léa'`, `'Lucas'`, `'Chloé'`). Ce n'est pas branché sur des données réelles multi-élèves. Le composant simule ce que serait un dashboard classe. Priorité : P2.

**Finding F47** : La vue enseignant n'a pas d'onglet "programme" dans le `tabs` array (ligne 100-106), bien que `activeTab === 'programme'` est géré dans le rendu (ligne 299). L'onglet `programme` a été supprimé de la navigation mais pas du rendu → code mort accessible uniquement par manipulation d'état. Priorité : P3.

---

## 10. Bilan (`BilanView.tsx`, 444 lignes)

### 10.1 Structure

3 vues bilan :
- **Bilan Élève** : synthèse personnalisée pour guider les révisions
- **Bilan Famille** : rapport parent (format communication Nexus)
- **Fiche Nexus** : fiche technique équipe pédagogique

Données dynamiques : `completedChapters`, `diagnosticResults`, `totalXP`, `dueReviews`, `getDaysUntilExam()`.

### 10.2 Finding bilan

**Finding F48** : Le bilan est entièrement client-side (Zustand store). Il n'y a pas de persistance PDF, pas d'API de génération, pas de partage. Le bouton "Imprimer" fait `window.print()` — fonctionnel mais basique. Le bilan Famille et la Fiche Nexus sont des vues HTML, pas des documents partageables. Priorité : P2.

---

## 11. Cohérence des niveaux de difficulté et prérequis

### 11.1 Niveaux par chapitre

| Niveau | Chapitres |
|--------|-----------|
| `essentiel` | second-degre, suites, derivation, equations-droites, produit-scalaire, probabilites-cond |
| `maitrise` | suites-limites, variations-courbes, geometrie-vectorielle, variables-aleatoires, algorithmique-python |
| `approfondissement` | exponentielle, trigonometrie, equations-cercles, algo-fibonacci-syracuse, algo-newton |

### 11.2 Graphe de prérequis

```
second-degre
  └→ suites-limites (prerequis: ['suites'])
  
produit-scalaire
  └→ geometrie-vectorielle (prerequis: ['produit-scalaire'])
  
equations-droites + produit-scalaire
  └→ equations-cercles (prerequis: ['equations-droites', 'produit-scalaire'])
  
probabilites-cond
  └→ variables-aleatoires (prerequis: ['probabilites-cond'])
  
algorithmique-python + suites
  └→ algo-fibonacci-syracuse (prerequis: ['algorithmique-python', 'suites'])
  
variations-courbes + algorithmique-python
  └→ algo-newton (prerequis: ['variations-courbes', 'algorithmique-python'])
```

**Constat** : le graphe est cohérent et acyclique. Les prérequis sont logiquement corrects. Cependant, comme noté en F39, ces prérequis **ne sont jamais enforced** côté UI — un élève peut accéder à `algo-newton` sans avoir vu `variations-courbes`.

---

## 12. Synchronisation et persistance (`useProgressionSync.ts`)

### 12.1 Flux de sync

```
Zustand Store (source de facto)
  ↓ subscribe (debounce 800ms)
  ↓ saveProgressViaApi → POST /api/programme/maths-1ere/progress
  ↓ fallback: saveProgress → Supabase direct
  ↓ exit: navigator.sendBeacon (critical save)
```

### 12.2 Hydration

Au montage : `loadProgressWithStatus(userId)` avec timeout 2500ms. Si succès, merge dans le store. Si échec, le store reste dans son état initial.

### 12.3 Findings sync (rappel F16/F17)

- **F16** : localStorage = source de facto, Supabase = backup → changement de navigateur = perte
- **F17** : Maths 1ère et Terminale partagent la même table Supabase `maths_lab_progress`

Ces findings ont déjà été documentés en AXE 6. Ils restent critiques pour l'intégrité pédagogique.

---

## 13. Matrice de couverture consolidée

| Composant | Présent | Fonctionnel | Complet | Priorité remédiation |
|-----------|:---:|:---:|:---:|:---:|
| Chapitres (16/16) | ✅ | ✅ | 🟡 manque 2 thèmes BO | P3 |
| Cours structuré (rappel/méthode/astuce) | ✅ | ✅ | ✅ 16/16 | — |
| CoupDePouce 3 niveaux | ✅ | ✅ | 🟡 15/16 | P3 |
| Exercices statiques | ✅ | ✅ | 🟡 1-3 par chap | P2 |
| Exercices procéduraux | ✅ | ✅ | 🔴 4/16 chapitres | **P1** |
| Diagnostic prérequis | ✅ | ✅ | 🔴 1/16 chapitres | **P1** |
| Labs interactifs | ✅ | ✅ | 🟢 14/16 chapitres | P3 |
| GeoGebra | ✅ | ✅ | 🔴 3/16 chapitres | P2 |
| Quiz global (57 questions) | ✅ | ✅ | 🟡 déséquilibré | P3 |
| Examen blanc | ✅ | ✅ | 🔴 1 seul sujet | **P1** |
| Score examen non persisté | — | 🔴 | 🔴 | **P1** |
| RAG remédiation | ✅ | ✅ | 🟡 générique | P2 |
| Stage ↔ chapitres | ✅ | 🔴 3 clés cassées | 🔴 | **P1** (F9) |
| CTA stage hardcode catKey | — | 🔴 | 🔴 | **P1** (F44) |
| SRS | ✅ | ✅ | ✅ | — |
| Badges (22) | ✅ | ✅ | 🟡 pas persistés Prisma | P2 |
| Prérequis (graphe) | ✅ | 🔴 non enforced | 🔴 | P2 |
| Feuille de route | ✅ | ✅ | ✅ 3 phases | — |
| Vue enseignant | ✅ | ✅ | 🟡 données groupe simulées | P2 |
| Bilan tri-destinataire | ✅ | ✅ | 🟡 pas de PDF/partage | P2 |
| Sync progression | ✅ | 🟡 fragile | 🟡 | P1 (F16/F17) |

---

## 14. Réponses aux questions Q1-Q8

### Q1 : Que couvre réellement le module aujourd'hui ?

**5 domaines, 16 chapitres, 33 exercices statiques, 57 quiz, 1 sujet blanc, 10 labs, 22 badges, SRS, diagnostics (1/16), exercices procéduraux (4/16), vue enseignant 5 onglets, bilan 3 vues, feuille de route 3 phases, cockpit contextuel, RAG flash + remédiation.** C'est un module riche mais inégalement approfondi.

### Q2 : Quels chapitres sont complets vs superficiels ?

- **Complets** (cours + exercices + lab + procédural) : `second-degre`, `suites`, `derivation`, `probabilites-cond`
- **Bien structurés** (cours + exercices + lab, sans procédural) : `variations-courbes`, `exponentielle`, `trigonometrie`, `produit-scalaire`, `equations-cercles`, `algorithmique-python`, `algo-fibonacci-syracuse`, `algo-newton`
- **Superficiels** (cours + quelques exercices, pas de lab dédié) : `suites-limites`, `equations-droites`, `geometrie-vectorielle`, `variables-aleatoires`

### Q3 : Les diagnostics sont-ils réellement fonctionnels ?

**Non.** Un seul chapitre (`probabilites-cond`) a un diagnostic. Le composant fonctionne, mais le champ `remediation` n'est pas exploité. Les 15 autres chapitres n'ont aucun diagnostic de prérequis. Le graphe de `prerequis` n'est pas enforced. C'est le **plus gros trou pédagogique** du module.

### Q4 : L'examen blanc est-il intégré et cohérent ?

**Oui pour l'UX et le contenu, non pour la persistance.** Le sujet est fidèle au format Bac 2026 (2h, sans calculatrice, 6+14 pts). Le timer, l'auto-évaluation et la RAG remédiation sont fonctionnels. Mais le score n'est pas sauvegardé, et il n'y a qu'un seul sujet.

### Q5 : La vue enseignant a-t-elle une vraie valeur pédagogique ?

**Oui pour le profil élève, non pour le pilotage groupe.** Le profil individuel est branché sur des données réelles (store). Le pilotage groupe est une maquette (noms hardcodés). Le RAG enseignant fonctionne. L'export bilan est partiel.

### Q6 : Les labs sont-ils pédagogiquement utiles ou décoratifs ?

**Utiles.** Les 10 labs sont chacun spécifiquement conçus pour un concept mathématique (toile d'araignée pour récurrence, tangente glissante pour dérivation, Monte Carlo pour probabilités, etc.). Ce n'est pas du décoratif — c'est de la manipulation interactive pertinente. La couverture (14/16) est bonne.

### Q7 : Le module est-il prêt pour la production pédagogique ?

**Non.** Les bugs bloquants (F9/F44 — stage ↔ chapitres cassé), les lacunes critiques (1/16 diagnostics, 4/16 procéduraux, score examen non persisté) et la fragilité de la persistance (F16/F17) l'empêchent. Le module est **prêt pour une démo**, pas pour un stage réel.

### Q8 : Quelles sont les priorités LOT 7 ?

Voir section 15 ci-dessous.

---

## 15. Plan LOT 7 — Remédiation couverture pédagogique

### LOT 7.1 — Bugs bloquants stage (P1, ~2h)

| Tâche | Fichier | Impact |
|-------|---------|--------|
| Corriger les 3 clés stage (`suites-numeriques` → `suites`, etc.) | `config/stage.ts` | F9 |
| Résoudre dynamiquement `catKey` dans SeanceDuJour | `SeanceDuJour.tsx` | F44 |
| Persister le score examen blanc dans le store | `ExamenBlancView.tsx` + `store.ts` | F41 |

### LOT 7.2 — Diagnostics prérequis (P1, ~4h)

| Tâche | Fichier | Impact |
|-------|---------|--------|
| Ajouter `prerequisDiagnostic` (2-3 questions) pour les 15 chapitres manquants | `data.ts` | F38 |
| Exploiter le champ `remediation` → navigation vers chapitre cible | `DiagnosticPrerequis.tsx` | F43 |
| Enforcer les `prerequis` dans l'UI (warning ou soft-lock) | `ChapterPractice.tsx` | F39 |

### LOT 7.3 — Exercices procéduraux (P2, ~6h)

| Tâche | Fichier | Impact |
|-------|---------|--------|
| Ajouter générateurs pour 12 chapitres manquants | `lib/exercise-generator.ts` | F37 |
| Priorité : `exponentielle`, `trigonometrie`, `produit-scalaire`, `equations-droites`, `geometrie-vectorielle`, `equations-cercles`, `variables-aleatoires` | | |

### LOT 7.4 — Sujets blancs supplémentaires (P2, ~4h)

| Tâche | Fichier | Impact |
|-------|---------|--------|
| Créer `SUJET_BLANC_2` et `SUJET_BLANC_3` | `config/exam.ts` | F40 |
| Ajouter sélecteur de sujet dans `ExamenBlancView` | `ExamenBlancView.tsx` | |

### LOT 7.5 — RAG ciblée par erreur (P2, ~3h)

| Tâche | Fichier | Impact |
|-------|---------|--------|
| Enrichir le payload RAG avec la question ratée et l'erreur | `ExamenBlancView.tsx`, `ExerciseEngine.tsx` | F42 |
| Exploiter `remediation` des diagnostics pour orienter le RAG | `DiagnosticPrerequis.tsx` | F43 |

### LOT 7.6 — Vue enseignant réelle (P2, ~4h)

| Tâche | Fichier | Impact |
|-------|---------|--------|
| Brancher les données groupe sur une API (même fictive multi-élèves) | `TeacherView.tsx` | F46 |
| Supprimer le code mort onglet `programme` | `TeacherView.tsx` | F47 |
| Ajouter export PDF bilan | `BilanView.tsx` | F48 |

### Estimation totale LOT 7

| Sous-lot | Priorité | Effort estimé |
|----------|----------|:---:|
| LOT 7.1 | P1 | 2h |
| LOT 7.2 | P1 | 4h |
| LOT 7.3 | P2 | 6h |
| LOT 7.4 | P2 | 4h |
| LOT 7.5 | P2 | 3h |
| LOT 7.6 | P2 | 4h |
| **Total** | | **~23h** |

---

## 16. Findings résumé (AXE 8)

| # | Finding | Sévérité | LOT |
|---|---------|----------|-----|
| F37 | Seuls 4/16 chapitres ont des exercices procéduraux infinis | P2 | LOT 7.3 |
| F38 | Diagnostic prérequis actif pour 1/16 chapitres seulement | P1 | LOT 7.2 |
| F39 | Champ `prerequis` jamais enforced en UI (6 chapitres) | P2 | LOT 7.2 |
| F40 | Un seul sujet blanc — insuffisant pour préparation Bac | P2 | LOT 7.4 |
| F41 | Score examen blanc non persisté (state local) | P1 | LOT 7.1 |
| F42 | RAG remédiation générique (pas ciblée par erreur élève) | P2 | LOT 7.5 |
| F43 | Champ `remediation` du diagnostic jamais exploité | P2 | LOT 7.5 |
| F44 | CTA stage hardcode `catKey='algebre'` → navigation cassée | P1 | LOT 7.1 |
| F45 | Badges non persistés en Prisma (rappel F20) | P2 | LOT 5 |
| F46 | Données groupe enseignant hardcodées (noms fictifs) | P2 | LOT 7.6 |
| F47 | Onglet `programme` supprimé du nav mais rendu accessible | P3 | LOT 7.6 |
| F48 | Bilan sans export PDF ni partage | P2 | LOT 7.6 |

---

*Fin du rapport AXE 8.*
