# Exceptions privées aux frontières des documents

## Critères et reproduction

Une panne inattendue du dépôt de documents doit conserver500 et un événement d'erreur exploitable sans sérialiser message, stack ou cause privés. Deux tests distincts injectent un canary synthétique dans une exception DB : deux échecs et 38 réussites sur le code précédent, car les logs contenaient ce canary.

## Correction

Les deux routes de téléchargement ne transmettent plus l'exception à `serializeError`. Elles émettent seulement un code constant `DOCUMENT_READ_UNEXPECTED_ERROR` et la route statique. L'erreur n'est pas silencieuse ; aucun échec n'est converti en succès. Autorisation, stockage et réponse client restent identiques.

## Limites

Le lot protège ces deux catches inattendus, pas tous les logs de l'application. Les autres frontières et l'observabilité globale restent à qualifier. Aucun identifiant de session, contenu privé, DSN ou cause n'est nécessaire à cet événement. Aucun changement de schéma ni déploiement.

## Tests

Six suites voisines, 94 tests réussis, dont les deux nouveaux cas de non-divulgation ; typecheck complet et lint concernés réussis. Retour applicatif par commit distinct si besoin ; aucune réécriture d'historique.
