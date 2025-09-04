# 🚦 Implémentation complète des Bilans (Volet 1 + Volet 2 + PDF)

## 0) Objectif & Règle d’or (à appliquer à la lettre)

* **Objectif** : livrer un système de **Bilan** conforme à notre standard :

  * **Volet 1** = QCM **discipline × niveau** (ex. *Seconde → pré-requis Première Maths*).
  * **Volet 2** = **pédago spécifique** à la discipline × niveau **puis** **pédago commun** (toujours dans cet ordre).
* **Aucune invention de structure** : tu dois **respecter strictement** les schémas et chemins ci-dessous.
* **PDF** : génération **XeLaTeX** (pas d’HTML→PDF).
* **HTML** : rendu **LaTeX propre** pour les items via **KaTeX** (SSR-friendly).
* **RBAC / Sécurité** : routes protégées, rate-limit, validation Zod des env, **aucun secret versionné**.

---

## 1) Arborescence et Noms de fichiers (obligatoires)

Crée/complète **exactement** ces chemins :

```
/data/
  # VOLET 1 — QCM disciplinaires (un fichier par matière × niveau, 40 Q + 3 mini-exercices)
  qcm_seconde_for_premiere_maths.json
  qcm_premiere_for_terminale_maths.json
  qcm_seconde_for_premiere_pc.json
  qcm_premiere_for_terminale_pc.json
  qcm_premiere_for_terminale_nsi.json
  # (et autres déclinaisons à venir selon le même pattern)

  # VOLET 2 — Pédago spécifique (matière × niveau) + pédago commun (déjà fourni)
  pedago_survey_maths_premiere.json        # si manquant, à créer
  pedago_survey_maths_terminale.json       # si manquant, à créer
  pedago_survey_pc_premiere.json           # si manquant, à créer
  pedago_survey_pc_terminale.json          # si manquant, à créer
  pedago_survey_nsi_premiere.json          # (déjà fourni)
  pedago_survey_nsi_terminale.json         # (déjà fourni)
  pedago_survey_commun.json                # (déjà fourni)

# Scoring, indices & décision
/lib/scoring/
  qcm_scorer.ts               # générique, basé sur le JSON Volet 1 (pas de hardcode de matière)
  pedago_indices.ts           # calcule IDX_* depuis Volet 2 (spécifique + commun)
  offers_decision.ts          # matrice de décision → offre primaire + alternatives

# Rendu PDF & graph radar
/lib/pdf/
  templates/
    bilan_premiere_maths.tex
    bilan_terminale_maths.tex
    bilan_premiere_pc.tex
    bilan_terminale_pc.tex
    bilan_nsi_terminale.tex
  BilanPdfEleve.tsx
  BilanPdfParent.tsx
  BilanPdfNexus.tsx

/server/graphics/
  radar/buildRadarPng.ts      # ChartJSNodeCanvas -> PNG pour LaTeX

# Pages Bilan (élève/parent)
 /app/(bilan)/
  bilan/initier/page.tsx
  bilan/[bilanId]/questionnaire/page.tsx
  bilan/[bilanId]/resultats/page.tsx

# API Routes (Next.js 14 App Router)
/app/api/bilan/
  questionnaire-structure/route.ts
  [bilanId]/submit-answers/route.ts
  generate-report-text/route.ts
  generate-summary-text/route.ts
  pdf/[bilanId]/route.ts
  email/[bilanId]/route.ts
```

---

## 2) **Schéma JSON** à respecter (strict)

### 2.1 Volet 1 (QCM)

* Fichier : `/data/qcm_<source>_for_<cible>_<matiere>.json` (40 + 3 mini-exercices).
* **Schéma** (aucune déviation) :

```json
{
  "id": "M2-ALG-Q1",
  "domain": "algebre",            // ex: "algebre" | "fonctions" | "geometrie" | "trigo" | "proba_stats" | "algo_logique" | ...
  "type": "mcq",                   // "mcq" | "numeric" | "short"
  "difficulty": "A",               // "A" | "B" | "C"
  "weight": 1,                     // 1,2,3,4
  "prompt_latex": "Énoncé en LaTeX",
  "choices": [                     // uniquement si type="mcq"
    { "k": "A", "latex": "...", "correct": true },
    { "k": "B", "latex": "..." }
  ],
  "answer_latex": "x=3",           // uniquement si type="numeric" | "short"
  "explanation_latex": "Justification LaTeX"
}
```

> **Rendu HTML** : utiliser **KaTeX** pour `prompt_latex` / `explanation_latex`.
> **PDF** : injecter tel quel dans LaTeX (pas de conversion).

### 2.2 Volet 2 (pédago spécifique **PUIS** commun)

* Fichier spécifique (matière×niveau) **puis** `/data/pedago_survey_commun.json`.
* **Schéma minimal attendu** (Likert, single, multi, text) :

```json
{
  "id": "B1",
  "section": "Motivation",
  "type": "likert",             // "likert" | "single" | "multi" | "text"
  "label": "J’ai une motivation régulière...",
  "scale": { "min": 1, "max": 5, "labels": ["Jamais","Toujours"] },
  "weight": 1.0,
  "mapsTo": "IDX_MOTIVATION"    // champ obligatoire pour le calcul des indices
}
```

> **Règle** : **toujours concaténer** `pedago_survey_<matiere>_<niveau>.json` **puis** `pedago_survey_commun.json` (dans cet ordre) si le Volet 2 est requis.

---

## 3) Types & Validation

* Crée un **type TS** + **Zod schema** commun pour les items QCM & pédago. Exemple :

```ts
// /lib/scoring/types.ts
export type QcmItem =
  | { id:string; domain:string; type:"mcq"; difficulty:"A"|"B"|"C"; weight:number;
      prompt_latex:string; choices:{k:string;latex:string;correct?:boolean}[];
      explanation_latex?:string }
  | { id:string; domain:string; type:"numeric"|"short"; difficulty:"A"|"B"|"C"; weight:number;
      prompt_latex:string; answer_latex:string; explanation_latex?:string };

// idem pour PedagoItem avec mapsTo obligatoire si type likert/single/multi
```

* **Validation env (Zod)** : refuse le démarrage prod si des clés critiques manquent (`OPENAI_API_KEY`, SMTP, `BILAN_PDF_LATEX=1`, etc.).

---

## 4) Endpoints **(implémentation obligatoire)**

### 4.1 `GET /api/bilan/questionnaire-structure?matiere=...&niveau=...&studentId=...`

* **Charge Volet 1** depuis `/data/qcm_*` en fonction du couple **(matière, niveau)** demandé.
* **Volet 2** :

  * Si `StudentProfileData` **existe** → `requiresVolet2=false` et renvoie `previousPedagoAnswers`.
  * Sinon → **concatène** `pedago_survey_<matiere>_<niveau>.json` **puis** `pedago_survey_commun.json` et `requiresVolet2=true`.
* **Réponse** :

```json
{
  "volet1": [...],                 // QCM items
  "volet2": [...],                 // concat(spécifique, commun) OU []
  "requiresVolet2": true,
  "previousPedagoAnswers": null
}
```

### 4.2 `POST /api/bilan/[bilanId]/submit-answers`

* **Entrée** : `{ qcmAnswers: {...}, pedagoAnswers?: {...} }`.

* **Étapes** :

  1. Persister **brut** (`qcmRawAnswers`, `pedagoRawAnswers`).
  2. Calculer **scores** (`/lib/scoring/qcm_scorer.ts`) → `qcmScores` (domaines %, global %, lacunes).
  3. Si `pedagoAnswers` présent → `pedago_indices.ts` (calc `IDX_*`) → `pedagoProfile`, `preAnalyzedData` et mise à jour/ création `StudentProfileData`.
  4. `offers_decision.ts` → `offers` (offre primaire + alternatives).
  5. Déclencher jobs **report** & **summary** (voir 4.3).
  6. `status="GENERATED"` si succès.

* **Sortie** : `{ ok:true, bilanId:"..." }`.

### 4.3 `POST /api/bilan/generate-report-text` & `POST /api/bilan/generate-summary-text`

* **Entrées** (DB) : `qcmScores`, `pedagoProfile`, `preAnalyzedData`, `offers`.
* **Modèle** : `gpt-4o` (prod) / `gpt-4o-mini` (dev), prompts versionnés.
* **Écrit** en DB : `reportText`, `summaryText`.

### 4.4 `GET /api/bilan/pdf/[bilanId]?variant=eleve|parent|nexus`

* **Assemble** le `.tex` (template de la matière×niveau), injecte textes & `radar.png`, compile **XeLaTeX**, renvoie le **PDF**.

### 4.5 `POST /api/bilan/email/[bilanId]`

* **Envoie** le PDF (variant) via SMTP (env validées).

---

## 5) Scoring & Radar (générique)

* **Score item** = `weight` si juste ; `0` sinon.

* **Domaine %** = (points obtenus / points max domaine) × 100.

* **Global %** = moyenne pondérée des domaines.

* **Seuils** : `<50%` = faible ; `50–74%` = moyen ; `≥75%` = solide.

* **Radar** : `/server/graphics/radar/buildRadarPng.ts` (ChartJSNodeCanvas) :

```ts
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
export async function buildRadarPng(labels:string[], values:number[], outPath:string){
  const c = new ChartJSNodeCanvas({ width: 800, height: 800, backgroundColour: 'white' });
  // config radar...
  const buffer = await c.renderToBuffer({ /* ... */ } as any);
  const fs = await import('fs'); fs.writeFileSync(outPath, buffer);
}
```

---

## 6) UI/UX (pages & composants)

* `bilan/initier` : choisir **matière** + **niveau** + élève → crée `Bilan` et redirige.
* `bilan/[id]/questionnaire` :

  * Appelle `GET questionnaire-structure`.
  * **Volet 1** (QCM) → **Volet 2** (si requis = spécifique puis commun).
  * **Autosave** section, **progression** visible, KaTeX pour LaTeX, navigation clavier, responsive.
* `bilan/[id]/resultats` :

  * Affiche **radar** (HTML), **forces/faiblesses**, **plan d’action**.
  * Boutons **Télécharger PDF** (variant) & **Envoyer par email**.

> **Important** : ne pas densifier. 1 question = 1 bloc. Options aérée. Police min 16px. Contraste AA.

---

## 7) PDF LaTeX (XeLaTeX)

* **Templates** par matière×niveau dans `/lib/pdf/templates/*.tex`.
* **Packages** : `fontspec`, `geometry`, `graphicx`, `xcolor`, `amsmath`.
* **Compilation** : `latexmk -xelatex -interaction=nonstopmode -halt-on-error`.
* **Sanitization** : champs libres via `sanitize-latex`.
* **Inclure** `radar.png` (généré serveur) + `reportText` + `summaryText`.

---

## 8) Prisma (rappel champs Bilan)

* `Bilan.qcmRawAnswers Json`

* `Bilan.pedagoRawAnswers Json`

* `Bilan.qcmScores Json`

* `Bilan.pedagoProfile Json`

* `Bilan.preAnalyzedData Json`

* `Bilan.offers Json`

* `Bilan.reportText Text`

* `Bilan.summaryText Text`

* `Bilan.generatedAt DateTime`

* `Bilan.status String` (`PENDING`→`GENERATED`)

* `StudentProfileData` : `pedagoRawAnswers`, `pedagoProfile`, `preAnalyzedData` (réutilisés).

---

## 9) Tests (obligatoires)

* **Unitaires**

  * `/lib/scoring/qcm_scorer.test.ts` (agrégats domaines, global, seuils).
  * `/lib/scoring/pedago_indices.test.ts` (Likert→IDX).
  * `/lib/scoring/offers_decision.test.ts` (règles).

* **Intégration (API)**

  * `GET questionnaire-structure` (avec et sans `StudentProfileData`).
  * `POST submit-answers` (V1 seul / V1+V2) → vérifie `qcmScores`, `IDX_*`, `offers`.
  * `POST generate-*` → `reportText`/`summaryText` persistés.
  * `GET pdf` (variants) → 200.

* **E2E (Playwright)**

  * Parcours **initier → questionnaire → résultats → PDF** (déterministe).

---

## 10) CI/CD & Sécurité (rappels obligatoires)

* **CI** : lint, tests unitaires/intégration/E2E, build, PDF LaTeX (cache TeXLive possible).
* **Audit** : `npm audit` strict (fail on any vulnerability), `gitleaks` pré-commit.
* **RBAC** : middleware NextAuth, rate-limit sur `submit-answers`, `generate-*`, `pdf`.
* **Env** : validation Zod, aucun secret versionné (ex : `.env.e2e.example`).

---

## 11) Check-list d’acceptation (à cocher avant PR)

* [ ] **Volet 1** : QCM correct (schéma strict), conforme au périmètre (ex : Seconde → pré-requis Première).
* [ ] **Volet 2** : **concat** `pedago_survey_<matiere>_<niveau>.json` **PUIS** `pedago_survey_commun.json`.
* [ ] **Scoring** : domaines %, global %, lacunes.
* [ ] **Radar** : PNG généré et intégré au PDF.
* [ ] **Textes** : `reportText` & `summaryText` générés et stockés.
* [ ] **PDF XeLaTeX** : compile OK pour **toutes les variantes** (élève/parent/nexus).
* [ ] **UI** : KaTeX (HTML), autosave, accessibilité de base.
* [ ] **Sécurité** : RBAC + rate-limit + validation env ; **zéro secret** en repo.
* [ ] **Tests** : unit/int/E2E **verts** ; CI passée.

---

## 12) Tâches à exécuter (en branches PR propres)

* **feat/bilan-core-pipeline**

  * Endpoints 4.1 → 4.5
  * Scorer générique + indices + décision
  * Radar builder + templates LaTeX (matière×niveau)
  * Pages UI/UX (initier/questionnaire/résultats)

* **chore/bilan-katex-latex**

  * KaTeX côté UI
  * Docker/latexmk si manquant
  * Sanitization LaTeX

* **test/bilan-suite**

  * Unit/int/E2E + fixtures d’answers (mocks)

Tu exécutes ces tâches **sans dévier** du présent cahier. À la fin, tu fournis :

* les **diffs** complets,
* la **sortie CI** (tests/coverage, build PDF),
* un **résumé** d’implémentation (fichiers modifiés / créés, commandes de test local),
* la **check-list** ci-dessus **cochée**.

**Merci de confirmer la prise en compte et de commencer par `feat/bilan-core-pipeline`.**

