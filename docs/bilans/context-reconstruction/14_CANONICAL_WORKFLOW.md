# Workflow canonique

La séquence demandée est une **projection de workflow**, pas un enum unique : affectation, tentative, scoring, job, version/revue et publication ont leurs propres machines d'état et transactions.

## Chemin nominal

| État projeté | Agrégat | Acteur | Invariants / événement |
|---|---|---|---|
| `AVAILABLE` | Assignment | système/équipe | définition publiée, lien élève, curriculum connu ; `DIAGNOSTIC_AVAILABLE` |
| `STARTED` | Attempt | élève | snapshot créé, clé start unique ; `ATTEMPT_STARTED` |
| `IN_PROGRESS` | Attempt/Responses | élève | autosave avec version optimiste ; `RESPONSES_SAVED` agrégé |
| `SUBMITTED` | Attempt | élève/système | transaction finale, idempotency key ; `ATTEMPT_SUBMITTED` |
| `SCORING` | ScoringRun | scorer | claim unique sur checksum ; `SCORING_STARTED` |
| `SCORED` | ScoreSnapshot | scorer | evidence complète, snapshot immutable ; `SCORE_SNAPSHOT_CREATED` |
| `REPORT_QUEUED` | ReportJob | système | job unique par audience/input ; `REPORT_REQUESTED` |
| `REPORT_CLAIMED` | ReportJob | worker | CAS + lease ; `REPORT_JOB_CLAIMED` |
| `BUILDING_CONTEXT` | ReportJob | worker | IDs snapshot seulement, PII minimisée |
| `RAG_RETRIEVAL` | ReportJob | worker/RAG | filtres/version, résultat typé, citations candidates |
| `LLM_GENERATING` | ReportJob | worker/LLM | JSON strict, timeout, prompt checksum |
| `VALIDATING` | ReportJob | worker | schéma, Evidence IDs, citations, audience ; fallback possible |
| `RENDERING` | ReportJob | worker | template/version, sandbox, aucun artefact partiel |
| `STORED` | ReportVersion | worker | contenu+artefact checksums, stockage privé |
| `NEEDS_REVIEW` | ReportVersion | système | version figée et assignable ; `REVIEW_REQUESTED` |
| `APPROVED` | HumanReview | reviewer autorisé | décision sur version exacte ; `REPORT_APPROVED` |
| `PUBLISHED` | Publication | publisher autorisé | audience unique, remplacement atomique ; `REPORT_PUBLISHED` |

Le chemin peut sauter RAG et/ou LLM avec une trace explicite et un fallback, mais ne saute pas validation. Un rapport interne peut avoir une politique de revue différente ; parent exige initialement `APPROVED`.

## Branches d'erreur

| État | Usage | Sortie |
|---|---|---|
| `RETRY_SCHEDULED` | erreur transitoire, lease libéré, `availableAt` calculé | nouveau claim idempotent |
| `DEAD_LETTER` | tentatives épuisées/erreur permanente | alerte, inspection et requeue auditée |
| `REJECTED` | reviewer refuse une version/question | nouvelle version nécessaire, jamais édition en place |
| `REVOKED` | publication retirée | historique conservé, accès externe coupé |

## Transitions interdites

- `IN_PROGRESS → SCORED` sans soumission finale ;
- modification d'une réponse après `SUBMITTED` sans nouvelle tentative/réouverture auditée ;
- LLM → `ScoreSnapshot` ;
- `STORED → PUBLISHED` parent sans revue ;
- publication d'une version d'une autre audience ;
- reprise d'un job avec lease actif d'un autre worker ;
- retour en arrière par réécriture de statut : créer événement/version/retry.

## Données et clés

Start : `(assignmentId, studentId, clientKey)`. Autosave : `attemptId + revision`. Submit : `attemptId + submitKey + responsesChecksum`. Scoring : `attemptId + inputChecksum + engineVersion`. Report : `scoreSnapshotId + audience + templateVersion + contextChecksum`. Publication : `attemptId + audience + versionId + publishKey`.

## Audit et rollback

Chaque transition enregistre acteur/service, capacité, ancien/nouvel état, timestamp serveur, corrélation, idempotency key et raison. Les payloads sensibles restent hors audit. Rollback = feature flag/process version, jamais suppression d'événements ou modification d'un snapshot. Le lecteur reconstruit l'état à partir des agrégats et événements, sans exiger un event sourcing complet.
