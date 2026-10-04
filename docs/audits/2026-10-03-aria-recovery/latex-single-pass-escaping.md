# Échappement LaTeX en une passe

## Défaut et correction

L'échappement successif de l'antislash puis des accolades modifiait les commandes de présentation introduites par l'échappement lui-même. La correction remplace chaque caractère spécial de l'entrée une fois par callback ; les remplacements ne sont jamais retraités. Les chaînes synthétiques ressemblant à des commandes restent du texte littéral. Les flags de compilation, dont `-no-shell-escape`, restent présents.

## Preuves

- Avant correction : 2 échecs et 12 réussites dans la suite de rendu, sur l'antislash et la chaîne de commande synthétique.
- Après correction : 14 tests de rendu réussis ; 7 suites voisines, 84 tests réussis (7,351 s).
- Lint ciblé sans avertissement, secret scan du diff et diff-check : réussis.
- Journaux locaux : `.artifacts/recovery/latex-escape-red.log`, `latex-escape-green.log`, `latex-neighbors-green.log`.

## Limites

Cette preuve ne constitue pas une inspection visuelle de tous les PDF de production ni une clôture des alertes CodeQL. Le prochain SHA doit être analysé à distance. Aucune compilation de document réel, modification de production ou migration.
