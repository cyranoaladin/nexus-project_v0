# Pré-rentrée 2026 — services et frontières d'écriture

## Architecture

`route/Server Action → guard → Zod → policy → command/query service → Prisma`. React, routes et dashboards n'importent jamais Prisma. Une route orchestre HTTP seulement ; un service commande possède les invariants et transactions. Les query services retournent des DTO, jamais des modèles Prisma.

## Services de commande

| Service | Méthodes et entrées principales | Écritures/transaction | Dépendances autorisées | Événements/erreurs/idempotence | Autorisation et tests |
|---|---|---|---|---|---|
| `editionService` | `transitionEdition(command)`, `transitionPublication`, `archiveEdition` | `Edition`, audit/outbox ; transaction par commande | authorization, audit, outbox | `EDITION_*`, invalid state/gate ; `commandId` | admin ; transitions, gates, optimistic version |
| `templateMaterializationService` | `validate(template)`, `plan(template)`, `apply(plan,checksum)`, `verify(code)`, `logicalRollback` | édition, modules, variantes, règles, cohortes, séances, run ; `SERIALIZABLE` + advisory lock | pricing lecture, scheduling validation, audit | checksum/duplicate/immutable ; clé `(code,checksum,command)` | admin technique ; second apply, concurrence, rollback |
| `moduleService` | `activateModule`, `inactivateModule`, `registerCompatibilityRule` | modules/variantes/règles ; transaction | authorization, audit | `MODULE_*`, incompatible dimensions | responsable pédagogique ; terminologie/règles |
| `cohortService` | `createCohort`, `assignTeacher`, `validatePedagogy`, `validateLogistics`, `confirmCohort`, `cancelCohort` | cohorte, variantes, teacher assignments ; confirmation sous lock | scheduling, capacity lecture, arbitration, audit/outbox | resource/gate/conflict | rôles séparés ; ressources, seuil, état |
| `schedulingService` | `createSession`, `moveSession`, `replaceSession`, `cancelSession`, `verifySchedule` | séances, rooms/resources, claims lors déplacement via capacity ; transaction | authorization, audit/outbox | contraintes planning traduites | staff autorisé ; collisions, UTC/date civile, charges |
| `capacityService` | `createHolds`, `convertHolds`, `releaseHold`, `assign`, `transfer`, `joinWaitlist`, `promoteNext`, `expireBatch`, `rebuildClaims` | holds, assignments, waitlist, schedule claims, audit/outbox sous locks | scheduling validation, authorization | full/expired/conflict ; clés persistées | assistant/admin ou commande système ; tests concurrence |
| `applicationService` | `submitPublic`, `qualify`, `withdraw`, `reject`, `linkCandidate`, `requestProposal` | application, selections, consent ; transaction | academic rules, authorization, pricing orchestré | duplicate/contact/compatibility | public rate-limit ou staff ; minimisation/idempotence |
| `enrollmentService` | `acceptProposal`, `createEnrollment`, `confirm`, `cancel`, `complete`, `archive` | enrollment/modules ; transaction + audit/outbox | guardian, capacity, payment lecture, authorization | relationship/contract/state | parent/staff ; aucune dual-write, contrat immuable |
| `guardianRelationshipService` | `proposeMatch`, `verify`, `reject`, `revoke`, `expire`, `mergeIdentityControlled` | relationship, audit/outbox | authorization, identity provider | unverified/conflict/duplicate | assistant/admin ; M:N, aucune égalité email seule |
| `pricingService` | `quote(selection,catalogVersion)`, `issueProposal`, `verifySnapshot`, `invoiceFromEnrollment` | proposition/items ; facture via adaptateur transactionnel dédié | `lib/pricing.ts`, authorization, audit/outbox | catalog/rounding/floor/checksum | serveur/staff ; 1–4 packs, client price ignored |
| `paymentReconciliationService` | `initiate`, `handleVerifiedWebhook`, `reconcile`, `markFailed` | payment/events, audit/outbox ; transaction | provider adapter, pricing snapshot, authorization | signature avant appel, amount/currency mismatch | public parent pour initier ; finance pour manuel ; duplicate webhook |
| `refundService` | `request`, `approve`, `initiate`, `handleResult`, `cancel` | refund, audit/outbox ; transaction | payment, policy snapshot, provider adapter | cap/policy/idempotence | parent demande, finance exécute ; total/partiel |
| `attendanceService` | `recordAttendance`, `correctAttendance` | présences, audit/outbox | authorization | assignment/session/state | coach affecté/pédagogie ; correction motivée |
| `pedagogicalReportService` | `saveDraft`, `publish`, `withdraw`, `archive` | rapports uniquement, audit/outbox | authorization, attendance lecture | audience/state/version | coach affecté/pédagogie ; contenus séparés et publication |
| `documentService` | `linkDocument`, `archiveLink`, `authorizeDownload`, `issueSignedAccess` | `DocumentLink` uniquement ; `UserDocument` via service documentaire existant | authorization, storage adapter, audit | invalid audience/scope/storage | uploader autorisé ; path traversal, IDOR, URL expirée |
| `arbitrationService` | `open`, `review`, `decide`, `supersede`, `close` | arbitration, cohort variants/rule links seulement via commande approuvée, audit/outbox | academic rules, authorization | authority/rule/version/state | responsable pédagogique ; incompatibilité par défaut |
| `communicationService` | `plan`, `queue`, `cancel`, `recordDelivery`, `recordFailure` | communication/outbox, audit | template registry, authorization | recipient/template/channel | staff par finalité ; paramètres minimisés, retry |
| `authorizationService` | `authorizeV2`, `scopeV2Query`, `grantStaffRole`, `revokeStaffRole` | grants et audit seulement pour grant/revoke | auth session | fail-closed/forbidden/not-found scope | admin ; matrice exhaustive/IDOR |
| `auditService` | `append(tx,event)` | audit append-only dans transaction appelante | aucune dépendance métier | erreur audit = rollback pour actions obligatoires | service interne ; redaction, immutabilité |
| `outboxService` | `append(tx,event)`, `claimBatch`, `deliver`, `fail`, `deadLetter` | outbox ; append dans transaction appelante, worker séparé | adapters email/WhatsApp/dashboard/analytics | lease/retry/idempotence | interne ; workers concurrents, poison message |

`attendanceService` n'écrit que les présences ; les méthodes bilan sont la responsabilité de `pedagogicalReportService`. `pricingService` est le nom domaine ; son accès catalogue passe exclusivement par les getters actuels/futurs de `lib/pricing.ts`. Aucun second moteur tarifaire n'est créé.

## Query services

| Service | Méthodes | Source/portée | DTO/cache |
|---|---|---|---|
| `publicStageQueryService` | `getEditionLanding(slug)`, `getConfigurator(slug)`, `getAvailability(slug,selections)` | édition/modules/cohortes publiés ; aucune PII | `PublicEditionV2Dto`, cache court/tag édition ; capacité recalculée |
| `adminStageQueryService` | `listEditions`, `getOperations`, `getConflicts`, `getAudit` | grant/admin, édition entière, pagination | DTO admin versionné, pas de cache partagé |
| `pedagogicalStageQueryService` | `getVariants`, `getArbitrations`, `getCohorts`, `getReports` | grant pédagogique édition | DTO pédagogie, PII minimale |
| `coachStageQueryService` | `getMyCohorts`, `getSessionRoster`, `getResources` | affectation active incluse dans chaque requête | DTO coach sans finance/famille |
| `parentStageQueryService` | `getChildren`, `getChildEnrollment`, `getPayments`, `getCommunications` | relation vérifiée active et droits | DTO parent, cache privé/no-store pour finance |
| `studentStageQueryService` | `getMySchedule`, `getResources`, `getAttendance`, `getReports` | `Student.userId` | DTO élève sans finance |
| `roomInventoryQueryService` | `listSites`, `getRoomAvailability`, `verifyRequirements` | staff logistique/admin | inventaire, pas public sauf libellé affecté |

## Règles transactionnelles

- Un service ne passe jamais un client Prisma global à un sous-service qui démarrerait une seconde transaction ; il transmet un `TransactionContext` explicitement typé.
- Ordre global de locks : édition → cohortes triées → holds/assignments → paiements ; jamais l'inverse.
- Audit/outbox reçoivent le même transaction client.
- Les appels réseau (email, WhatsApp, fournisseur de paiement) sont hors transaction, pilotés par outbox. La vérification cryptographique webhook est avant transaction ; aucune confirmation fournisseur sortante sous lock.
- Les retries n'englobent que les erreurs PostgreSQL transitoires identifiées et rejouent la même clé d'idempotence.

## Propriété exclusive des modèles

Un modèle a un seul propriétaire principal. Exception bornée : `templateMaterializationService` possède un droit bootstrap sur édition, modules, variantes, règles, cohortes et séances tant que l'édition est DRAFT et inutilisée ; après `materializedAt`, il ne peut plus les muter et les services métier deviennent seuls propriétaires. Les autres collaborations sont commandées, pas des écritures libres : `cohortService` demande au `schedulingService` les séances ; `enrollmentService` appelle `capacityService`; `communicationService` ne change jamais l'agrégat d'origine. `auditService` et `outboxService` écrivent seulement leurs tables. Un test d'architecture recherche `prisma.preRentree*.(create|update|delete)` hors dossiers propriétaires/bootstrap/migrations.

## Erreurs métier communes

`NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE_TRANSITION`, `VALIDATION_FAILED`, `IDEMPOTENCY_CONFLICT`, `CONCURRENT_MODIFICATION`, `COHORT_FULL`, `SEAT_HOLD_EXPIRED`, `SCHEDULE_CONFLICT`, `RESOURCE_REQUIREMENT_UNMET`, `UNVERIFIED_GUARDIAN_RELATIONSHIP`, `PRICING_INVARIANT_VIOLATION`, `PAYMENT_RECONCILIATION_REQUIRED`, `TEMPLATE_IMMUTABLE_AFTER_USE`.

Les routes traduisent ces codes selon [les contrats API/DTO](pre-rentree-2026-api-dto-contracts.md), sans exposer SQL, stack, chemins ou PII.
