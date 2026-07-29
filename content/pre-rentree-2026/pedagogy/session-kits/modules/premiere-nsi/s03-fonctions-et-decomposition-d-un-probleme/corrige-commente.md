# Corrigé commenté — NSI — Entrée en Première — Séance 3

## Fonctions et décomposition d’un problème

**Statut :** `HUMAN_VALIDATION_REQUIRED`  
**Usage :** document enseignant ; ne pas distribuer avant le travail élève.

## Banque A — Consolidation guidée

### Correction A1

**Réponse : D — calculer le TTC d'un prix donné**

La sous-tâche est réutilisable et possède une entrée claire.

**Lecture des erreurs possibles**

- A : Tout est traité dans un seul bloc.
- B : Tout est traité dans un seul bloc.
- C : Une sous-tâche est confondue avec son résultat.

**Méthode à institutionnaliser :** Identifier des sous-problèmes cohérents et leurs entrées/sorties.

**Erreur à confronter :** Tout est traité dans un seul bloc

**Traçabilité :** `n06:n06-i1`

### Correction A2

La réponse est incorrecte. **Réponse attendue : calculer le TTC d'un prix donné**. La sous-tâche est réutilisable et possède une entrée claire. Le contrôle consiste à vérifier le critère suivant : Identifier des sous-problèmes cohérents et leurs entrées/sorties.

**Méthode à institutionnaliser :** Identifier la conception erronée, produire un contre-exemple ou une vérification, puis reformuler.

**Erreur à confronter :** Tout est traité dans un seul bloc

**Traçabilité :** `n06:n06-i1:analyse-erreur`

### Correction A3

```python
def est_pair(n):
    return n % 2 == 0
```
Tests possibles : `est_pair(4)` vrai, `est_pair(7)` faux, `est_pair(-2)` vrai.

**Méthode à institutionnaliser :** Guidage à retirer progressivement : Définir un contrat simple, renvoyer l'expression booléenne et tester des classes de cas.

**Erreur à confronter :** Afficher le résultat dans la fonction au lieu de le renvoyer.

**Traçabilité :** `programme:premiere-nsi:s03:A`

## Banque B — Attendu autonome

### Correction B1

**Réponse : A — deux nombres**

Les paramètres sont les données nécessaires au calcul.

**Lecture des erreurs possibles**

- B : Tout est traité dans un seul bloc.
- C : Une sous-tâche est confondue avec son résultat.
- D : Tout est traité dans un seul bloc.

**Méthode à institutionnaliser :** Identifier des sous-problèmes cohérents et leurs entrées/sorties.

**Erreur à confronter :** Tout est traité dans un seul bloc

**Traçabilité :** `n06:n06-i2`

### Correction B2

La réponse est incorrecte. **Réponse attendue : deux nombres**. Les paramètres sont les données nécessaires au calcul. Le contrôle consiste à vérifier le critère suivant : Identifier des sous-problèmes cohérents et leurs entrées/sorties.

**Méthode à institutionnaliser :** Identifier la conception erronée, produire un contre-exemple ou une vérification, puis reformuler.

**Erreur à confronter :** Tout est traité dans un seul bloc

**Traçabilité :** `n06:n06-i2:analyse-erreur`

### Correction B3

```python
def est_pair(n):
    return n % 2 == 0
```
Tests possibles : `est_pair(4)` vrai, `est_pair(7)` faux, `est_pair(-2)` vrai.

**Méthode à institutionnaliser :** Définir un contrat simple, renvoyer l'expression booléenne et tester des classes de cas.

**Erreur à confronter :** Afficher le résultat dans la fonction au lieu de le renvoyer.

**Traçabilité :** `programme:premiere-nsi:s03:B`

## Banque C — Transfert et justification

### Correction C1

**Réponse : B — au résultat transmis au reste du programme**

Le retour rend le résultat réutilisable.

**Lecture des erreurs possibles**

- A : Tout est traité dans un seul bloc.
- C : Une sous-tâche est confondue avec son résultat.
- D : Tout est traité dans un seul bloc.

**Méthode à institutionnaliser :** Identifier des sous-problèmes cohérents et leurs entrées/sorties.

**Erreur à confronter :** Tout est traité dans un seul bloc

**Traçabilité :** `n06:n06-i3`

### Correction C2

La réponse est incorrecte. **Réponse attendue : au résultat transmis au reste du programme**. Le retour rend le résultat réutilisable. Le contrôle consiste à vérifier le critère suivant : Identifier des sous-problèmes cohérents et leurs entrées/sorties.

**Méthode à institutionnaliser :** Identifier la conception erronée, produire un contre-exemple ou une vérification, puis reformuler.

**Erreur à confronter :** Tout est traité dans un seul bloc

**Traçabilité :** `n06:n06-i3:analyse-erreur`

### Correction C3

```python
def est_pair(n):
    return n % 2 == 0
```
Tests possibles : `est_pair(4)` vrai, `est_pair(7)` faux, `est_pair(-2)` vrai.

**Extension attendue :** la donnée modifiée doit être annoncée ; la prévision doit s'appuyer sur la méthode « Définir un contrat simple, renvoyer l'expression booléenne et tester des classes de cas. » ; le nouveau résultat doit être contrôlé et comparé au premier.

**Méthode à institutionnaliser :** Résoudre, contrôler, prévoir l'effet d'une variation, puis vérifier : Définir un contrat simple, renvoyer l'expression booléenne et tester des classes de cas.

**Erreur à confronter :** Afficher le résultat dans la fonction au lieu de le renvoyer.

**Traçabilité :** `programme:premiere-nsi:s03:C`
