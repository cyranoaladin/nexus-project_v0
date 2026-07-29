# Corrigé commenté — NSI — Entrée en Première — Séance 2

## Conditions et boucles

**Statut :** `HUMAN_VALIDATION_REQUIRED`  
**Usage :** document enseignant ; ne pas distribuer avant le travail élève.

## Banque A — Consolidation guidée

### Correction A1

**Réponse : D — les deux conditions sont vraies**

Une conjonction exige les deux propositions.

**Lecture des erreurs possibles**

- A : La négation d'un « et » est mal construite.
- B : La négation d'un « et » est mal construite.
- C : Le « ou » est compris comme exclusif.

**Méthode à institutionnaliser :** Évaluer une proposition logique et formuler sa négation.

**Erreur à confronter :** La négation d'un « et » est mal construite

**Traçabilité :** `n02:n02-i1`

### Correction A2

**Réponse : C — x ≤ 10**

La borne 10 doit être incluse.

**Lecture des erreurs possibles**

- A : Les bornes sont testées dans le mauvais sens.
- B : < et ≤ sont confondus.
- D : < et ≤ sont confondus.

**Méthode à institutionnaliser :** Distinguer strict et large et vérifier l'appartenance à un intervalle.

**Erreur à confronter :** < et ≤ sont confondus

**Traçabilité :** `n03:n03-i1`

### Correction A3

```python
def somme_entiers(n):
    total = 0
    for k in range(1, n + 1):
        total += k
    return total
```
Pour n = 4, le résultat vaut 10.

**Méthode à institutionnaliser :** Guidage à retirer progressivement : Initialiser un accumulateur, choisir des bornes incluant n et renvoyer après la boucle.

**Erreur à confronter :** Utiliser `range(1, n)`, qui exclut n.

**Traçabilité :** `programme:premiere-nsi:s02:A`

## Banque B — Attendu autonome

### Correction B1

**Réponse : A — x ≤ 2 ou x ≥ 7**

La négation d'une conjonction devient une disjonction des négations.

**Lecture des erreurs possibles**

- B : La négation d'un « et » est mal construite.
- C : Le « ou » est compris comme exclusif.
- D : La négation d'un « et » est mal construite.

**Méthode à institutionnaliser :** Évaluer une proposition logique et formuler sa négation.

**Erreur à confronter :** La négation d'un « et » est mal construite

**Traçabilité :** `n02:n02-i2`

### Correction B2

**Réponse : D — x ≥ 0 et x ≤ 5**

Les deux bornes doivent être respectées.

**Lecture des erreurs possibles**

- A : < et ≤ sont confondus.
- B : < et ≤ sont confondus.
- C : Les bornes sont testées dans le mauvais sens.

**Méthode à institutionnaliser :** Distinguer strict et large et vérifier l'appartenance à un intervalle.

**Erreur à confronter :** < et ≤ sont confondus

**Traçabilité :** `n03:n03-i2`

### Correction B3

```python
def somme_entiers(n):
    total = 0
    for k in range(1, n + 1):
        total += k
    return total
```
Pour n = 4, le résultat vaut 10.

**Méthode à institutionnaliser :** Initialiser un accumulateur, choisir des bornes incluant n et renvoyer après la boucle.

**Erreur à confronter :** Utiliser `range(1, n)`, qui exclut n.

**Traçabilité :** `programme:premiere-nsi:s02:B`

## Banque C — Transfert et justification

### Correction C1

**Réponse : B — une image, un PDF, ou les deux**

En logique, le ou est inclusif sauf indication contraire.

**Lecture des erreurs possibles**

- A : La négation d'un « et » est mal construite.
- C : Le « ou » est compris comme exclusif.
- D : La négation d'un « et » est mal construite.

**Méthode à institutionnaliser :** Évaluer une proposition logique et formuler sa négation.

**Erreur à confronter :** La négation d'un « et » est mal construite

**Traçabilité :** `n02:n02-i3`

### Correction C2

**Réponse : A — elle s'arrête**

4 < 4 est faux.

**Lecture des erreurs possibles**

- B : < et ≤ sont confondus.
- C : Les bornes sont testées dans le mauvais sens.
- D : < et ≤ sont confondus.

**Méthode à institutionnaliser :** Distinguer strict et large et vérifier l'appartenance à un intervalle.

**Erreur à confronter :** < et ≤ sont confondus

**Traçabilité :** `n03:n03-i3`

### Correction C3

```python
def somme_entiers(n):
    total = 0
    for k in range(1, n + 1):
        total += k
    return total
```
Pour n = 4, le résultat vaut 10.

**Extension attendue :** la donnée modifiée doit être annoncée ; la prévision doit s'appuyer sur la méthode « Initialiser un accumulateur, choisir des bornes incluant n et renvoyer après la boucle. » ; le nouveau résultat doit être contrôlé et comparé au premier.

**Méthode à institutionnaliser :** Résoudre, contrôler, prévoir l'effet d'une variation, puis vérifier : Initialiser un accumulateur, choisir des bornes incluant n et renvoyer après la boucle.

**Erreur à confronter :** Utiliser `range(1, n)`, qui exclut n.

**Traçabilité :** `programme:premiere-nsi:s02:C`
