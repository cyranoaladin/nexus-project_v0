# Rapport de migration — workflow canonique des bilans

## Date

2026-07-29

## État initial

- base Git : `origin/main` à
  `11e0dce93e9f1d4c79824f9cccd0a467dde4f11b` ;
- 51 migrations Prisma ;
- fondation canonique déjà présente :
  `CanonicalAssessmentAttempt`, snapshots de score, preuves, artefacts,
  révisions, reviews et outboxes ;
- provenance de tentative déjà scellable par identifiant, version et checksum ;
- absence de demande canonique, session de reprise et lien magique dédiés.

Plusieurs branches historiques modifient `prisma/schema.prisma`. Aucune branche
de release récente, basée sur le dernier `origin/main`, n'apporte un schéma
concurrent à fusionner. La branche locale `fix/bilan-lead-pipeline`, basée sur
un historique antérieur, ajoute des extensions de lead/outbox ; elle est hors
périmètre et n'a pas été reprise. Le worktree principal contient aussi une
migration non suivie portant un nom d'extension d'outbox : elle a été
préservée et exclue de l'intégration.

## État final

52 migrations, avec :

`prisma/migrations/20260729_add_canonical_bilan_requests/migration.sql`.

Le lot de convergence n'ajoute pas de migration supplémentaire : les champs
de provenance existants suffisent au raccordement du corpus. Aucune table
spéculative d'affectation, réponse ou correction n'est introduite.

## Tables ajoutées

| Table | Rôle | Rétention |
|---|---|---|
| `canonical_bilan_requests` | demande, consentement, rattachement famille/tentative, attribution et statut | références parent/enfant/tentative en `RESTRICT` |
| `canonical_bilan_request_events` | historique append-only | suppression de la demande refusée |
| `canonical_bilan_flow_sessions` | reprise courte par token hashé | cascade avec la demande |
| `canonical_bilan_magic_links` | lien magique hashé, expiré/révoqué/consommé | cascade avec la demande ; parent en `RESTRICT` |

## Enums ajoutés ou étendus

- ajout :
  `BilanAccountVerificationState`, `BilanRequestStatus`,
  `BilanRequestActor`, `BilanRequestEventType`,
  `BilanAcquisitionChannel`, `ReportAudience` ;
- extension de `CanonicalNotificationEventType` avec
  `BILAN_REQUEST_CREATED`, `ASSESSMENT_SUBMITTED`,
  `TECHNICAL_ACTION_REQUIRED` ;
- extension de `NotificationChannel` avec `EMAIL`.

## Colonnes et backfills sur tables existantes

### `canonical_report_artifacts`

- ajout de `audience` ;
- backfill sûr à `NEXUS`, jamais vers parent ou élève ;
- `NOT NULL`, défaut `NEXUS` ;
- unicité `(assessmentAttemptId, audience)`.

La migration s'arrête si des doublons historiques rendent ce backfill
ambigu. Cette garde impose un audit explicite plutôt qu'une perte silencieuse.

### `canonical_parent_student_links`

- fermeture des lignes terminales anciennes sans `revokedAt` ;
- contrainte imposant `revokedAt` pour `REVOKED`/`EXPIRED` ;
- unicité partielle d'un lien non révoqué par couple parent/enfant.

### `canonical_notification_outbox`

- ajout de `recipientKey` et `recipientAddress` ;
- backfill de `recipientKey` depuis `recipientUserId` ;
- `recipientUserId` devient nullable pour les emails d'équipe ;
- contrainte de destination :
  adresse requise pour email, utilisateur requis pour WhatsApp ;
- déduplication par `(eventType, sourceEventKey, recipientKey)`.

## Contraintes et index critiques

- unicité de `submissionHash`, `tokenHash` de session et `tokenHash` magique ;
- lien composite tentative/enfant empêchant un rattachement croisé ;
- consentement obligatoirement vrai ;
- événement de demande append-only ;
- clés étrangères de données auditées en `RESTRICT` ;
- index d'activité, parent, enfant, coach, matière/niveau/année et expiration ;
- unicité d'un artefact par audience ;
- unicité d'un lien famille actif ;
- unicité d'une notification logique par destinataire stable.

## Compatibilité avec les données existantes

La migration est additive pour `assessments`, `bilans` et la chaîne canonique.
Les seules mutations historiques sont des backfills conservateurs :

- audience privée `NEXUS` ;
- clé destinataire dérivée de l'identifiant existant ;
- fermeture explicite de liens déjà terminaux.

Préflight production obligatoire :

```sql
SELECT "assessmentAttemptId", COUNT(*)
FROM "canonical_report_artifacts"
GROUP BY "assessmentAttemptId"
HAVING COUNT(*) > 1;
```

Le résultat doit être interprété par audience avant migration. Ne jamais
supprimer automatiquement une ligne pour passer la garde.

## Validation exécutée hors production

- déploiement complet des 52 migrations sur PostgreSQL éphémère : réussi ;
- installation neuve via le harnais de migration : réussie ;
- upgrade depuis les 51 migrations précédentes avec lignes héritées :
  réussie ;
- conservation des lignes, backfills privés et clés destinataires :
  réussie ;
- `prisma validate` : réussi au gate final ;
- `prisma generate` : réussi avec Prisma Client 6.19.3.

Aucune migration n'a été exécutée sur une base de production.

## Ordre d'activation

1. déployer le code avec tous les flags désactivés ;
2. sauvegarder et exécuter les preflights de données ;
3. appliquer `prisma migrate deploy` ;
4. configurer Redis/Upstash et SMTP ;
5. exécuter les smoke tests internes ;
6. obtenir les validations pédagogiques nominatives ;
7. activer uniquement le flag d'intake ;
8. surveiller erreurs, outbox et rate limiting.

## Retour arrière

La stratégie normale est :

1. désactiver `BILAN_CANONICAL_INTAKE_ENABLED` ;
2. préserver les lignes créées ;
3. revenir à un binaire compatible avec le schéma additif ;
4. ne pas modifier ni supprimer la migration appliquée.

Un rollback SQL destructif des types/tables n'est pas fourni, car il pourrait
effacer des demandes et preuves d'audit. Il nécessiterait une décision
explicite, une sauvegarde vérifiée et un script séparé.

## Variables nécessaires

- `DATABASE_URL` ;
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET` ;
- variables SMTP ;
- `REDIS_URL`, ou `UPSTASH_REDIS_REST_URL` +
  `UPSTASH_REDIS_REST_TOKEN` ;
- `RATE_LIMIT_DISTRIBUTED_TIMEOUT_MS` ;
- `BILAN_TEAM_NOTIFICATION_EMAIL` ;
- flags `BILAN_*`, tous faux lors de la migration.
