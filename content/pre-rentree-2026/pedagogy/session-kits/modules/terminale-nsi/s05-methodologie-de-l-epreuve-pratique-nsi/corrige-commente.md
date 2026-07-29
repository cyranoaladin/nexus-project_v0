# Corrigé commenté — NSI — Entrée en Terminale — Séance 5

## Méthodologie de l'épreuve pratique NSI

**Statut :** `HUMAN_VALIDATION_REQUIRED`  
**Usage :** document enseignant ; ne pas distribuer avant le travail élève.

## Banque A — Consolidation guidée

### Correction A1

**Réponse : A — la recherche séquentielle**

La recherche séquentielle ne suppose aucun ordre.

**Lecture des erreurs possibles**

- B : La dichotomie n'est pas maîtrisée.
- C : Le tri est supposé sans coût.
- D : La dichotomie n'est pas maîtrisée.

**Méthode à institutionnaliser :** Choisir entre recherche séquentielle et dichotomique selon les préconditions.

**Erreur à confronter :** La dichotomie n'est pas maîtrisée

**Traçabilité :** `n05:n05-i1`

### Correction A2

**Réponse : B — positifs, négatifs, égalité et valeurs limites**

Les classes de cas doivent varier.

**Lecture des erreurs possibles**

- A : Aucune stratégie de test n'est construite.
- C : Un seul exemple réussi est tenu pour preuve.
- D : Aucune stratégie de test n'est construite.

**Méthode à institutionnaliser :** Choisir des cas nominaux, limites et invalides pertinents.

**Erreur à confronter :** Aucune stratégie de test n'est construite

**Traçabilité :** `n08:n08-i1`

### Correction A3

Ordre robuste : identifier le contrat, lire les tests fournis, coder une première solution, exécuter et compléter les tests par des cas limites, puis corriger. Le contrat et les tests guident l'implémentation.

**Méthode à institutionnaliser :** Guidage à retirer progressivement : Transformer l'énoncé en contrat avant d'écrire et utiliser les tests comme preuves partielles.

**Erreur à confronter :** Coder immédiatement puis modifier au hasard jusqu'à obtenir un résultat.

**Traçabilité :** `programme:terminale-nsi:s05:A`

## Banque B — Attendu autonome

### Correction B1

**Réponse : B — élimine environ la moitié de la zone**

Le milieu partage la zone de recherche.

**Lecture des erreurs possibles**

- A : La dichotomie n'est pas maîtrisée.
- C : Le tri est supposé sans coût.
- D : La dichotomie n'est pas maîtrisée.

**Méthode à institutionnaliser :** Choisir entre recherche séquentielle et dichotomique selon les préconditions.

**Erreur à confronter :** La dichotomie n'est pas maîtrisée

**Traçabilité :** `n05:n05-i2`

### Correction B2

**Réponse : C — entrée et résultat attendu**

La comparaison à l'attendu permet de décider.

**Lecture des erreurs possibles**

- A : Un seul exemple réussi est tenu pour preuve.
- B : Aucune stratégie de test n'est construite.
- D : Aucune stratégie de test n'est construite.

**Méthode à institutionnaliser :** Choisir des cas nominaux, limites et invalides pertinents.

**Erreur à confronter :** Aucune stratégie de test n'est construite

**Traçabilité :** `n08:n08-i2`

### Correction B3

Ordre robuste : identifier le contrat, lire les tests fournis, coder une première solution, exécuter et compléter les tests par des cas limites, puis corriger. Le contrat et les tests guident l'implémentation.

**Méthode à institutionnaliser :** Transformer l'énoncé en contrat avant d'écrire et utiliser les tests comme preuves partielles.

**Erreur à confronter :** Coder immédiatement puis modifier au hasard jusqu'à obtenir un résultat.

**Traçabilité :** `programme:terminale-nsi:s05:B`

## Banque C — Transfert et justification

### Correction C1

**Réponse : C — la trier puis utiliser la dichotomie**

Le coût initial du tri peut être amorti.

**Lecture des erreurs possibles**

- A : Le tri est supposé sans coût.
- B : La dichotomie n'est pas maîtrisée.
- D : La dichotomie n'est pas maîtrisée.

**Méthode à institutionnaliser :** Choisir entre recherche séquentielle et dichotomique selon les préconditions.

**Erreur à confronter :** La dichotomie n'est pas maîtrisée

**Traçabilité :** `n05:n05-i3`

### Correction C2

**Réponse : D — rejouer le test fautif et les tests de non-régression**

La correction ne doit pas casser d'autres cas.

**Lecture des erreurs possibles**

- A : Aucune stratégie de test n'est construite.
- B : Aucune stratégie de test n'est construite.
- C : Un seul exemple réussi est tenu pour preuve.

**Méthode à institutionnaliser :** Choisir des cas nominaux, limites et invalides pertinents.

**Erreur à confronter :** Aucune stratégie de test n'est construite

**Traçabilité :** `n08:n08-i3`

### Correction C3

Ordre robuste : identifier le contrat, lire les tests fournis, coder une première solution, exécuter et compléter les tests par des cas limites, puis corriger. Le contrat et les tests guident l'implémentation.

**Extension attendue :** la donnée modifiée doit être annoncée ; la prévision doit s'appuyer sur la méthode « Transformer l'énoncé en contrat avant d'écrire et utiliser les tests comme preuves partielles. » ; le nouveau résultat doit être contrôlé et comparé au premier.

**Méthode à institutionnaliser :** Résoudre, contrôler, prévoir l'effet d'une variation, puis vérifier : Transformer l'énoncé en contrat avant d'écrire et utiliser les tests comme preuves partielles.

**Erreur à confronter :** Coder immédiatement puis modifier au hasard jusqu'à obtenir un résultat.

**Traçabilité :** `programme:terminale-nsi:s05:C`
