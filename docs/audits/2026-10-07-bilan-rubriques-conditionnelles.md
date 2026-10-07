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

## Résultats définitifs et livraison

- **108 tests unitaires ciblés / 7 suites réussis** ; TypeScript et lint ciblé sans erreur.
- **53 E2E réussis sur l’artefact de production** : 21 Chromium, 16 Firefox, 16 WebKit, sans relance automatique après échec. Les tests vérifient les questions et les énoncés, pas seulement les titres de rubriques. Captures mobiles des deux niveaux inspectées.
- Une première passe sur le serveur de développement, pendant les modifications, a rencontré trois incidents de rechargement : réponses HTTP 404 transitoires et fichier JavaScript tronqué (`Unexpected EOF`). Les cas fractions ont ensuite réussi sur ce serveur ; la validation complète ci-dessus a été effectuée sur un artefact figé, sans rechargement de développement.
- Compilation et contrôles de livraison réussis : 655 fichiers statiques identiques, aucune donnée d’exécution embarquée, sommes de contrôle identiques après transfert et catalogue de 7 activités conforme à la base.
- Release activée : `98a2858eb-espace-bilan-rubriques-20261007`, source `98a2858ebd7d15cf34c41795b4082dc94e69428e`, build `FG3v42fiH-3vtu0BWjrEs`. Santé interne et publique HTTP 200. Sauvegarde préalable conservée ; aucune migration ni modification du contenu des copies réelles.
- En production, aperçu de chaque niveau vérifié à 390 px : toutes les questions de maîtrise présentes, énoncé visible après choix d’un essai, absence de débordement. Deux parcours techniques complets de sauvegarde, reprise, transmission, correction, export et PDF familial réussis ; texte des PDF contrôlé.
- Les groupes réels restent à 4 et 5 élèves avec leurs séances publiées. Une copie réelle était déjà présente avant le test de production et reste présente après. Aucun compte réel n’a servi aux essais ; les quatre comptes techniques ont été désactivés et leurs deux séances clôturées.

Les journaux, captures et rapports techniques sont conservés dans le dossier privé `~/.local/state/nexus-bilan-empty-sections-20261007/`. Les comptes techniques et secrets ne sont pas versionnés.
