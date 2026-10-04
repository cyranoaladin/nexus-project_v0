# Consommateur natif du transport SSE

Date : 4 octobre 2026. Base : dc182fd1d. Statut : NOT_READY.

## Diagnostic et correction

Le navigateur pouvait parser entièrement un flux SSE privé/no-store tout en terminant sa requête par ERR_ABORTED. Les prototypes isolés ont comparé plusieurs modes de consommation. Le tee direct du body échoue encore sur 100 requêtes terminées/100 annulées ; il n'est pas retenu. Le Response.clone avec une branche native pipeTo termine 100/100 requêtes sans annulation, en conservant les deltas avant l'envoi du terminal par le serveur.

Le parser utilise désormais cette double consommation progressive. La branche native discard attend l'acquittement de chaque chunk effectivement parsé ; aucune accumulation d'une deuxième réponse complète, aucun arrayBuffer/text/json du corps complet, aucune modification des headers ou du harness. Le terminal n'est publié qu'après EOF et drainage natif, avec le timeout existant de cinq secondes.

Deux tests rouges ont reproduit l'absence d'annulation du transport ouvert après JSON invalide ou exception du consommateur. Les premiers essais du nouveau lecteur ont révélé un deadlock d'annulation. Le pipeline n'annule plus seul sa source pendant l'abort : il libère son lecteur, puis les deux branches sont annulées conjointement. Le write bloqué est rejeté avant l'abort. L'annulation est idempotente, et une erreur de cleanup ne remplace pas la cause initiale.

## Preuves

- Lane canonique test:aria:sse élargie aux tests de drainage/lecteur : trois suites, 49 tests réussis.
- Tests adjacents SSE/JSON/policy : cinq suites, 72 tests réussis.
- Typecheck et lint strict concernés : réussis ; revue indépendante lecture seule : aucun P0/P1 nouveau démontré.
- Chromium 145.0.7632.6, parser réel recompilé : 100/100 réponses complètes, 100/100 deltas reçus avant le terminal, 100/100 requestfinished, zéro requestfailed. Le serveur synthétique ne ferme le flux qu'après le signal reçu depuis onDelta, sans temporisation arbitraire.
- Source en panne, abort déjà déclenché, abort en drainage, protocole invalide, callback en échec, terminal absent/dupliqué, EOF manquant, dernier chunk non acquitté et annulation d'une réponse volumineuse couverts.

## Limites

Ce micro-banc n'est pas la campagne authentifiée E018–E021 ni E019 ×20 : celles-ci restent à exécuter sur le SHA publié. Le tee interne de Response.clone n'apporte pas une mesure universelle de mémoire maximale ; le test de grande réponse prouve seulement qu'elle n'est pas intégralement drainée avant annulation d'un consommateur arrêté. Une source dont cancel ne résout jamais reste non bornée ; aucune telle panne native observée ici. Le drainage après EOF n'a pas de course explicite contre le signal, même si son pipeTo reçoit l'abort. Ces limites ne sont pas des preuves de qualification production.

Aucune migration, aucun changement de garde RBAC, de protocole ou d'API native, aucun appel self-HTTP, aucune exclusion de requête échouée, aucun déploiement.
