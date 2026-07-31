# Machine d'états des jobs de génération OpenRouter

## Périmètre

Spécification C2 documentaire, sans implémentation ni schéma Prisma.

## États canoniques

| État interne | État API équipe | Terminal | Signification |
| --- | --- | ---: | --- |
| `QUEUED` | `QUEUED` | non | snapshot scellé, budget réservé |
| `LEASED` | `RUNNING` | non | détenu par un worker jusqu'à `leaseExpiresAt` |
| `CALLING_PROVIDER` | `RUNNING` | non | appel hors transaction en cours |
| `VALIDATING` | `RUNNING` | non | schéma, PII, audience et grounding locaux |
| `RETRY_SCHEDULED` | `FAILED_RETRYABLE` | non | prochain essai différé à `nextAttemptAt` |
| `PENDING_REVIEW` | `PENDING_REVIEW` | oui pour le worker | révision sûre créée, non publiable sans revue |
| `DEAD_LETTER` | `FAILED_FINAL` | oui | essais épuisés ou erreur non retryable |
| `CANCELLED` | `FAILED_FINAL` | oui | arrêt administratif audité avant publication |

`COMPLETED` côté API désigne un job ayant créé une révision
`PENDING_REVIEW`; il ne signifie ni approbation ni publication.

## Transitions

- `QUEUED → LEASED` : claim atomique si disponible et budget encore valide.
- `LEASED → CALLING_PROVIDER` : invocation immuable créée, transaction close.
- `CALLING_PROVIDER → VALIDATING` : réponse reçue et coût connu réconcilié.
- `VALIDATING → PENDING_REVIEW` : toutes les validations passent.
- état actif → `RETRY_SCHEDULED` : uniquement 408, 429, 502, 503, timeout ou
  indisponibilité temporaire ; `Retry-After` est respecté.
- `RETRY_SCHEDULED → LEASED` : `nextAttemptAt` atteint et nouvelle lease.
- état actif → `DEAD_LETTER` : 400/401/402/403, budget, schema/grounding,
  sécurité, absence de provider conforme ou maximum d'essais.
- `QUEUED|RETRY_SCHEDULED → CANCELLED` : action staff autorisée et auditée.

Les échecs de schéma ou de grounding ne sont pas retriés automatiquement. Ils
ouvrent une revue ou une escalade manuelle selon la future politique, sans
Sonnet automatique de « qualité ».

## Invariants

- un seul job actif par clé d'idempotence et checksum de payload ;
- snapshot, prompt, schéma et politique immuables pendant le job ;
- aucun appel après expiration de lease sans renouvellement validé ;
- aucune révision publiable issue d'un état autre que `PENDING_REVIEW` ;
- une réponse manuelle manquante interdit la création du job final ;
- aucun job ne change score, calibration ou recommandations déterministes ;
- tout changement d'état est audité sans contenu pédagogique brut.
