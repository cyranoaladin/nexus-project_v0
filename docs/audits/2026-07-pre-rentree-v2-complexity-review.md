# Pré-rentrée 2026 — revue de complexité du schéma V2

## Date, baseline et verdict

- Date : 11 juillet 2026.
- Baseline : `99c4baa945447b00e82138e21915b02ab601e8b9` sur `plan/pre-rentree-2026-m0-m3`.
- Schéma analysé : 40 modèles et 35 enums de [la conception physique](../specs/pre-rentree-2026-physical-schema-v2.md).
- Verdict : **le noyau M1 est ramené à 21 modèles et 19 enums ; il n'est pas inutilement volumineux**.

Le nombre brut de tables surestime la complexité réelle : M1 contient dix agrégats racines, six tables de jointure/ligne et cinq tables de preuve ou d'intégrité. Dix-sept modèles restent différés derrière des gates ; aucune route ne pourra présumer leur existence.

## Catégories

- `LAUNCH_CRITICAL` : indispensable au produit publiable, mais pas nécessairement créé en M1.
- `REQUIRED_BEFORE_PUBLICATION` : nécessaire avant exposition publique ou avant le premier cours concerné.
- `DEFERRED_WITH_EXPLICIT_GATE` : ajout ultérieur additif, fonctionnalité interdite jusque-là.
- `REDUNDANT_OR_MERGE_CANDIDATE` : suppression/fusion recommandée.

## Revue des 40 modèles

| # | Modèle | Catégorie | Lot cible | Justification/dépendances | Risque de report / surmodélisation | Décision |
|---:|---|---|---|---|---|---|
| 1 | `PreRentreeEdition` | LAUNCH_CRITICAL | M1 | racine, période, fuseau, versions, flags | aucun produit V2 sans elle / faible | retenir M1 |
| 2 | `PreRentreeModule` | LAUNCH_CRITICAL | M1 | 12 modules, niveau×matière, durée | aucune sélection fiable / faible | retenir M1 |
| 3 | `PreRentreeVariant` | LAUNCH_CRITICAL | M1 | parcours EDS/voie/options évolutifs | fusion académique implicite / faible | retenir M1 comme table, pas enum |
| 4 | `PreRentreeModuleVariant` | LAUNCH_CRITICAL | M1 | M:N module–variante | variante impossible à rattacher / faible | retenir M1 |
| 5 | `PreRentreeCompatibilityRule` | REQUIRED_BEFORE_PUBLICATION | M4 | fusion versionnée et arbitrage | aucune fusion autorisée avant / moyen si anticipé | différer ; gate PED |
| 6 | `PreRentreeCohort` | LAUNCH_CRITICAL | M1 | capacité et état opérationnel | aucun groupe réel / faible | retenir M1 |
| 7 | `PreRentreeCohortVariant` | LAUNCH_CRITICAL | M1 | cohorte typée ; M:N futur | sans elle, fusion silencieuse / faible | retenir, une variante/cohorte jusqu'à M4 |
| 8 | `PreRentreeSession` | LAUNCH_CRITICAL | M1 | cinq séances et ressources effectives | planning non matérialisable / faible | retenir M1 |
| 9 | `PreRentreeSite` | LAUNCH_CRITICAL | M1 | site/fuseau Mutuelleville | salle sans portée / faible | retenir M1 |
| 10 | `PreRentreeRoom` | LAUNCH_CRITICAL | M1 | FK séance et exclusion M2 | pas de collision salle / faible | retenir M1 |
| 11 | `PreRentreeEquipment` | REQUIRED_BEFORE_PUBLICATION | M4 | inventaire NSI/PC | cohorte équipement-dépendante bloquée / moyen | différer, gate NSI/PC |
| 12 | `PreRentreeRoomEquipment` | REQUIRED_BEFORE_PUBLICATION | M4 | quantité par salle | validation logistique impossible / faible une fois équipement retenu | différer |
| 13 | `PreRentreeRoomBlackout` | REQUIRED_BEFORE_PUBLICATION | M4 | indisponibilités | planning doit rester DRAFT sans contrôle / moyen | différer, gate ROOM |
| 14 | `PreRentreeTeacherQualification` | REQUIRED_BEFORE_PUBLICATION | M4 | matière/niveau/période | confirmation interdite / faible | différer, gate STAFF |
| 15 | `PreRentreeTeacherAvailability` | REQUIRED_BEFORE_PUBLICATION | M4 | disponibilité temporelle | confirmation interdite / moyen | différer, gate STAFF |
| 16 | `PreRentreeTeacherAssignment` | LAUNCH_CRITICAL | M1 | FK coach–cohorte, rôle primaire | aucune responsabilité de séance / faible | retenir M1 |
| 17 | `PreRentreeStaffGrant` | LAUNCH_CRITICAL | M5 | portée staff V2 par édition | aucune API V2 staff avant création / moyen si M1 | différer derrière SEC/API |
| 18 | `PreRentreeGuardianRelationship` | LAUNCH_CRITICAL | M3 | M:N vérifié parent–élève | aucune inscription/lecture parent V2 / faible | retenir M3 |
| 19 | `PreRentreeApplication` | LAUNCH_CRITICAL | M1 | demande sans compte, PII minimale | aucun tunnel public / faible | retenir M1 |
| 20 | `PreRentreeConsentEvidence` | LAUNCH_CRITICAL | M1 | preuve versionnée distincte | consentement improuvable / faible | retenir M1 |
| 21 | `PreRentreeApplicationSelection` | LAUNCH_CRITICAL | M1 | 1–4 variantes demandées | multi-matières impossible / faible | retenir M1 |
| 22 | `PreRentreeProposal` | LAUNCH_CRITICAL | M1 | snapshot prix/CGV immuable | engagement réinterprétable / faible | retenir M1 |
| 23 | `PreRentreeProposalItem` | LAUNCH_CRITICAL | M1 | lignes module/variante/durée | JSON générique sinon / faible | retenir M1 |
| 24 | `PreRentreeEnrollment` | LAUNCH_CRITICAL | M1 | contrat élève–édition | concepts demande/paiement confondus sinon / faible | retenir M1 ; writes bloqués jusqu'à M3 |
| 25 | `PreRentreeEnrollmentModule` | LAUNCH_CRITICAL | M1 | sélection contractuelle immuable | affectation ne prouve pas le pack / faible | retenir M1 |
| 26 | `PreRentreeCohortAssignment` | LAUNCH_CRITICAL | M1 | place confirmée distincte du contrat | capacité impossible à prouver / faible | retenir M1 |
| 27 | `PreRentreeSeatHold` | LAUNCH_CRITICAL | M1 | place temporaire/idempotence | course paiement/capacité / faible | retenir M1, durée externe |
| 28 | `PreRentreeWaitlistEntry` | REQUIRED_BEFORE_PUBLICATION | M5 | attente/promotion | public full doit refuser sans inscription en attente / moyen | différer, gate CAP-WAITLIST |
| 29 | `PreRentreePayment` | LAUNCH_CRITICAL | M9 | argent V2 millimes | aucune collecte publique / moyen en M1 | différer, gate PAYMENT |
| 30 | `PreRentreePaymentEvent` | LAUNCH_CRITICAL | M9 | déduplication webhook | paiement non activable / faible avec Payment | différer |
| 31 | `PreRentreeRefund` | REQUIRED_BEFORE_PUBLICATION | M9 | remboursement distinct | paiement public interdit / faible | différer, gates LEGAL/PAYMENT |
| 32 | `PreRentreeAttendance` | REQUIRED_BEFORE_PUBLICATION | M7 | présence par séance | premier cours sans suivi / moyen en M1 | différer avant début des cours |
| 33 | `PreRentreePedagogicalReport` | DEFERRED_WITH_EXPLICIT_GATE | M7+ | bilan publié par audience | bilan indisponible, contrat non affecté / moyen | différer, gate REPORT |
| 34 | `PreRentreeDocumentLink` | DEFERRED_WITH_EXPLICIT_GATE | M7+ | portée V2 de `UserDocument` | supports V2 interdits / moyen | différer, gate DOCUMENT |
| 35 | `PreRentreeArbitration` | REQUIRED_BEFORE_PUBLICATION | M4 | décision de fusion/dédoublement | variantes incompatibles restent bloquées / faible | différer, gate PED |
| 36 | `PreRentreeCommunication` | REQUIRED_BEFORE_PUBLICATION | M9 | trace ancienne date/ouverture/remboursement | campagne corrective impossible / faible | différer, gate COMM |
| 37 | `PreRentreeOutboxEvent` | REQUIRED_BEFORE_PUBLICATION | M9 | atomicité effets externes | aucune notification fiable / faible | différer ; aucun side effect avant |
| 38 | `PreRentreeAuditEvent` | LAUNCH_CRITICAL | M1 | transitions/identité/capacité minimisées | actions sensibles non traçables / faible | retenir M1 |
| 39 | `PreRentreeMaterializationRun` | LAUNCH_CRITICAL | M1 | apply/checksum/idempotence | seed non prouvable / faible | retenir M1 |
| 40 | `PreRentreeStudentScheduleClaim` | LAUNCH_CRITICAL | M2 | exclusion élève inter-tables | collision élève possible / faible | retenir M2 |

## Revue des 35 enums

| Enum | Catégorie | Lot | Justification et décision |
|---|---|---|---|
| `PreRentreeLifecycleStatus` | LAUNCH_CRITICAL | M1 | cycle édition fermé ; retenir |
| `PreRentreePublicationStatus` | LAUNCH_CRITICAL | M1 | axe orthogonal fermé ; retenir |
| `PreRentreeModuleStatus` | LAUNCH_CRITICAL | M1 | cycle module ; retenir |
| `PreRentreeValidationStatus` | LAUNCH_CRITICAL | M1 | validation cohorte/affectation ; retenir |
| `PreRentreeCohortStatus` | LAUNCH_CRITICAL | M1 | cycle cohorte ; retenir |
| `PreRentreeModality` | LAUNCH_CRITICAL | M1 | présentiel/en ligne fermés, hybride interdit ; retenir |
| `PreRentreeVariantKind` | LAUNCH_CRITICAL | M1 | dimensions stables ; retenir, variantes elles-mêmes en table |
| `PreRentreeMathOption` | LAUNCH_CRITICAL | M1 | NONE/EXPERTES/COMPLEMENTAIRES fermés ; retenir |
| `PreRentreeCompatibilityOutcome` | LAUNCH_CRITICAL | M1 | statut de qualification demande ; retenir |
| `PreRentreeApplicationStatus` | LAUNCH_CRITICAL | M1 | machine demande ; retenir |
| `PreRentreeProposalStatus` | LAUNCH_CRITICAL | M1 | snapshot/offre ; retenir |
| `PreRentreeEnrollmentStatus` | LAUNCH_CRITICAL | M1 | contrat, sans PAID ; retenir |
| `PreRentreeAssignmentStatus` | LAUNCH_CRITICAL | M1 | place confirmée/transfert ; retenir |
| `PreRentreeSeatHoldStatus` | LAUNCH_CRITICAL | M1 | hold terminal ; retenir |
| `PreRentreeSessionStatus` | LAUNCH_CRITICAL | M1 | statut actif des exclusions ; retenir |
| `PreRentreeMaterializationStatus` | LAUNCH_CRITICAL | M1 | run idempotent ; retenir |
| `PreRentreeMaterializationCommand` | LAUNCH_CRITICAL | M1 | vocabulaire CLI fermé ; retenir |
| `PreRentreeResourceStatus` | LAUNCH_CRITICAL | M1 | site/salle ; retenir |
| `PreRentreeTeacherAssignmentRole` | LAUNCH_CRITICAL | M1 | PRIMARY/SUBSTITUTE/ASSISTANT ; retenir |
| `PreRentreeGuardianRelationType` | LAUNCH_CRITICAL | M3 | type légal fermé pour V1 ; retenir |
| `PreRentreeGuardianVerificationStatus` | LAUNCH_CRITICAL | M3 | machine d'autorité ; retenir |
| `PreRentreeWaitlistStatus` | REQUIRED_BEFORE_PUBLICATION | M5 | créé avec waitlist |
| `PreRentreeWaitlistPriority` | REQUIRED_BEFORE_PUBLICATION | M5 | priorité auditée |
| `PreRentreePaymentStatus` | LAUNCH_CRITICAL | M9 | paiement orthogonal |
| `PreRentreePaymentPurpose` | LAUNCH_CRITICAL | M9 | acompte/solde/full |
| `PreRentreeRefundStatus` | REQUIRED_BEFORE_PUBLICATION | M9 | remboursement séparé |
| `PreRentreeAttendanceStatus` | REQUIRED_BEFORE_PUBLICATION | M7 | présence fermée |
| `PreRentreeArbitrationType` | REQUIRED_BEFORE_PUBLICATION | M4 | décisions owner fermées |
| `PreRentreeArbitrationStatus` | REQUIRED_BEFORE_PUBLICATION | M4 | cycle arbitrage |
| `PreRentreeCommunicationStatus` | REQUIRED_BEFORE_PUBLICATION | M9 | preuve de livraison |
| `PreRentreeCommunicationChannel` | REQUIRED_BEFORE_PUBLICATION | M9 | canaux approuvés |
| `PreRentreeOutboxStatus` | REQUIRED_BEFORE_PUBLICATION | M9 | worker/retry |
| `PreRentreeStaffRole` | LAUNCH_CRITICAL | M5 | rôles V2 par édition |
| `PreRentreeReportStatus` | DEFERRED_WITH_EXPLICIT_GATE | M7+ | bilan |
| `PreRentreeDocumentAudience` | DEFERRED_WITH_EXPLICIT_GATE | M7+ | document |

## Champs JSON conservés

| Champ | Justification | Schéma/version obligatoires |
|---|---|---|
| `ApplicationSelection.constraints` | contraintes de disponibilité hétérogènes, non contractuelles | `ApplicationSelectionConstraintsV1Schema`, propriété `_schemaVersion: 1` |
| `Proposal.discountSnapshot` | trace structurée des remises | `DiscountSnapshotV1Schema`, `_schemaVersion: 1` |
| `Proposal.snapshotPayload` | snapshot canonique immuable/checksummé | `PricingSnapshotV1Schema`, `schemaVersion: 1` |
| `AuditEvent.metadata` | détails minimisés dépendant de l'action | union discriminée `AuditMetadataV1Schema`, `_schemaVersion: 1` |
| `MaterializationRun.plan/result` | plan et résultat de commande versionnés | `MaterializationPlanV1Schema`/`MaterializationResultV1Schema`, `schemaVersion: 1` |

Tout JSON inconnu, sans version ou ne passant pas Zod est refusé. Les JSON des 17 modèles différés seront décidés avec leur lot ; ils ne sont pas créés anticipativement.

## Périmètre arrêté

| Résultat | Nombre |
|---|---:|
| modèles M1 | **21** |
| modèles M2 | **1** |
| modèles M3 | **1** |
| modèles différés | **17** |
| modèles supprimés/fusionnés | **0** |
| enums M1 | **19** |
| enums M2 | **0** |
| enums M3 | **2** |
| enums requis M0–M3 | **21** |
| enums différés | **14** |

## Gates de report

- aucune API V2 staff avant `PreRentreeStaffGrant` ou politique temporaire strictement admin testée ;
- aucune fusion de variantes avant règle/arbitrage ; M1 impose une seule variante par cohorte ;
- aucune waitlist publique avant son modèle ; capacité pleine retourne une erreur explicite ;
- aucun paiement/remboursement avant M9 ;
- aucune notification externe avant outbox/communication ;
- aucune confirmation cohorte avant qualifications, disponibilités et équipements ;
- aucune présence, document ou bilan avant leurs lots.

Le schéma n'est donc pas bloqué par sa complexité : M1 ne crée aucune table hypothétique et les fonctionnalités différées sont fail-closed.
