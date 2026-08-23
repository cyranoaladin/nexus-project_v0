# Certitude absente sur copie — Mathématiques complémentaires

## Contexte

Le pack `entree-terminale-maths-complementaires-v1` impose actuellement une
certitude de 1 à 4 pour toute réponse A/B/C/D saisie depuis une copie papier.
L'opérateur demande désormais d'aligner ce pack sur les autres matières : si
la case de certitude n'a pas été remplie sur la copie, l'assistante doit pouvoir
le déclarer explicitement sans inventer une valeur.

Cette décision remplace l'exigence urgente précédente qui rendait la certitude
obligatoire pour ce seul pack.

## Comportement attendu

Pour chaque question MCO ayant une réponse A/B/C/D, l'interface propose :

- les certitudes `1`, `2`, `3` et `4` ;
- le choix explicite `Absente de la copie`.

Le choix `Absente de la copie` envoie et conserve `confidence: null`. Il ne
change ni `optionId`, ni la correction, ni le score de connaissances. La
saisie ne lui substitue aucune valeur 1–4.

Le choix `Sans réponse` reste réservé à une question à laquelle l'élève n'a pas
répondu. Il continue de produire `optionId: null` et `confidence: null`.

Une case de certitude laissée sans sélection dans l'interface reste une saisie
incomplète : l'assistante doit choisir 1–4 ou `Absente de la copie` avant de
valider.

## Architecture

Le comportement générique du pipeline papier devient la seule politique :

1. `PaperEntryGrid` affiche toujours le choix `Absente de la copie`.
2. La valeur UI `ABSENTE` est projetée en `confidence: null` dans la requête.
3. `buildPaperEntryAnswers` accepte une réponse non nulle avec une confiance
   nulle, comme pour les autres packs.
4. Le garde `optionId: null` avec une confiance non nulle reste inchangé.
5. Le scoring canonique continue de travailler sur `optionId`; aucun moteur,
   barème, poids ou fait déterministe n'est modifié.

La politique spéciale `paperEntryRequiresConfidence` et la prop
`confidenceRequired` sont supprimées plutôt que conservées inactives. Cette
suppression évite une branche morte et rétablit un seul comportement papier.

## Interface et messages

Le libellé retenu est `Absente de la copie`, identique aux autres matières. Le
terme `Sans réponse` n'est pas réutilisé pour la certitude afin de ne pas le
confondre avec l'absence de réponse à la question.

Après sélection de `Absente de la copie`, le résumé avant validation indique
que la certitude sera enregistrée comme non renseignée, sans valeur de
remplacement.

## Validation et erreurs

- `optionId !== null` avec `confidence: null` est accepté pour MCO.
- `optionId === null` avec `confidence !== null` reste rejeté avec
  `PAPER_ENTRY_BLANK_WITH_CONFIDENCE`.
- Un `optionId` invalide, une confiance hors 1–4, un item inconnu ou un doublon
  restent rejetés par les gardes existants.
- Aucune migration et aucune dépendance ne sont nécessaires.

## Limite explicitement acceptée

Le moteur canonique actuel convertit une confiance nulle en
`isConfident: false` pour ses profils et inclut l'item dans son indice de
calibration. Ce hotfix reproduit volontairement le comportement déjà appliqué
aux autres matières et ne corrige pas ce modèle.

L'opérateur a choisi ce hotfix UI/API immédiat après présentation de cette
limite. La distinction canonique entre « confiance faible » et « confiance
absente » fera l'objet d'une correction séparée du moteur, du FactSheet et des
restitutions.

## Tests

Le changement suit un cycle TDD strict :

1. modifier d'abord les tests UI pour exiger `Absente de la copie` sur MCO ;
2. modifier d'abord le test serveur pour exiger l'acceptation de
   `optionId + confidence:null` ;
3. observer les échecs avec le runtime actuel ;
4. supprimer la politique spéciale minimale ;
5. vérifier les tests papier, MCO, scoring et intégration PostgreSQL jetable ;
6. exécuter typecheck, lint et build avant livraison.

Le scénario PostgreSQL MCO doit prouver qu'une tentative `SAISIE_PAPIER` peut
conserver une confiance nulle tout en gardant l'`optionId` et le score de
connaissances attendu. Les protections ETL-MCO-PRO-02 et logarithme restent
couvertes. Il ne doit pas introduire de nouvelle assertion sur la sémantique de
calibration, qui demeure hors périmètre de ce hotfix.

## Déploiement

La correction est livrée par une PR dédiée depuis le worktree exclusif. Après
CI verte et merge, une release du SHA mergé est construite et déployée selon le
runbook production, sous verrou opérateur. Le flag MCO reste actif, la narration
LLM reste désactivée et un smoke authentifié vérifie la présence du cinquième
choix de certitude sans soumettre de copie réelle.

## Hors périmètre

- modification du modèle général de calibration ;
- modification de la banque ou de sa validation pédagogique ;
- changement du scoring, des FactSheets ou des rapports ;
- changement de rôle de revue ;
- migration de base de données ;
- refonte de l'interface de saisie.
