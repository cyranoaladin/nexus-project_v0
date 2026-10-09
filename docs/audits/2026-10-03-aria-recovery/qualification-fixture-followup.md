# Qualification globale — correction des fixtures

Le SHA `793941b0306435edfacb1eac9149993d971c3aed` a passé le build production et les 71 suites / 686 tests Core. La suite unitaire complète a exécuté 1 279 suites / 14 324 tests : 1 277 suites et 14 322 tests réussis, deux échecs, sept snapshots réussis.

Les causes sont distinctes : le scanner canonique refuse une valeur de mot de passe synthétique fixe dans le test de migration ; le test du dashboard parent attend encore le texte antérieur au contrat de rattachement vérifié. La fixture génère désormais un mot de passe neuf par CSPRNG à chaque appel. Le test du dashboard vérifie le message de rattachement vérifié, conserve le rôle accessible `status` et l'absence d'alerte. Aucun scanner, seuil, protection serveur ou assertion d'autorisation n'est affaibli.

Après correction : sept tests ciblés réussis ; onze tests de migration sur deux bases PostgreSQL isolées réussis. La suite globale doit être renouvelée sur le nouveau SHA ; les succès de `793941b` ne sont pas une preuve de qualification complète du nouveau commit. Aucun déploiement.
