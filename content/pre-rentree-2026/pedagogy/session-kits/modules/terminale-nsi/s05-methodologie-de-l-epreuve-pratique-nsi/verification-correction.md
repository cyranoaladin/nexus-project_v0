# Correction de la vérification — NSI — Entrée en Terminale — Séance 5

## Méthodologie de l'épreuve pratique NSI

**Statut :** `HUMAN_VALIDATION_REQUIRED`

### Correction question 1

Ordre robuste : identifier le contrat, lire les tests fournis, coder une première solution, exécuter et compléter les tests par des cas limites, puis corriger. Le contrat et les tests guident l'implémentation.

**Critère d'attribution du point :** la réponse respecte la méthode suivante : Transformer l'énoncé en contrat avant d'écrire et utiliser les tests comme preuves partielles.

**Source :** `programme:terminale-nsi:s05:B`

### Correction question 2

**Réponse : A — la recherche séquentielle**

La recherche séquentielle ne suppose aucun ordre.

**Lecture des erreurs possibles**

- B : La dichotomie n'est pas maîtrisée.
- C : Le tri est supposé sans coût.
- D : La dichotomie n'est pas maîtrisée.

**Critère d'attribution du point :** la réponse respecte la méthode suivante : Choisir entre recherche séquentielle et dichotomique selon les préconditions.

**Source :** `n05:n05-i1`

### Correction question 3

**Réponse : D — rejouer le test fautif et les tests de non-régression**

La correction ne doit pas casser d'autres cas.

**Lecture des erreurs possibles**

- A : Aucune stratégie de test n'est construite.
- B : Aucune stratégie de test n'est construite.
- C : Un seul exemple réussi est tenu pour preuve.

**Critère d'attribution du point :** la réponse respecte la méthode suivante : Choisir des cas nominaux, limites et invalides pertinents.

**Source :** `n08:n08-i3`

## Décision pédagogique

| Résultat | Statut du nœud | Action pour la séance suivante |
|---:|---|---|
| 3/3 | ACQUIS | Réactivation brève puis palier supérieur |
| 2/3 | FRAGILE | Reprise ciblée de l'erreur et nouvel item court |
| 0–1/3 | NON_ACQUIS | Fiche de reprise, guidage et nouvelle vérification |

Une réponse encore en correction manuelle reste `PENDING_REVIEW` et ne doit pas être comptée comme un échec.
