# Plan d'implémentation — Ressources pédagogiques prioritaires Pré-rentrée 2026

## Objectif

Transformer six modules prioritaires en ressources réellement exploitables en classe, sans promouvoir les ressources génériques existantes hors de leur statut `DRAFT`.

## Périmètre prioritaire

- Entrée en 3e : Mathématiques et Français.
- Entrée en Seconde : Mathématiques et Physique-Chimie.
- Entrée en Première : Mathématiques.
- Entrée en Terminale : Mathématiques.

Chaque module reçoit un test de positionnement élève et enseignant, un cahier élève, un guide enseignant, des activités, des exercices, des corrigés spécifiques, un barème, des durées, des niveaux de difficulté, une production finale et un bilan.

## Références officielles

- Le nouveau programme de cycle 4 publié au BO du 5 mars 2026 ne s'applique en 3e qu'en 2028-2029 ; les ressources d'entrée en 3e restent donc alignées sur le programme encore applicable en 2026-2027.
- Les nouveaux programmes de mathématiques du lycée publiés au BO du 2 avril 2026 s'appliquent en Seconde et Première dès 2026-2027, mais seulement en Terminale à partir de 2027-2028.
- Les programmes de Français, Physique-Chimie, SNT et NSI restent associés à leurs références officielles en vigueur dans la matrice interne.

## Étapes

- [x] Ajouter des tests rouges sur le statut des ressources génériques, l'inventaire prioritaire et la matrice officielle.
- [x] Écrire la source pédagogique des six modules avec questions, réponses, barèmes et séquençage détaillé.
- [x] Créer la matrice programme officiel × année d'application × niveau × matière × module Nexus pour les quatorze modules.
- [x] Générer les sources HTML, les PDF, les rendus page par page, les planches de contact et le manifeste.
- [x] Contrôler visuellement les ressources élève et enseignant, puis vérifier PDF, polices, pages blanches et débordements.
- [x] Exécuter les suites complètes, committer et pousser sur la branche d'intégration.

## Statut de validation

Les fichiers techniquement complets portent `READY_FOR_PEDAGOGICAL_REVIEW`. Ils ne deviennent `CLASSROOM_READY` qu'après validation nominative d'un responsable pédagogique ; aucune validation humaine n'est simulée par le générateur.
