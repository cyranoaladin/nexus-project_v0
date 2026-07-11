# Pré-rentrée 2026 — catalogue des modèles et champs

## Références de lecture

Les types, nullabilités, valeurs par défaut, clés, index et relations exacts proposés sont dans [le schéma physique V2](pre-rentree-2026-physical-schema-v2.md). Ce catalogue explicite la sémantique, les risques, les propriétaires d'écriture, l'exposition DTO et les tests. Les suppressions ordinaires sont logiques ; toute FK historique ou financière est `Restrict` ou `SetNull`.

## Inventaire V1 vérifié

| Modèle actuel | Responsabilité et clé | Relations/contraintes utiles | Réutilisation V2 | Incompatibilité ou risque | Stratégie |
|---|---|---|---|---|---|
| `User` | identité authentifiée, `String/cuid`, email unique, rôle unique | profils parent/élève/coach, paiements, documents | acteur, staff grant, identité parent/élève/coach | rôle seul et email ne prouvent pas la portée | conserver ; ajouter seulement des back-relations V2 |
| `ParentProfile` | profil d'un utilisateur parent, `userId` unique | `children` via `Student.parentId` | identité d'un responsable vérifié | modèle V1 suppose un parent principal | conserver V1 ; V2 utilise la jointure plusieurs-à-plusieurs |
| `Student` | élève, `userId` unique, `parentId` obligatoire | niveau, voie, spécialités, stages V1 | élève canonique après liaison vérifiée | aucune option maths distincte ; cascade V1 parent/user | ne pas réinterpréter ; capturer le parcours de demande V2 séparément |
| `CoachProfile` | identité professionnelle du coach | `subjects` JSON, sessions et Stage V1 | enseignant V2 par FK | JSON ne prouve ni niveau, ni validité | qualifications et disponibilités V2 dédiées |
| `CoachAvailability` | disponibilité récurrente V1 en chaînes horaires | FK `User`, contrainte récurrence | aucune écriture ; inspiration seulement | fuseau/date civile insuffisants | disponibilités V2 en instants |
| `Session` | séance pédagogique annuelle V1 | élève/coach, statut et dates existants | aucune écriture V2 | autre agrégat et autre logique de crédits | conserver V1 |
| `SessionBooking` | réservation de créneau V1 | coach/élève/parent, contrainte d'exclusion coach `btree_gist` | preuve de capacité PostgreSQL seulement | ne porte ni cohorte Stage V2, ni salle, ni pack | conserver ; ne pas détourner |
| `SessionReport`/`StudentReport` | compte rendu de séance/suivi V1 | coach/élève et contenus historiques | lecture historique | granularité et audiences différentes | rapport V2 distinct |
| `SessionNotification`/`SessionReminder` | notification/rappel lié à session V1 | idempotence par session/utilisateur/type/canal | adaptateur consumer éventuel | aucune atomicité avec agrégat Pré-rentrée | outbox V2 reste source de livraison |
| `CoachStudentAssignment` | portée coach–élève existante | période/statut, unique actif SQL | peut rester pour les services annuels | trop large pour une cohorte V2 | V2 autorise par affectation enseignant–cohorte |
| `Stage` | produit/campagne V1 | slug, capacité globale, `Decimal(10,2)`, dates | lecture historique uniquement | agrège produit, capacité et édition | aucun lien d'écriture V2 |
| `StageSession` | séance V1 | stage en cascade, coach nullable | lecture historique uniquement | pas de salle, fuseau, collision ni état | modèle V2 distinct |
| `StageCoach` | affectation Stage V1 | unique stage/coach, cascades | aucune | portée trop globale | affectation V2 temporelle par cohorte |
| `StageReservation` | lead/réservation V1 | email+academy, prix `Float`, statuts doublement encodés | lecture historique uniquement | identité email, argent Float, concepts confondus | aucun backfill automatique |
| `StageDocument` | document Stage/session V1 | URL, visibilité booléenne | lecture historique | audience trop simple, cascade Stage | lien V2 sur `UserDocument` sécurisé |
| `StageBilan` | bilan Stage/élève V1 | unique stage/élève, contenus multiples | lecture historique | cascade et granularité stage | rapport V2 distinct |
| `Bilan` | bilan canonique V1 lié à différents parcours, Stage optionnel | statuts/types et relations actuels | lecture historique, pas d'écriture V2 initiale | signification et cycle de publication plus larges | rapport V2 séparé ; convergence ultérieure seulement par ADR |
| `Payment` | paiement générique V1 | `Float`, `TND`, externe/méthode unique partiel | adaptateur de lecture/réconciliation seulement | unité incompatible | nouveau paiement V2 en millimes ; aucune conversion implicite |
| `ClicToPayTransaction` | transaction fournisseur V1 | `Float`, order/payment uniques | webhook via adaptateur futur | signature et unité à revalider | ne pas lier comme vérité contractuelle V2 |
| `Invoice`/`InvoiceItem` | facture, montants `Int` millimes | numéro unique, items, statut, événements JSON | facture finale optionnelle d'une inscription V2 | PII snapshot et événements non normalisés | réutiliser par FK 1–1 ; générer depuis snapshot accepté |
| `InvoiceSequence`/`InvoiceAccessToken` | séquence de numérotation et accès signé facture | unicité/expiration | réutiliser via service facture existant | token brut interdit dans V2/audit | ne pas dupliquer la numérotation ou l'accès |
| `UserDocument` | stockage privé documentaire | chemin unique, propriétaire, uploader | support physique des documents V2 | règles de visibilité V1 insuffisantes | ajouter `PreRentreeDocumentLink`, renforcer guard |
| `Notification`/`SessionNotification` | notification existante | relation utilisateur et idempotence session | aucun usage direct obligatoire | pas d'atomicité avec agrégat V2 | outbox V2 puis adaptateur éventuel |
| `BusinessConfig`/`BusinessConfigAudit` | configuration opérationnelle et audit | clé unique, version/audit | flags V2 uniquement selon allowlist | source parallèle potentielle | jamais prix, dates, capacité, modules ou planning |
| `NpcAuditLog` | audit pédagogique spécialisé | portée rapport | aucun usage V2 | couverture trop étroite | audit V2 générique et minimisé |
| `CoachNote` | note coach privée sur un utilisateur | auteur/sujet, PII pédagogique | aucune exposition V2 automatique | ne doit pas fuiter dans roster/bilan | laisser V1, politique séparée |

Provider PostgreSQL ; 45 migrations présentes. Les migrations existantes montrent des cascades historiques, des index partiels et une contrainte d'exclusion `btree_gist`. Elles ne doivent pas être « nettoyées » pendant les lots V2.

Migrations particulièrement structurantes relues : `20260201201047_add_payment_idempotency`, `20260201201415_add_session_overlap_prevention`, `20260202182051_add_referential_integrity_and_indexes`, `20260218230000_add_missing_tables_diagnostics_invoices_trajectories`, `20260219_add_unique_constraints_notifications_reminders`, `20260220100000_add_user_documents`, `20260221_fix_payment_setnull`, `20260417185546_add_stage_models_extended`, `20260422081249_add_bilan_canonical`, `20260425230000_add_coach_student_assignments`, `20260503000000_add_coach_notes`, `20260621100400_create_clictopay_transactions`, `20260630212227_add_business_config` et `20260701063940_add_business_config_audit`. La migration de paiement historique ayant connu des changements de cascade puis `SetNull`, le schéma courant et la migration corrective font foi ; V2 ne réouvre pas ce passé.

## Catalogue V2 — agrégats et responsabilités

| Modèle | Responsabilité/invariants principaux | PII/classe | Archivage et suppression | Écrivain unique | DTO autorisés | Tests minimaux |
|---|---|---|---|---|---|---|
| `PreRentreeEdition` | période civile, fuseau, versions/checksum, états publication/lifecycle ; code/slug uniques | interne/public partiel | `archivedAt`, `Restrict` | `editionService` après matérialisation | public, admin, planning | dates, timezone, transitions, doublon code/slug |
| `PreRentreeModule` | réservation logistique niveau×matière ; durée/count contractuels du template | public/interne | logique | `templateMaterializationService`, puis `moduleService` | public, configurateur, tous dashboards selon portée | 12 modules, unique niveau/matière, durées positives |
| `PreRentreeVariant` | variante académique versionnée, dimensions niveau/matière/voie/option | pédagogique | inactivation | `moduleService` avec autorité pédagogique | configurateur, pédagogie, coach limité | libellés Seconde/Terminale, combinaison académique |
| `PreRentreeModuleVariant` | rattachement autorisé module–variante et défaut | pédagogique | suppression seulement avant usage | matérialisation | configurateur/admin | variante compatible avec niveau/matière |
| `PreRentreeCompatibilityRule` | résultat déclaratif par paire/version/période | pédagogique/audit | immuable après approbation | `arbitrationService` | configurateur résumé, pédagogie | symétrie canonique, version, période, refus par défaut |
| `PreRentreeCohort` | groupe réellement ouvert, capacité 3–5, validations orthogonales | interne/public partiel | statut + `archivedAt` | `cohortService` | public disponibilité, admin/pédagogie/coach/parent/élève filtrés | confirmation ressources, capacité, pas de `FULL` stocké |
| `PreRentreeCohortVariant` | variante(s) servies par la cohorte avec preuve de fusion | pédagogique | immuable après confirmation sauf arbitrage | `arbitrationService` | pédagogie/coach ; code public dérivé | fusion sans règle impossible |
| `PreRentreeSession` | séance effective, instants UTC, enseignant/salle effectifs, remplacement | pédagogique/interne | annulation/archivage | `schedulingService` | planning et dashboards filtrés | 5 séances, 120 min, collisions, remplacement |
| `PreRentreeSite` | site physique et fuseau | public/interne | logique | `schedulingService` | public libellé, inventaire/admin | code unique, timezone IANA |
| `PreRentreeRoom` | salle/capacité/type | interne ; libellé public après affectation | logique | `schedulingService` | planning, inventaire, dashboards concernés | capacité, statut, site |
| `PreRentreeEquipment` | équipement stable par code | interne | logique | `schedulingService` | inventaire/admin/pédagogie | code unique, état |
| `PreRentreeRoomEquipment` | quantité et vérification par salle | interne/logistique | historique par audit | `schedulingService` | inventaire/admin | quantité positive, NSI/PC |
| `PreRentreeRoomBlackout` | indisponibilité ponctuelle | interne | conservation auditée | `schedulingService` | inventaire/admin | intervalle, collision séance |
| `PreRentreeTeacherQualification` | preuve matière/niveau/période | personnel/pédagogique | révocation/statut | `cohortService` sous rôle pédagogique | admin/pédagogie ; coach propre profil | validité à toutes les séances |
| `PreRentreeTeacherAvailability` | disponibilité explicite en instants | personnel/interne | conservation selon politique | `schedulingService` | admin/pédagogie, coach propre | couverture, intervalle, timezone |
| `PreRentreeTeacherAssignment` | rôle enseignant dans cohorte et période | personnel/pédagogique | fin de validité | `cohortService` | admin/pédagogie/coach concerné | un primaire actif, qualification, pas de conflit |
| `PreRentreeStaffGrant` | rôle V2 et permissions par édition | sécurité/personnel | révocation | `authorizationService` | admin sécurité uniquement | portée, expiration, élévation auditée |
| `PreRentreeGuardianRelationship` | M:N parent–élève, droits et vérification | responsable légal/sensible | révocation ; jamais hard delete ordinaire | `guardianRelationshipService` | parent/admin ; booléen de portée dans autres DTO | actif/vérifié, dates, plusieurs enfants/responsables, IDOR |
| `PreRentreeApplication` | demande publique minimale sans compte | PII/personnelle | archive puis anonymisation selon règle légale | `applicationService` | confirmation publique, admin/pédagogie minimisée | idempotence, contact requis, 1–4 sélections, aucun compte créé |
| `PreRentreeConsentEvidence` | preuve versionnée et hashée de consentement | personnelle/audit | immuable | `applicationService` | admin conformité uniquement | version, horodatage, refus explicite |
| `PreRentreeApplicationSelection` | variante demandée et contraintes | pédagogique/personnelle | avec demande | `applicationService` | configurateur/confirmation/admin | unique, 1–4, compatibilité |
| `PreRentreeProposal` | offre commerciale et snapshot tarifaire immuable | financière/personnelle | annulation/expiration ; conservation engagement | `pricingService` via orchestrateur | public résumé tokenisé, parent/admin/finance | checksum, sommes, arrondi, aucune mutation après émission |
| `PreRentreeProposalItem` | module/variante/durée figés de la proposition | pédagogique/contractuelle | immuable | `pricingService` | résumé/parent/admin | unique module, codes et durée snapshot |
| `PreRentreeEnrollment` | contrat accepté, responsable, élève, édition | contractuelle/PII | annulation/archive | `enrollmentService` | parent/admin, élève sans finance, coach sans contrat | proposition acceptée, relation vérifiée, unique élève/édition |
| `PreRentreeEnrollmentModule` | modules contractuels de l'inscription | pédagogique/contractuelle | inactivation auditée | `enrollmentService` | dashboards filtrés | égalité aux items acceptés |
| `PreRentreeCohortAssignment` | affectation opérationnelle inscription–cohorte | personnelle/pédagogique | transitions, pas delete | `capacityService` | dashboards filtrés | unique, capacité, transfert atomique |
| `PreRentreeSeatHold` | réservation temporaire durable et expirante | interne/transactionnelle | statut terminal conservé | `capacityService` | confirmation publique limitée, admin | unique actif, expiration, conversion atomique |
| `PreRentreeWaitlistEntry` | ordre d'attente pour demande ou inscription | personnelle/interne | statut terminal | `capacityService` | parent/admin, public référence limitée | XOR cible, unique actif, promotion sous verrou |
| `PreRentreePayment` | tentative/réconciliation en millimes | financière/sensible | conservation | `paymentReconciliationService` | parent/admin/finance ; jamais coach/élève | preuve fournisseur, idempotence, unité TND |
| `PreRentreePaymentEvent` | déduplication webhook, hash du payload | financière/audit | immuable | `paymentReconciliationService` | finance/admin audit | doublon événement, signature hors DB |
| `PreRentreeRefund` | workflow remboursement séparé | financière/sensible | conservation | `refundService` | parent résumé, finance/admin | plafond payé net, idempotence, politique partielle |
| `PreRentreeAttendance` | état par séance et affectation | pédagogique/personnelle | correction auditée | `attendanceService` | coach concerné, parent/élève, admin | unique, auteur, assignment cohérent |
| `PreRentreePedagogicalReport` | bilan V2 par inscription/module | pédagogique/sensible | retrait/archive | `pedagogicalReportService` | audiences séparées parent/élève/coach/admin | contenus cloisonnés, publication |
| `PreRentreeDocumentLink` | portée V2 d'un `UserDocument` | dépend du document | archive ; fichier rétention distincte | `documentService` | selon audience et politique | exactement une portée métier, propriété, URL signée |
| `PreRentreeArbitration` | décision incompatible/dédoublement/report | pédagogique/audit | immuable après clôture ; supersession | `arbitrationService` | pédagogie/admin ; résumé parent si impact | autorité, justification, version règle |
| `PreRentreeCommunication` | preuve de communication par template/paramètres minimisés | PII hashée/audit | conservation selon finalité | `communicationService` | parent concerné/admin | cohérence canal, statuts, pas de corps libre par défaut |
| `PreRentreeOutboxEvent` | livraison asynchrone transactionnelle | interne ; payload minimisé | terminal puis rétention technique | `outboxService`, création par services métier | aucun DTO public | claim concurrent, retry, dead letter, idempotence |
| `PreRentreeAuditEvent` | trace immuable des actions et transitions | audit ; PII minimisée | aucune suppression ordinaire | `auditService` dans transaction | admin sécurité/périmètre audit | append-only, corrélation, redaction |
| `PreRentreeMaterializationRun` | plan/résultat validate/plan/apply/verify/rollback logique | interne/audit | conservation | `templateMaterializationService` | admin technique | relance identique, checksum différent, échec atomique |
| `PreRentreeStudentScheduleClaim` | projection d'intégrité élève–séance | personnelle/pédagogique | désactivation/reconstruction | `capacityService` avec `schedulingService` | aucun DTO direct | exclusion, réparation, égalité source |

## Champs dérivés et exceptions matérialisées

| Valeur | Stockage | Source/calcul | Réparation |
|---|---|---|---|
| places disponibles / complet | non | `maxCapacity - confirmed assignments - active unexpired holds`, sous verrou pour écrire | aucun cache contractuel |
| nombre de séances/volume | prévu sur module, réalisé par comptage séances | template pour le prévu ; DB pour l'opérationnel | `verify` matérialisation |
| nombre de matières | snapshot historique dans proposition ; sinon comptage | items proposition | checksum snapshot |
| solde | snapshot attendu puis paiement net dérivé | total − acompte ; paiements réussis − remboursements | réconciliation |
| charge enseignant/élève/jours | non | séances actives et affectations | query/rapport de contrôle |
| `PreRentreeStudentScheduleClaim` | oui, exception justifiée | affectation active × séances non annulées | commande idempotente de rebuild et comparaison |

## Données historiques

Aucune donnée V1 n'est migrée dans ces modèles par défaut. Les dashboards lisent les deux domaines par query services, jamais par union implicite de tables. Les snapshots V1 restent exprimés dans leurs unités et statuts historiques ; les adaptateurs produisent des DTO `LEGACY_STAGE` sans réécriture.
