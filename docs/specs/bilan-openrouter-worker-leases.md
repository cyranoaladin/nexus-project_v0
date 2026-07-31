# Leases du worker de génération OpenRouter

## Périmètre

Contrat C2 documentaire. Aucun worker ni table n'est créé dans ce lot.

## Claim

Un claim atomique sélectionne un job disponible (`QUEUED` ou
`RETRY_SCHEDULED`, `nextAttemptAt ≤ now`) et écrit :

- `leaseOwner` opaque ;
- `leaseAcquiredAt` ;
- `leaseExpiresAt` ;
- compteur de tentative ;
- version optimiste.

La durée de lease doit dépasser le timeout réseau plus la validation et la
marge opérationnelle. Un worker ne traite jamais un job qu'il ne possède pas.

## Renouvellement et expiration

Le renouvellement est conditionnel à `leaseOwner`, à la version et à une lease
encore valide. Une lease expirée rend le job réclamable, mais ne prouve pas que
l'appel fournisseur n'a pas abouti. Si un appel avait commencé sans terminal
persisté, le job passe en `UNKNOWN_OUTCOME` et exige réconciliation par
`generationId` ou décision opérateur ; aucun replay automatique.

## Écriture après réseau

Après l'appel, la transaction de finalisation compare toujours owner, version
et lease. Une réponse d'un worker ayant perdu sa lease ne peut créer une
seconde révision. Elle est conservée comme événement d'audit expurgé pour
réconciliation.

## Retry et dead letter

Le retry est différé avec jitter borné et `Retry-After`. Au maximum la politique
versionnée autorise les tentatives. Les erreurs non retryables et les essais
épuisés vont en dead letter avec code normalisé, jamais le body fournisseur.

## Observabilité minimale

Métriques : jobs disponibles/leased/anciens/dead-letter, âge de queue, leases
expirées, conflits de claim, `UNKNOWN_OUTCOME`, latence, codes fournisseur et
budget. Les logs portent correlationId, jobId, invocationId et owner opaque,
sans prompt, completion, PII ni secret.
