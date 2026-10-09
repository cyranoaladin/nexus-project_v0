# Annulation SSE — préparation et fin du drainage

4 octobre 2026. Source de campagne distante : `0036533e61feae5363933b5395ff909d337c7542`.

La CI refuse encore la couverture des branches du parseur (97,22 %), indépendamment de ses lignes à 100 %. Deux contrats supplémentaires sont maintenant exercés : annulation pendant la préparation native avant l’attachement du listener, et annulation au retour du drainage avant notification de succès.

Le premier scénario intercepte clone() sur une vraie Response et vérifie ABORTED et une unique annulation. Le second conserve le vrai lecteur natif, l’enveloppe seulement pour injecter le signal au retour de finish(), puis restaure son implémentation. Ce point d’injection représente une annulation au dernier instant et vérifie qu’aucun onDone ne fuit après annulation. Aucun timer arbitraire, retry, ignore ou changement des assertions réseau.

Trois suites, 52 tests réussis ; parseur : lignes/fonctions 100 %, statements 99,35 %, branches 99,07 %. La seule branche non couverte restante est le garde de cleanup à la ligne 236. La couverture globale n’est donc pas annoncée verte. Typecheck et ESLint ciblé passent.

Analyse de cette dernière branche : toute sortie normale du try a ended=true ; toute exception passant par le catch a failed=true. Par conséquent `!cleaned && !failed` est impossible puisque cleaned vaut ended || résultat de cancel(). Aucun scénario client légitime ne peut couvrir cette branche. Son éventuel retrait doit être un commit distinct avec preuve de non-utilisation et renouvellement des tests, sans exclusion de couverture.
