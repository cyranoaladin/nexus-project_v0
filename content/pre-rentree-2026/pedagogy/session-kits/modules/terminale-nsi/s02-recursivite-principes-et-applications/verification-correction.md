# Correction de la vérification — NSI — Entrée en Terminale — Séance 2

## Récursivité : principes et applications

**Statut :** `HUMAN_VALIDATION_REQUIRED`

### Correction question 1

Les appels sont puissance(2,4) → 2×puissance(2,3) → 2²×puissance(2,2) → 2³×puissance(2,1) → 2⁴×puissance(2,0) = 16.

**Critère d'attribution du point :** la réponse respecte la méthode suivante : Identifier le cas de base et vérifier que chaque appel s'en rapproche.

**Source :** `programme:terminale-nsi:s02:B`

### Correction question 2

**Réponse : D — ne fournit pas nécessairement 5 à l'appelant**

Afficher et retourner sont deux actions différentes.

**Lecture des erreurs possibles**

- A : return et print sont confondus.
- B : return et print sont confondus.
- C : Le cas de base n'est pas identifié.

**Critère d'attribution du point :** la réponse respecte la méthode suivante : Expliquer le rôle d'un paramètre, d'un retour et d'un cas de base.

**Source :** `n02:n02-i1`

### Correction question 3

La réponse est incorrecte. **Réponse attendue : un problème plus petit**. La réduction rapproche du cas de base. Le contrôle consiste à vérifier le critère suivant : Expliquer le rôle d'un paramètre, d'un retour et d'un cas de base.

**Critère d'attribution du point :** la réponse respecte la méthode suivante : Identifier la conception erronée, produire un contre-exemple ou une vérification, puis reformuler.

**Source :** `n02:n02-i3:analyse-erreur`

## Décision pédagogique

| Résultat | Statut du nœud | Action pour la séance suivante |
|---:|---|---|
| 3/3 | ACQUIS | Réactivation brève puis palier supérieur |
| 2/3 | FRAGILE | Reprise ciblée de l'erreur et nouvel item court |
| 0–1/3 | NON_ACQUIS | Fiche de reprise, guidage et nouvelle vérification |

Une réponse encore en correction manuelle reste `PENDING_REVIEW` et ne doit pas être comptée comme un échec.
