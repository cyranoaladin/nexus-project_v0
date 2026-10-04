# CI unitaire : inventaire exhaustif des opérations protégées

Source en échec : 57da8a6d0ee3b00afad2cd7b817f544f0ef0ff71, job 111525210460. Résultat distant : 1 330 suites réussies/une échouée ; 14 780 tests réussis/un échoué. Cause : __tests__/lib/rate-limit.s3-final-contract.test.ts:81 comparait la liste exacte des scopes et omettait reservation-verify (lecture staff) et stage-confirmation (écriture avec émission d’activation).

La correction ajoute les deux scopes à cet inventaire et affirme leurs presets exacts. La comparaison exhaustive est conservée ; aucun scope arbitraire n’est accepté, aucun seuil ni test n’est désactivé. Trois suites locales passent, 32 tests : contrat S3, lookup staff et confirmation avec destinataire canonique. ESLint ciblé, diff-check et scan du delta sont consignés au commit. La suite complète est renouvelée par la prochaine CI, sans réutiliser le résultat du SHA précédent.

Un scope distinct reservation-decision appartient au lot administratif encore en cours et sera accompagné de son propre contrat dans ce lot. Ce document ne qualifie ni Redis de production ni la CI complète.
