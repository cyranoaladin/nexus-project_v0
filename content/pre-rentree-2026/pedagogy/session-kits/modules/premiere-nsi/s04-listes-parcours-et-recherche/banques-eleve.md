# NSI — Entrée en Première — Séance 4

## Listes, parcours et recherche

**Statut :** `HUMAN_VALIDATION_REQUIRED`  
**Objectif publié :** Manipuler une collection simple et construire un premier algorithme de recherche  
**Livrable publié :** Algorithme de recherche commenté et jeu de tests

### Notions clés publiées

- Création et accès aux éléments d’une liste
- Parcours par indices et par valeurs
- Accumulation et recherche séquentielle
- Introduction à l’efficacité d’un algorithme

## Consigne de différenciation

L'enseignant indique le palier d'entrée pour chaque nœud. Un élève peut changer de palier au cours de la séance. Rédiger les raisonnements et conserver les traces de contrôle.

## Banque A — Consolidation guidée

### Exercice A1

Soit `notes = [12, 8, 15, 10]`. Donnez `notes[0]`, `notes[-1]` et `len(notes)`.

**Réponse et justification**



### Exercice A2

Complétez : `total = 0` puis `for x in [3, 5, 2]: ...` afin d'obtenir la somme.

**Réponse et justification**



### Exercice A3

Écrivez une fonction `contient(tab, valeur)` utilisant une recherche séquentielle et renvoyant un booléen.

**Réponse et justification**



## Banque B — Attendu autonome

### Exercice B1

Écrivez `maximum(tab)` sans utiliser `max`. On suppose `tab` non vide.

**Réponse et justification**



### Exercice B2

La fonction suivante doit compter les valeurs positives : `def compte_pos(tab): c=0; for x in tab: if x>0: c=c+1; return c`. Expliquez pourquoi le `return` doit être placé après la boucle.

**Réponse et justification**



### Exercice B3

Proposez quatre tests pour `contient(tab, valeur)` couvrant des cas différents.

**Réponse et justification**



## Banque C — Transfert et justification

### Exercice C1

Écrivez `indice_premier(tab, valeur)` qui renvoie le premier indice trouvé, ou `None` si la valeur est absente.

**Réponse et justification**



### Exercice C2

Comparez une recherche séquentielle dans une liste de 10 éléments et dans une liste de 1 000 éléments. Quel est le pire nombre de comparaisons et quelle conclusion d'efficacité en tirez-vous ?

**Réponse et justification**



### Exercice C3

Écrivez une fonction qui renvoie la moyenne des valeurs d'une liste non vide, puis indiquez l'adaptation nécessaire pour la liste vide.

**Réponse et justification**
