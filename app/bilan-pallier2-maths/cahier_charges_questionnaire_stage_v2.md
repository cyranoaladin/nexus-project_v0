# 📘 CAHIER DES CHARGES : MOTEUR DE DIAGNOSTIC DYNAMIQUE (V2)

**Projet** : Moteur de questionnaire adaptatif multi-programmes.
**Cible** : Élèves de Première et Terminale (Spécialités Maths & NSI).
**Architecture** : Pipeline de données semi-automatique (PDF -> Mapping -> Definition).
**Version** : 2.0 (Architecture "Invariant Système").

---

## 1. VISION ET OBJECTIFS

### 1.1 L'Objectif "Universel"
Créer un **moteur de diagnostic unique** capable de charger dynamiquement n'importe quel programme officiel (Maths, NSI, Physique...) sans modifier le code source de l'application.
Le système distingue strictement :
- **Le Moteur (Invariant)** : Logique de questionnaire, scoring, UI.
- **La Définition (Variable)** : Contenu pédagogique, poids, règles métier.

### 1.2 Le Pipeline de Données (Data Pipeline)
Pour garantir la maintenabilité face aux changements de programmes, nous refusons le codage en dur.
**Flux de production des données** :
1.  **Sources** : PDFs officiels du Ministère.
2.  **Extraction (ETL)** : Scripts semi-automatiques générant des *candidats skills* (`generated.json`).
3.  **Mapping (Vérité)** : Fichiers YAML humains validant et structurant les compétences (`map.yml`).
4.  **Compilation** : Génération des définitions TypeScript utilisées par l'app (`definitions.ts`).

---

## 2. ARCHITECTURE TECHNIQUE & STACK

### 2.1 Stack Technologique
* **App** : `Next.js 15`, `React Server Components`.
* **Data** : `JSON` (Definitions), `YAML` (Mappings).
* **Scripting** : `Node.js` / `TS-Node` (Pipeline ETL).
* **AI** : `OpenAI API` (Analyse LLM, RAG).

### 2.2 Structure du "Diagnostic Engine"
Le moteur charge une `DiagnosticDefinition` unique au runtime contenant :
* `id` : Identifiant unique (ex: `maths-premiere-p2`).
* `domains` : Arborescence des compétences pondérées.
* `riskModel` : Facteurs de risque spécifiques à la matière.
* `ragStrategy` : Collections documentaires associées.
* `llmPrompts` : Instructions système pour la génération de bilan.

---

## 3. SPÉCIFICATIONS DES PROGRAMMES (DEFINITIONS)

Quatre définitions initiales doivent être implémentées.

### 3.1 📐 MATHS - PREMIÈRE (`maths-premiere-p2`)
* **Source** : Programme 2019.
* **Structure (Poids indicatifs)** :
    - **Algèbre (22%)** : Suites, Second degré.
    - **Analyse (22%)** : Dérivation, Variations.
    - **Géométrie (18%)** : Produit scalaire, Géométrie repérée.
    - **Probabilités (18%)** : Conditionnelles, Variables aléatoires.
    - **Algorithmique (10%)** : Boucles, Listes Python.
    - **Logique (10%)** : Raisonnement, Ensembles.
* **Risk Model** : Focus sur *Calcul sans calculatrice*, *Rigueur rédactionnelle*.

### 3.2 📐 MATHS - TERMINALE (`maths-terminale-p2`)
* **Source** : Programme 2020.
* **Structure** :
    - **Analyse (28%)** : Limites, Continuité, Logarithme, Primitives.
    - **Algèbre/Géo (37%)** : Combinatoire, Espace, Vecteurs.
    - **Probabilités (20%)** : Loi Binomiale, Succès/Échec.
    - **Algorithmique (15%)** : Listes avancées.
* **Risk Model** : *Abstraction*, *Gestion du temps*, *Démonstration*.

### 3.3 💻 NSI - PREMIÈRE (`nsi-premiere-p2`)
* **Source** : Programme officiel NSI 1ère.
* **Structure** :
    - **Data (40%)** : Représentation (Binaire, Hexa), Types de base.
    - **Algo (20%)** : Complexité naissante, Tris.
    - **Python (25%)** : Syntaxe, Fonctions, Modularité.
    - **Architecture (15%)** : OS, Réseaux simples, IHM.
* **Risk Model** : *Compréhension du code*, *Débuggage*, *Logique booléenne*.

### 3.4 💻 NSI - TERMINALE (`nsi-terminale-p2`)
* **Source** : Programme officiel NSI Tle.
* **Structure** :
    - **Structures de Données (25%)** : Arbres, Graphes, Piles/Files.
    - **Bases de Données (15%)** : SQL, Modèle relationnel.
    - **Algo Avancé (25%)** : Récursivité, Diviser pour régner.
    - **Réseaux/OS (20%)** : Routage, Processus, Sécurité.
    - **Programmation Objet (15%)** : Classes, Méthodes.
* **Risk Model** : *Abstraction des structures*, *SQL*, *Complexité*.

---

## 4. PIPELINE DE DONNÉES (DÉTAILLÉ)

### 4.1 Étape 1 : Extraction (ETL)
Script `extract_programme.ts` :
- Lit le PDF.
- Utilise des heuristiques (puces, gras, structure de colonnes) pour identifier les "Skills Candidats".
- Produit `programs/generated/{key}.skills.generated.json`.

### 4.2 Étape 2 : Mapping (Humain)
Fichier `programs/mapping/{key}.skills.map.yml` :
- C'est la source de vérité.
- Permet de :
    - Renommer des skills mal extraits.
    - Fusionner des doublons.
    - Exclure le bruit (titres, intros).
    - Assigner des `stable_ids` (ex: `ALG_SUITES`).

### 4.3 Étape 3 : Compilation
Script `compile_definitions.ts` :
- Lit le JSON généré et le YAML de mapping.
- Vérifie l'intégrité (tous les IDs sont uniques, tous les skills mappés existent).
- Génère `lib/diagnostics/definitions/generated/{key}.domains.json`.

---

## 5. UI & UX ADAPTATIVE

### 5.1 Sélecteur de Diagnostic (Wizard)
- Étape 0 : L'élève choisit "Maths" ou "NSI" et son niveau.
- Action : L'UI charge la définition correspondante (`/api/definitions?id=...`).

### 5.2 Rendu du Questionnaire
Le composant `DiagnosticForm` est agnostique :
- Il itère sur `definition.domains`.
- Il affiche les skills.
- Il utilise `definition.examFormat` pour le timer et les règles.

### 5.3 Feedback & Bilan (LLM)
- Le prompt système est injecté dynamiquement :
    - **Maths** : "Tu es un professeur de mathématiques exigeant sur la rédaction..."
    - **NSI** : "Tu es un expert en informatique, focus sur l'optimisation et la propreté du code..."

---

## 6. SÉCURITÉ ET CONFORMITÉ

* **RBAC** : Les définitions complètes (avec prompts et règles de scoring) ne sont accessibles qu'au STAFF ou via une API sécurisée côté serveur.
* **Validation** : Les données utilisateur (réponses) sont validées par rapport au schéma de la définition active (pour éviter d'injecter des réponses hors-sujet).
* **Versionnage** : Chaque définition a une version (`v1.0`, `v1.1`) pour assurer la cohérence des bilans historiques.

---

## 7. FEUILLE DE ROUTE (ROADMAP)

### Phase 1 : Outillage (J+5)
- [ ] Création des scripts d'extraction PDF.
- [ ] Définition du schéma YAML de mapping.

### Phase 2 : Données & Mapping (J+10)
- [ ] Génération des 4 fichiers JSON bruts.
- [ ] Rédaction des 4 fichiers YAML de mapping (Travail pédagogique).

### Phase 3 : Moteur & UI (J+20)
- [ ] Mise à jour du `DiagnosticEngine` pour charger les définitions JSON.
- [ ] Adaptation de l'UI pour le sélecteur Discipline/Niveau.

### Phase 4 : Validation (J+25)
- [ ] Tests unitaires sur le compilateur de définitions.
- [ ] Vérification manuelle des bilans générés par le LLM pour chaque matière.

---

**Note** : Ce cahier des charges assure que l'application peut passer de "Maths Only" à "Multi-Matières" sans dette technique, grâce à une séparation stricte entre le Code (Moteur) et la Donnée (Définitions).
