# Audit des Ressources Pédagogiques — 28 avril 2026

> **Objectif** : Inventaire exhaustif des ressources pédagogiques éparpillées dans le repo pour centralisation dans le Hub Élève.
> **Méthode** : Parcours réel du repo, validation/correction du tableau du prompt § 2.1-2.6, ajout colonne "Rattachement Hub cible".

---

## 2.1 Ressources statiques (PDFs et data)

| Source | Niveau / Filière | Catégorie Hub | Statut actuel | Rattachement Hub cible |
|---|---|---|---|---|
| `programmes/automatismes-eds-premiere/bo-annexe-automatismes-eam-2025-2026-session-2027.pdf` | EDS 1ère | `OFFICIAL_AUTOMATISMES` | ✅ Lot B+C exposé | `OFFICIAL_AUTOMATISMES` — EDS Première uniquement — Hub téléchargement via Lot C |
| `programmes/automatismes-eds-premiere/declic-1s-2026-sujets.pdf` | EDS 1ère | `OFFICIAL_SUJET` | ✅ Lot B+C exposé | `OFFICIAL_SUJET` — EDS Première — Hub téléchargement via Lot C |
| `programmes/automatismes-eds-premiere/programme-officiel-maths-premiere-generale.pdf` | EDS 1ère | `OFFICIAL_PROGRAM` | ✅ Lot B+C exposé | `OFFICIAL_PROGRAM` — EDS Première — Hub téléchargement via Lot C |
| `programmes/automatismes-eds-premiere/qcm-2025-adlane.pdf` | EDS 1ère | `OFFICIAL_SUJET` | ✅ exposé, à reclasser éventuellement | `OFFICIAL_QCM_BANK` (nouvelle catégorie proposée) — EDS Première — Hub téléchargement via Lot C |
| `programmes/automatismes-eds-premiere/sujet-specialite-1.pdf` | EDS 1ère | `OFFICIAL_SUJET` | ✅ Lot B+C exposé | `OFFICIAL_SUJET` — EDS Première — Hub téléchargement via Lot C |
| `programmes/automatismes-eds-premiere/sujet-specialite-2.pdf` | EDS 1ère | `OFFICIAL_SUJET` | ✅ Lot B+C exposé | `OFFICIAL_SUJET` — EDS Première — Hub téléchargement via Lot C |
| `programmes/programme_eds_maths_premiere.pdf` | EDS 1ère | `OFFICIAL_PROGRAM` | ✅ Lot B exposé | `OFFICIAL_PROGRAM` — EDS Première — Hub téléchargement via Lot C (doublon avec programme-officiel-maths-premiere-generale.pdf) |
| `programmes/programme_eds_maths_terminale.pdf` | Terminale EDS | `OFFICIAL_PROGRAM` | ✅ Lot B exposé | `OFFICIAL_PROGRAM` — Terminale EDS — Hub téléchargement via Lot C |
| `programmes/programme_eds_nsi_premiere.pdf` | EDS 1ère (si NSI) | `OFFICIAL_PROGRAM` | ✅ Lot B exposé conditionnellement | `OFFICIAL_PROGRAM` — EDS Première spécialité NSI — Hub téléchargement via Lot C (gating spécialité) |
| `programmes/programme_eds_nsi_terminale.pdf` | Terminale EDS (si NSI) | `OFFICIAL_PROGRAM` | ✅ Lot B exposé conditionnellement | `OFFICIAL_PROGRAM` — Terminale EDS spécialité NSI — Hub téléchargement via Lot C (gating spécialité) |
| `programmes/mapping/maths_premiere.skills.map.yml` + `generated/maths_premiere.skills.generated.json` | EDS 1ère | Source pour `data.ts` programme interactif | ✅ utilisé par `app/programme/maths-1ere/data.ts` | `INTERACTIVE_PROGRAM` — EDS Première — Programme interactif `/programme/maths-1ere` |
| `programmes/mapping/maths_premiere_stmg.skills.map.yml` + `generated/maths_premiere_stmg.skills.generated.json` | STMG 1ère | Source pour le futur `app/programme/maths-1ere-stmg/data.ts` | ❌ pas encore consommé | `INTERACTIVE_PROGRAM` — STMG Première — Programme interactif `/programme/maths-1ere-stmg` (Lot F) |
| `programmes/mapping/maths_terminale.skills.map.yml` + `generated/maths_terminale.skills.generated.json` | Terminale EDS | Source pour `app/programme/maths-terminale/data.ts` | ⚠️ partiellement consommé | `INTERACTIVE_PROGRAM` — Terminale EDS — Programme interactif `/programme/maths-terminale` (Lot E.bis) |
| `programmes/mapping/{sgn,management,droit_eco}_premiere_stmg.skills.map.yml` | STMG 1ère (modules secondaires) | Sources pour les 3 modules STMG hors maths | ❌ pas encore consommés | `INTERACTIVE_PROGRAM` — STMG Première — Modules SGN/Management/DroitEco via `/programme/maths-1ere-stmg` (Lot F) |
| `programmes/mapping/{nsi_premiere,nsi_terminale}.skills.map.yml` | NSI | Hors scope ce prompt | — | — |

---

## 2.2 Banques de données dynamiques

| Source | Niveau / Filière | Description | Statut | Rattachement Hub cible |
|---|---|---|---|---|
| `data/automatismes/premiere-eds/simulations.ts` | EDS 1ère | Simulations d'exercices automatismes | ✅ utilisé par `lib/automatismes/scoring.ts` | `OFFICIAL_AUTOMATISMES` — EDS Première — Hub lien vers `/dashboard/eleve/automatismes` |
| `data/stages/fevrier2026.ts` | Tous niveaux | Métadonnées du stage février 2026 | ✅ utilisé par `app/stages/...` | `STAGE_BILAN` — Tous profils avec réservation — Hub lien vers bilans de stage |
| `lib/data/assessments/maths_terminale_spe_v1.ts` | Terminale EDS | Banque d'évaluations | ✅ utilisé par `lib/diagnostics` | `INTERACTIVE_QUIZ` — Terminale EDS — Quiz via programme interactif |
| `lib/data/stage-qcm-structure.ts` | Tous (stages) | Structure QCM stages | ✅ utilisé | `STAGE_BILAN` — Tous profils — Hub lien vers bilans de stage |

---

## 2.3 Modules survie (STMG mode survie)

| Source | Description | Statut | Rattachement Hub cible |
|---|---|---|---|---|
| `lib/survival/phrases.ts` | Phrases magiques | ✅ exposé via `survival/phrases/[phraseId]/copied` | `INTERACTIVE_PROGRAM` — STMG Première survivalMode — Hub lien vers `/dashboard/eleve/survival` |
| `lib/survival/qcm-bank.ts` | Banque QCM survie (6 questions, SVG inclus) | ✅ exposé via `survival/qcm/attempt` | `INTERACTIVE_QUIZ` — STMG Première survivalMode — Hub lien vers `/dashboard/eleve/survival#qcm` |
| `lib/survival/reflex-data.ts` + `lib/survival/reflexes.ts` | Réflexes (mini-leçons + pratique) | ✅ exposé via `survival/reflexes/[reflexId]/attempt` | `INTERACTIVE_PROGRAM` — STMG Première survivalMode — Hub lien vers `/dashboard/eleve/survival#reflexes` |
| `lib/survival/ritual-engine.ts` | Moteur rituel quotidien | ✅ exposé via `survival/ritual` | `INTERACTIVE_PROGRAM` — STMG Première survivalMode — Hub lien vers `/dashboard/eleve/survival` |
| `lib/survival/score-simulator.ts` | Simulateur de note | ✅ utilisé en local par `ScoreSimulator.tsx` | `INTERACTIVE_PROGRAM` — STMG Première survivalMode — Hub lien vers `/dashboard/eleve/survival#score-simulator` |
| `public/survival/qcm/*.svg` (6 SVG) | Assets pour QCM survie | ✅ servis statiquement | `INTERACTIVE_QUIZ` — STMG Première survivalMode — Assets utilisés par QCM survie |

---

## 2.4 Diagnostics par matière

| Définition | Niveau / Filière | Statut | Rattachement Hub cible |
|---|---|---|---|---|
| `lib/diagnostics/definitions/maths-premiere-p2.ts` | EDS 1ère Maths palier 2 | ✅ exposé | `INTERACTIVE_QUIZ` — EDS Première — Quiz via programme interactif `/programme/maths-1ere#quiz` |
| `lib/diagnostics/definitions/maths-terminale-p2.ts` | Terminale EDS Maths palier 2 | ✅ exposé | `INTERACTIVE_QUIZ` — Terminale EDS — Quiz via programme interactif `/programme/maths-terminale#quiz` |
| `lib/diagnostics/definitions/maths-premiere-stmg-p2.ts` | STMG 1ère Maths palier 2 | ✅ exposé | `INTERACTIVE_QUIZ` — STMG Première — Quiz via programme interactif `/programme/maths-1ere-stmg#quiz` (Lot F) |
| `lib/diagnostics/definitions/{droit-eco,management,sgn}-premiere-stmg-p2.ts` | STMG 1ère modules secondaires | ✅ exposé | `INTERACTIVE_QUIZ` — STMG Première — Quiz via programme interactif `/programme/maths-1ere-stmg#quiz` (Lot F) |
| `lib/diagnostics/definitions/{nsi-premiere,nsi-terminale}-p2.ts` | NSI | hors scope | — | — |

---

## 2.5 Programmes interactifs

| Source | Niveau / Filière | Composants | Statut | Rattachement Hub cible |
|---|---|---|---|---|
| `app/programme/maths-1ere/` | EDS 1ère | Cockpit (Hero, FeuilleDeRoute, SeanceDuJour, SyntheseEleve), Course (ChapterView, 4 sections), Dashboard, DiagnosticPrerequis, Enseignant, Examen (ExamenBlancView), ExerciseEngine, FormulaireView, GrandOralSuggestions, InteractiveGraph, InteractiveMafs, **10 labs** (ArchimedePi, Enrouleur, EulerExponentielle, MonteCarloSim, NewtonSolver, ParabolaController, PythonExercises, TangenteGlissante, ToileAraignee, VectorProjector), MathContent, MathInput, MathJaxProvider, MathsRevisionClient, Navigation, ProceduralExercise, PythonIDE, Quiz/QuizEngine, RAG (RAGFlashCard, RAGRemediation), RAGSources, SkillTree | ✅ **Très complet** | `INTERACTIVE_PROGRAM` — EDS Première — Hub lien `/programme/maths-1ere` + `INTERACTIVE_LAB` — 10 labs avec deep links `/programme/maths-1ere?lab={slug}` + `INTERACTIVE_QUIZ` — Quiz via `/programme/maths-1ere#quiz` |
| `app/programme/maths-1ere-stmg/page.tsx` | STMG 1ère | **Page minimaliste seule** | ❌ **Lot F : à créer** | `INTERACTIVE_PROGRAM` — STMG Première — Hub lien `/programme/maths-1ere-stmg` (Lot F) |
| `app/programme/maths-terminale/` | Terminale EDS | `MathsTerminaleClient.tsx`, `data.ts`, `page.tsx`, `store.ts` (4 fichiers) | ⚠️ **Lot E.bis : parité légère** | `INTERACTIVE_PROGRAM` — Terminale EDS — Hub lien `/programme/maths-terminale` (Lot E.bis) |
| `components/programme/livret-stmg/LivretStmg.tsx` + `app/(platform)/outils/livret-stmg/page.tsx` | STMG 1ère outils | Livret PDF STMG | ✅ existe (à intégrer dans Hub STMG) | `INTERACTIVE_PROGRAM` — STMG Première — Hub lien vers `/programme/maths-1ere-stmg#livret` (Lot F) |

---

## 2.6 Coffre numérique élève

| Source | Description | Statut | Rattachement Hub cible |
|---|---|---|---|---|
| `storage/documents/<student_slug>/*.pdf` | Documents personnels de l'élève (bilans, copies, plannings) | ✅ exposé via `USER_DOCUMENT` dans Hub | `USER_DOCUMENT` — Tous profils — Hub téléchargement via `/api/student/documents/[id]/download` |
| `storage/stage-bilans/` | Bilans de stages | ✅ exposé via `STAGE_BILAN` dans Hub | `STAGE_BILAN` — Tous profils avec réservation — Hub téléchargement via lien externe |
| `storage/stage-documents/` | Documents stages | ✅ exposé via `STAGE_BILAN` dans Hub | `STAGE_BILAN` — Tous profils — Hub téléchargement via lien externe |

---

## Synthèse des gaps identifiés

### Ressources non exposées dans le Hub actuel

| Ressource | Gap | Action requise |
|---|---|---|
| Labs interactifs EDS 1ère (10 labs) | Pas de catégorie `INTERACTIVE_LAB` | Lot B' : Ajouter catégorie + mapping deep links |
| Programme interactif STMG | Page minimaliste seule | Lot F : Créer programme complet STMG |
| Programme interactif Terminale | Parité légère incomplète | Lot E.bis : Compléter parité Terminale |
| Modules STMG secondaires (SGN, Management, DroitEco) | Non consommés | Lot F : Intégrer dans programme STMG |
| Livret STMG | Existe mais pas intégré Hub | Lot F : Intégrer dans programme STMG |
| Mode survie STMG | Exposé mais pas dans Hub | Lot B' : Ajouter catégorie `INTERACTIVE_PROGRAM` pour survivalMode |

### Corrections apportées au tableau du prompt

1. **Duplication PDF programme EDS 1ère** : `programme_eds_maths_premiere.pdf` et `programme-officiel-maths-premiere-generale.pdf` sont des doublons. Le premier devrait être supprimé ou fusionné.
2. **Consommation mapping Terminale** : `maths_terminale.skills.map.yml` est partiellement consommé (data.ts existe mais programme incomplet).
3. **Modules STMG secondaires** : Les mappings existent mais ne sont pas encore consommés par aucun composant UI.

---

**Document généré le 28 avril 2026 — Phase 1 du prompt Windsurf**
