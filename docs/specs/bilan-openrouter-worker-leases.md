# Leases du worker OpenRouter

## Objet

Empêcher deux workers d'appeler le fournisseur pour le même job, permettre la
récupération après crash et ne jamais masquer un résultat ambigu.

## Contrat de claim

Le claim est un compare-and-set atomique qui exige : état éligible,
`nextAttemptAt <= now`, lease absente ou expirée, et budget réservé. Il écrit :

- `leaseOwner` pseudonyme ;
- `leaseToken` aléatoire non journalisé en clair ;
- `leasedAt`, `leaseExpiresAt` ;
- compteur de claim et version optimiste.

Un seul worker obtient la ligne. Toute mutation ultérieure exige le token et la
version courante. Un heartbeat ne prolonge que la lease possédée et reste borné.

## Crash et expiration

- crash avant `ATTEMPT_STARTED` : remise en queue sûre après expiration ;
- crash après `ATTEMPT_STARTED` sans réponse durable : `UNKNOWN_OUTCOME`, aucune
  relance automatique ;
- réponse et generation ID durables : réconciliation puis validation locale ;
- lease abandonnée sans appel : reprise différée avec nouvel owner.

Le worker ne conserve aucune transaction DB pendant `fetch`. Les appels sont
bornés par timeout. `Retry-After` est respecté ; backoff avec jitter, nombre de
tentatives explicite et aucune boucle infinie.

## Dead letter et supervision

Après épuisement ou erreur non retryable, le job devient `FAILED_FINAL`, conserve
la provenance expurgée et entre dans la vue dead letter. Alertes minimales : âge
de queue, absence de worker, leases expirées, unknown outcomes, 401/402, budget,
429/5xx, schéma/grounding, Redis et profondeur dead letter.

Une relance manuelle crée une nouvelle décision auditée ; elle ne réécrit pas
l'historique et ne réutilise pas silencieusement une clé dont l'issue est inconnue.
