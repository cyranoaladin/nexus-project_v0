# Pré-rentrée 2026 — DTO et contrats API futurs

## Convention commune

- Préfixe futur : `/api/v2/pre-rentree`; aucune route n'est créée dans cette phase.
- Entrées : schémas Zod `strict()`, IDs opaques, dates ISO strictes, limites de taille.
- Sorties : enveloppe `{ data, meta:{ apiVersion:"2026-07", requestId } }` ou `{ error:{ code,message,requestId,fieldErrors? } }`.
- Tous les DTO V2 portent `domain: "EDITION_V2"`; les listes mixtes portent le discriminant `LEGACY_STAGE | EDITION_V2` par élément.
- `Idempotency-Key` obligatoire pour toute commande publiquement répétable ou financière. Son hash et le hash du payload sont persistés ; jamais la clé brute.
- Auth cookie : protection CSRF obligatoire sur mutations ; Bearer interne signé : audience/scope. Webhook : signature fournisseur, pas CSRF.
- Aucun modèle Prisma, chemin de stockage, secret, hash interne, email d'une autre famille ou champ financier coach/élève n'est sérialisé.

## DTO de lecture

| DTO/version | Champs | Calcul/source | Visibilité/PII | Cache/invalidation |
|---|---|---|---|---|
| `PublicEditionV2Dto@1` | domain, slug, title, timezone, period `{startDate,endDate,teachingDates}`, locationLabel, levels, subjects, packSummaries, publication | DB publiée + pricing getters serveur | public, aucune PII | public 5 min ; tags édition/catalogue |
| `PublicConfiguratorV2Dto@1` | edition, variants `{code,level,subject,label,kind}`, compatibilityRuleVersion, scheduleBlocks, constraints | DB opérationnelle + règles actives | public, aucune PII | 1 min ; invalidation module/cohorte/règle |
| `PublicPriceSummaryV2Dto@1` | productCode, catalogVersion, currency, totalMillimes, depositMillimes, balanceMillimes, subjectCount, totalMinutes, roundingLabel, checksum | pricing serveur, réponse éphémère | public, finance non personnelle | no-store ou cache clé sélection/version |
| `PublicApplicationFormV2Dto@1` | fields/rules, consentDocuments `{code,version,url}`, idempotencyRequirement | config éditoriale typée + DB édition | public | 5 min, tag consent/content |
| `PublicApplicationConfirmationV2Dto@1` | publicReference, status, selectedLabels, nextStep, contactMasked, createdAt | application après création | PII masquée, token de confirmation | privé/no-store |
| `AdminEditionOperationsV2Dto@1` | édition, modules, cohortes, sessions, resources, capacity, requests, enrollments, payment aggregates, waitlist, conflicts, gates, auditCursor | query admin scoped | PII/finance selon permission | no-store, pagination |
| `PedagogicalOperationsV2Dto@1` | variants, rules, arbitrations, cohorts, teacher qualifications, anonymized demand counts, reports | query pédagogie | pédagogique, PII nécessaire seulement | privé/no-store |
| `CoachCohortV2Dto@1` | cohort, sessions, roster `{studentId,displayName,variantLabel,learningNeeds}`, attendances, resources, reports | affectation coach active | PII/pédagogique minimisée ; aucune finance/contact parent | privé/no-store |
| `ParentStageV2Dto@1` | child, enrollment, modules, assignments, schedule, cohortStatuses, payments summary, documents, communications, reports | relation vérifiée + services parent | PII/finance propre | privé/no-store |
| `StudentStageV2Dto@1` | enrollmentLabel, modules, schedule, roomLabel, teacherDisplayName, resources, work, attendance, reports | Student propre | pédagogique ; aucune finance | privé/no-store |
| `PaymentV2Dto@1` | paymentId, enrollmentRef, purpose, status, currency, expected/received millimes, providerLabel, timestamps, refunds | payment query scoped | parent autorisé/finance/admin | no-store |
| `ScheduleV2Dto@1` | timezone, sessions `{id,localDate,startLocal,endLocal,startAt,endAt,moduleLabel,roomLabel,teacherLabel,status}`, warnings | DB + formatter serveur IANA | selon audience | privé ; public sans IDs internes, invalidation session |
| `RoomInventoryV2Dto@1` | site, rooms `{id,code,label,capacity,type,status,equipment,blackouts}`, requirementChecks | inventaire DB | interne/logistique | cache privé court, invalidation ressource |

Les montants DTO sont des entiers millimes accompagnés de `currency`; le frontend appelle un formatter partagé sans calcul tarifaire. Les dates civiles restent `YYYY-MM-DD`; les instants sont ISO UTC et les libellés locaux sont produits serveur avec `timezone`.

## Routes publiques

Abréviations : `RL` rate limit ; `I` clé d'idempotence ; `T` transaction ; `A/O` audit/outbox. Toutes les erreurs de validation sont 422, ressource publiée absente 404.

| Méthode/chemin | Entrée Zod → sortie | Service/rôle | I/T/A/O | Sécurité, PII, retry |
|---|---|---|---|---|
| `GET /editions/:slug` | slug → `PublicEditionV2Dto` | public query/visiteur | —/lecture/— | RL lecture, cache public, 404 |
| `GET /editions/:slug/configurator` | slug → `PublicConfiguratorV2Dto` | public query/visiteur | —/lecture/— | RL, aucune PII |
| `POST /editions/:slug/quote` | 1–4 `{variantCode}` + parcours → `PublicPriceSummaryV2Dto` | pricing/public | hash requête/no write/— | RL strict, prix client interdit, 422/409 |
| `GET /editions/:slug/application-form` | slug → `PublicApplicationFormV2Dto` | public query | — | RL/cache |
| `POST /editions/:slug/applications` | contact minimal, élève, parcours, sélections, consentements → confirmation | application/visiteur | I/T/A+O | RL+anti-spam, 201 ou résultat rejoué 200, aucune création compte, PII no-store |
| `GET /applications/:publicRef/confirmation` | token signé + ref → confirmation | application/token | —/lecture/audit refus pertinent | RL, 404 sans fuite, PII masquée |
| `POST /applications/:publicRef/withdraw` | token, reason → confirmation | application/token | I/T/A+O | CSRF si cookie, 200/409 |
| `GET /editions/:slug/availability` | sélection codes → disponibilités agrégées | public query | — | RL, valeur indicative ; allocation seulement par commande |

## Routes responsable et élève

| Méthode/chemin | Entrée → sortie | Service/politique | I/T/A/O | Erreurs/PII/CSRF/retry |
|---|---|---|---|---|
| `GET /parent/children` | pagination → enfants V1/V2 discriminés | parent query/relation | lecture | 401/404, privé |
| `GET /parent/children/:studentId/stages/:editionId` | IDs → `ParentStageV2Dto` | parent query/relation vérifiée | lecture | IDOR 404, no-store |
| `POST /parent/proposals/:id/accept` | versions acceptées → parent DTO | enrollment | I/T/A+O | CSRF, 409 expirée/relation, retry même clé |
| `POST /parent/enrollments/:id/cancel` | reason/policyAck → parent DTO | enrollment | I/T/A+O | CSRF, 409 état/politique |
| `POST /parent/enrollments/:id/payments` | purpose/provider → `PaymentV2Dto` + redirect/token | payment | I/T/A+O | CSRF, RL financier, montant serveur |
| `POST /parent/payments/:id/refund-requests` | reason/choice refund-report → `PaymentV2Dto` | refund | I/T/A+O | CSRF, 202/409, aucun report précoché |
| `GET /parent/enrollments/:id/payments` | — → `PaymentV2Dto[]` | parent query | lecture | droit finance de relation, no-store |
| `GET /student/stages/:editionId` | — → `StudentStageV2Dto` | student query/propre | lecture | aucune finance, 404 IDOR |
| `GET /student/stages/:editionId/schedule` | — → `ScheduleV2Dto` | student query | lecture | no-store |
| `GET /student/documents/:linkId` | — → métadonnées + flux signé | `documentService` + policy | lecture/audit | 404 audience, URL courte |

## Routes coach et pédagogiques

| Méthode/chemin | Entrée → sortie | Service/politique | I/T/A/O | Contrôles |
|---|---|---|---|---|
| `GET /coach/cohorts` | filtres/pagination → résumés coach | coach query/assigned | lecture | aucun contact/finance |
| `GET /coach/cohorts/:id` | — → `CoachCohortV2Dto` | coach query/assigned | lecture | IDOR 404 |
| `PUT /coach/sessions/:sessionId/attendance/:assignmentId` | status, justification, expectedVersion → attendance DTO | attendance/assigned | I/T/A | CSRF, 409 état/version |
| `PUT /coach/enrollments/:id/reports/:moduleId` | contenus séparés, status draft → report DTO | pedagogical report/assigned | I/T/A | tailles Zod, aucun champ finance |
| `POST /pedagogy/arbitrations` | type, targets, ruleVersion → pedagogy DTO | arbitration/grant | I/T/A+O | CSRF, 201/409 |
| `POST /pedagogy/arbitrations/:id/decision` | decision, rationale, impact → DTO | arbitration/RESPONSABLE_PEDAGOGIQUE | I/T/A+O | autorité exacte, confirmation |
| `POST /pedagogy/cohorts/:id/validate` | validation, evidence → cohort DTO | cohort/grant | I/T/A | séparation logistique |
| `POST /pedagogy/cohorts/:id/teachers` | coachId, role, period, qualification → cohort DTO | cohort/grant | I/T/A | ID coach re-filtré, collision |
| `POST /pedagogy/reports/:id/publish` | expectedVersion → report DTO | pedagogical report/grant | I/T/A+O | audience validée |

## Routes administratives et logistiques

| Méthode/chemin | Entrée → sortie | Service/politique | I/T/A/O | Contrôles |
|---|---|---|---|---|
| `GET /admin/editions/:id/operations` | filtres/cursors → admin DTO | admin query/grant | lecture/audit export si demandé | pagination, no-store |
| `POST /admin/cohorts` | module, variants, capacities, modality → cohort DTO | cohort/staff | I/T/A | CSRF, 201/422 |
| `POST /admin/cohorts/:id/confirm` | expectedVersion → cohort DTO | cohort/admin | I/T/A+O | toutes gates, lock, 409 |
| `POST /admin/cohorts/:id/cancel` | reason, remediation → DTO | cohort/admin | I/T/A+O | confirmation renforcée |
| `POST /admin/cohorts/:id/assignments` | enrollmentId → assignment DTO | capacity/staff | I/T/A+O | lock/collision/capacité |
| `POST /admin/assignments/:id/transfer` | targetCohortId, reason → DTO | capacity/admin | I/T/A+O | atomique deux cohortes |
| `POST /admin/cohorts/:id/waitlist/promote` | entryId/auto → DTO | capacity/staff | I/T/A+O | ordre/priorité auditée |
| `POST /admin/sessions` | cohort/date locale/bloc/teacher/room → schedule DTO | scheduling/staff | I/T/A | conversion serveur/DB exclusion |
| `PATCH /admin/sessions/:id` | expectedVersion + patch permis → DTO | scheduling/staff | I/T/A+O si public | pas de mutation template implicite |
| `GET /admin/resources/rooms` | filtres → `RoomInventoryV2Dto` | room query/staff | lecture | interne |
| `POST /admin/resources/rooms/:id/validate` | requirements/evidence → DTO | scheduling/logistique | I/T/A | équipement/capacité |
| `POST /admin/guardian-relationships/:id/verify` | evidence, rights, period → relation DTO | guardian/staff | I/T/A+O | aucune égalité email seule |
| `POST /admin/guardian-relationships/:id/revoke` | reason → DTO | guardian/admin | I/T/A+O | confirmation/impact accès |
| `GET /admin/audit` | edition/resource/cursor → audit DTO | admin query/permission audit | lecture auditée | export séparé, metadata redacted |

## Routes financières

| Méthode/chemin | Entrée → sortie | Service/rôle | I/T/A/O | Contrôles |
|---|---|---|---|---|
| `GET /finance/enrollments/:id` | — → snapshot + paiements/remboursements | query/finance | lecture | grant édition, PII minimale |
| `POST /finance/payments/:id/reconcile` | provider evidence, decision, reason → payment DTO | reconciliation/finance | I/T/A+O | confirmation, montant/devise exacts |
| `POST /finance/refunds/:id/approve` | expectedVersion → refund DTO | refund/finance | I/T/A | politique/plafond |
| `POST /finance/refunds/:id/initiate` | provider → refund DTO | refund/finance | I/T/A+O | aucun réseau sous lock ; outbox/adapter |
| `POST /finance/enrollments/:id/invoice` | idempotency + snapshot checksum → invoice DTO existant | pricing invoice adapter/finance | I/T/A | facture millimes, unique enrollment |

## Routes internes de matérialisation

Accessibles uniquement à un admin authentifié avec permission technique, jamais au public et jamais via un secret d'URL.

| Méthode/chemin | Entrée → sortie | Transaction/audit | Statut |
|---|---|---|---|
| `POST /internal/templates/pre-rentree/validate` | template version/code ou artefact déployé → rapport | lecture ; audit commande | 200/422 |
| `POST /internal/templates/pre-rentree/plan` | code/checksum → plan | lecture | 200/409 |
| `POST /internal/templates/pre-rentree/apply` | code/checksum/acceptChecksum → run DTO | I, SERIALIZABLE/advisory lock, audit | 202/409 |
| `POST /internal/templates/pre-rentree/verify` | code/checksum → rapport | lecture | 200 ou 409 drift |
| `POST /internal/templates/pre-rentree/logical-rollback` | runId/reason → run DTO | I/T/A | 200/409 usage |

## Webhook paiement

`POST /payments/clictopay/webhook` reçoit le corps brut, headers signature/événement et aucune session. Avant parsing métier : secret configuré obligatoire, signature et anti-rejeu vérifiés. Puis Zod provider → adaptateur → `paymentReconciliationService.handleVerifiedWebhook`. Événement dupliqué exact : 200 ; signature invalide : 401 ; payload invalide : 400 ; divergence : 200 ou 409 selon contrat fournisseur mais état interne `RECONCILIATION_REQUIRED`. Rate limit adapté aux IP/provider sans bloquer les retries légitimes. Aucun payload/secret complet dans les logs.

## Cache et invalidation

Seuls landing/configurateur publiés sont cacheables publiquement. L'invalidation vient d'événements outbox `edition.publication.changed`, `module.changed`, `cohort.availability.changed`, `pricing.catalog.changed`. La capacité affichée est informative et cache très court ; l'allocation est toujours transactionnelle. Tous DTO avec PII/finance/audit : `Cache-Control: private, no-store`.

## Contrat de retry

GET sûrs répétables. POST/PUT/PATCH mutantes exigent idempotence quand un double effet est possible. 409 métier n'est pas retrié automatiquement, 429 respecte `Retry-After`, 5xx/timeout peut être répété avec même clé. Les routes n'initient jamais une seconde transaction après un timeout sans relire l'enregistrement d'idempotence.
