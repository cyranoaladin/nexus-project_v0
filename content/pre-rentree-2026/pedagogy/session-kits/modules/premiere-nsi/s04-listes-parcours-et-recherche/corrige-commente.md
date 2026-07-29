# Corrigé commenté — NSI — Entrée en Première — Séance 4

## Listes, parcours et recherche

**Statut :** `HUMAN_VALIDATION_REQUIRED`  
**Usage :** document enseignant ; ne pas distribuer avant le travail élève.

## Banque A — Consolidation guidée

### Correction A1

`notes[0]` vaut 12, `notes[-1]` vaut 10 et `len(notes)` vaut 4.

**Méthode à institutionnaliser :** Les indices commencent à 0 ; l'indice -1 désigne le dernier élément.

**Erreur à confronter :** Confondre le dernier indice, qui vaut 3, avec la longueur, qui vaut 4.

**Traçabilité :** `programme:premiere-nsi:s04:A:programme:NSI-listes`

### Correction A2

```python
total = 0
for x in [3, 5, 2]:
    total = total + x
```
À la fin, `total` vaut 10.

**Méthode à institutionnaliser :** Initialiser l'accumulateur avant la boucle puis ajouter chaque valeur.

**Erreur à confronter :** Réinitialiser `total` à 0 à chaque tour.

**Traçabilité :** `programme:premiere-nsi:s04:A:programme:NSI-parcours`

### Correction A3

```python
def contient(tab, valeur):
    for element in tab:
        if element == valeur:
            return True
    return False
```

**Méthode à institutionnaliser :** Tester chaque élément ; renvoyer `False` seulement après la fin du parcours.

**Erreur à confronter :** Renvoyer `False` dès que le premier élément est différent.

**Traçabilité :** `programme:premiere-nsi:s04:A:programme:NSI-recherche`

## Banque B — Attendu autonome

### Correction B1

```python
def maximum(tab):
    m = tab[0]
    for x in tab[1:]:
        if x > m:
            m = x
    return m
```

**Méthode à institutionnaliser :** Initialiser avec une valeur de la liste, puis conserver le meilleur candidat rencontré.

**Erreur à confronter :** Initialiser à 0 : cela échoue si toutes les valeurs sont négatives.

**Traçabilité :** `programme:premiere-nsi:s04:B:programme:NSI-accumulation`

### Correction B2

S'il est dans la boucle, la fonction s'arrête après le premier élément. Placé après la boucle, il renvoie le total une fois tous les éléments examinés.

**Méthode à institutionnaliser :** Tracer l'exécution et repérer le moment où la fonction se termine.

**Erreur à confronter :** Confondre fin d'une itération et fin de la fonction.

**Traçabilité :** `programme:premiere-nsi:s04:B:programme:NSI-trace`

### Correction B3

Exemples : valeur au début `[4,2,1],4`; au milieu `[4,2,1],2`; absente `[4,2,1],9`; liste vide `[],4`. On peut ajouter une valeur répétée.

**Méthode à institutionnaliser :** Couvrir réussite, échec, position limite et structure vide.

**Erreur à confronter :** Tester seulement un cas où la valeur est présente.

**Traçabilité :** `programme:premiere-nsi:s04:B:programme:NSI-tests`

## Banque C — Transfert et justification

### Correction C1

```python
def indice_premier(tab, valeur):
    for i in range(len(tab)):
        if tab[i] == valeur:
            return i
    return None
```

**Méthode à institutionnaliser :** Parcourir les indices pour pouvoir renvoyer une position ; différer l'échec jusqu'à la fin.

**Erreur à confronter :** Renvoyer l'élément au lieu de son indice.

**Traçabilité :** `programme:premiere-nsi:s04:C:programme:NSI-recherche-indice`

### Correction C2

Au pire, 10 puis 1 000 comparaisons. Le coût croît proportionnellement à la longueur : la recherche est linéaire, notée O(n).

**Méthode à institutionnaliser :** Étudier le cas où la valeur est absente ou placée en dernier.

**Erreur à confronter :** Dire seulement que la grande liste est « plus lente » sans quantifier.

**Traçabilité :** `programme:premiere-nsi:s04:C:programme:NSI-efficacite`

### Correction C3

```python
def moyenne(tab):
    total = 0
    for x in tab:
        total += x
    return total / len(tab)
```
Pour une liste vide, on peut lever une exception explicite ou renvoyer `None` selon le contrat choisi.

**Méthode à institutionnaliser :** Séparer le calcul nominal du traitement du cas limite et annoncer le contrat.

**Erreur à confronter :** Diviser par zéro ou choisir silencieusement une convention.

**Traçabilité :** `programme:premiere-nsi:s04:C:programme:NSI-cas-limite`
