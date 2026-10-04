# Oracle cryptographique des jetons opaques

## Contexte

Le contrôle CodeQL du SHA publié `7e59831b1a47dad91a5b46cb4d87bd31809e3e13` reste rouge. Cette correction du test ne constitue pas encore une preuve de clôture distante.

## Décision

Le test calcule son oracle HMAC à partir de deux vecteurs opaques de 32 octets, indépendamment du résultat du service. La source CSPRNG est remplacée uniquement pendant cet appel de test puis restaurée dans un `finally`. Le service doit solliciter exactement 32 octets. Les tests natifs de génération, séparation des usages, expiration et consommation restent présents. Aucun changement du mécanisme de production ni suppression CodeQL.

## Vérifications

- Service account/token : 7 tests réussis, 2,679 s.
- Typecheck global et lint ciblé : code de sortie 0.
- Cette modification de l'oracle protège un contrat existant ; aucun résultat rouge préalable artificiel n'est revendiqué.
- Journaux locaux : `.artifacts/recovery/codeql-opaque-oracle-final-green.log` et `codeql-remediation-typecheck.log`.

## Gate restante

Relancer CodeQL sur le SHA contenant cette correction et vérifier les alertes actives avant toute qualification.
