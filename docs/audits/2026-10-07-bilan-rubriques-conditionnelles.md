# Bilans — rubriques conditionnelles sans questions

## Cause reproduite

L’aperçu enseignant démarrait avec un objet de réponses vide. « Où j’en suis » et « Mes essais » dépendent des thèmes déclarés travaillés : aucune question n’était donc proposée dans ces deux rubriques. L’élève pouvait aussi les ouvrir avant de préciser ses thèmes. La relecture présentait encore des sous-rubriques sans contenu applicable.

La campagne précédente vérifiait les huit titres et le questionnaire intégral après sélection des thèmes. Elle ne vérifiait pas la présence des questions dans l’aperçu initial ni la navigation sans sélection. Le défaut signalé a révélé cette lacune de couverture.

## Correction

- L’aperçu enseignant présélectionne les thèmes du niveau dans une démonstration explicitement annoncée. Ces sélections restent locales et ne créent aucune réponse d’élève.
- La navigation élève passe aux rubriques applicables. Les options indisponibles expliquent pourquoi elles le sont ; un bouton permet de revoir les thèmes. Une copie reprise sur une rubrique devenue inapplicable affiche la suivante.
- Aucun thème n’est présumé travaillé dans une vraie copie. Les thèmes refusés ou incertains restent exclus des questions de maîtrise et des essais.
- La relecture omet les rubriques inapplicables et explique le choix de ne faire aucun essai. Tous les commentaires du professeur y restent consultables, y compris ceux d’une rubrique devenue inapplicable.
- L’instruction des essais explique qu’une sélection affiche l’énoncé.

## Vérification

Les régressions ont d’abord échoué : navigation sans thèmes (6 échecs), relecture vide (2), aperçu enseignant (3), conservation des retours sur une rubrique exclue (1). Après correction, 108 tests ciblés dans 7 suites passent ; TypeScript et le lint des fichiers modifiés passent.

Les nouveaux E2E vérifient le contenu réel des questions pour chaque niveau, les énoncés des essais, la navigation sans thèmes, le rechargement, puis l’activation des questions après sélection. Le test mobile d’aperçu vérifie chaque compétence et un énoncé, sans création de copie.

La vérification finale de l’artefact compilé et la livraison seront consignées après exécution.
