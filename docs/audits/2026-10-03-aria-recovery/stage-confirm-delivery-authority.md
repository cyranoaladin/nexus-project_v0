# Confirmation de stage : autorité du destinataire et protections serveur

Date : 2026-10-04. Base du lot : 87803c54ded1c8bf707abab62bbbb54ced0c4df2.

## Défauts reproduits

Six scénarios rouges ont démontré l’envoi au contact de réservation plutôt qu’au compte élève, le fallback avec contact canonique absent/invalide, le faux succès « envoyé » et l’absence d’encodage HTML des données stockées. Quatre scénarios supplémentaires ont démontré l’absence de cache privé, de throttling, de limite réelle de corps et de protection CSRF. Une première exécution avait une configuration d’origine synthétique incorrecte ; elle n’est pas une preuve causale. Les scénarios ont ensuite échoué sur leurs causes attendues.

## Correction

Le destinataire est le contact valide du compte Student.user, jamais celui déclaré dans la réservation. Le manque de contact refuse la confirmation (409) avant transaction ; le parcours familial canonique doit renseigner ce contact. L’émission de l’activation vérifie atomiquement l’identifiant du compte, son contact et son état non activé ; une divergence refuse sans mise en file. Les noms, titres et liens sont encodés au sink HTML ; les retours de ligne sont retirés du sujet. La réponse décrit une mise en file, pas une livraison.

ADMIN/ASSISTANTE restent les seuls rôles admis. CSRF, throttling par opérateur/réservation et limite de corps réellement lu de 2048 octets précèdent toute lecture privée. Toute réponse porte private/no-store et Vary Cookie/Authorization. Une panne d’autorisation/throttling échoue en 503 sans détails internes. Aucun prix ni état de paiement n’est modifié par ce lot.

## Preuves

Quatre suites ciblées : 38 tests réussis, incluant les refus de changement de contact et de panne du backend de limitation. ESLint ciblé et git diff --check réussis. PostgreSQL réel : 4/4 tests réussis, 131 migrations appliquées puis relance sans migration en attente ; instance éphémère tmpfs arrêtée. Preuves privées : .artifacts/recovery/stage-confirm-payment-green-1791145809/. Typecheck réussi (tsc --noEmit). ESLint : zéro erreur ; 14 avertissements any préexistants dans les anciennes fixtures, aucun ajouté dans ce lot. Le test PostgreSQL existant est renforcé pour vérifier que chacune des quatre variantes de paiement ne crée qu’un job chiffré destiné au compte élève, distinct du contact de réservation.

## Limites

La mise en file ne prouve pas la livraison externe. Le CAS de contact à l’émission ne remplace pas une invalidation globale lors d’un changement ultérieur de contact. Les écrivains V1/Core et leurs fenêtres de coexistence restent un gate distinct. Les historiques de paiements incorrectement marqués ne sont pas réparés sans preuve du prestataire. Aucun accès réel, déploiement, migration supplémentaire ni livraison externe n’est effectué ici.

Pendant une première assertion rouge, Jest a affiché un jeton éphémère généré pour une fixture synthétique. Aucun secret de production ni donnée client n’était impliqué. Les assertions ont été limitées aux champs nécessaires pour empêcher cette sortie de diagnostic.

## Rollback

Revert applicatif du commit par le mécanisme protégé ; aucune modification de schéma. Ne pas rétablir le fallback de contact dans un périmètre ouvert aux clients.
