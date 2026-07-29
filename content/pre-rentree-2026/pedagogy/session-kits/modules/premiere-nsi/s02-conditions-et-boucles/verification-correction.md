# Correction de la vérification — NSI — Entrée en Première — Séance 2

## Conditions et boucles

**Statut :** `HUMAN_VALIDATION_REQUIRED`

### Correction question 1

```python
def somme_entiers(n):
    total = 0
    for k in range(1, n + 1):
        total += k
    return total
```
Pour n = 4, le résultat vaut 10.

**Critère d'attribution du point :** la réponse respecte la méthode suivante : Initialiser un accumulateur, choisir des bornes incluant n et renvoyer après la boucle.

**Source :** `programme:premiere-nsi:s02:B`

### Correction question 2

**Réponse : D — les deux conditions sont vraies**

Une conjonction exige les deux propositions.

**Lecture des erreurs possibles**

- A : La négation d'un « et » est mal construite.
- B : La négation d'un « et » est mal construite.
- C : Le « ou » est compris comme exclusif.

**Critère d'attribution du point :** la réponse respecte la méthode suivante : Évaluer une proposition logique et formuler sa négation.

**Source :** `n02:n02-i1`

### Correction question 3

**Réponse : A — elle s'arrête**

4 < 4 est faux.

**Lecture des erreurs possibles**

- B : < et ≤ sont confondus.
- C : Les bornes sont testées dans le mauvais sens.
- D : < et ≤ sont confondus.

**Critère d'attribution du point :** la réponse respecte la méthode suivante : Distinguer strict et large et vérifier l'appartenance à un intervalle.

**Source :** `n03:n03-i3`

## Décision pédagogique

| Résultat | Statut du nœud | Action pour la séance suivante |
|---:|---|---|
| 3/3 | ACQUIS | Réactivation brève puis palier supérieur |
| 2/3 | FRAGILE | Reprise ciblée de l'erreur et nouvel item court |
| 0–1/3 | NON_ACQUIS | Fiche de reprise, guidage et nouvelle vérification |

Une réponse encore en correction manuelle reste `PENDING_REVIEW` et ne doit pas être comptée comme un échec.
