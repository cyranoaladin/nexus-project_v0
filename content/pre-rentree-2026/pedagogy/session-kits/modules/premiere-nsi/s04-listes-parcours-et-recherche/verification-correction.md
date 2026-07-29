# Correction de la vérification — NSI — Entrée en Première — Séance 4

## Listes, parcours et recherche

**Statut :** `HUMAN_VALIDATION_REQUIRED`

### Correction question 1

Exemples : valeur au début `[4,2,1],4`; au milieu `[4,2,1],2`; absente `[4,2,1],9`; liste vide `[],4`. On peut ajouter une valeur répétée.

**Critère d'attribution du point :** la réponse respecte la méthode suivante : Couvrir réussite, échec, position limite et structure vide.

**Source :** `programme:premiere-nsi:s04:B:programme:NSI-tests`

### Correction question 2

`notes[0]` vaut 12, `notes[-1]` vaut 10 et `len(notes)` vaut 4.

**Critère d'attribution du point :** la réponse respecte la méthode suivante : Les indices commencent à 0 ; l'indice -1 désigne le dernier élément.

**Source :** `programme:premiere-nsi:s04:A:programme:NSI-listes`

### Correction question 3

Au pire, 10 puis 1 000 comparaisons. Le coût croît proportionnellement à la longueur : la recherche est linéaire, notée O(n).

**Critère d'attribution du point :** la réponse respecte la méthode suivante : Étudier le cas où la valeur est absente ou placée en dernier.

**Source :** `programme:premiere-nsi:s04:C:programme:NSI-efficacite`

## Décision pédagogique

| Résultat | Statut du nœud | Action pour la séance suivante |
|---:|---|---|
| 3/3 | ACQUIS | Réactivation brève puis palier supérieur |
| 2/3 | FRAGILE | Reprise ciblée de l'erreur et nouvel item court |
| 0–1/3 | NON_ACQUIS | Fiche de reprise, guidage et nouvelle vérification |

Une réponse encore en correction manuelle reste `PENDING_REVIEW` et ne doit pas être comptée comme un échec.
