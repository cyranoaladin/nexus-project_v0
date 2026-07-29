# Corrigé commenté — NSI — Entrée en Terminale — Séance 2

## Récursivité : principes et applications

**Statut :** `HUMAN_VALIDATION_REQUIRED`  
**Usage :** document enseignant ; ne pas distribuer avant le travail élève.

## Banque A — Consolidation guidée

### Correction A1

**Réponse : D — ne fournit pas nécessairement 5 à l'appelant**

Afficher et retourner sont deux actions différentes.

**Lecture des erreurs possibles**

- A : return et print sont confondus.
- B : return et print sont confondus.
- C : Le cas de base n'est pas identifié.

**Méthode à institutionnaliser :** Expliquer le rôle d'un paramètre, d'un retour et d'un cas de base.

**Erreur à confronter :** return et print sont confondus

**Traçabilité :** `n02:n02-i1`

### Correction A2

La réponse est incorrecte. **Réponse attendue : ne fournit pas nécessairement 5 à l'appelant**. Afficher et retourner sont deux actions différentes. Le contrôle consiste à vérifier le critère suivant : Expliquer le rôle d'un paramètre, d'un retour et d'un cas de base.

**Méthode à institutionnaliser :** Identifier la conception erronée, produire un contre-exemple ou une vérification, puis reformuler.

**Erreur à confronter :** return et print sont confondus

**Traçabilité :** `n02:n02-i1:analyse-erreur`

### Correction A3

Les appels sont puissance(2,4) → 2×puissance(2,3) → 2²×puissance(2,2) → 2³×puissance(2,1) → 2⁴×puissance(2,0) = 16.

**Méthode à institutionnaliser :** Guidage à retirer progressivement : Identifier le cas de base et vérifier que chaque appel s'en rapproche.

**Erreur à confronter :** Oublier le cas de base, ce qui empêche la terminaison.

**Traçabilité :** `programme:terminale-nsi:s02:A`

## Banque B — Attendu autonome

### Correction B1

**Réponse : A — arrêter les appels**

Il garantit une terminaison.

**Lecture des erreurs possibles**

- B : return et print sont confondus.
- C : Le cas de base n'est pas identifié.
- D : return et print sont confondus.

**Méthode à institutionnaliser :** Expliquer le rôle d'un paramètre, d'un retour et d'un cas de base.

**Erreur à confronter :** return et print sont confondus

**Traçabilité :** `n02:n02-i2`

### Correction B2

La réponse est incorrecte. **Réponse attendue : arrêter les appels**. Il garantit une terminaison. Le contrôle consiste à vérifier le critère suivant : Expliquer le rôle d'un paramètre, d'un retour et d'un cas de base.

**Méthode à institutionnaliser :** Identifier la conception erronée, produire un contre-exemple ou une vérification, puis reformuler.

**Erreur à confronter :** return et print sont confondus

**Traçabilité :** `n02:n02-i2:analyse-erreur`

### Correction B3

Les appels sont puissance(2,4) → 2×puissance(2,3) → 2²×puissance(2,2) → 2³×puissance(2,1) → 2⁴×puissance(2,0) = 16.

**Méthode à institutionnaliser :** Identifier le cas de base et vérifier que chaque appel s'en rapproche.

**Erreur à confronter :** Oublier le cas de base, ce qui empêche la terminaison.

**Traçabilité :** `programme:terminale-nsi:s02:B`

## Banque C — Transfert et justification

### Correction C1

**Réponse : B — un problème plus petit**

La réduction rapproche du cas de base.

**Lecture des erreurs possibles**

- A : return et print sont confondus.
- C : Le cas de base n'est pas identifié.
- D : return et print sont confondus.

**Méthode à institutionnaliser :** Expliquer le rôle d'un paramètre, d'un retour et d'un cas de base.

**Erreur à confronter :** return et print sont confondus

**Traçabilité :** `n02:n02-i3`

### Correction C2

La réponse est incorrecte. **Réponse attendue : un problème plus petit**. La réduction rapproche du cas de base. Le contrôle consiste à vérifier le critère suivant : Expliquer le rôle d'un paramètre, d'un retour et d'un cas de base.

**Méthode à institutionnaliser :** Identifier la conception erronée, produire un contre-exemple ou une vérification, puis reformuler.

**Erreur à confronter :** return et print sont confondus

**Traçabilité :** `n02:n02-i3:analyse-erreur`

### Correction C3

Les appels sont puissance(2,4) → 2×puissance(2,3) → 2²×puissance(2,2) → 2³×puissance(2,1) → 2⁴×puissance(2,0) = 16.

**Extension attendue :** la donnée modifiée doit être annoncée ; la prévision doit s'appuyer sur la méthode « Identifier le cas de base et vérifier que chaque appel s'en rapproche. » ; le nouveau résultat doit être contrôlé et comparé au premier.

**Méthode à institutionnaliser :** Résoudre, contrôler, prévoir l'effet d'une variation, puis vérifier : Identifier le cas de base et vérifier que chaque appel s'en rapproche.

**Erreur à confronter :** Oublier le cas de base, ce qui empêche la terminaison.

**Traçabilité :** `programme:terminale-nsi:s02:C`
