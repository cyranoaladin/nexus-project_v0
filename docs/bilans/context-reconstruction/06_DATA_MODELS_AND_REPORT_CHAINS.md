# Modèles de données et chaînes de rapports

Voir `MODEL_INVENTORY.csv` pour l'inventaire comparatif.

## Modèle primaire actuel

- `Assessment` stocke identité, réponses JSON, résultat JSON, score/confiance et trois Markdown ; `DomainScore`/`SkillScore` sont des agrégats.
- `Diagnostic` stocke identité brute, réponses, scoring/analyse et trois Markdown.
- `Bilan` stocke source JSON, scores, trois Markdown, statut/progression et publication globale. Les champs commentés comme IDs hérités ne sont pas des relations canoniques.
- `StageBilan` stocke trois contenus et `isPublished`.
- `EafPreparationReport` encode un workflow propre EAF.
- `GeneratedPedagogicalReport` stocke contexte, JSON LLM, JSON validé, LaTeX, URL PDF, checksum et un statut, mais pas de version/revue/publication par audience.
- NPC possède `CopySubmission`, `AiProcessingJob`, `PedagogicalReport`, `CompetenceMatrix` et roadmap.

Le modèle familial est un-à-plusieurs ; `CoachStudentAssignment` est l'association d'affectation exploitable. Les enums de génération couvrent une partie du traitement mais pas l'approbation/publication/révocation.

## Entités canoniques

| Entité | Nécessité / invariant |
|---|---|
| `DiagnosticDefinition` | définition publiée versionnée, matière/niveau/curriculum, banque, règles ; immutable après publication |
| `AssessmentAttempt` | affectation snapshotée, élève, définition, états, durée, accommodations ; une soumission logique |
| `AssessmentResponse` | réponse itemisée, statut sémantique, horodatage/révision ; aucune solution client |
| `SkillEvidence` | lien réponse–compétence/notion/règle/source, valeur et type d'erreur ; append-only pour un run |
| `ScoringRun` | moteur/règles/version/checksum, entrée, auteur système, statut ; relance explicite |
| `ScoreSnapshot` | résultat immutable et explicable d'un run, axes + qualité/confiance |
| `ReportJob` | travail durable, claim/lease/tentatives/idempotence/erreur ; ne contient pas la publication |
| `ReportVersion` | audience, score snapshot, prompt/schema/corpus/checksums, contenu validé et artefact |
| `HumanReview` | décision, reviewer/capacité, annotations, version examinée ; append-only |
| `ReportPublication` | audience + version publiée + dates/révocation ; une publication active par audience/attempt |

Ajouter conceptuellement `GuardianStudentLink`, `DiagnosticAssignment`, `LegacyEntityLink`, `OutboxEvent`, `AuditEvent` et un `Artifact` privé peut éviter de surcharger les dix entités sans créer une nouvelle chaîne concurrente.

## Conservation / adaptation / migration

- Conserver `User`, `Student`, profils et `CoachStudentAssignment` ; adapter la famille via lien additif.
- Conserver Assessment/Diagnostic/Bilan/StageBilan/EAF/NPC durant la transition comme sources historiques.
- Ne pas faire de `Bilan` la table cible par renommage : sa sémantique mélange score, rapport et publication.
- Adapter `GeneratedPedagogicalReport` via un export vers `ReportJob/ReportVersion`, pas comme second canon.
- NPC reste producteur de preuves de copie ; ses scores LLM sont `UNVERIFIED` jusqu'à validation humaine et ne modifient jamais un `ScoreSnapshot` déterministe.

## Identifiants historiques et backfill

`LegacyEntityLink(canonicalType, canonicalId, sourceSystem, sourceModel, sourceId, importedAt, checksum)` conserve tous les IDs sans colonnes polymorphes éparses. Le backfill est relançable, par lots, checksumé et journalisé. Il importe d'abord tentative/réponses, puis un scoring run « legacy-import » et enfin des versions de rapports marquées `IMPORTED`, sans inventer de preuve absente.

## Double lecture / double écriture

1. écrire canonique + outbox dans une transaction, conserver l'ancien write derrière feature flag ;
2. shadow-read et comparer décisions/agrégats sans modifier l'expérience ;
3. basculer lecture par cohorte et matière ;
4. arrêter l'ancien write seulement après métriques, audit et rollback testé ;
5. conserver adaptateur en lecture pour l'historique.

La double écriture applicative non transactionnelle est interdite. Utiliser transaction DB + outbox/idempotence. Le rollback rebascule le flag de lecture ; les données canoniques additives restent, sans suppression.

## Chaînes à garder distinctes

La correction de copies NPC, les questionnaires de stage et EAF gardent leurs formulaires et preuves propres. Ce qui converge est la sortie : tentative/artefact source → evidence → snapshot → versions/pubications. Les contenus, rubriques et renderers disciplinaires restent des plugins de définition, pas des bases ou workers séparés.
