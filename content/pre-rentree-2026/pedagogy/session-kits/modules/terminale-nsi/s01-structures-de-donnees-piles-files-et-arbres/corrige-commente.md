# Corrigé commenté — NSI — Entrée en Terminale — Séance 1

## Structures de données : piles, files et arbres

**Statut :** `HUMAN_VALIDATION_REQUIRED`  
**Usage :** document enseignant ; ne pas distribuer avant le travail élève.

## Banque A — Consolidation guidée

### Correction A1

**Réponse : A — 3**

Les indices commencent à 0.

**Lecture des erreurs possibles**

- B : Indice et valeur sont confondus.
- C : Les bornes d'une liste sont mal déterminées.
- D : Indice et valeur sont confondus.

**Méthode à institutionnaliser :** Suivre un parcours et distinguer position et contenu.

**Erreur à confronter :** Indice et valeur sont confondus

**Traçabilité :** `n01:n01-i1`

### Correction A2

**Réponse : C — 12 fois**

4 × 3 = 12.

**Lecture des erreurs possibles**

- A : Seule la boucle externe est comptée.
- B : Le coût n'est pas évalué.
- D : Le coût n'est pas évalué.

**Méthode à institutionnaliser :** Compter les opérations d'une double boucle simple.

**Erreur à confronter :** Le coût n'est pas évalué

**Traçabilité :** `n03:n03-i1`

### Correction A3

Dans une pile LIFO, 2 sort et il reste [4, 7] du bas vers le sommet. Dans une file FIFO contenant 4, 7, 2, le premier élément sorti serait 4.

**Méthode à institutionnaliser :** Guidage à retirer progressivement : Identifier l'extrémité d'insertion et celle de retrait.

**Erreur à confronter :** Confondre LIFO et FIFO.

**Traçabilité :** `programme:terminale-nsi:s01:A`

## Banque B — Attendu autonome

### Correction B1

**Réponse : B — dernier entré, premier sorti**

Une pile est LIFO.

**Lecture des erreurs possibles**

- A : Indice et valeur sont confondus.
- C : Les bornes d'une liste sont mal déterminées.
- D : Indice et valeur sont confondus.

**Méthode à institutionnaliser :** Suivre un parcours et distinguer position et contenu.

**Erreur à confronter :** Indice et valeur sont confondus

**Traçabilité :** `n01:n01-i2`

### Correction B2

**Réponse : D — n²**

Chaque élément est combiné avec n éléments.

**Lecture des erreurs possibles**

- A : Le coût n'est pas évalué.
- B : Le coût n'est pas évalué.
- C : Seule la boucle externe est comptée.

**Méthode à institutionnaliser :** Compter les opérations d'une double boucle simple.

**Erreur à confronter :** Le coût n'est pas évalué

**Traçabilité :** `n03:n03-i2`

### Correction B3

Dans une pile LIFO, 2 sort et il reste [4, 7] du bas vers le sommet. Dans une file FIFO contenant 4, 7, 2, le premier élément sorti serait 4.

**Méthode à institutionnaliser :** Identifier l'extrémité d'insertion et celle de retrait.

**Erreur à confronter :** Confondre LIFO et FIFO.

**Traçabilité :** `programme:terminale-nsi:s01:B`

## Banque C — Transfert et justification

### Correction C1

**Réponse : C — premier entré, premier sorti**

Une file est FIFO.

**Lecture des erreurs possibles**

- A : Les bornes d'une liste sont mal déterminées.
- B : Indice et valeur sont confondus.
- D : Indice et valeur sont confondus.

**Méthode à institutionnaliser :** Suivre un parcours et distinguer position et contenu.

**Erreur à confronter :** Indice et valeur sont confondus

**Traçabilité :** `n01:n01-i3`

### Correction C2

**Réponse : A — des données triées**

La dichotomie exploite l'ordre.

**Lecture des erreurs possibles**

- B : Le coût n'est pas évalué.
- C : Seule la boucle externe est comptée.
- D : Le coût n'est pas évalué.

**Méthode à institutionnaliser :** Compter les opérations d'une double boucle simple.

**Erreur à confronter :** Le coût n'est pas évalué

**Traçabilité :** `n03:n03-i3`

### Correction C3

Dans une pile LIFO, 2 sort et il reste [4, 7] du bas vers le sommet. Dans une file FIFO contenant 4, 7, 2, le premier élément sorti serait 4.

**Extension attendue :** la donnée modifiée doit être annoncée ; la prévision doit s'appuyer sur la méthode « Identifier l'extrémité d'insertion et celle de retrait. » ; le nouveau résultat doit être contrôlé et comparé au premier.

**Méthode à institutionnaliser :** Résoudre, contrôler, prévoir l'effet d'une variation, puis vérifier : Identifier l'extrémité d'insertion et celle de retrait.

**Erreur à confronter :** Confondre LIFO et FIFO.

**Traçabilité :** `programme:terminale-nsi:s01:C`
