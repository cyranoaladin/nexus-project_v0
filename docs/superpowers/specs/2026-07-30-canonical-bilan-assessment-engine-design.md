# Conception du moteur canonique de tests et bilans

## Date et dépendance

2026-07-30, Africa/Tunis.

Cette branche part exclusivement du SHA stabilisé
`be627c788b0b60a6ab63fe7d8f903863fe837278` et dépend de la draft PR #88.
Elle ne doit pas être fusionnée avant sa branche de base.

## Objectifs

Le moteur doit :

- affecter une définition pédagogique canonique validée ;
- créer et reprendre une tentative ;
- autosauvegarder des réponses typées avec concurrence optimiste ;
- sceller une soumission de manière idempotente ;
- corriger les QCM automatiquement sans exposer leur corrigé ;
- mettre les réponses courtes dans une file de correction manuelle auditée ;
- produire un score brut déterministe et versionné ;
- conserver le calibrage réel en attente tant que ses seuils ne sont pas
  validés ;
- générer un bilan déterministe par audience ;
- séparer génération, revue, publication et révocation ;
- préserver les preuves historiques sans copier le corpus dans Prisma.

Le moteur dépend uniquement de `lib/pre-rentree/pedagogy/`. Une route HTTP ne
lit jamais un YAML et aucun chemin de source ne vient du client.

## Inventaire et réutilisation

| Concept | Modèle existant | Réutilisable | Modification | Nouveau modèle nécessaire |
|---|---|---:|---|---:|
| demande | `BilanRequest` | oui | lien composite vers affectation/tentative et nouveaux événements | non |
| affectation pédagogique | aucun | non | sans objet | oui, `CanonicalAssessmentAssignment` |
| tentative | `CanonicalAssessmentAttempt` | oui | rattachement, ordinal, version, dates de scellement et idempotence | non |
| réponse unitaire | JSON legacy `answers` | non comme vérité v1 | conserver `{}` pour compatibilité, ne plus le consommer | oui, `CanonicalAssessmentResponse` |
| correction manuelle | contrat non persistant | non | sans objet | oui, tâche et décisions append-only |
| scoring | `ScoreSnapshot`, `EvidenceItem` | oui | nature provisoire/finale, maximum, checksum d'entrée et calibrage | non |
| bilan | `ReportArtifact`, `ReportRevision`, `ReportReview` | oui | révocation et historique de publication | oui, `ReportPublication` |
| outbox | `JobOutbox`, `NotificationOutbox` | oui | nouveaux types d'événements seulement | non |
| audit moteur | `BilanRequestEvent` couvre seulement l'intake | partiellement | conserver les événements de demande | oui, `AssessmentAuditEvent` |
| idempotence multi-commandes | clés dispersées | non | sans objet | oui, `AssessmentIdempotencyRecord` |
| validation pédagogique | manifeste et contrats de catalogue | oui | paquet de revue et transitions liées au hash | non |

Les modèles legacy `Assessment`, `Bilan`, `StageBilan`,
`GeneratedPedagogicalReport` et `CopySubmission` ne sont ni étendus ni
réutilisés par le nouveau moteur.

## Arbitrages explicites

### Réponses

`CanonicalAssessmentAttempt.answers` reste présent pour les lignes
historiques, mais le moteur v1 y écrit uniquement `{}`. La source de vérité des
réponses v1 est la table normalisée, avec unicité tentative/item. Il n'existe
donc pas deux représentations mutables du même état.

Une absence de réponse est distincte d'une réponse fausse. Une réponse courte
absente ne crée pas de tâche de correction. Une réponse courte fournie crée
obligatoirement une tâche et bloque tout résultat final jusqu'à sa correction.

### Politique de score

Le corpus ne définit aucun poids d'item ni seuil de groupe. La politique
technique `canonical-raw-item-score-v1` attribue donc un maximum uniforme de
`1` à chaque item :

- QCM correct : `1` ;
- QCM faux : `0` ;
- absence : `0`, avec résultat `UNANSWERED`, jamais `INCORRECT` ;
- réponse manuelle : valeur entre `0` et `1` fournie par le correcteur ;
- réponse techniquement invalide : exclue du score et signalée.

Cette hypothèse produit un score brut factuel, pas une décision de groupe. Son
identifiant, sa version, son document canonique sérialisé et son SHA-256 sont
persistés.

Aucun seuil réel de calibrage n'est inventé. Le runtime produit
`PENDING_POLICY_VALIDATION`. Une politique de calibrage injectée est permise
uniquement dans les tests de contrat ; elle ne fait pas partie du catalogue
production.

### Contenus non validés

Les 17 définitions restent `HUMAN_VALIDATION_REQUIRED`. Le service
d'affectation appelle le catalogue avec le but `ASSIGNMENT` et les refuse donc
toutes en runtime réel. Les tests positifs du moteur utilisent une définition
synthétique injectée directement dans le service de test ; aucun flag, route
ou variable de production ne permet de sélectionner cette fixture.

Les tests HTTP et navigateur sur le runtime réel vérifient le refus sûr. Le
workflow positif complet est testé sur services réels et PostgreSQL réel avec
la fixture injectée au point de composition du test, sans promouvoir le
corpus.

### Validation humaine

Les paquets de revue sont générés sous
`.artifacts/pre-rentree-2026/pedagogy/review/`. Ils restent des sorties et ne
modifient pas le manifeste. Ils exposent, pour chaque hash :

- module, discipline, niveau, séances, items et réponses manuelles ;
- sources officielles citées, ou l'absence explicite qui bloque la décision ;
- responsable pédagogique et enseignant disciplinaire à renseigner ;
- dates, décisions, réserves, identité vérifiable et hash signé.

Les transitions contractuelles sont :

1. `HUMAN_VALIDATION_REQUIRED` ;
2. `SUBJECT_REVIEW_APPROVED` ;
3. `PEDAGOGICAL_OWNER_APPROVED` ;
4. `PUBLICATION_APPROVED`.

Chaque décision porte le hash. Un changement de hash invalide la chaîne. Codex
ne renseigne aucune identité et ne change aucun statut actuel.

## Modèle d'état

### Affectation

```text
DRAFT -> ASSIGNED -> AVAILABLE -> CLOSED
  |          |           |
  +----------+-----------+-> REVOKED
```

L'ouverture est dérivée de la fenêtre temporelle mais persistée lors d'une
transition opérationnelle. Une affectation révoquée ne peut plus créer de
tentative.

### Tentative

Les états historiques sont conservés. Pour le moteur v1 :

```text
IN_PROGRESS
  -> SUBMITTED
      -> PENDING_MANUAL_REVIEW
          -> SUBMITTED
      -> SCORED
          -> REPORT_PENDING_REVIEW
              -> COACH_VALIDATED
                  -> PUBLISHED

IN_PROGRESS -> CANCELLED
SUBMITTED/PENDING_MANUAL_REVIEW -> CANCELLED (administration seulement)
```

`SCORING_FAILED`, `REPORT_GENERATION_FAILED`, `COACH_REJECTED` et
`INVALIDATED` conservent leur fonction de reprise ou d'invalidation
historique.

La soumission scelle la tentative et toutes ses réponses dans une transaction.
Une réponse scellée est immuable au niveau base.

### Correction

```text
PENDING -> CLAIMED -> COMPLETED
             |
             +-> PENDING (libération explicite ou lease expiré)
```

Une nouvelle décision après correction est une ligne append-only de version
supérieure. La décision précédente n'est jamais modifiée.

### Bilan

```text
DRAFT -> PENDING_REVIEW -> APPROVED -> PUBLISHED -> REVOKED
```

Le vocabulaire Prisma existant utilise `COACH_VALIDATED` pour `APPROVED`.
Générer ne publie jamais. Chaque audience possède son propre artifact et sa
propre publication.

## Provenance

L'affectation scelle :

- `definitionId`, `moduleId`, version et hash CPS ;
- version et hash du manifeste ;
- version et hash du catalogue modules ;
- instant de résolution.

La tentative recopie seulement cette référence immuable afin de préserver les
lectures historiques déjà garanties par les triggers. Les réponses référencent
des IDs d'items, sans définition copiée.

Le score scelle :

- hash de la tentative et des décisions manuelles ;
- politique et hash de scoring ;
- nature provisoire ou finale ;
- état de la politique de calibrage.

Le bilan scelle :

- score source ;
- template et version ;
- audience ;
- checksum du contexte déterministe ;
- version de génération.

## Concurrence et idempotence

Toutes les commandes mutantes exigent une clé de 16 à 128 caractères. La
combinaison `(scope, actorKey, key)` est unique et conserve le hash de requête.

- même clé + même payload : même résultat ;
- même clé + payload différent : `409 IDEMPOTENCY_PAYLOAD_MISMATCH` ;
- commande encore active : `409 IDEMPOTENCY_IN_PROGRESS`.

Les verrous sont :

- contrainte unique affectation/idempotence ;
- ordinal unique par affectation ;
- version optimiste par réponse ;
- verrou de ligne tentative avant autosave ou soumission ;
- unicité tentative/item ;
- claim atomique de correction avec lease ;
- checksum unique de snapshot de score ;
- unicité de publication active par artifact.

Le trigger de réponse relit l'état de la tentative. Un autosave arrivé après
le scellement échoue même si le navigateur a ignoré la réponse de soumission.

## API et permissions

| Opération | Parent | Élève | Assistante | Coach affecté | Admin |
|---|---:|---:|---:|---:|---:|
| lister affectations accessibles | oui | oui | oui | oui | oui |
| lire définition publique | propriétaire | propriétaire | oui | oui | oui |
| démarrer/reprendre | propriétaire | propriétaire | non | non | oui |
| autosave/soumettre | propriétaire | propriétaire | non | non | oui |
| créer affectation | non | non | oui | non | oui |
| voir file de correction | non | non | non | affecté | oui |
| réclamer/corriger | non | non | non | affecté | oui |
| scorer/générer | non | non | oui | affecté | oui |
| approuver | non | non | non | affecté | oui |
| publier/révoquer | non | non | non | affecté et rôle Coach | oui |
| voir bilan | publication audience | publication audience | interne | interne | toutes |

Les ressources famille non accessibles retournent 404 afin de ne pas confirmer
leur existence. Les routes équipe distinguent 401 et 403.

La définition publique omet toujours :

- `correct` ;
- `rationale` ;
- `targetedObstacle` ;
- `gradingCriteria` ;
- `admissibleAnswerExample`.

## Génération et audiences

Le générateur `canonical-bilan-template-v1` est déterministe. Il produit des
données JSON validées, rendues par React sans HTML brut.

- `NEXUS` : résultats factuels, décisions de correction et statut de
  calibrage ; commentaires internes autorisés ;
- `PARENT` : scores factuels, points à consolider et commentaires explicitement
  publiables ; aucun corrigé ;
- `STUDENT` : uniquement si un artifact distinct a été approuvé ; aucun
  commentaire interne, corrigé ou réponse attendue.

La génération reste désactivée tant que
`BILAN_REPORT_GENERATION_MODE=DISABLED`. L'ancienne variable
`BILAN_LLM_ENRICHMENT_ENABLED` est refusée afin d'éviter deux sources de
configuration. Le score, le calibrage, la validation et la publication n'ont
aucune dépendance LLM.

## Observabilité

Les événements structurés ne contiennent ni email, nom, réponse, commentaire,
token ou payload fournisseur. Ils portent seulement :

- nom d'événement ;
- issue (`SUCCESS`, `DENIED`, `CONFLICT`, `FAILED`) ;
- statut HTTP éventuel ;
- durée ;
- rôle ;
- code métier non sensible.

Les métriques externes et alertes sont documentées comme cibles de
configuration, jamais comme déjà installées.

## Migration

La migration est additive et ne modifie aucune migration passée. Elle :

- crée les modèles v1 consommés ;
- ajoute les enums et colonnes nécessaires ;
- ajoute contraintes, index partiels et triggers ;
- backfille les nouvelles colonnes nullable ou avec défaut sûr ;
- remplace le trigger de tentative par un graphe compatible avec les états
  historiques et v1.

Le rollback applicatif désactive tous les flags, cesse les workers et conserve
les nouvelles tables. Le rollback SQL destructif n'est pas prévu après
écriture de données ; une migration compensatoire serait requise.
