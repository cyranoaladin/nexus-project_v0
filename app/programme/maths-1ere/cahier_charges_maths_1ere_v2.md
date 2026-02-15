# 📘 CAHIER DES CHARGES : NEXUS MATHS LAB (V2) - SPÉCIALITÉ MATHS 1ÈRE

**Projet** : Plateforme d'apprentissage adaptative, gamifiée et interactive.
**Cible** : Élèves de Première Générale (Spécialité Mathématiques - 4h/semaine).
**Alignement** : Programme Officiel B.O. Éducation Nationale (2019).
**Version** : 2.0 (Refonte complète "Web App").

---

## 1. VISION ET OBJECTIFS STRATÉGIQUES

### 1.1 La Vision "Nexus"
L'objectif est de transformer la révision des mathématiques en une expérience active. L'élève ne doit plus subir le cours, mais le **manipuler**.
- **Du statique au dynamique** : Remplacer "Lire une formule" par "Jouer avec les paramètres de la formule".
- **De la solitude à la communauté** : Intégrer des mécaniques sociales et de progression (Gamification).
- **De l'échec à la maîtrise** : Utiliser l'erreur comme levier d'apprentissage via un feedback immédiat et bienveillant.

### 1.2 Le Cadre Pédagogique (Exigences Officielles)
Le site doit permettre de travailler les 6 compétences majeures du B.O. :
1. **Chercher** (Expérimenter avec des graphiques, émettre des conjectures).
2. **Modéliser** (Traduire un problème réel en équation/suite/fonction).
3. **Représenter** (Changer de registre : graphique <-> algébrique <-> géométrique).
4. **Raisonner** (Logique, démonstration, contraposée, récurrence).
5. **Calculer** (Automatismes, calcul littéral, calculatrice).
6. **Communiquer** (Rédiger une preuve, expliquer à l'oral).

---

## 2. ARCHITECTURE TECHNIQUE ET STACK (LE SOCLE)

Pour garantir fluidité et évolutivité (SaaS), l'architecture est celle d'une **Modern Web App**.

### 2.1 Stack Technologique
* **Frontend** : `Next.js 15` (App Router) + `React Server Components`.
* **Langage** : `TypeScript` (Strict mode).
* **Styling** : `Tailwind CSS` + `Shadcn/UI` (Accessibilité & Design System).
* **Backend (BaaS)** : `Supabase` (PostgreSQL, Auth, Realtime, Edge Functions).
* **State Management** : `Zustand` (Persistance locale + Sync Cloud).

### 2.2 Moteurs Mathématiques & Scientifiques
Le cœur du "Lab" repose sur des bibliothèques spécialisées :
1. **Rendu LaTeX** : `KaTeX` (Optimisé pour le re-rendu rapide).
2. **Saisie Mathématique** : `MathLive` (Clavier virtuel, reconnaissance de syntaxe).
3. **Calcul Formel** : `Compute Engine` (CortexJS) ou `Algebrite` (Validation des expressions symboliques, ex: $x(x+1) = x^2+x$).
4. **Graphiques Interactifs** : `Mafs` (React components) ou `JSXGraph` (Figures dynamiques).
5. **Python (Client-side)** : `Pyodide` (WebAssembly) pour exécuter le code Python dans le navigateur sans serveur.

---

## 3. UI/UX, GAMIFICATION & ENGAGEMENT

### 3.1 Design System : "Nexus Theme"
* **Ambiance** : "Laboratoire Futuriste". Fond sombre (`slate-950`), accents néons (`cyan-500`, `violet-500`).
* **Glassmorphism** : Panneaux translucides, flous d'arrière-plan.
* **Layout "Workstation"** : Écran scindé (Split-screen) :
    - **Gauche (35%)** : Le Manuel (Texte, Définitions, Théorèmes).
    - **Droite (65%)** : Le Lab (Graphique manipulable, Éditeur Python, Quiz).

### 3.2 Mécaniques de Gamification
* **Arbre de Compétences (Skill Tree)** : Visualisation des dépendances (ex: "Dérivation" requiert "Variations de fonctions").
* **Système d'XP et Niveaux** : Gain d'XP par exercice réussi. Rangs : *Novice* -> *Initié* -> *Expert* -> *Maître*.
* **Scaffolding (Coup de Pouce)** : Indices progressifs payants (en XP).
    - *Niveau 1* : Indice méthodologique (-10% XP).
    - *Niveau 2* : Première étape du calcul (-30% XP).
    - *Niveau 3* : Solution détaillée (-100% XP).
* **Streaks (Séries)** : Incitation à la régularité quotidienne.

### 3.3 Système Adaptatif (SRS)
* **Algorithme** : Spaced Repetition System (type Anki/SuperMemo).
* **Fonction** : Planifier les révisions en fonction de la courbe d'oubli de l'élève.
* **Dashboard** : Affichage des "Révisions du jour".

---

## 4. SPÉCIFICATIONS FONCTIONNELLES DÉTAILLÉES (PAR THÈME)

Cette section détaille le contenu pédagogique à implémenter, conformément au B.O.

### 🔴 THÈME 1 : ALGÈBRE

#### 1.1 Suites Numériques
* **Contenu** : Modes de génération ($u_n = f(n)$ et $u_{n+1} = f(u_n)$), suites arithmétiques et géométriques (sens de variation, limites), modélisation de phénomènes discrets (évolution de populations, intérêts financiers).
* **Lab Interactif** :
    - **Visualiseur de Convergence** : Graphique "Toile d'araignée" pour les suites récurrentes. L'élève bouge $u_0$ pour voir l'effet.
    - **Calcul de Somme** : Visualisation géométrique de $\sum k$ (triangle) et $\sum q^k$.
* **Algorithmique (Python)** :
    - Calcul de termes (boucle `for`).
    - Recherche de seuil (boucle `while`).
    - Somme de termes (accumulateur).

#### 1.2 Second Degré
* **Contenu** : Forme canonique, racines, factorisation, signe, inéquations, équations paramétriques.
* **Lab Interactif** : "Le Contrôleur de Parabole".
    - 3 Sliders ($a, b, c$).
    - Feedback visuel immédiat sur le nombre de racines (code couleur Delta).
* **Histoire** : Al-Khwarizmi et la résolution géométrique (complétion du carré).

### 🔵 THÈME 2 : ANALYSE

#### 2.1 Dérivation
* **Contenu** : Taux de variation, nombre dérivé (limite), tangente, fonction dérivée, opérations ($uv, u/v, u+v$), composée simple $x \mapsto \sqrt{ax+b}$, lien variations/signe, extremums.
* **Lab Interactif** : "La Tangente Glissante".
    - Zoomer sur une courbe pour voir la sécante devenir tangente.
    - Double graphique synchronisé : $f(x)$ en haut, $f'(x)$ en bas (Zones positives/négatives alignées avec Croissance/Décroissance).
* **Point de Vigilance** : Distinction claire entre le nombre dérivé (local) et la fonction dérivée (globale).

#### 2.2 Fonction Exponentielle
* **Contenu** : Définition ($f'=f, f(0)=1$), propriétés algébriques, courbe représentative, nombre d'Euler $e$, lien avec suites géométriques.
* **Lab Interactif** : "Méthode d'Euler".
    - Construction de l'exponentielle point par point en suivant la pente.
    - Comparaison de croissance ($e^x$ vs $x^n$).

#### 2.3 Fonctions Trigonométriques
* **Contenu** : Cercle trigonométrique, radian, cosinus/sinus, parité, périodicité, dérivées.
* **Lab Interactif** : "L'Enrouleur".
    - Enroulement de la droite réelle sur le cercle.
    - Génération des courbes sinusoïdales par projection temporelle.

### 🟣 THÈME 3 : GÉOMÉTRIE

#### 3.1 Calcul Vectoriel et Produit Scalaire
* **Contenu** : Définitions (projeté orthogonal, normes et angle, analytique $XX'+YY'$), propriétés (bilinéarité, identités remarquables), orthogonalité.
* **Lab Interactif** : "Le Projecteur".
    - Vecteurs manipulables.
    - Affichage dynamique du produit scalaire.
    - "Snap" visuel et sonore quand les vecteurs sont orthogonaux (PS = 0).

#### 3.2 Applications et Géométrie Repérée
* **Contenu** : Formule d'Al-Kashi, théorème de la médiane, équation cartésienne de droite (vecteur normal), équation de cercle.
* **Lab Interactif** : "Lignes de Niveau".
    - Déplacer un point $M$ tel que $\vec{n} \cdot \vec{AM} = 0$.
    - Visualiser l'ensemble des points (Droite ou Cercle).
* **Démonstration** : Reconstituer la preuve d'Al-Kashi (Puzzle de preuve).

### 🟠 THÈME 4 : PROBABILITÉS ET STATISTIQUES

#### 4.1 Probabilités Conditionnelles
* **Contenu** : Arbres pondérés, tableaux croisés, formule des probabilités totales, indépendance, partition de l'univers.
* **Lab Interactif** : "L'Arbre Constructeur".
    - Drag & drop pour construire des arbres.
    - Calcul automatique des probabilités de chemin (produit) et totales (somme).
    - Simulation : "Paradoxe du test médical" (comprendre $P_M(T)$ vs $P_T(M)$).

#### 4.2 Variables Aléatoires Réelles
* **Contenu** : Loi de probabilité littérale, espérance, variance, écart-type, répétition d'épreuves identiques et indépendantes (Bernoulli, Binomiale).
* **Lab Interactif** : "Simulation de Monte-Carlo".
    - Simuler 1000 lancers de dés/pièces pour voir la fréquence converger vers la probabilité.
    - Visualiser l'Espérance comme le centre de gravité de la distribution.

### 🐍 THÈME 5 : ALGORITHMIQUE & PROGRAMMATION

#### 5.1 Environnement et Concepts
* **Outil** : Console Python intégrée (Repl).
* **Concepts** :
    - **Listes** : Génération (compréhension, `range`), accès par index, parcours (`for x in L`), ajout (`append`).
    - **Fonctions** : Définition, arguments, retour.
    - **Bibliothèques** : `math`, `random`.

#### 5.2 Exercices "Fil Rouge"
* Simulation de marches aléatoires.
* Estimation de $\pi$ (Monte-Carlo).
* Problème de Galton (Planche de Galton simulée).

---

## 5. MODÈLE DE DONNÉES (SCHEMA BDD)

Structure relationnelle critique pour `Supabase`.

```sql
-- Structure du Programme
CREATE TABLE themes (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE, -- 'algebre', 'analyse', 'geometrie', 'probas'
  title TEXT,
  color_hex TEXT
);

CREATE TABLE chapters (
  id UUID PRIMARY KEY,
  theme_id UUID REFERENCES themes,
  title TEXT,
  order_index INT,
  is_published BOOLEAN DEFAULT false
);

-- Le Lab (Contenu Granulaire)
CREATE TABLE learning_nodes (
  id UUID PRIMARY KEY,
  chapter_id UUID REFERENCES chapters,
  type VARCHAR, -- 'LESSON', 'QUIZ', 'LAB_GRAPH', 'LAB_CODE'
  title TEXT,
  content_payload JSONB, -- Contient la config du composant React
  difficulty INT DEFAULT 1, -- Niveau 1 à 5
  xp_reward INT DEFAULT 10
);

-- Progression Utilisateur
CREATE TABLE user_progress (
  user_id UUID REFERENCES auth.users,
  node_id UUID REFERENCES learning_nodes,
  status VARCHAR, -- 'LOCKED', 'OPEN', 'COMPLETED', 'MASTERED'
  score INT,
  mistakes_log JSONB -- Pour l'analyse d'erreurs
);
```

---

## 6. ROADMAP ET JALONS

Le projet est découpé en 3 Sprints majeurs.

### Phase 1 : Socle Technique (J+15)
* [x] Setup Next.js + Supabase + Auth.
* [ ] Base de données (Schéma V1).
* [ ] Intégration KaTeX et Markdown pour les cours statiques.

### Phase 2 : Le Lab Interactif (J+45)
* [ ] Intégration Pyodide (Console Python).
* [ ] Intégration Mafs/JSXGraph (Composants graphiques réutilisables).
* [ ] Développement du module "Second Degré" et "Suites" (Preuve de concept).

### Phase 3 : Gamification & Contenu Complet (J+90)
* [ ] Système d'XP et Arbre de Compétences.
* [ ] Algorithme SRS.
* [ ] Remplissage de la BDD avec les 4 Thèmes complets.
* [ ] Tests E2E et validation Mobile.

---

**Note de fin** : Ce document constitue la référence unique pour le développement de la V2. Il garantit que chaque ligne de code servira une intention pédagogique précise, validée par le programme officiel.
