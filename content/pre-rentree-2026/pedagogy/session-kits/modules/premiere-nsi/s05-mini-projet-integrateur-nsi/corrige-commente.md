# Corrigé commenté — NSI — Entrée en Première — Séance 5

## Mini-projet intégrateur NSI

**Statut :** `HUMAN_VALIDATION_REQUIRED`  
**Usage :** document enseignant ; ne pas distribuer avant le travail élève.

## Banque A — Consolidation guidée

### Correction A1

Entrées : cinq températures numériques. Traitement : somme puis division par 5. Sortie : affichage de la moyenne avec une unité.

**Méthode à institutionnaliser :** Transformer le besoin en données reçues, opération calculée et résultat produit.

**Erreur à confronter :** Commencer à coder sans définir ce que le programme doit recevoir ni afficher.

**Traçabilité :** `programme:premiere-nsi:s05:A:programme:NSI-cahier-charges`

### Correction A2

Exemple : `moyenne(valeurs) -> float` et `message_moyenne(valeurs) -> str`. La première calcule ; la seconde prépare le texte affiché.

**Méthode à institutionnaliser :** Attribuer une responsabilité unique à chaque fonction.

**Erreur à confronter :** Créer une fonction unique qui saisit, calcule, affiche et teste tout à la fois.

**Traçabilité :** `programme:premiere-nsi:s05:A:programme:NSI-decomposition`

### Correction A3

Exemples : `[10] → 10`; `[10, 12, 14] → 12`; `[-2, 0, 2] → 0`. Ces tests couvrent singleton, cas ordinaire et valeurs négatives.

**Méthode à institutionnaliser :** Associer à chaque entrée un résultat attendu calculé à l'avance.

**Erreur à confronter :** Tester plusieurs listes sans écrire les résultats attendus.

**Traçabilité :** `programme:premiere-nsi:s05:A:programme:NSI-validation`

## Banque B — Attendu autonome

### Correction B1

Le programme stocke trois questions et leurs réponses, pose chaque question, compare la saisie après normalisation simple, compte les réussites et affiche le score. Une saisie vide doit être redemandée ou signalée selon la règle annoncée.

**Méthode à institutionnaliser :** Écrire des exigences observables et testables, pas une intention vague.

**Erreur à confronter :** Ajouter des fonctions non demandées sans fixer les règles essentielles.

**Traçabilité :** `programme:premiere-nsi:s05:B:programme:NSI-specification`

### Correction B2

Exemple : `poser_question(question, reponse) -> bool`, `calculer_score(questions) -> int`, `bilan(score, total) -> str`.

**Méthode à institutionnaliser :** Faire circuler les données par paramètres et retours plutôt que par variables globales.

**Erreur à confronter :** Donner des noms de fonctions sans préciser leur contrat.

**Traçabilité :** `programme:premiere-nsi:s05:B:programme:NSI-fonctions`

### Correction B3

Le tableau doit indiquer entrée, résultat attendu et règle testée. Exemple : `"Paris"/"paris" → vrai` seulement si le cahier des charges prévoit une comparaison insensible à la casse.

**Méthode à institutionnaliser :** Chaque test doit vérifier une règle explicite du cahier des charges.

**Erreur à confronter :** Inventer pendant les tests une règle absente de la spécification.

**Traçabilité :** `programme:premiere-nsi:s05:B:programme:NSI-plan-tests`

## Banque C — Transfert et justification

### Correction C1

Structure possible : liste de dictionnaires `{'titre': str, 'faite': bool}`. Fonctions : `ajouter(taches,titre)`, `terminer(taches,indice)`, `afficher(taches)`. Invariant : chaque tâche possède toujours les deux clés avec les types annoncés.

**Méthode à institutionnaliser :** Choisir une représentation simple, puis écrire les contrats qui la préservent.

**Erreur à confronter :** Multiplier les structures sans justifier leur nécessité.

**Traçabilité :** `programme:premiere-nsi:s05:C:programme:NSI-architecture`

### Correction C2

Exemple : « Marque comme faite la tâche d'indice valide. Préconditions : liste conforme et `0 ≤ indice < len(taches)`. Effet : met `faite` à `True`. Retour : aucun. Erreur : `IndexError` ou message contrôlé si l'indice est invalide. »

**Méthode à institutionnaliser :** Documenter le contrat observable, pas traduire chaque ligne de code.

**Erreur à confronter :** Écrire « cette fonction termine une tâche » sans préciser conditions ni effet exact.

**Traçabilité :** `programme:premiere-nsi:s05:C:programme:NSI-documentation`

### Correction C3

Une présentation recevable suit les quatre étapes demandées et montre un test concret avec entrée et résultat. L'amélioration doit être réaliste, par exemple sauvegarder les tâches ou valider les titres vides.

**Méthode à institutionnaliser :** Soutenir chaque choix par une raison et une preuve de fonctionnement.

**Erreur à confronter :** Lire le code ligne par ligne sans expliquer les décisions.

**Traçabilité :** `programme:premiere-nsi:s05:C:programme:NSI-presentation`
