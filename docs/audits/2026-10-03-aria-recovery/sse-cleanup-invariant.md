# SSE — retrait d’un garde inatteignable

4 octobre 2026. Base : `ad3310ab5`. Aucun changement du contrat réseau.

Le garde final TRANSPORT_CLEANUP_FAILED exigeait à la fois !cleaned et !failed. Toute sortie normale du try positionne ended=true après le drainage natif, donc cleaned=true. Toute exception positionnait failed=true dans le catch avant propagation. Le garde ne peut donc jamais émettre son erreur. La recherche dans app/components/lib/tests ne trouve aucun autre consommateur de ce code.

Retrait dans un commit distinct : supprimer ce code d’erreur, le drapeau devenu inutile et le garde mort ; conserver l’annulation si !ended, puis la libération du lecteur. Les échecs de protocole après EOF n’exigent pas une seconde annulation : le drainage a déjà terminé. Aucun timeout, signal, terminal ou contrôle d’identité n’est retiré.

Avant : 52 tests réussis, branches 99,07 % ; seul garde mort non couvert. Après : 3 suites, 52 tests réussis, couverture du parseur 100 % lignes/branches/statements/fonctions. Typecheck réussi. Revue indépendante en lecture seule confirme le raisonnement et ne relève aucun P0/P1 dans ce delta. La couverture complète et la CI du prochain SHA restent à renouveler.

Rollback : commit inverse, sans donnée ni migration. Les rapports ciblés sont ignorés sous .artifacts/recovery/sse-coverage-diagnostic.
