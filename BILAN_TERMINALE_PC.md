# BILAN — Entrée en Terminale (Physique-Chimie)

## 0) Finalité & principes

- **But** : évaluer **exclusivement** le **programme de Première** (pré-requis Terminale), pour poser un diagnostic fin et un plan de remédiation ciblé.  
- **Sorties** : (1) scores par domaines + **radar** ; (2) **bilan texte** (forces/faiblesses, priorités) ; (3) **PDF** via **LaTeX (XeLaTeX)** ; rendu **HTML** des formules en **KaTeX**.  
- **Alignement programme** : continuité Première→Terminale, 4 thèmes structurants et place de la modélisation/numérique (Python). 

---

## 1) Périmètre évalué (Première → pré-requis Terminale)

**Thèmes (Première)** : « Constitution et transformations de la matière », « Mouvement et interactions », « L’énergie : conversions et transferts », « Ondes et signaux » (démarche de modélisation, mesures/incertitudes, dispositifs numériques). :contentReference[oaicite:4]{index=4}

**Exigences Terminale** (orientation de la remédiation) : approfondissements (équilibre chimique K(T), piles/électrolyse, stratégies de synthèse, capacités numériques & expérimentales) **sans** les interroger directement. 

---

## 2) Structure du questionnaire

- **Volume** : 30 items (dont 2 mini-exercices courts).  
- **Domaines & poids** (exemple recommandé) :
  - **Mesure & incertitudes** : 5 Q, 8 pts (écriture du résultat, moyenne/écart-type, usage tableur) — acquis Première, poursuivis en Terminale. :contentReference[oaicite:6]{index=6}
  - **Constitution & transformations de la matière (chimie)** : 9 Q, 14 pts (dissolution/dilution, titrage, UV-Vis, extraction, rendement). :contentReference[oaicite:7]{index=7}
  - **Mouvement & interactions** : 7 Q, 10 pts (Newton, travail, cinématique).  
  - **Énergie : conversions & transferts** : 5 Q, 8 pts (loi d’Ohm, puissance/énergie). :contentReference[oaicite:8]{index=8}
  - **Ondes & signaux** : 4 Q, 6 pts (λ, f, v ; instrumentation/microcontrôleur). :contentReference[oaicite:9]{index=9}
  - **Mini-exercices** : 2 × 4 pts = 8 pts (raisonnement concis).

> **Pondération** : notions “passeurs” pour la Terminale (mesure/écriture du résultat, titrage, énergétique, traitement du signal) ≥ 2 pts.

---

## 3) Qualité pédagogique

- **Couverture** : bornage **strict Première**, pas d’items Terminale.  
- **Difficulté** : A (automatismes), B (application), C (problème court).  
- **Distracteurs** : erreurs types (pH à l’équivalence, loi d’Ohm, v=λf, etc.).  
- **Fiabilité** : viser α≥0,80 (analyses ultérieures sur export anonymisé).

---

## 4) Schéma JSON & données

- **Fichier** : `data/qcm_premiere_for_terminale_pc.json` (fourni ci-dessus).  
- **Schéma item** : `id, domain, type, difficulty, weight, prompt_latex, choices[]?/answer_latex, explanation_latex`.  
- **Domains** : `mesure_incertitudes`, `chimie_matiere`, `mouvement_interactions`, `energie`, `ondes_signaux`.

---

## 5) Rendu HTML (KaTeX) & PDF (XeLaTeX)

- **HTML** : `npm i katex @matejmazur/react-katex remark-math rehype-katex` ; import `katex.min.css`; composant `<Latex block>` (déjà fourni dans vos bilans).  
- **PDF** : Template `lib/pdf/templates/bilan_terminale_pc.tex` (packages `amsmath`, `geometry`, `fontspec`, `graphicx`, `xcolor`). Compilation via `latexmk/xelatex` dans le worker Docker (déjà utilisé pour les bilans).  
- **Graphique radar** : générer `radar.png` (ChartJS-NodeCanvas) avant compilation.

---

## 6) Scoring & profil

- **Score question** = `weight` si juste ; 0 sinon.  
- **Par domaine (%)** : somme obtenue / somme max × 100.  
- **Niveaux** : <50% (fragile), 50–74% (moyen), ≥75% (solide).  
- **Lacunes critiques** : reporter les thèmes <50% et notions clés (titrage, exploitation mesures, v=λf, Newton/Travail, P=UI).  
- **Volet 2 commun** : agrégation des `IDX_*` (motivation, organisation…) déjà spécifiée pour les autres bilans.

---

## 7) Endpoints & workflow (alignés Nexus)

- `GET /api/bilan/questionnaire-structure?matiere=PC&niveau=Terminale` → charge ce QCM + (si besoin) 
le **Volet 2** contient :
`data/pedago_survey_pc_terminale.json` (pour la première partie du volet 2).
`data/pedago_survey_commun.json` (pour la deuxième partie du volet 2)
  
- `POST /api/bilan/[id]/submit-answers` → calcule scores, indices pédagogiques, génère `reportText/summaryText`, alimente `offers`.  
- `GET /api/bilan/pdf/[id]?variant=` (standard/parent/eleve/nexus) → compile LaTeX.  
- **Sécurité** : RBAC NextAuth, rate-limit, logs sanitizés.

---

## 8) Bilan texte (structure)

- **Intro** (contexte, objectifs).  
- **Synthèse globale** (pourcentage + niveau).  
- **Par domaine** : score, 2–3 phrases & priorités (ex. “Consolider écriture du résultat et représentation des données ; réviser titrage et extraction ; refaire fiches sur v=λf et puissance électrique”).  
- **Plan 2–3 semaines** (séquences concrètes).  
- **Projection Terminale** : expliquer liens vers **équilibre chimique**, **piles/électrolyse**, **stratégies de synthèse**, **projets expérimentaux/modélisation** (sans les interroger dans le QCM). 

---

## 9) Tests & recette

- **Unitaires** : calculs de pourcentages, agrégats, niveaux, sérialisation `.tex`.  
- **Intégration** : endpoints `questionnaire-structure`, `submit-answers`, `pdf`.  
- **E2E** : parcours complet (initier → répondre → résultats → PDF).  
- **Qualité** : rendu KaTeX correct, PDF 200, radar présent, temps <2s compilation locale.

---

## 10) Checklist d’acceptation

- [ ] Aucune question hors **Première**.  
- [ ] Barèmes pondérés (notions passeurs ≥2 pts).  
- [ ] KaTeX OK, PDF XeLaTeX OK (4 variantes).  
- [ ] Radar généré et inséré.  
- [ ] Bilan texte cohérent (diagnostic + plan).  
- [ ] Tests unit/int/E2E verts, RBAC/rate-limit actifs.  
- [ ] Pas de secrets versionnés.


