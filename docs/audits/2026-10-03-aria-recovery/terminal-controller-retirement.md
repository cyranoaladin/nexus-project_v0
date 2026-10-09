# Retrait du contrôleur ARIA après transport terminal

## Critères et défaut reproduit

Un transport dont le callback terminal a été publié après validation et EOF ne doit plus être annulé par la fermeture du panneau. Deux tests déterministes retiennent la résolution de la promesse après `done` et après `error`, ferment le hook puis vérifient le signal : RED, deux échecs et 76 réussites. Aucun délai artificiel.

## Correction

`attachTransport` capture les callbacks de sa génération et retire uniquement son propre contrôleur après un callback terminal accepté. Le nettoyage ne touche pas un nouveau contrôleur. La capture empêche les callbacks détachés de prendre les handlers d'une génération ultérieure. Les transports non terminés restent annulables ; les erreurs de protocole ne deviennent pas des succès.

## Tests et limites

Deux suites de hook, 79 tests réussis, dont les anciens tests de callbacks détachés. Les tests navigateur E025 et les trois échanges normaux E018 attendent dorénavant la réponse exacte correspondant au contenu soumis et la fin sans erreur de son corps HTTP. Les assertions de console/page/réseau sont conservées, sans exclusion des API métier. Les échanges volontairement arrêtés gardent leur traitement explicite existant.

Le défaut de contrôleur est reproduit localement. Son attribution à la POST annulée dans la CI `57d4c445d` reste une hypothèse : les logs n'identifient pas l'échange concerné. Les preuves navigateur du nouveau SHA, notamment 20 répétitions et multi-navigateurs, restent à renouveler. Aucun état qualifié production n'est revendiqué.

## Migration et rollback

Aucune migration ni écriture production. Retour applicatif par commit distinct si nécessaire ; aucune réécriture d'historique.
