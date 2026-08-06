# ADR-0014 — Moteur de faits 1.0.1

- **Statut** : Acceptée
- **Date** : 2026-08-01
- **Décideur** : Nexus
- **Concerne** : lib/bilans/facts

## Contexte

Deux cas limites du moteur 1.0.0 contredisaient la spécification ou la sémantique
pédagogique attendue sans être exercés par les six cas dorés.

## Décision

La version moteur passe à 1.0.1.

1. La normalisation SHORT_TEXT retire ensemble ponctuation et espaces terminaux, puis
   applique un dernier trim. Une réponse correcte terminée par une ponctuation ne conserve
   plus un espace résiduel.
2. Lorsque le seuil de difficulté d’un nœud est atteint uniquement par NON_TRAITE, sans
   masse ERREUR_CONFIANTE ni LACUNE_CONSCIENTE, le profil devient NON_TRAITE.

## Motif

Un espace de normalisation ne doit pas invalider une réponse correcte. Un élève qui ne
répond pas ne doit pas être décrit comme se trompant avec confiance.

## Compatibilité

Les six cas dorés restent inchangés dans tous leurs champs fonctionnels. Seul leur champ
engineVersion passe de 1.0.0 à 1.0.1.
