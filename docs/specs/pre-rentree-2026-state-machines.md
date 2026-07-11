# Pré-rentrée 2026 — machines à états V2

## Règles communes

- Chaque commande fournit `commandId`/clé d'idempotence et `expectedVersion` lorsque l'agrégat est modifiable concurremment.
- La répétition avec même clé et même hash retourne le résultat initial ; même clé avec payload différent retourne `409 IDEMPOTENCY_CONFLICT`.
- Une transition non listée retourne `409 INVALID_STATE_TRANSITION`, sans mutation.
- Mutation, `PreRentreeAuditEvent` et événement outbox requis sont écrits dans la même transaction.
- `ADMIN` ci-dessous désigne un `User.role=ADMIN` ou un `PreRentreeStaffGrant.ADMINISTRATOR` actif ; les autres rôles staff sont des grants V2 actifs.
- Les états financiers ne modifient jamais l'état d'inscription automatiquement ; un orchestrateur déclenche une commande d'inscription distincte après préconditions.

## 1. Édition — `PreRentreeLifecycleStatus`

Initial : `DRAFT`. Terminaux : `COMPLETED`, `CANCELLED`, `ARCHIVED` (archive postérieure à un terminal).

| Transition | Rôle | Préconditions | Effets/audit/outbox |
|---|---|---|---|
| `DRAFT→READY` | ADMIN | matérialisation `VERIFIED`, template/catalogue versions présentes | audit `EDITION_READY`; aucun public |
| `READY→ACTIVE` | ADMIN | gates techniques d'activation satisfaites ; publication traitée séparément | audit + `edition.activated` |
| `ACTIVE→COMPLETED` | ADMIN | toutes séances terminées/annulées | audit + `edition.completed` |
| `DRAFT/READY/ACTIVE→CANCELLED` | ADMIN | motif ; plan inscriptions/paiements | audit + outbox annulation |
| `COMPLETED/CANCELLED→ARCHIVED` | ADMIN | rétention et engagements préservés | audit ; retrait des listes actives |

`publicationStatus` est orthogonal : `DRAFT→READY→PUBLISHED→UNPUBLISHED→PUBLISHED` ou `ARCHIVED`. Publication exige lifecycle `READY|ACTIVE`, flags et gates ; dépublication ne change aucune inscription.

## 2. Module — `PreRentreeModuleStatus`

Initial `DRAFT`, terminal `ARCHIVED`.

| Transition | Rôle | Préconditions | Effets |
|---|---|---|---|
| `DRAFT→ACTIVE` | PEDAGOGICAL_MANAGER | variante(s), qualification, durée/count validés | audit `MODULE_ACTIVATED` |
| `ACTIVE→INACTIVE` | PEDAGOGICAL_MANAGER | aucune nouvelle sélection ; cohortes traitées | audit + invalidation query |
| `INACTIVE→ACTIVE` | PEDAGOGICAL_MANAGER | invariants revalidés | audit |
| `DRAFT/INACTIVE→ARCHIVED` | ADMIN | aucun usage contractuel actif | audit |

Un module utilisé par une proposition émise n'est plus mutable contractuellement ; une nouvelle version/template crée une nouvelle définition compatible.

## 3. Cohorte — `PreRentreeCohortStatus`

Initial `DRAFT`; terminaux `COMPLETED`, `CANCELLED`, `ARCHIVED`. `FULL` n'existe pas.

| Transition | Rôle | Préconditions | Effets |
|---|---|---|---|
| `DRAFT→FORMING` | ADMINISTRATIVE_ASSISTANT | module actif, variantes autorisées, min/max | audit ; disponibilité publique seulement si publication permise |
| `FORMING→CONFIRMED` | ADMIN | ≥3 affectations confirmables, enseignant/salle/5 séances, qualifications, validations pédagogique/logistique `APPROVED`, aucune collision | verrou cohorte ; audit + ouverture/confirmation outbox |
| `CONFIRMED→IN_PROGRESS` | système/ADMIN | première séance débutée | audit |
| `IN_PROGRESS→COMPLETED` | ADMIN | séances toutes terminales | audit + demandes de bilan |
| `DRAFT/FORMING/CONFIRMED→CANCELLED` | ADMIN | motif, plan hold/affectation/paiement | verrou ; libérations, audit, outbox remboursement/communication |
| `COMPLETED/CANCELLED→ARCHIVED` | ADMIN | politique rétention | audit |

Publication cohorte suit la machine de publication et exige état `FORMING|CONFIRMED`, publication édition, ressources et validations requises par OWNER-013.

## 4. Demande — `PreRentreeApplicationStatus`

Initial `RECEIVED`; terminaux `CONVERTED`, `WITHDRAWN`, `REJECTED`, `ARCHIVED`.

| Transition | Rôle | Préconditions | Effets |
|---|---|---|---|
| `RECEIVED→QUALIFICATION_REQUIRED` | système | compatibilité indécidable/incompatible ou identité à rapprocher | audit + tâche interne |
| `RECEIVED/QUALIFICATION_REQUIRED→QUALIFIED` | ADMINISTRATIVE_ASSISTANT/PEDAGOGICAL_MANAGER | 1–4 sélections valides et arbitrage requis clôturé | audit |
| `QUALIFIED→PROPOSED` | ADMINISTRATIVE_ASSISTANT | proposition `ISSUED` | audit + communication |
| `PROPOSED→CONVERTED` | `enrollmentService` | proposition acceptée, élève et responsable vérifiés | audit, aucune création de compte implicite |
| état non terminal `→WITHDRAWN` | responsable via token/assistant | authentification de la commande, motif | audit + annulation offre/holds concernés |
| état non terminal `→REJECTED` | ADMIN/PEDAGOGICAL_MANAGER | motif métier | audit + communication |
| terminal `→ARCHIVED` | ADMIN | rétention | audit |

## 5. Proposition commerciale — `PreRentreeProposalStatus`

Initial `DRAFT`; terminaux `ACCEPTED`, `DECLINED`, `EXPIRED`, `CANCELLED`.

| Transition | Rôle | Préconditions | Effets |
|---|---|---|---|
| `DRAFT→ISSUED` | ADMINISTRATIVE_ASSISTANT | prix serveur, checksum, 1–4 items, CGV/politique versions | snapshot devient immuable ; audit + envoi |
| `ISSUED→ACCEPTED` | responsable autorisé | avant expiration, preuve d'acceptation, relation vérifiée au plus tard lors de l'inscription | audit + commande inscription |
| `ISSUED→DECLINED` | responsable | preuve de commande | audit |
| `ISSUED→EXPIRED` | système | `now≥expiresAt` | audit sans notification obligatoire |
| `DRAFT/ISSUED→CANCELLED` | staff autorisé | motif | audit + communication si émise |

## 6. Inscription — `PreRentreeEnrollmentStatus`

Initial `PENDING`; terminaux `COMPLETED`, `CANCELLED`, `ARCHIVED`.

| Transition | Rôle | Préconditions | Effets |
|---|---|---|---|
| `PENDING→CONFIRMED` | `enrollmentService`/ADMIN | proposition acceptée, responsable vérifié actif, contrat/CGV, politique de paiement satisfaite, affectations nécessaires confirmées | audit + confirmation outbox |
| `CONFIRMED→COMPLETED` | ADMIN | édition terminée, obligations pédagogiques clôturées | audit |
| `PENDING/CONFIRMED→CANCELLED` | responsable autorisé/ADMIN | politique, motif, traitement séparé affectations et remboursements | audit + outbox |
| terminal `→ARCHIVED` | ADMIN | rétention | audit |

`PAID` et `REFUNDED` sont interdits ici ; le solde est dérivé des transactions financières.

## 7. Affectation cohorte — `PreRentreeAssignmentStatus`

Initial `PROPOSED`; terminaux `TRANSFERRED`, `CANCELLED`, `COMPLETED`.

| Transition | Rôle | Préconditions | Effets |
|---|---|---|---|
| `PROPOSED→CONFIRMED` | `capacityService` | capacité atomique, variante servie, aucun chevauchement élève | crée claims élève, audit + éventuelle confirmation |
| `CONFIRMED→TRANSFERRED` | ADMIN | nouvelle affectation confirmée dans la même transaction | désactive claims anciens, lien transfert, audit/outbox |
| `PROPOSED/CONFIRMED→CANCELLED` | ADMIN/responsable selon politique | motif | libère capacité, désactive claims, promotion waitlist planifiée |
| `CONFIRMED→COMPLETED` | système/ADMIN | cohorte complétée | audit |

## 8. Seat hold — `PreRentreeSeatHoldStatus`

Initial `ACTIVE`; tous les autres états sont terminaux.

| Transition | Rôle | Préconditions | Effets |
|---|---|---|---|
| `ACTIVE→CONVERTED` | `capacityService` | non expiré, paiement/condition remplie, capacité toujours réservée | crée/confirme affectation sous même verrou ; audit |
| `ACTIVE→RELEASED` | système/staff | demande explicite ou échec | audit + promotion waitlist |
| `ACTIVE→EXPIRED` | système | `now≥expiresAt` | audit + promotion ; un paiement tardif ne reconvertit pas |
| `ACTIVE→CANCELLED` | ADMIN | cohorte/inscription annulée | audit/outbox selon impact |

## 9. Liste d'attente — `PreRentreeWaitlistStatus`

Initial `ACTIVE`; autres états terminaux.

| Transition | Rôle | Préconditions | Effets |
|---|---|---|---|
| `ACTIVE→PROMOTED` | `capacityService` | première entrée éligible sous verrou, hold créé | lie le hold, audit + offre limitée |
| `ACTIVE→DECLINED` | responsable | preuve de refus | audit, candidat suivant |
| `ACTIVE→EXPIRED` | système | délai dépassé | audit, candidat suivant |
| `ACTIVE→CANCELLED` | ADMIN/responsable | cohorte ou demande annulée | audit |

## 10. Paiement — `PreRentreePaymentStatus`

Initial `INITIATED`; terminaux `SUCCEEDED`, `FAILED`, `CANCELLED`, avec `RECONCILIATION_REQUIRED` récupérable.

| Transition | Rôle | Préconditions | Effets |
|---|---|---|---|
| `INITIATED→PENDING` | fournisseur/service finance | ordre fournisseur accepté | audit technique |
| `INITIATED/PENDING→SUCCEEDED` | webhook/service finance | signature valide, événement unique, montant/devise/référence reconciliés | preuve, événement paiement, audit + outbox ; aucune mutation directe d'inscription |
| `INITIATED/PENDING→FAILED` | fournisseur | preuve authentique | audit + communication sobre |
| `INITIATED/PENDING→CANCELLED` | finance | ordre annulable | audit |
| état non terminal `→RECONCILIATION_REQUIRED` | service | divergence montant/devise/référence ou paiement tardif | audit prioritaire, aucune place accordée |
| `RECONCILIATION_REQUIRED→SUCCEEDED/FAILED` | FINANCIAL_MANAGER | preuve et justification | audit renforcé |

## 11. Remboursement — `PreRentreeRefundStatus`

Initial `REQUESTED`; terminaux `SUCCEEDED`, `FAILED`, `CANCELLED`.

| Transition | Rôle | Préconditions | Effets |
|---|---|---|---|
| `REQUESTED→APPROVED` | FINANCIAL_MANAGER | politique, montant ≤ payé net, décision report/remboursement tracée | audit |
| `APPROVED→INITIATED` | FINANCIAL_MANAGER | référence fournisseur créée | audit/outbox |
| `INITIATED→SUCCEEDED/FAILED` | webhook/FINANCIAL_MANAGER | preuve fournisseur | audit + communication |
| `REQUESTED/APPROVED→CANCELLED` | FINANCIAL_MANAGER | motif, aucune opération irréversible | audit |

Le remboursement partiel est refusé par défaut pour l'annulation sous seuil ; toute autre politique doit être versionnée dans le snapshot et autoriser explicitement le montant.

## 12. Séance — `PreRentreeSessionStatus`

Initial `SCHEDULED`; terminaux `COMPLETED`, `CANCELLED`.

| Transition | Rôle | Préconditions | Effets |
|---|---|---|---|
| `SCHEDULED→CONFIRMED` | PEDAGOGICAL_MANAGER + validation logistique | enseignant/salle/disponibilité/équipement/contraintes DB | audit |
| `CONFIRMED→IN_PROGRESS` | coach/système | horaire atteint, coach affecté | audit |
| `IN_PROGRESS→COMPLETED` | coach | présences enregistrables | audit + demandes de bilan |
| `SCHEDULED/CONFIRMED→CANCELLED` | ADMIN/PEDAGOGICAL_MANAGER | motif et remplacement/communication décidés | désactive claims si sans remplacement, audit/outbox |

Un remplacement est une nouvelle séance liée ; l'ancienne reste `CANCELLED`.

## 13. Présence — `PreRentreeAttendanceStatus`

Initial `UNKNOWN`; aucun état métier irréversible. Coach affecté peut enregistrer `PRESENT|ABSENT|EXCUSED|LATE` après le début ; admin/pédagogie peut corriger avec motif. Chaque changement produit un audit. Répéter la même valeur est un no-op idempotent ; changer la valeur sans motif après clôture est interdit.

## 14. Liaison responsable–élève — `PreRentreeGuardianVerificationStatus`

Initial `PROPOSED`; terminaux `REJECTED`, `REVOKED`, `EXPIRED`.

| Transition | Rôle | Préconditions | Effets |
|---|---|---|---|
| `PROPOSED→PENDING_VERIFICATION` | système/staff | profils identifiés sans fusion automatique | audit, défi de vérification |
| `PENDING_VERIFICATION→VERIFIED` | ADMINISTRATIVE_ASSISTANT/ADMIN | preuves et confirmation ; droits/période | `verifiedBy/At`, audit |
| `PROPOSED/PENDING_VERIFICATION→REJECTED` | staff | motif | audit |
| `VERIFIED→REVOKED` | ADMIN/parent selon droit | motif, impact inscriptions évalué | `revokedBy/At`, audit/outbox si accès perdu |
| `VERIFIED→EXPIRED` | système | `validUntil` dépassé | audit |

Aucun retour vers `VERIFIED` : créer une nouvelle période de relation.

## 15. Arbitrage — `PreRentreeArbitrationStatus`

Initial `OPEN`; terminaux `REJECTED`, `SUPERSEDED`, `CLOSED`.

| Transition | Rôle | Préconditions | Effets |
|---|---|---|---|
| `OPEN→UNDER_REVIEW` | PEDAGOGICAL_MANAGER | dossier complet | audit |
| `OPEN/UNDER_REVIEW→APPROVED` | PEDAGOGICAL_MANAGER | décision, justification, règle versionnée, impact | audit + commande métier séparée |
| `OPEN/UNDER_REVIEW→REJECTED` | PEDAGOGICAL_MANAGER | justification | audit |
| `APPROVED→CLOSED` | PEDAGOGICAL_MANAGER | effet réalisé/vérifié | audit |
| non terminal `→SUPERSEDED` | PEDAGOGICAL_MANAGER | nouvel arbitrage lié | audit |

## 16. Communication et outbox

Communication initiale `PLANNED` : `PLANNED→QUEUED→SENT→DELIVERED`; `QUEUED/SENT→FAILED`; avant envoi `→CANCELLED`; retry de `FAILED` crée une nouvelle tentative outbox mais conserve la même communication et l'historique.

Outbox initiale `PENDING` : worker atomique `PENDING/FAILED→PROCESSING`; `PROCESSING→DELIVERED|FAILED`; après nombre maximal versionné, `FAILED→DEAD_LETTER`; avant traitement `PENDING→CANCELLED`. Un lease expiré rend `PROCESSING` récupérable. La clé d'idempotence est stable ; un consumer doit lui aussi être idempotent. Aucun événement livré n'est remis à `PENDING` manuellement.

## Contrôle transversal

Les statuts publication, ouverture, demande, inscription, affectation, paiement, remboursement, présence et communication sont orthogonaux. Une vue peut les agréger dans un libellé d'interface, mais aucun agrégat ne stocke ce libellé composite.
