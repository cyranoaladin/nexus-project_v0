# Journalisation contrôlée du retry de diagnostic

## Défaut reproduit

L'identifiant de diagnostic fourni dans la requête était interpolé dans le premier argument de `console.error` et l'erreur fournisseur sérialisée dans le second. Le test avec un identifiant synthétique contenant des marqueurs de format a échoué avant correction : 1 échec et 7 réussites.

La validation des données persistées exposait également le message détaillé dans la réponse 422. Un second test a reproduit cette fuite : 1 échec et 8 réussites.

## Correction

Les logs utilisent des messages fixes et un code d'erreur issu de branches bornées, sans identifiant ni erreur fournisseur. La réponse 422 conserve son message fonctionnel et supprime les détails privés. Les dix `any` préexistants du fichier de test sont retirés ; le mock Prisma est limité aux deux méthodes utilisées. Aucun changement des transitions de génération ni des permissions dans ce lot.

## Vérifications et limites

- Retry et route voisine : 2 suites, 24 tests réussis (0,76 s).
- Lint ciblé sans avertissement et secret scan : réussis.
- Le lint initial du test a refusé dix avertissements `any` historiques ; ils ont été corrigés, sans désactivation de règle.
- Journaux : `.artifacts/recovery/diagnostic-retry-log-red.log`, `diagnostic-retry-validation-red.log`, `diagnostic-retry-neighbors-green.log`.
- CodeQL distant et contrôle des permissions/ownership de l'ensemble du domaine restent obligatoires. Ce lot ne qualifie pas le parcours complet de diagnostic.
