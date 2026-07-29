# Corrigé commenté — Mathématiques expertes — Entrée en Terminale — Séance 5

## Graphes : notions et parcours

**Statut :** `HUMAN_VALIDATION_REQUIRED`  
**Usage :** document enseignant ; ne pas distribuer avant le travail élève.

## Banque A — Consolidation guidée

### Correction A1

**Réponse : C — les sommets**

Les objets deviennent les sommets.

**Lecture des erreurs possibles**

- A : Le sens d'une relation orientée est ignoré.
- B : Sommet et arête sont confondus.
- D : Sommet et arête sont confondus.

**Méthode à institutionnaliser :** Identifier sommets, arêtes et chemins dans une représentation.

**Erreur à confronter :** Sommet et arête sont confondus

**Traçabilité :** `n07:n07-i1`

### Correction A2

**Réponse : B — la somme des poids de ses arêtes**

Les coûts successifs s'additionnent.

**Lecture des erreurs possibles**

- A : Une stratégie locale est tenue pour toujours optimale.
- C : Les états déjà visités ne sont pas mémorisés.
- D : Une stratégie locale est tenue pour toujours optimale.

**Méthode à institutionnaliser :** Suivre un algorithme de parcours simple et comparer des coûts.

**Erreur à confronter :** Une stratégie locale est tenue pour toujours optimale

**Traçabilité :** `n08:n08-i1`

### Correction A3

A-C-B-D a un poids 2 + 1 + 3 = 6. A-B-D vaut 7 et A-C-D vaut 8. Un plus court chemin est donc A-C-B-D, de longueur 6.

**Méthode à institutionnaliser :** Guidage à retirer progressivement : Comparer les coûts cumulés des chemins admissibles ou appliquer Dijkstra.

**Erreur à confronter :** Choisir à chaque étape l'arête la plus courte sans tenir compte du coût total.

**Traçabilité :** `programme:terminale-maths-expertes:s05:A`

## Banque B — Attendu autonome

### Correction B1

**Réponse : D — une suite de sommets reliés**

Chaque étape utilise une arête ou un arc.

**Lecture des erreurs possibles**

- A : Sommet et arête sont confondus.
- B : Sommet et arête sont confondus.
- C : Le sens d'une relation orientée est ignoré.

**Méthode à institutionnaliser :** Identifier sommets, arêtes et chemins dans une représentation.

**Erreur à confronter :** Sommet et arête sont confondus

**Traçabilité :** `n07:n07-i2`

### Correction B2

**Réponse : C — de coût total minimal**

On compare le coût total.

**Lecture des erreurs possibles**

- A : Les états déjà visités ne sont pas mémorisés.
- B : Une stratégie locale est tenue pour toujours optimale.
- D : Une stratégie locale est tenue pour toujours optimale.

**Méthode à institutionnaliser :** Suivre un algorithme de parcours simple et comparer des coûts.

**Erreur à confronter :** Une stratégie locale est tenue pour toujours optimale

**Traçabilité :** `n08:n08-i2`

### Correction B3

A-C-B-D a un poids 2 + 1 + 3 = 6. A-B-D vaut 7 et A-C-D vaut 8. Un plus court chemin est donc A-C-B-D, de longueur 6.

**Méthode à institutionnaliser :** Comparer les coûts cumulés des chemins admissibles ou appliquer Dijkstra.

**Erreur à confronter :** Choisir à chaque étape l'arête la plus courte sans tenir compte du coût total.

**Traçabilité :** `programme:terminale-maths-expertes:s05:B`

## Banque C — Transfert et justification

### Correction C1

**Réponse : A — un arc de A vers B**

L'orientation fixe le sens.

**Lecture des erreurs possibles**

- B : Sommet et arête sont confondus.
- C : Le sens d'une relation orientée est ignoré.
- D : Sommet et arête sont confondus.

**Méthode à institutionnaliser :** Identifier sommets, arêtes et chemins dans une représentation.

**Erreur à confronter :** Sommet et arête sont confondus

**Traçabilité :** `n07:n07-i3`

### Correction C2

**Réponse : D — des répétitions inutiles ou des boucles**

Le marquage structure le parcours.

**Lecture des erreurs possibles**

- A : Une stratégie locale est tenue pour toujours optimale.
- B : Une stratégie locale est tenue pour toujours optimale.
- C : Les états déjà visités ne sont pas mémorisés.

**Méthode à institutionnaliser :** Suivre un algorithme de parcours simple et comparer des coûts.

**Erreur à confronter :** Une stratégie locale est tenue pour toujours optimale

**Traçabilité :** `n08:n08-i3`

### Correction C3

A-C-B-D a un poids 2 + 1 + 3 = 6. A-B-D vaut 7 et A-C-D vaut 8. Un plus court chemin est donc A-C-B-D, de longueur 6.

**Extension attendue :** la donnée modifiée doit être annoncée ; la prévision doit s'appuyer sur la méthode « Comparer les coûts cumulés des chemins admissibles ou appliquer Dijkstra. » ; le nouveau résultat doit être contrôlé et comparé au premier.

**Méthode à institutionnaliser :** Résoudre, contrôler, prévoir l'effet d'une variation, puis vérifier : Comparer les coûts cumulés des chemins admissibles ou appliquer Dijkstra.

**Erreur à confronter :** Choisir à chaque étape l'arête la plus courte sans tenir compte du coût total.

**Traçabilité :** `programme:terminale-maths-expertes:s05:C`
