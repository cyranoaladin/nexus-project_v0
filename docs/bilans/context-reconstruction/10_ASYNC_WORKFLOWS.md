# Workflows asynchrones

## État actuel

Assessment et Bilan générique lancent des promesses après la réponse HTTP. Un redémarrage perd le travail, plusieurs requêtes peuvent démarrer le même traitement et le statut n'est pas toujours écrit avant l'exécution. `GeneratedPedagogicalReport` persiste mieux les étapes mais n'a ni claim atomique, lease, compteur de tentatives, backoff ou DLQ. Son contexte relit les entrées les plus récentes, donc un job peut générer depuis des données différentes de son checksum.

Le worker NPC possède un claim transactionnel conditionnel et un compteur, mais pas de lease utilisable. Après erreur, l'état `RETRYING` n'est pas recherché par le claim (`PENDING`/`QUEUED`) : le retry annoncé ne progresse pas.

Le prototype NSI montre BullMQ, retries exponentiels, DLQ, métriques et S3 ; il ne doit pas être copié sans corriger PII, pipelines concurrents, idempotence et gouvernance de score.

## Cible durable

La soumission exécute une transaction courte : verrou/version de tentative, réponses finales, état `SUBMITTED`, événement outbox de scoring. Le scorer consomme idempotemment, écrit `ScoringRun`, `SkillEvidence`, `ScoreSnapshot` et outbox `REPORT_REQUESTED`. Le report worker claim un `ReportJob` par compare-and-swap.

Champs minimaux du job : type, aggregateId, audience, inputChecksum, idempotencyKey unique, status, priority, availableAt, attempts/maxAttempts, claimedBy, leaseUntil, heartbeatAt, lastErrorCode, correlationId, created/updated. L'entrée référence des snapshots immutables ; elle ne fait aucune requête « latest ».

## Claim, lease et retry

1. `SELECT ... FOR UPDATE SKIP LOCKED` ou update conditionnel sur job disponible.
2. passage `REPORT_CLAIMED`, worker et `leaseUntil` dans la même transaction.
3. heartbeat borné ; chaque étape vérifie ownership du lease.
4. reprise d'un lease expiré, incrément atomique, artefacts identifiés par checksum.
5. erreurs transitoires → `RETRY_SCHEDULED` avec backoff exponentiel + jitter.
6. erreurs permanentes ou tentatives épuisées → `DEAD_LETTER` ; aucune boucle infinie.
7. requeue DLQ est une commande auditée et idempotente.

Timeouts séparés pour DB, RAG, LLM, rendu et stockage. Un timeout de worker ne doit jamais rendre un PDF partiel publiable.

## Idempotence

- soumission : clé client unique par attempt + version de réponses ; même clé/même payload retourne le résultat, même clé/payload différent renvoie conflit ;
- scoring : unique `(attemptId, inputChecksum, engineVersion)` ;
- report job : unique `(scoreSnapshotId, audience, templateVersion, inputChecksum)` ;
- artefact : clé par `reportVersionId/contentChecksum` ;
- publication : une active par `(attemptId, audience)`, remplacement transactionnel et historique conservé.

## Observabilité

Événements d'audit et métriques : profondeur/âge de file, claims, leases expirés, retries, DLQ, durée par étape, taux de fallback, RAG vide/erreur, validation LLM, rendu et stockage. Logs : IDs/corrélation/codes, jamais identité ou contenu. Dashboard d'exploitation avec lien vers job, attempt, version et événements.

## Rollback

Un worker n'annule pas le score. Une version en échec reste non publiée. Le rollback de déploiement arrête les nouveaux consumers, laisse expirer/récupère les leases, rebascule le feature flag et conserve jobs/artefacts. Les migrations de statut sont additives ; aucun job n'est supprimé pour « nettoyer ».
