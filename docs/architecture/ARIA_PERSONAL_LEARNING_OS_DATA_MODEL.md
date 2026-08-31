# ARIA Personal Learning OS — Architecture et matrice de données V2

## Statut du document

- Date : 2026-08-31
- Baseline auditée : `1149572f5bf85b43bc10c870cb4fd81b336f7f56`
- Décision : `ARCHITECTURE_DESIGN_V2_APPROVED` et `OPTION_2_CANONICAL_APPLICATION_CORE_APPROVED`
- Statut d'implémentation : `PR_200_IMPLEMENTED_PENDING_FINAL_QUALIFICATION`
- Portée : SSoT d'architecture et de données ; #200 implémente uniquement la Conversation Foundation, tandis que les lots C–G restent futurs.

Ce document sépare ce qui existe dans le dépôt, ce qui peut être réutilisé après audit et la cible proposée. Une cible documentaire n'est jamais une preuve d'implémentation.

Le plan TDD qualifiable est [2026-08-30-aria-b-conversation-foundation.md](../superpowers/plans/2026-08-30-aria-b-conversation-foundation.md). Les marqueurs ont le sens suivant : `IMPLEMENTED` = présent et prouvé par les gates du HEAD qualifié ; `IN_#200` = contrat et implémentation appartenant à la PR, en attente de ses gates finaux tant qu'elle n'est pas mergeable ; `FUTURE_LOT` = réservé aux lots C–G et non revendiqué.

```text
PR_200_STATUS=IMPLEMENTED_PENDING_FINAL_QUALIFICATION
ARIA_C_STATUS=FUTURE_LOT_NOT_IMPLEMENTED
ARIA_D_STATUS=FUTURE_LOT_NOT_IMPLEMENTED
ARIA_E_STATUS=FUTURE_LOT_NOT_IMPLEMENTED
ARIA_F_STATUS=FUTURE_LOT_NOT_IMPLEMENTED
ARIA_G_STATUS=FUTURE_LOT_NOT_IMPLEMENTED
```

## 1. Décision d'architecture V2

ARIA possède une façade applicative canonique **par cas d'usage**, et non une fonction universelle :

- `runConversation` — propriété de PR #200 ;
- `generateResource` — ARIA-F ;
- `runPractice` — ARIA-F ;
- `correctSubmission` — ARIA-G ;
- `buildPlan` — ARIA-F ;
- `recommendNextActions` — ARIA-E.

Dans #200, `runConversation` est l'unique **cas d'usage génératif** et l'unique pipeline RAG/prompt/model/persistance conversationnelle. Le bounded context expose aussi des commandes/queries sans génération : `listAvailableCourses`, `getConversationHistory`, `getLearningProfile`, `updateLearningPreferences` et `submitConversationFeedback`. Elles utilisent les mêmes frontières actor/subject/access mais n'appellent ni retrieval, ni prompt, ni model gateway.

Ces cas d'usage partagent un kernel de politiques, sans partager une orchestration métier monolithique :

```text
Transport / worker
        ↓
Application use case
        ↓
Actor + Subject resolution
        ↓
Global safety + visibility + entitlement
        ↓
Task pedagogical policy + subject policy + agent role
        ↓
Retrieval policy + model capability policy
        ↓
Use-case repository / events / outbox
```

Le kernel commun couvre uniquement identité, accès, visibilité, sécurité globale, sélection de politiques, gateway de modèles, idempotence et primitives de jobs. Il ne décide pas à la place des cas d'usage de leur workflow, de leur persistance ou de leur pédagogie.

## 2. Boucle pédagogique canonique

Le Personal Learning OS suit une boucle explicite :

```text
OBSERVE → DIAGNOSE → DECIDE → ACT → ASSESS → REFLECT → ADAPT
```

| Phase | Responsabilité | Donnée canonique ou sortie | Contrainte |
| :--- | :--- | :--- | :--- |
| OBSERVE | Capturer un fait d'apprentissage ou une production | événement source, réponse, copie, tentative, interaction | conserver source, période académique, provenance et visibilité |
| DIAGNOSE | Interpréter les faits selon une politique versionnée | diagnostic ou projection, avec incertitude | ne jamais modifier le fait observé |
| DECIDE | Classer les interventions possibles | décision explicable et reason codes | classement déterministe/auditable ; LLM non SSoT |
| ACT | Exécuter un cas d'usage | conversation, ressource, pratique, correction ou plan | une façade applicative dédiée |
| ASSESS | Mesurer le résultat de l'action | nouvelle Evidence observable | barème, validateur et provenance obligatoires |
| REFLECT | Comparer intention, action et résultat | réflexion élève/coach/système | visibilité indépendante des conversations brutes |
| ADAPT | Recalculer projection, priorité ou plan | mastery projection, NBA, plan révisé | reconstruction possible depuis les faits |

PR #200 établit les contrats nécessaires à cette boucle mais ne prétend pas implémenter l'ensemble des sept phases. Une conversation peut produire une interaction observable ; elle ne crée pas directement un niveau de maîtrise.

## 3. Politiques pédagogiques et de sécurité

### 3.1 Global Safety Policy

Politique commune, indépendante de la matière et de la tâche :

- protection des mineurs et gestion des situations de sauvegarde ;
- confidentialité, minimisation des données et résistance aux injections ;
- contrôle d'accès actor/subject et visibilité ;
- intégrité académique et restrictions de contenu ;
- outils autorisés, redaction des logs et erreurs publiques sûres.

### 3.2 Task Pedagogical Policy et Pedagogical Mode

La pédagogie dépend du mode d'intervention. La règle « ne jamais donner la réponse » n'est pas globale. Le cas d'usage conversationnel distingue `DISCOVERY`, `GUIDED_PRACTICE`, `INDEPENDENT_PRACTICE`, `CHECK_MY_WORK`, `CORRECTION`, `WORKED_EXAMPLE`, `EXAM_SIMULATION`, `REVISION` et `METHODOLOGY`. #200 n'active que les combinaisons dont les policies sont effectivement livrées ; les autres restent des valeurs de contrat refusées jusqu'à leur lot.

| Task | Politique d'intervention attendue |
| :--- | :--- |
| TUTOR | questionnement, étayage progressif, vérification de compréhension |
| PRACTICE | consigne, indices gradués, évaluation séparée de la tentative |
| CORRECTION | solution exacte, erreurs repérées, barème et remédiation |
| WORKED_EXAMPLE | raisonnement complet et réponse explicitement montrée |
| RESOURCE_GENERATION | contenu structuré, corrigé et difficulté contrôlée |
| PLANNING | priorisation, charge, échéances et contraintes de l'élève |

Chaque application use case sélectionne une politique strictement versionnée. Une tâche non déclarée par la capability du cours est refusée.

### 3.3 Agent Role × Subject Policy

Un comportement est composé de trois axes indépendants :

- **Agent Role** : rôle, outils et responsabilités (`Tutor`, `PracticeCoach`, `Corrector`, `ResourceAuthor`, `Planner`) ;
- **Task Pedagogical Policy** : niveau de dévoilement, feedback, évaluation et forme de sortie ;
- **Subject Policy** : curriculum, vocabulaire, conventions et contraintes du `courseKey`.

Une matière n'entraîne jamais la duplication d'une implémentation d'agent. Le résolveur compose rôle × tâche × politique matière, puis applique la Global Safety Policy.

## 4. Identité, sujet et autorisation

```text
AriaActor
  actorUserId
  actorRole
  principalKind = INTERACTIVE | SYSTEM_JOB

AriaSubject
  studentId
  academicContext
```

`AriaActor` désigne qui agit. `AriaSubject` désigne l'élève pour lequel l'action est réalisée.

- Une route élève résout toujours `subject=self` et rejette tout `studentId` client.
- Une future route coach résout le sujet via une affectation coach-élève active et un scope de cours explicite.
- Un futur job système utilise une identité de service et un payload signé/scopé créé par une opération déjà autorisée.
- Aucun core n'accepte un objet actor/subject arbitraire construit par un contrôleur.

Le builder canonique du cas conversationnel résout identité, sujet, carte scolaire, cours, capabilities, accès commercial, préférences, conversation, skill et ressource. Le contexte résultant est opaque au transport et ne peut être créé que dans le module d'application autorisé.

### Entitlement cible

Le modèle converge vers :

```text
generic ARIA access
        +
explicit course scopes
```

Un produit accorde `aria_access` et une liste explicite de `courseKey`, ou un scope global. Il n'existe pas une `FeatureKey` par matière. Les anciens produits Maths/NSI peuvent conserver leur `productCode`, mais leur définition canonique accorde le droit générique et des course scopes.

`Entitlement` reste le SSoT du statut, des dates, de la source commerciale et de la révocation. Un modèle relationnel enfant `AriaEntitlementScope` porte exclusivement `GLOBAL` ou un `courseKey`, avec CHECK/unique et lineage vers l'Entitlement ; aucun scope d'accès n'est stocké dans un `metadata` libre.

La migration #200 est fail-closed et bornée :

1. inventorier les droits issus de `Subscription.ariaSubjects`, des feature keys historiques, des course keys et des accès explicites STMG/global ;
2. étendre le registre produit canonique avec `aria_access + courseScopes` et backfiller les droits sans créer un nouveau produit par matière ;
3. comparer, dans la migration et les tests, décisions legacy et nouvelles décisions pour chaque bénéficiaire ; toute divergence bloque la bascule ;
4. basculer l'unique builder runtime sur le nouveau grant ;
5. supprimer la lecture `ariaSubjects` et les aliases `aria_maths`, `aria_nsi`, `aria_stmg` avant le HEAD final de #200.

La double lecture n'est donc qu'un outil de migration contrôlé, jamais une seconde vérité runtime durable. Les cas feature-key, course-key, STMG explicite et global conservent un test d'équivalence.

La permission actor→subject et l'entitlement du subject restent séparés. Un parent, coach ou job autorisé à agir pour un élève n'utilise jamais ses propres entitlements à la place de ceux du bénéficiaire.

## 5. Retrieval, ressources et RAG

La politique de retrieval est résolue à partir de :

```text
task
+ course
+ requested resource
+ agent capability
+ actor/subject visibility
```

Elle produit un plan versionné : grounding requis/autorisé, resource identities admissibles, filtres, budget, nombre de résultats, stratégie de citations et comportement par état RAG.

Le modèle documentaire cible est :

```text
ONE Resource Registry
  ├─ official resources
  ├─ curated Nexus resources
  ├─ generated resources
  └─ personal/student resources
           ↓ resourceId + resourceVersionId
RAG Manifest
  ├─ corpusId + corpusVersionId
  ├─ indexed resourceVersionIds
  └─ physical repository binding
```

Le Resource Registry est la vérité des documents, de leur provenance, owner, visibilité et versions. La RAG Manifest ne recrée pas de documents ; elle référence des identités de ressources et décrit leur indexation. Le nom physique d'une collection n'est qu'un binding d'infrastructure.

Le partage cross-repository est unidirectionnel et digesté : Nexus possède le Resource Registry et `courseKey + pedagogicalMode + agentRole → corpusId`; le dépôt RAG possède le manifeste de corpus servable et `corpusId → collection physique`. Le RAG publie `resourceRegistryVersion/resourceRegistrySha256`, `corpusId/corpusVersionId`, `manifestSha256` et la liste `resourceId/resourceVersionId/contentSha256`; Nexus consomme un lock généré, jamais un deuxième registre manuel. Le RAG est déployé d'abord avec un index immuable qui annonce N/N-1 et leur `retireAt`, puis Nexus échoue fermé si le digest runtime ne correspond pas au lock piné, est N-2/retiré ou référence un autre digest Registry.

Les états restent distincts : `NOT_CONFIGURED`, `NO_RESULTS`, `RUNTIME_UNAVAILABLE`, `SUCCESS`. Leur traitement dépend de la Task Pedagogical Policy et de la capability résolue, jamais du seul cours.

### Capability fondée sur preuve

Une capability n'est disponible que si son evidence resolver réussit :

- resources : nombre réel de versions actives et vérifiables dans le Resource Registry ;
- RAG : corpus manifesté avec `resourceVersionIds` indexées **et** health runtime disponible ;
- skill graph : graphe versionné réellement chargeable ;
- assessment/correction : adapter runtime réel et policy déclarée ;
- chat/task : combinaison task × course × agent explicitement déclarée.

Une constante `hasResources: true`, un nom de collection ou un mapping de chaîne ne prouve aucune capability. Le resolver retourne séparément `CONFIGURED`, `AVAILABLE`, `UNAVAILABLE` et sa preuve.

## 6. Model Gateway et politique de modèles

Le gateway reçoit des exigences, pas un nom de modèle hardcodé :

- `vision` ;
- `reasoning` ;
- `structuredOutput` ;
- `toolCalling` ;
- `latencyClass` ;
- `costClass`.

Un `ModelPolicyResolver` versionné sélectionne une configuration fournisseur/modèle explicitement déclarée. Si aucune configuration ne satisfait les exigences, l'appel échoue avec une erreur typée. La décision enregistre policy version, provider, model, capabilities retenues, latence et coût ; elle ne devient jamais une vérité pédagogique. Aucun fallback de provider ou de modèle n'est implicite.

## 7. Idempotence, concurrence et jobs

### Conversation dans #200

La cible introduit un agrégat use-case spécifique `AriaConversationTurn`, et non un run générique pour tous les futurs cas d'usage. Il relie conversation, actor, subject, messages user/assistant, `courseKey`, mode pédagogique, `clientRequestId`, empreinte de requête, statut, heartbeat et versions de politiques. Une contrainte unique actor + subject + useCase + clientRequestId assure l'idempotence ; une contrainte PostgreSQL partielle sur les états actifs assure qu'un seul turn génératif est actif.

- Chaque génération exige un `clientRequestId`; le transport peut le refléter dans `Idempotency-Key` et refuse une divergence entre les deux.
- Le scope est actor + cas d'usage + sujet, et non le nom d'une route HTTP.
- Une empreinte de requête empêche de rejouer la même clé avec un contenu différent.
- Une exécution conversationnelle persistée possède exactement les états `PENDING`, `RUNNING`, `COMPLETED`, `CANCELLED`, `ERROR`. `STREAMING` est un comportement de transport, pas un état métier.
- Même clé et turn actif : réponse HTTP 202 `TURN_IN_PROGRESS` portant le même turnId/statut/retryAfter, sans second appel modèle.
- Même clé et turn terminal : réémission d'un résultat terminal construit depuis la persistance canonique ; aucun token n'est régénéré.
- Clé différente pendant une génération active dans la même conversation : refus typé `CONVERSATION_BUSY`.
- Des conversations différentes peuvent s'exécuter en parallèle.

`AriaConversationTurn.status` est l'unique SSoT du lifecycle. Pour le rollout expand/contract, le trigger DB maintient uniquement la projection legacy du **message assistant lié** ; le message utilisateur accepté reste `COMPLETED` et ne reflète jamais `RUNNING`, `CANCELLED` ou `ERROR`. L'application ne peut pas modifier indépendamment cette projection, qui sera supprimée par M2. Les messages historiques sans Turn restent lisibles mais ne pilotent aucune exécution.

Des transactions courtes encadrent l'appel LLM :

1. **TX1 reserve** : verrouiller la conversation, vérifier l'absence de turn `PENDING/RUNNING`, créer le turn `PENDING`, le message user, le placeholder assistant et le watchdog outbox ;
2. **claim** : transaction courte CAS `PENDING→RUNNING` avec executionToken/heartbeat/lease ;
3. exécuter retrieval et modèle hors transaction, avec heartbeat/bail ;
4. **TX2 terminalize** : écrire atomiquement contenu/citations/métadonnées/watchdog puis CAS `RUNNING + executionToken` vers `COMPLETED`, `CANCELLED` ou `ERROR`.

Seul un état actif peut devenir terminal. Si `terminalize` échoue, le turn reste récupérable par le sweep autonome. Aucun appel RAG, LLM ou stream n'est exécuté dans une transaction DB. V1 met à jour un heartbeat au plus toutes les dix secondes et considère un Turn stale après soixante secondes, valeurs configurables et bornées.

### Jobs longs et recovery

Le dépôt possède déjà `JobOutbox`, des leases, `FOR UPDATE SKIP LOCKED`, retries et quarantaine pour les bilans. Cette infrastructure est un candidat réel, mais ses types et handlers sont actuellement liés aux bilans/emails.

- #200 extrait ou adapte seulement les primitives nécessaires au recovery conversationnel autonome.
- TX1 planifie un watchdog ; un scheduler/worker récupère les générations expirées, indépendamment d'une nouvelle requête élève.
- Le recovery utilise heartbeat/bail et fencing/CAS ; l'âge de création du message n'est pas un heartbeat. #200 ne fait aucun checkpoint par token : une annulation explicite observée conserve le buffer dans TX2, tandis qu'un crash perd éventuellement le buffer mémoire mais devient `ERROR` de façon autonome. Une déconnexion transport seule ne cancel pas.
- Les futures corrections et générations créent leurs propres agrégats et jobs outbox ; elles ne détournent pas une conversation.
- Le payload outbox est strict, versionné et contient des références, pas des documents sensibles ou conversations brutes.
- Les alertes/retries sont bornés, mais un watchdog reste retryable tant que son Turn est actif ; il ne passe jamais en quarantaine finale avant terminalisation.

`CanonicalApiIdempotencyKey` est réutilisable pour une mutation courte, pas pour tenir une transaction pendant un stream. `AiProcessingJob` NPC n'est pas un kernel générique et ne possède pas aujourd'hui de récupération fiable après crash.

## 8. Privacy et visibilité

Toute donnée ARIA porte une politique d'audience indépendante. Les quatre termes sont des grants/limites composables, pas un enum exclusif :

- `STUDENT_PRIVATE` ;
- `COACH_VISIBLE` ;
- `PARENT_VISIBLE` ;
- `SYSTEM_ONLY`.

`COACH_VISIBLE` et `PARENT_VISIBLE` peuvent coexister. `STUDENT_PRIVATE` interdit ces deux audiences tant qu'aucun artifact dérivé n'est explicitement publié ; `SYSTEM_ONLY` interdit toute audience utilisateur. Chaque grant combine audience, purpose, condition relationnelle, consentement/base légale si requis et statut de publication.

L'accès coach exige une affectation active et un scope adapté ; l'accès parent exige une relation/autorisation valide et la politique du concept. Les conversations brutes sont `STUDENT_PRIVATE` par défaut. Une Evidence ou un résumé dérivé peut être partagé selon sa propre politique sans rendre la conversation source visible.

Les prompts, traces provider et outils sont `SYSTEM_ONLY`. Les journaux opérationnels utilisent des identifiants opaques et des messages redacted.

## 9. Evidence, mastery et Next Best Action

### Evidence

Une Evidence est un fait d'apprentissage observable et immuable : tentative, réponse, score déterministe, production, correction validée ou observation humaine. Elle référence sa source, son élève, son cours/skill, sa période académique, son instant, sa provenance et sa visibilité.

Un LLM peut proposer une observation `AI_DRAFT`, mais celle-ci ne devient une Evidence utilisable pour la maîtrise qu'après le validateur prévu par la politique : règle déterministe ou validation humaine.

### Mastery

La maîtrise est une projection reconstruisible à partir des Evidence acceptées. Elle conserve version de politique, fenêtre d'évidence, date de calcul et niveau de confiance. `SkillScore` actuel est une projection legacy liée à `Assessment`, pas un SSoT partagé. Un LLM n'écrit jamais directement un score de maîtrise.

### Next Best Action

La NBA est un classement explicable sur :

- Evidence et mastery projections ;
- goals ;
- échéances ;
- disponibilité et charge ;
- prerequisites et contraintes pédagogiques.

Chaque décision conserve les candidats, composantes de score, `reasonCodes`, références d'entrée, policy version, date d'expiration et résultat éventuel. Le LLM peut verbaliser la recommandation ; il ne choisit pas de façon opaque la priorité canonique.

## 10. Carte scolaire et période académique

`Student` demeure le SSoT de la situation scolaire **courante**. ARIA-D introduit une période académique explicite afin de préserver l'interprétation historique :

- `AcademicPeriod` : année scolaire/session, bornes et curriculum version ;
- `StudentAcademicPeriod` : snapshot élève du grade, track, pathway et dimensions académiques approuvées ;
- inscriptions/choix associés à la période ;
- Evidence, goals, plans et décisions rattachés à la période pertinente.

`StudentAcademicEnrollment.curriculumVersion` ne remplace pas l'année scolaire.

Pont #200→ARIA-D : chaque `AriaConversationTurn` persiste un `academicContextSnapshot` strictement versionné issu du `Student` courant et de l'Academic Map : grade, track, pathway, course, curriculum version, statut de couverture et dimensions connues/manquantes. Ce snapshot n'invente aucune dimension absente et ne remplace pas `AcademicPeriod`. ARIA-D le rattache ou le migre vers la période explicite correspondante.

Avant de choisir un modèle de variable académique, ARIA-D doit énumérer toutes les dimensions : LVA, LVB, spécialités conservées/abandonnées, options, enseignements technologiques, mode de scolarisation/candidat, session d'examen et autres choix variables. `LANGUAGE_CHOICE` n'est pas une décision approuvée et LVA/LVB ne sont pas des `OPTION`.

Faits actuels :

- `SECONDE` est un `GradeLevel`, pas une valeur d'`AcademicTrack` ;
- le statut candidat libre n'a pas de SSoT académique ; `CandidateDiagnostic` ne remplit pas ce rôle ;
- LVA/LVB ne sont pas représentables sans ambiguïté ;
- aucune couverture académique à 100 % n'est revendiquée.

### Deux métriques indépendantes

`ACADEMIC_MAP_REPRESENTATION_COVERAGE` mesure si le modèle peut exprimer sans ambiguïté la réalité scolaire de l'élève.

`ARIA_CAPABILITY_COVERAGE` mesure, pour une réalité déjà représentée, quels cas d'usage sont effectivement disponibles et prouvés : chat, RAG, ressources, pratique, correction, planification, etc.

Une représentation complète n'implique aucune capability, et une capability technique ne répare pas une représentation ambiguë.

## 11. Learning Profile et cockpit

Le cockpit est dérivé automatiquement de l'Academic Map. Une préférence utilisateur ne décide jamais si un cours réel existe, est supporté ou est autorisé.

La cible remplace la sémantique de `selectedCourseKeys` par :

- `pinnedCourseKeys` — raccourcis ;
- `focusedCourseKey` — contexte d'ouverture préféré ;
- `courseOrder` — ordre d'affichage.

Ces valeurs sont validées contre l'Academic Map mais n'entrent pas dans l'autorisation. Les goals ne sont jamais stockés dans `AriaLearningProfile`. Si `AriaLearningGoal` devient le modèle cible après audit de `Trajectory`, lui seul portera les goals.

#200 livre le schéma strict de préférences et un consumer réel dans le client ARIA unifié : sélection initiale du focus, ordre des cours, affichage des pins et `showCitations`. ARIA-C réutilise ce contrat pour le cockpit complet ; il ne redéfinit pas les préférences.

Les données existantes `selectedCourseKeys` sont inventoriées avant migration. Comme le système les initialise automatiquement avec tous les cours et qu'aucun consumer de préférence explicite n'est prouvé, elles ne sont pas converties aveuglément en pins.

## 12. Matrice canonique des concepts

Statut de livraison des groupes : Conversations, idempotence, feedback, préférences et l'interface minimale Resource/RAG sont `IN_#200`. Les modèles actuels cités dans `CURRENT_MODEL` sont `IMPLEMENTED_PARTIAL`, jamais validation de réutilisation. Academic period, journey, goals, work items, generated resources, practice, submissions/corrections, Evidence/mastery/NBA et agents sont `FUTURE_LOT` jusqu'à leur audit et leur lot respectif.

| PRODUCT_CONCEPT | CURRENT_MODEL | REUSE | EXTEND | NEW_MODEL | SSoT CIBLE | WRITE_PATH | READ_PATH | OWNER | SECURITY_OWNER | VISIBILITY_POLICY | MIGRATION | RETENTION | EVIDENCE |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Academic map courant | `Student` + `StudentAcademicEnrollment` | Oui | Oui, après modèle ARIA-D | Non décidé pour choix variables | `Student` courant + AcademicMapService | onboarding/admin vérifié | AcademicMapService | Équipe scolaire | AcademicMap authorization | élève ; autres audiences via vues autorisées | conserver current state ; supprimer les approximations | politique dossier élève | source, verifier, curriculumVersion |
| Academic period / school year | Absent ; `academicYear` existe seulement dans certains DTO | Non | Non | `AcademicPeriod` + `StudentAcademicPeriod` proposés ARIA-D | snapshot académique historique | onboarding annuel / transition vérifiée | AcademicMapService historique | Équipe scolaire | AcademicMap authorization | audience selon dossier scolaire et purpose | créer périodes puis rattacher faits/enrollments | calendrier scolaire + politique dossier | période, source, vérification |
| Choix académiques variables | `SPECIALTY` et `OPTION` seulement | Partiel | Décision après inventaire complet | À décider ARIA-D | modèle sémantique approuvé après couverture | onboarding/admin | AcademicMapService | Équipe scolaire | AcademicMap authorization | élève ; staff scolaire autorisé | aucune conversion LVA/LVB→OPTION | période académique | rôle du choix, valeur, provenance |
| Learning profile | `AriaLearningProfile` + JSON | Oui | préférences v1 explicites | Non | LearningProfileService | élève authentifié | client ARIA / application context | Élève | Actor/Subject policy | `STUDENT_PRIVATE` | retirer rôle de gate ; migrer uniquement préférences prouvées | durée compte, revue RGPD | schemaVersion, updatedAt |
| Learning journey | Agrégations disparates | Sources seulement | Non | projection/service ARIA-E | projection reconstruite depuis faits | événements des use cases | JourneyService | Domaine apprentissage | VisibilityPolicyService | grants composables par vue ; aucune propagation des sources brutes | brancher sources canoniques | rebuildable | IDs d'Evidence et policy versions |
| Goals | `Trajectory` existe ; `AriaLearningGoal` absent | Audit requis | Audit requis | `AriaLearningGoal` seulement si invariants distincts approuvés | GoalService, jamais LearningProfile | élève/coach selon politique | plan, cockpit, NBA | Élève + équipe pédagogique | GoalService access policy | élève ; coach/parent seulement par grant explicite | auditer Trajectory avant décision | période + clôture | auteur, échéance, état, historique |
| Work items / plan | `RoadmapTask` lié à `RemediationRoadmap` NPC | Non approuvé | Audit requis | À décider ARIA-F | PlanService après audit | `buildPlan` / coach | cockpit | Domaine planification | PlanService access policy | élève ; coach assigné ; parent summary si publié | ne pas réutiliser avant audit invariants | période / échéance | reason codes, goal/Evidence refs |
| Conversations | `AriaConversation`, `AriaMessage`, citations | Oui | intégrité, visibilité, statut | `AriaConversationTurn` dans #200 | ConversationRepository | `runConversation` | history/course workspace | Élève pour données privées | ConversationApplication | `STUDENT_PRIVATE` par défaut | courseKey-only ; subject supprimé ; snapshot académique v1 | politique de compte existante ; aucune nouvelle purge silencieuse dans #200 | actor, subject, academicContextSnapshot, policies |
| Conversation idempotency | idempotence HTTP route-based non adaptée au stream | primitives seulement | Oui | `AriaConversationTurn` dans #200 | Conversation application | `runConversation` | replay/recovery | Application ARIA | ConversationApplication | `SYSTEM_ONLY` pour run/heartbeat | clé actor+subject+useCase+clientRequestId + fingerprint | courte, liée au turn | clientRequestId, heartbeat, transitions |
| Feedback conversationnel | `AriaFeedback` + `AriaMessage.feedback` legacy | `AriaFeedback` | upsert idempotent | Non | `AriaFeedback` | FeedbackApplication | history/chat projection | Élève | FeedbackApplication | `STUDENT_PRIVATE` | backfill du booléen legacy ; projection read-only puis suppression du champ | durée conversation/compte | messageId, studentId, updatedAt |
| Resource registry | `STATIC_RESOURCES` + `PedagogicalContent`, identités divergentes | adaptateurs seulement | #200 : registre minimal immuable scellé pour ressources/citations existantes | ARIA-F : command service d'issuance + backends generated/personal | ResourceService / Resource Registry | #200 bootstrap/import ; ARIA-F curation/génération | conversation/retrieval puis cockpit/practice | Équipe pédagogique / élève selon type | ResourceService | grants par ressource/version/owner | retirer entrées sans provenance ; unifier IDs sans remint RAG | selon type/provenance | resourceId, resourceVersionId, hash, source ref, owner, visibility |
| Generated resources | Aucun modèle canonique | Non | via Resource Registry | modèle/version générée ARIA-F | Resource Registry | `generateResource` async | practice/cockpit/RAG si approuvé | Élève + système | ResourceService | `STUDENT_PRIVATE` par défaut ; grants explicites | même univers d'identités | période + politique RGPD | prompt/policy/model, validation |
| Practice attempts | Aucun modèle ARIA canonique | sources d'assessment à auditer | Non | modèle ARIA-F | PracticeService | `runPractice` | Evidence pipeline / cockpit | Élève | PracticeService | `STUDENT_PRIVATE` ; Evidence partageable séparément | relier ressource, course, period | période + politique RGPD | réponses, hints, scorer/version |
| Submissions | `CopySubmission` NPC, création staff-only actuelle | Prometteur, non approuvé | Audit lifecycle obligatoire | À décider ARIA-G | SubmissionService après audit | futur dépôt autonome élève/coach | correction workspace | Élève / équipe pédagogique | SubmissionService | student + coach selon ownership ; parent non automatique | auditer ownership, upload, visibility, retention | à approuver | fichiers, hash, uploader, consent |
| Corrections / reports | `PedagogicalReport`, défaut `DRAFT` + `COACH_ONLY` | Prometteur, non approuvé | Audit lifecycle obligatoire | À décider ARIA-G | CorrectionService après audit | `correctSubmission` async + validation | vues selon publication | Équipe pédagogique | CorrectionService | raw provider artifact `SYSTEM_ONLY` ; draft pédagogique `COACH_VISIBLE` ; élève/parent après validation/publish | séparer `AI_DRAFT`, `HUMAN_VALIDATED`, `FORMATIVE_ESTIMATE`, `OFFICIAL_RUBRIC` ; aucune note LLM officielle sans barème autorisé | à approuver après audit lifecycle | rubric, versions, validation, publication |
| Evidence | `ScoreSnapshot` + `EvidenceItem` canonical bilans | concept/pattern réutilisable | généralisation ARIA-E | éventuellement envelope multi-source | EvidenceService, faits immuables | assessors déterministes / humains validés | projections, NBA, cockpit autorisé | Domaine évaluation | EvidenceService | grants composables propres au fait ; source brute non propagée | conserver sources ; bannir écritures LLM directes | période + politique RGPD | source, policy, observedAt, visibility |
| Mastery | `SkillScore` legacy lié à `Assessment` | Non comme SSoT | projection ARIA-E | projection versionnée possible | ProjectionService, rebuildable | calcul depuis Evidence acceptée | cockpit / NBA | Domaine évaluation | ProjectionService | projection par audience, sans accès implicite aux Evidence brutes | migrer ou déprécier SkillScore legacy | rebuildable | Evidence IDs, algorithmVersion, confidence |
| Next Best Action | Absent | Non | Non | décision/ranking explicable ARIA-E | RecommendationService | `recommendNextActions` | cockpit / planner | Domaine décision | RecommendationService | élève ; coach/parent via explication publiée | nouveau contrat reason-coded | courte + audit des décisions | inputs, scores, reasonCodes, policyVersion |
| Agent roles / subject policies | Registre annoncé mais absent | Non | Non | kernel conversationnel minimal #200 ; rôles spécialisés ARIA-G | AgentPolicyRegistry | déploiement/revue pédagogique | orchestrateurs use-case | Équipe pédagogique + plateforme | Policy governance | `SYSTEM_ONLY` | Tutor/task/subject minimal en #200 ; extensions par use case | version immuable | role, task, subject policy versions |
| Agent runs | Aucun modèle ARIA canonique | primitives logs seulement | Non | modèle d'audit ARIA-G si requis | AgentRunRepository, non SSoT pédagogique | orchestrateur / gateway | audit/coût/qualité | Plateforme | Platform security | `SYSTEM_ONLY` | lier au use-case source sans porter mastery | opérationnel, politique RGPD | model decision, tools, tokens, outcome |
| Pedagogical evaluation corpus | Tests logiciels et fixtures dispersés | patterns seulement | Oui | registres versionnés séparés Nexus/RAG | Nexus conversation registry + RAG retrieval registry | revue pédagogique dans chaque repo | release reports liés par fingerprint | Équipe pédagogique | Evaluation governance | reviewers autorisés ; aucune PII brute | #200 : 19 cas conversation ; PR RAG C04 : retrieval fingerprint | versions permanentes sans PII | source/licence, rubric, reviewer, repo fingerprint |

## 13. Audits de réutilisation obligatoires

### RoadmapTask

Réutilisation non approuvée. L'audit ARIA-F doit vérifier ownership, course/period, liens goal/Evidence, ordering, dépendances, état, récurrence, reason codes, visibilité, expiration et capacité à reconstruire un plan. Le modèle actuel est exclusivement enfant d'un `RemediationRoadmap` NPC et ne possède aucun write runtime prouvé.

### CopySubmission et PedagogicalReport

Réutilisation prometteuse mais non prouvée. L'audit ARIA-G doit couvrir :

- dépôt autonome par l'élève et ownership des fichiers ;
- AI draft versus rapport humain validé ;
- transitions d'état et concurrence ;
- règles de visibilité et publication ;
- barème, notation et contestation ;
- conservation, purge et traçabilité.

Le runtime actuel prouve une création staff-only via `/api/npc/submissions`, des fichiers contrôlés par taille/SHA-256 et un rapport `DRAFT`/`COACH_ONLY`. Il ne prouve ni une route `POST /api/submissions`, ni un write élève autonome, ni le chiffrement applicatif, ni une publication parent, ni une rétention automatique de deux ans.

## 14. Évaluation pédagogique

La CI logicielle démontre la conformité du code ; elle ne démontre pas la qualité pédagogique.

Un corpus ARIA versionné, sans PII brute, couvre :

- tutoring : exactitude, étayage, adaptation, respect du niveau de dévoilement ;
- retrieval : recall/precision, couverture, fidélité des citations, traitement des états RAG ;
- generation : alignement curriculum, solvabilité, difficulté, cohérence corrigé/barème ;
- correction : extraction, accord au barème, qualité du feedback, taux d'acceptation/édition humaine.

Chaque cas contient task, course, contexte minimal, ressources autorisées, sortie/rubric attendue, politiques applicables et provenance. Les résultats enregistrent version du corpus, policy, prompt, provider/model et reviewers. Les seuils de release sont approuvés pédagogiquement et restent séparés des tests unitaires/intégration/E2E.

PR #200 crée la commande `aria:evaluate`, son contrat et les 19 cas Nexus de conversation end-to-end. Le PR RAG compagnon C04 possède séparément la suite retrieval/corpus et publie son fingerprint ; Nexus le référence sans dupliquer les cas RAG. Un mode fixture déterministe valide chaque schéma en CI ; le mode fournisseur, revu humainement, est un gate de go-live séparé. Les lots suivants ajoutent leurs cas avant d'activer leur use case.

## 15. Frontières de modules enforceables

Les invariants sont protégés par structure et tests d'architecture :

```text
app/api/aria/**
  may import → lib/aria/application/<use-case>/public
  may not import → internal, repositories, prompt, rag, gateway, providers

application/<use-case>
  may import → kernel public policies + domain ports
  owns → orchestration and use-case repository contract

infrastructure
  owns → Prisma repositories, RAG adapters, provider SDKs, outbox adapters

manifests
  owns → capability, resource and RAG declarations
```

Gates prévus :

- `no-restricted-imports` ciblé ;
- tests AST/import graph sur routes, provider SDK et Prisma writes ;
- barrels publics explicites, modules `internal` non exportés ;
- test garantissant que seul le gateway importe les SDK fournisseurs ;
- test garantissant que chaque agrégat ARIA n'est écrit que par son repository propriétaire : `ConversationRepository`, `LearningProfileRepository` ou `FeedbackRepository` ;
- test garantissant que les mappings course/corpus/resource n'existent que dans leurs manifestes ;
- test garantissant qu'aucune route n'accepte ou ne transmet un `studentId` arbitraire ;
- test garantissant que SSE/JSON n'implémentent aucune étape métier.

Le dépôt possède déjà des tests d'architecture fondés sur un scan AST ; ce motif est réutilisable sans ajouter une dépendance. Les types opaques complètent ces frontières mais ne les remplacent pas.

## 16. Limites des lots proposées

### PR #200 — Conversation Foundation

- `runConversation` seul cas d'usage génératif et seul pipeline RAG/prompt/model/persistance ;
- queries/commands dédiées pour courses, history, profile/preferences et feedback, sans génération ;
- actor/subject avec route élève `subject=self` ;
- migration fail-closed vers entitlement générique ARIA + course scopes, puis suppression du runtime legacy ;
- Global Safety Policy séparée de la politique `TUTOR` ;
- registres versionnés minimaux `Tutor role × TUTOR task × subject policy` ;
- retrieval policy résolue avec task/course/resource/agent ;
- gateway par capabilities et configuration fail-closed ;
- interface Resource Registry + manifeste validé pour les ressources actuelles, liés à une RAG Manifest ; les backends generated/personal restent ARIA-F ;
- idempotence, concurrence mono-génération par conversation et replay ;
- transitions persistées et recovery autonome via primitives outbox/scheduler ;
- `academicContextSnapshot` versionné sur chaque turn comme pont vers ARIA-D ;
- visibilité `STUDENT_PRIVATE` par défaut ;
- frontend, history, feedback et SSE canoniques ;
- préférences strictes pin/focus/order/showCitations sans gate académique, consommées par le client unifié ;
- capabilities dérivées de preuves réelles, jamais de flags statiques ;
- architecture tests enforceables ;
- corpus Nexus de 19 conversations et référence au fingerprint retrieval du PR RAG C04 ;
- documentation/matrice de couverture sans revendication 100 %.

### ARIA-C — Cockpit et workspaces

- cockpit dérivé automatiquement de l'Academic Map ;
- cockpit complet et navigation matière réutilisant pin/focus/order livrés dans #200 ;
- affichage séparé academic relevance, entitlement et capability ;
- surfaces de visibilité, sans rendre les conversations brutes parent/coach visibles.

### ARIA-D — Academic Temporal Model

- `AcademicPeriod` / `StudentAcademicPeriod` ;
- inventaire complet des dimensions variables ;
- modèle sémantique approuvé pour langues, scolarisation, candidature, session et historique ;
- migration de l'état courant vers des snapshots historiques ;
- rattachement des faits d'apprentissage à leur période ;
- mesures séparées représentation/capability.

### ARIA-E — Evidence et décision

- Evidence immuable multi-source ;
- mastery projections reconstruisibles ;
- goals après audit de `Trajectory` ;
- learning journey ;
- `recommendNextActions` déterministe, reason-coded ;
- phases OBSERVE, DIAGNOSE, DECIDE, ASSESS, REFLECT et ADAPT.

### ARIA-F — Ressources, pratique et plan

- `generateResource` asynchrone dans le Resource Registry ;
- `runPractice` et tentatives ;
- `buildPlan` après audit de `RoadmapTask` ;
- jobs outbox, retries, quarantine et évaluations pédagogiques associées.

### ARIA-G — Submissions, corrections et agents

- audit puis migration de `CopySubmission` / `PedagogicalReport` ;
- `correctSubmission` asynchrone ;
- AI draft versus validation humaine ;
- AgentRun, tools et rôles spécialisés ajoutés au kernel minimal de #200, composés rôle × subject policy ;
- visibilité/publication et corpus d'évaluation correction.

## 17. Assertions honnêtes à cette baseline

```text
DATA_MODEL_MATRIX_VERSIONED=YES_V2_DESIGN
DATA_MODEL_MATRIX_IMPLEMENTED=PR_200_CONVERSATION_FOUNDATION_ONLY
ACADEMIC_MAP_REPRESENTATION_COVERAGE=INCOMPLETE
ARIA_CAPABILITY_COVERAGE=INCOMPLETE_AND_SEPARATE
CANDIDAT_LIBRE_COVERAGE=NOT_PROVEN
LANGUAGE_CHOICE_MODEL=NOT_APPROVED_PENDING_DIMENSION_INVENTORY
EVIDENCE_SSoT=IMMUTABLE_FACT_TARGET
MASTERY_SSoT=REBUILDABLE_PROJECTION_TARGET
ROADMAPTASK_REUSE=NOT_APPROVED_PENDING_AUDIT
COPY_REPORT_REUSE=PROMISING_PENDING_LIFECYCLE_AUDIT
ARIA_B_ZERO_DEBT_NOT_READY
```
