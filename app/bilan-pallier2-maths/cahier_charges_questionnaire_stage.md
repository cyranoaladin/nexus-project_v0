Parfait. Nous allons maintenant **verrouiller l’architecture pédagogique et technique** du questionnaire dynamique en l’adossant explicitement aux **4 programmes officiels** (Maths 1ère, Maths Tle, NSI 1ère, NSI Tle), afin que le moteur adapte réellement :

* les **domaines**,
* les **compétences (skills)**,
* le **mini-test**,
* les **pondérations readiness/risk**,
* les **prompts LLM**,
* et la **stratégie RAG**,

en fonction du couple *(discipline, niveau)*.

Je vous fournis ici la **version finale structurée à implémenter dans les 4 definitions**, directement alignée sur les programmes officiels.

---

# 1️⃣ EDS MATHS – PREMIÈRE

Source officielle : *Programme de mathématiques de première générale* 

Organisation officielle (page 1 du programme) :

* Algèbre
* Analyse
* Géométrie
* Probabilités et statistiques
* Algorithmique et programmation
* Vocabulaire ensembliste et logique

---

## 🎯 Structure domains pour `maths-premiere-p2`

```ts
domains = [
  { domainId: "algebra", label: "Algèbre", weight: 0.22 },
  { domainId: "analysis", label: "Analyse", weight: 0.22 },
  { domainId: "geometry", label: "Géométrie", weight: 0.18 },
  { domainId: "prob_stats", label: "Probabilités & statistiques", weight: 0.18 },
  { domainId: "algo_prog", label: "Algorithmique & programmation", weight: 0.10 },
  { domainId: "logic_sets", label: "Logique & ensembles", weight: 0.10 }
]
```

### Exemple de skills détaillés

### Algèbre

* Suites arithmétiques
* Suites géométriques
* Limite intuitive de suite
* Second degré (forme canonique)
* Discriminant
* Factorisation

### Analyse

* Dérivation (règles)
* Tangente
* Taux de variation
* Sens de variation
* Problèmes d’optimisation

### Algorithmique

* Écriture d’algorithme simple
* Boucles
* Variables
* Simulations simples

---

# 2️⃣ EDS MATHS – TERMINALE

Structure officielle analogue mais plus avancée.

Domaines typiques :

```ts
[
  { id: "analysis", weight: 0.28 },
  { id: "algebra", weight: 0.22 },
  { id: "geometry", weight: 0.15 },
  { id: "prob_stats", weight: 0.20 },
  { id: "algorithmic", weight: 0.15 }
]
```

### Skills supplémentaires :

* Limites formalisées
* Dérivée seconde
* Convexité
* Primitives
* Intégrale
* Loi binomiale
* Variables aléatoires
* Exponentielle / logarithme
* Suites récurrentes avancées

---

# 3️⃣ EDS NSI – PREMIÈRE

Programme structuré en grands axes :

* Représentation des données
* Traitement des données
* Interaction homme-machine
* Architecture des machines
* Algorithmique
* Programmation Python

---

## 🎯 domains `nsi-premiere-p2`

```ts
[
  { id: "data_representation", weight: 0.20 },
  { id: "data_processing", weight: 0.20 },
  { id: "algorithms", weight: 0.20 },
  { id: "python_programming", weight: 0.25 },
  { id: "systems_architecture", weight: 0.15 }
]
```

### Skills exemples :

Data representation :

* Binaire
* Encodage texte
* Tableaux
* Structures simples

Algorithmique :

* Boucles
* Conditions
* Complexité intuitive

Python :

* Fonctions
* Listes
* Dictionnaires
* Parcours de structures

---

# 4️⃣ EDS NSI – TERMINALE

Axes structurants :

```ts
[
  { id: "data_structures", weight: 0.25 },
  { id: "algorithmic_advanced", weight: 0.25 },
  { id: "databases", weight: 0.15 },
  { id: "networks", weight: 0.15 },
  { id: "systems_os", weight: 0.10 },
  { id: "python_advanced", weight: 0.10 }
]
```

### Skills :

* Arbres
* Graphes
* Parcours DFS/BFS
* Complexité O(n), O(log n)
* SQL
* Requêtes SELECT/JOIN
* TCP/IP
* Protocoles
* Gestion mémoire
* Récursion

---

# 🔄 Adaptation dynamique du questionnaire

## Étape 0 du formulaire

L’élève choisit :

* Discipline : Maths / NSI
* Niveau : Première / Terminale

➡️ Le frontend charge `/api/diagnostics/definitions`
➡️ Le backend renvoie uniquement les domains correspondants

---

# ⚙️ Adaptation scoring par discipline

## Risk Model Maths

Facteurs :

* Mini-test sans calculatrice
* Gestion temps
* Rédaction
* Justification
* Stress

## Risk Model NSI

Facteurs :

* Lisibilité code
* Capacité debug
* Compréhension invariants
* Complexité algorithmique
* Gestion temps

---

# 🎯 Adaptation du RAG

Maths Première :

```
collections = [
  "programme_maths_premiere_officiel",
  "exercices_suites_second_degre",
  "optimisation_premiere"
]
```

NSI Terminale :

```
collections = [
  "structures_donnees",
  "graphes_bfs_dfs",
  "sql_requetes",
  "complexite_algorithmique"
]
```

---

# 🧠 Adaptation LLM Prompt par discipline

Exemple STUDENT – Maths :

> Tu es professeur agrégé de mathématiques en terminale générale.
> Rédige un bilan structuré, pédagogique, exigeant et bienveillant…

Exemple STUDENT – NSI :

> Tu es professeur de NSI spécialisé en algorithmique et structures de données…
> Analyse précisément la robustesse du raisonnement informatique…

---

# 📊 Structure JSON unique conservée (invariant système)

Toutes disciplines utilisent :

```json
competencies.domains[].items[].{
  mastery,
  confidence,
  friction,
  errorTypes,
  evidence
}
```

Ce qui change :

* domains injectés par definition
* riskModel
* examFormat
* llm.prompts
* rag.collections

---

# 🔐 Sécurité & conformité

* Liste diagnostics = STAFF only
* Lecture publique uniquement via token hashé
* discipline & level stockés dans DB
* définition versionnée via promptVersion

---

# 🏗 Architecture finale validée

| Couche                 | Status            |
| ---------------------- | ----------------- |
| JSON canon unique      | ✅                 |
| Multi-discipline       | ✅                 |
| Multi-niveau           | ✅                 |
| Scoring paramétrable   | ✅                 |
| Risk model dynamique   | ✅                 |
| RAG adaptable          | ✅                 |
| LLM prompts versionnés | ✅                 |
| Staff JSON exploitable | (commit 12 prévu) |
| RBAC sécurisé          | ✅                 |

---

Voici une proposition **concrète, exécutable et “sans flou”** pour obtenir une **génération (semi-)automatique des skills à partir des PDFs officiels**, via un **mapping structuré**, et l’intégrer proprement dans votre moteur `lib/diagnostics/engine/*` + registry `lib/diagnostics/definitions/*`.

L’idée centrale : **ne jamais “inventer” une taxonomie** côté code. On extrait **des “candidats skills”** depuis les PDFs, puis on les **stabilise** via un **mapping YAML** (contrôlé, versionné, diffable) qui produit les fichiers TS/JSON de definitions. C’est la seule approche robuste : l’extraction PDF est **bruitée** (colonnes, tableaux, puces, sauts de lignes), donc **100% automatique** = fragile et non maintenable.

---

## Objectif technique

À partir des 4 PDFs (Maths 1ère/Tle, NSI 1ère/Tle), produire automatiquement :

1. un fichier **canon** `skills.generated.json` (par programme), contenant :

* les **domaines**
* les **skills**
* un lien “officiel” (référence / ancrage) vers le texte extrait (trace)

2. un fichier de **mapping structuré** `skills.map.yml` (éditable), qui :

* renomme / fusionne / supprime des items bruités
* impose des **IDs stables**
* ajoute tags / poids / priorités / correspondances scoring / RAG

3. les **definitions** finales `lib/diagnostics/definitions/*` alimentées par ces mappings :

* `maths-premiere-p2`
* `maths-terminale-p2`
* `nsi-premiere-p2`
* `nsi-terminale-p2`

---

# Checklist Git (commits) — “diff mental” ultra concret

## COMMIT 1 — Outillage d’extraction + formats de sortie

### ✅ Nouveaux fichiers

#### `tools/programmes/extract_programme_text.ts`

But : extraction texte stable (pdfplumber/pdfminer côté Node via `pdf-parse` ou côté Python via script appelé).
**Signature** :

```ts
export type ExtractedProgramme = {
  sourcePdf: string;
  extractedAt: string;
  pages: Array<{ page: number; text: string }>;
  fullText: string;
};

export async function extractProgrammeText(pdfPath: string): Promise<ExtractedProgramme>;
```

#### `tools/programmes/segment_programme.ts`

But : segmentation “sections” (domaines/chapitres) + items (candidats skills) via heuristiques.
**Signature** :

```ts
export type SkillCandidate = {
  rawLabel: string;
  normalizedLabel: string;
  confidence: number; // 0..1
  anchors: Array<{ page?: number; excerpt: string }>;
};

export type ProgrammeCandidates = {
  programmeKey: "maths_premiere" | "maths_terminale" | "nsi_premiere" | "nsi_terminale";
  sections: Array<{
    rawTitle: string;
    normalizedTitle: string;
    candidates: SkillCandidate[];
  }>;
};

export function segmentProgramme(extracted: ExtractedProgramme, programmeKey: ProgrammeCandidates["programmeKey"]): ProgrammeCandidates;
```

#### `tools/programmes/generate_skills_json.ts`

But : produit le JSON brut `skills.generated.json`.
**Signature** :

```ts
export async function generateSkillsJson(args: {
  programmeKey: ProgrammeCandidates["programmeKey"];
  pdfPath: string;
  outDir: string; // e.g. "programmes/generated"
}): Promise<void>;
```

### ✅ Fichiers générés (committés)

* `programmes/generated/maths_premiere.skills.generated.json`
* `programmes/generated/maths_terminale.skills.generated.json`
* `programmes/generated/nsi_premiere.skills.generated.json`
* `programmes/generated/nsi_terminale.skills.generated.json`

> Remarque : on commit ces JSON car ils servent de **preuve** / traçabilité.

---

## COMMIT 2 — Mapping structuré (contrat) + compilateur

### ✅ Nouveaux fichiers

#### `programmes/mapping/skills.schema.json`

But : schéma du mapping (validé en CI).

#### `programmes/mapping/maths_premiere.skills.map.yml`

#### `programmes/mapping/maths_terminale.skills.map.yml`

#### `programmes/mapping/nsi_premiere.skills.map.yml`

#### `programmes/mapping/nsi_terminale.skills.map.yml`

Format minimal recommandé (diffable, explicite) :

```yaml
programmeKey: maths_premiere
schemaVersion: v1.3

domains:
  - domainId: algebra
    domainLabel: "Algèbre"
    weight: 0.22
    fromCandidates:
      include:
        - "Suites"
        - "Second degré"
      exclude:
        - "Objectifs"           # bruit
        - "Histoire"            # bruit
    skills:
      - skillId: ALG_SUITES_BASE
        label: "Suites : définition, variations, itérations"
        mergeFrom:
          - "Suites (définition, sens de variation, calculs itératifs)"
        tags: ["programme", "premiere", "eds", "algebre"]
```

#### `tools/programmes/compile_definitions.ts`

But : transforme `skills.generated.json` + `skills.map.yml` → JSON final prêt pour `lib/diagnostics/definitions/*`.

**Signature** :

```ts
export type CompiledDefinitionPayload = {
  id: string; // definitionKey
  label: string;
  discipline: "maths" | "nsi";
  level: "premiere" | "terminale";
  track: "eds";
  schemaVersion: "v1.2" | "v1.3";
  domains: Array<{
    domainId: string;
    domainLabel: string;
    weight: number;
    skills: Array<{ skillId: string; skillLabel: string; tags?: string[] }>;
  }>;
};

export async function compileDefinition(args: {
  programmeKey: "maths_premiere" | "maths_terminale" | "nsi_premiere" | "nsi_terminale";
  definitionKey: string; // e.g. "maths-premiere-p2"
  mappingYmlPath: string;
  generatedJsonPath: string;
  outJsonPath: string;
}): Promise<void>;
```

### ✅ Fichiers générés (committés)

* `lib/diagnostics/definitions/generated/maths-premiere-p2.domains.json`
* `lib/diagnostics/definitions/generated/maths-terminale-p2.domains.json`
* `lib/diagnostics/definitions/generated/nsi-premiere-p2.domains.json`
* `lib/diagnostics/definitions/generated/nsi-terminale-p2.domains.json`

---

## COMMIT 3 — Chargement automatique des domains dans les definitions TS

### ✅ Modifs file-by-file

#### `lib/diagnostics/definitions/maths-premiere-p2.ts`

Remplacer la liste codée en dur par import JSON :

```ts
import domains from "./generated/maths-premiere-p2.domains.json";
export const mathsPremiereP2: DiagnosticDefinition = {
  id: "maths-premiere-p2",
  // ...
  domains: domains.domains,
  // ...
};
```

Même changement pour :

* `maths-terminale-p2.ts`
* `nsi-premiere-p2.ts`
* `nsi-terminale-p2.ts`

#### `lib/diagnostics/definitions/boot.ts`

Register des 4 definitions.

---

## COMMIT 4 — Endpoint “definitions safe metadata” + UI dynamique (lecture des domains)

### ✅ Modifs

#### `app/api/diagnostics/definitions/route.ts`

Retourne `listDefinitionsSafe()` incluant `domains` et `examFormat`.

#### `app/bilan-pallier2-maths/page.tsx`

* Étape 0 : sélection discipline/niveau
* fetch defs safe → choix `definitionKey`
* rendu compétences piloté par `definition.domains`

---

## COMMIT 5 — Tests CI : extraction + compilation + stabilité des IDs

### ✅ Nouveaux tests

#### `__tests__/programmes/compile_definitions.test.ts`

* charge mapping + generated
* compile
* vérifie : IDs uniques, non vides, stabilité (snapshot)

#### `__tests__/programmes/mapping_integrity.test.ts`

* chaque `mergeFrom` référence un candidat existant (ou explicitement “manual”)
* `exclude` supprime bien les bruits (“Objectifs”, “Histoire”, etc.)

---

# Heuristiques d’extraction (ce que Windsurf doit implémenter)

## 1) Maths (PDFs)

On récupère correctement des candidats en repérant :

* des **puces** (`•`, ``, etc.)
* des lignes **courtes** en tête de bloc “Contenus”
* en filtrant les sections “Objectifs”, “Histoire…”, “Repères…”

Ensuite mapping YAML :

* supprime bruit
* fusionne libellés proches
* impose IDs stables

## 2) NSI (PDFs)

Les PDFs NSI contiennent souvent des **tableaux à 2 colonnes** (Contenus / Capacités). Le texte extrait est généralement “aplati”.
Donc : extraction = **candidats** (pas la vérité), mapping = vérité.

Heuristique recommandée :

* découper en blocs à partir de la présence répétée de “Contenus / Capacités attendues”
* remonter à une ligne-titre plausible (contenant “Représentation”, “IHM”, “Architectures”, “Réseaux”, “Données”, etc.)
* dans le bloc, sélectionner comme “contenus candidats” :

  * lignes courtes (≤ 90 caractères)
  * commençant par une majuscule
  * pas des phrases longues finissant par un point
  * pas des “Commentaires”

Puis mapping YAML pour nettoyer.

---

# Résultat attendu côté moteur (vous y gagnez immédiatement)

Une fois ce pipeline en place :

* votre UI devient réellement **multi discipline / multi niveau**
* le scoring générique devient fiable car **domainId / skillId** sont **stables**
* vous pouvez ajouter un programme (ex: “Physique”) uniquement en :

  1. ajoutant un PDF
  2. générant `skills.generated.json`
  3. écrivant un `skills.map.yml`
  4. compilant une nouvelle definition

---

# Prompt Windsurf (ultra direct) — génération automatique skills via PDFs + mapping

Copiez-collez tel quel :

```text
TU ES WINDSURF. OBJECTIF: implémenter un pipeline robuste "PDF programmes -> skills candidates -> mapping YAML -> domains JSON -> definitions TS".

CONTRAINTE: extraction PDF = bruitée, donc la vérité est dans le mapping YAML (versionné). L'extraction ne produit que des "candidats" + ancres.

À FAIRE (COMMITS):

COMMIT 1:
- Créer tools/programmes/extract_programme_text.ts (ExtractedProgramme + extractProgrammeText)
- Créer tools/programmes/segment_programme.ts (ProgrammeCandidates + segmentProgramme)
- Créer tools/programmes/generate_skills_json.ts (generateSkillsJson)
- Générer et committer:
  programmes/generated/maths_premiere.skills.generated.json
  programmes/generated/maths_terminale.skills.generated.json
  programmes/generated/nsi_premiere.skills.generated.json
  programmes/generated/nsi_terminale.skills.generated.json
- Source PDFs: dossier /programmes du repo (et files joints du projet).
- Heuristiques:
  - Maths: privilégier puces (•/), filtrer "Objectifs"/"Histoire"/"Repères"
  - NSI: découpage par occurrences "Contenus" / "Capacités attendues" et extraction de lignes courtes candidates

COMMIT 2:
- Créer programmes/mapping/*.skills.map.yml (4 fichiers)
- Créer tools/programmes/compile_definitions.ts (compileDefinition -> generated JSON)
- Produire et committer:
  lib/diagnostics/definitions/generated/maths-premiere-p2.domains.json
  lib/diagnostics/definitions/generated/maths-terminale-p2.domains.json
  lib/diagnostics/definitions/generated/nsi-premiere-p2.domains.json
  lib/diagnostics/definitions/generated/nsi-terminale-p2.domains.json
- Le mapping YAML doit:
  - impose domainId, skillId stables
  - mergeFrom (fusion de candidats), include/exclude (nettoyage bruit)
  - tags, weight par domaine (pour readiness scoring)

COMMIT 3:
- Modifier lib/diagnostics/definitions/*-p2.ts pour importer domains depuis les JSON generated
- Modifier lib/diagnostics/definitions/boot.ts pour register les 4 defs

COMMIT 4:
- S’assurer que GET /api/diagnostics/definitions expose domains safe metadata
- Mettre à jour UI /bilan-pallier2-maths pour rendre les compétences depuis definition.domains

COMMIT 5:
- Ajouter tests:
  __tests__/programmes/compile_definitions.test.ts (snapshot stable)
  __tests__/programmes/mapping_integrity.test.ts (mergeFrom refs existantes, IDs uniques)

SORTIE: un pipeline reproductible:
- node tools/programmes/generate_skills_json.ts --programmeKey=... --pdf=...
- node tools/programmes/compile_definitions.ts --programmeKey=... --mapping=... --generated=...
- les definitions utilisent uniquement les JSON compiled (pas de skills hard-coded)
```

---

## Décision d’architecture (opinion nette)

Je recommande **fortement** cette approche “semi-automatique” (candidats → mapping) plutôt qu’un “extract 100% automatique” qui :

* va casser dès que l’Éducation nationale modifie la mise en page
* va produire des IDs instables
* va polluer vos domaines avec des phrases pédagogiques au lieu de notions

Avec le mapping YAML, vous obtenez :

* **stabilité**
* **auditabilité**
* **diff Git clair**
* **évolutivité** (ajouter une discipline devient mécanique)


