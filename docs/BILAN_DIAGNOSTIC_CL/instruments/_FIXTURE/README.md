# _FIXTURE — instrument fictif

**Cet instrument est fictif.** Il ne mesure rien, n'est remis à aucun candidat et n'est
jamais assemblé dans un instrument réel. Il existe pour éprouver `validate_instrument.py`
et `build_instrument.py` : c'est la fixture de `tests/test_validate_instrument.py` et de
`tests/test_build_instrument.py`.

Il porte ses propres référentiels dans `referentiels/`, qui ne contiennent que ce que la
fixture ajoute ; les fichiers absents de ce dossier sont lus dans les référentiels réels.
`termes_bloquants.json` en particulier est celui de production : la fixture doit être
soumise aux règles de vocabulaire réelles.

Il couvre délibérément : un item de chaque type (A, B, C), une compétence de chaque
catégorie (`ordinaire`, `production`, `indicateur_transversal`), un couple `hors_version`
(HORS en version REDUITE), un indicateur transversal à deux sources (les critères LANG des
grilles REDA et INTE), un bloc 0 aligné sur les compétences de l'assemblage, et une durée
dans la fenêtre 90–100 % du catalogue.
