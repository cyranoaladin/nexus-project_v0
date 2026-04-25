# Automatismes EDS Premiere

## 1. Objectif
Module entrainement automatismes epreuve anticipee maths Premiere EDS. 10 simulations x 12 questions, feedback immediat, scoring serveur.

## 2. Sources
- Programme officiel premiere generale
- Annexe automatismes 2025-2026
- Sujets blancs Declic 2026
- QCM BNS 2025
- Sujets zero 2026

## 3. Structure
- 10 simulations (sim-1..sim-10)
- 12 questions/simulation = 120 questions
- Matrice Q1-Q12 respectee (calcul, proportion, evolution, algebre, equation, fonction, graphique, second degre, stats, proba, specifique premiere, mixte)

## 4. Scoring
- 1 pt/bonne reponse
- Score /12, equivalent /6, %
- Performance par domaine
- Recommandations selon score brut: <6 fondamentaux fragiles, 6-8 fiabilite insuffisante, 9-10 stabiliser, >=11 mode chronometre

## 5. API Routes
- GET /api/student/automatismes/series — liste metadata
- GET /api/student/automatismes/series/[id] — detail safe (sans reponses)
- POST /api/student/automatismes/check-answer — validation question par question
- GET/POST /api/student/automatismes/attempts — historique / soumission
- GET /api/student/automatismes/attempts/[id] — detail avec ownership

## 6. Securite
- Reponses correctes jamais exposees avant validation
- Scoring cote serveur uniquement
- Auth ELEVE obligatoire sur routes mutatives
- Ownership verifiee sur attempts/[id]

## 7. Tests
- scoring.test.ts: 13/13 passes
- simulations.validation.test.ts: 131/131 passes
- Matrice, 8+ domaines, sourceReference, non-vides verifies

## 8. Fichiers cles
- types/automatismes.ts
- data/automatismes/premiere-eds/simulations.ts
- lib/automatismes/scoring.ts
- app/api/student/automatismes/check-answer/route.ts
- components/automatismes/AutomatismesPlayer.tsx
- components/automatismes/AutomatismesResults.tsx
- app/dashboard/eleve/automatismes/page.tsx
