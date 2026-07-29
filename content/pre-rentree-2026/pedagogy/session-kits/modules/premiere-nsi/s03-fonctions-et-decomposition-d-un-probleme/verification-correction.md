# Correction de la vérification — NSI — Entrée en Première — Séance 3

## Fonctions et décomposition d’un problème

**Statut :** `HUMAN_VALIDATION_REQUIRED`

### Correction question 1

```python
def est_pair(n):
    return n % 2 == 0
```
Tests possibles : `est_pair(4)` vrai, `est_pair(7)` faux, `est_pair(-2)` vrai.

**Critère d'attribution du point :** la réponse respecte la méthode suivante : Définir un contrat simple, renvoyer l'expression booléenne et tester des classes de cas.

**Source :** `programme:premiere-nsi:s03:B`

### Correction question 2

**Réponse : D — calculer le TTC d'un prix donné**

La sous-tâche est réutilisable et possède une entrée claire.

**Lecture des erreurs possibles**

- A : Tout est traité dans un seul bloc.
- B : Tout est traité dans un seul bloc.
- C : Une sous-tâche est confondue avec son résultat.

**Critère d'attribution du point :** la réponse respecte la méthode suivante : Identifier des sous-problèmes cohérents et leurs entrées/sorties.

**Source :** `n06:n06-i1`

### Correction question 3

La réponse est incorrecte. **Réponse attendue : au résultat transmis au reste du programme**. Le retour rend le résultat réutilisable. Le contrôle consiste à vérifier le critère suivant : Identifier des sous-problèmes cohérents et leurs entrées/sorties.

**Critère d'attribution du point :** la réponse respecte la méthode suivante : Identifier la conception erronée, produire un contre-exemple ou une vérification, puis reformuler.

**Source :** `n06:n06-i3:analyse-erreur`

## Décision pédagogique

| Résultat | Statut du nœud | Action pour la séance suivante |
|---:|---|---|
| 3/3 | ACQUIS | Réactivation brève puis palier supérieur |
| 2/3 | FRAGILE | Reprise ciblée de l'erreur et nouvel item court |
| 0–1/3 | NON_ACQUIS | Fiche de reprise, guidage et nouvelle vérification |

Une réponse encore en correction manuelle reste `PENDING_REVIEW` et ne doit pas être comptée comme un échec.
