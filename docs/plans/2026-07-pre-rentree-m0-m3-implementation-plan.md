# Pré-rentrée 2026 M0–M3 Master Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:using-git-worktrees, then superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Préparer et exécuter ultérieurement M0A–M3 sans décision implicite, régression V1 ni exposition publique.

**Architecture:** M0 prouve sécurité, base, outillage et tests. M1 crée 21 modèles cœur, M2 ajoute un claim et les garanties SQL, M3 ajoute l'autorité responsable M:N et son backfill contrôlé. Dix-sept modèles restent différés et fail-closed.

**Tech Stack:** Node 20, TypeScript, NextAuth/guards existants, Prisma 6.19.2, PostgreSQL 15, `btree_gist`, Jest/Docker.

---

## 1. Objectif

Livrer des migrations additives M1–M3 et leurs preuves, avec une baseline M0 permettant à un agent de suivre les tickets sans inventer modèle, enum, contrainte, commande, sécurité ou rollback.

## 2. Non-objectifs

- aucune route/API/service métier V2 publique ;
- aucun dashboard, landing, pricing catalogue ou paiement actif ;
- aucune matérialisation PRE2026 réelle ;
- aucun envoi, backfill automatique ou création de compte ;
- aucun drop/rename/recalcul V1 ;
- aucun déploiement/push/merge sans mandat distinct.

## 3. Architecture

```text
V1 historique ──────────────────────────────────────── inchangé

M0A sécurité ───────────────┐
M0B PostgreSQL ─┐           │
M0C Prisma ─────┴─ M0D ── M1 core ─┬─ M2 intégrité
                                    └─ M3 relation ── backfill candidat
M0A scopes VERIFIED ────────────────────────────────┘

M4+ seulement : template réel, resources, services, waitlist,
payments, outbox, communications, dashboards/public.
```

Sources : [complexité](../audits/2026-07-pre-rentree-v2-complexity-review.md), [schéma final](../specs/pre-rentree-2026-physical-schema-v2.md), [états](../specs/pre-rentree-2026-state-machines.md).

## 4. Séquence exécutable M0A–M3

### Wave 0 — revalidation

- [ ] Fetch, SHA, status, merge-base et drift Prisma/auth/payment/Stage.
- [ ] Créer worktrees futurs selon ownership.
- [ ] Confirmer décisions owner et 17 modèles différés.

### Wave 1 — M0 parallèle

- [ ] M0A SEC-01..03 : inventaire, auth fail-closed, policy pure.
- [ ] M0B DB-01..03 : capacités, exclusion, backup/restore.
- [ ] M0C TOOL-01..02 : versions exactes et migration harness.
- [ ] M0D TEST-01..02 après DB/toolchain : stack et fixtures.
- [ ] Revue Sol ; M0B/C/D GO. M0A peut finir ses scopes après M3 mais ses fondations doivent être vertes avant M1.

### Wave 2 — M1

- [ ] M1-01 à M1-05 en TDD, un writer schema.
- [ ] M1-06 create-only, scan SQL, lanes fresh/V1, drift.
- [ ] Intégrer seulement après M0B/C GO et revue Sol xhigh.

### Wave 3 — M2/M3 schema

- [ ] M2-01..05 depuis M1 intégré : claim, checks, indexes, exclusions.
- [ ] M3-01 depuis M1 intégré : relation et FK ; intégration schema séquentielle avec M2.
- [ ] Rejouer fresh/V1 après les deux migrations dans l'ordre final.

### Wave 4 — M3 data/security

- [ ] M3-02 droits/policies.
- [ ] M3-03 inventory/dry-run et revue humaine.
- [ ] M3-04 apply/verify candidats PENDING seulement.
- [ ] M3-05 scopes/IDOR/non-régression ; gate M0A scope.

## 5. Diagramme de dépendances

| Producteur | Consommateur | Contrat |
|---|---|---|
| M0B | M1/M2 | PG15, extension/fallback, backup |
| M0C | tous | Node20, Prisma6.19.2, create-only/deploy/drift |
| M0D | M1–M3 | DB/fixtures/lanes |
| M0A policy | M3 scopes | deny-by-default, redaction |
| M1 | M2/M3 | 21 tables/19 enums exacts |
| M2 | capacity service futur | exclusions/claims |
| M3 | parent API future | VERIFIED active/right |

## 6. Modèles retenus par lot

### M1 — 21

`Edition`, `Module`, `Variant`, `ModuleVariant`, `Cohort`, `CohortVariant`, `Session`, `Site`, `Room`, `TeacherAssignment`, `Application`, `ConsentEvidence`, `ApplicationSelection`, `Proposal`, `ProposalItem`, `Enrollment`, `EnrollmentModule`, `CohortAssignment`, `SeatHold`, `AuditEvent`, `MaterializationRun`, tous préfixés `PreRentree`.

### M2 — 1

`PreRentreeStudentScheduleClaim`.

### M3 — 1

`PreRentreeGuardianRelationship` + colonnes relations sur Application/Enrollment.

### Différés — 17

CompatibilityRule, Equipment, RoomEquipment, RoomBlackout, TeacherQualification, TeacherAvailability, StaffGrant, WaitlistEntry, Payment, PaymentEvent, Refund, Attendance, PedagogicalReport, DocumentLink, Arbitration, Communication, OutboxEvent.

## 7. Enums retenus

- M1 : 19, listés exactement dans [M1](pre-rentree-2026-m1-core-schema-plan.md).
- M2 : aucun nouvel enum.
- M3 : `PreRentreeGuardianRelationType`, `PreRentreeGuardianVerificationStatus`.
- Différés : 14 avec leurs modèles.

## 8. Fichiers futurs

- outillage : package/lock, Dockerfile.e2e, CI, scripts m0b/m0c/test ;
- sécurité : guards/RBAC existants ciblés, `lib/stages/v2/authorization/**`, tests ;
- schema : `prisma/schema.prisma`, trois dossiers migrations futurs ;
- fixtures : `__tests__/fixtures/pre-rentree-v2/**`, Jest DB config ;
- M3 : guardian rights/service, scripts inventory/plan/apply/verify ;
- preuves : `docs/evidence/pre-rentree-2026/**`.

La [carte ownership](pre-rentree-2026-m0-m3-branch-and-ownership-plan.md) fait foi.

## 9. Migrations futures

1. `pre_rentree_v2_core` — 21/19, DDL additif.
2. `pre_rentree_v2_integrity` — claim + SQL M2.
3. `student_guardian_relationship` — M:N/FKs/checks, aucun backfill SQL.

Workflow exact : [migration SQL](pre-rentree-2026-migration-sql-execution-plan.md).

## 10. Tests

- guards/RBAC/IDOR/log redaction ;
- DB capability/exclusions/backup restore ;
- Prisma validate/format/generate/drift ;
- lanes fresh et snapshot V1 ;
- M1 defaults/FKs/uniques/archive ;
- M2 overlap/adjacency/concurrence/checks ;
- M3 M:N/status/droits/backfill/IDOR ;
- comparaison stricte lignes V1 et rollback applicatif.

Commandes et résultats : [test execution](pre-rentree-2026-m0-m3-test-execution-plan.md).

## 11. Gates

| Gate | Entrée | Sortie requise |
|---|---|---|
| SEC-BASE | IMPLEMENTED_ON_MAIN_PENDING_DEDICATED_REVIEW | VERIFIED_IN_TEST avant route V2 |
| DB-CAPABILITY | PENDING_EVIDENCE | PG15 + extension/fallback prouvé |
| BACKUP | PENDING_EVIDENCE | restore comparé |
| TOOLCHAIN | nouveau | Node20/Prisma6.19.2/drift |
| TEST-ENV | nouveau | DB isolée/factories/lanes |
| M1 | plan validé | 21/19 additive |
| M2 | M1+DB GO | constraints/concurrence |
| M3 | M1+SEC | relation/backfill/IDOR |

Toutes les gates publication restent bloquées.

## 12. Sécurité

Fail-closed, policy pure, ABAC scope avant lecture, 404 hors scope, parent par relation VERIFIED active, coach par affectation, finance absente coach/élève, documents/factures scoped, webhook secret/signature obligatoire, logs redacted. Plan : [M0A](pre-rentree-2026-m0a-security-implementation-plan.md).

## 13. Données

M1/M2 sans données réelles. M3 génère uniquement des candidats PENDING à partir de `Student.parentId`; aucune fusion/verification email. JSON M1 strictement Zod/versionné. Millimes/TND selon [contrat money](../specs/pre-rentree-2026-money-implementation-contract.md).

## 14. Rollback

Flags off, writes V2 stop, application V1, tables conservées, repair plan/apply/verify. Restore uniquement incident confirmé. Détails : [rollback/repair](pre-rentree-2026-m0-m3-rollback-repair-plan.md).

## 15. Ownership

Sol xhigh : sécurité/règles/revues critiques. Terra high : infra/outillage/schema sous revue. Un writer schema/migrations à la fois. Aucun travail parallèle sur les mêmes fichiers.

## 16. Calendrier logique

| Vague | Peut démarrer | Fin logique |
|---|---|---|
| W0 plan | maintenant | commit documentaire validé |
| W1 M0A/B/C | après mandat implementation | preuves fondation |
| W2 M0D | après contrats B/C | harness GO |
| W3 M1 | après B/C GO | core intégré |
| W4 M2 + préparation M3 | après M1 | migrations intégrées séquentiellement |
| W5 M3 backfill/security | M3 schema + M0A | candidats/IDOR vérifiés |

Aucune durée calendrier n'est inventée ; chaque vague avance par gate.

## 17. Ordre de fusion

M0C → M0B/M0D → M0A → M1 → M2 → M3 schema → M3 policies/backfill. M2 et M3 peuvent préparer tests en parallèle après M1, mais leurs changements schema sont intégrés séquentiellement et revalidés ensemble.

## 18. GO/NO-GO

GO M0 implementation : plan cohérent, worktrees/owners définis, aucun blocage main/monétaire/schéma. GO M1 : M0B/C/D. GO M2 : extension/fallback. GO M3 apply : M0A + revue plan candidats. NO-GO sur drift main, P0 sécurité, restore absent, outil divergent, DDL destructif, données V1 modifiées, enrollment avant M3 ou durée hold codée.

## 19. Risques

| Priorité | Risque | Réponse |
|---|---|---|
| P0 | sécurité seulement conçue | M0A, aucune route V2 |
| P0 | extension/restore cible inconnus | M0B NO-GO/fallback trigger |
| P0 | faux responsable | candidats PENDING, revue, IDOR |
| P1 | Node18/Prisma global E2E | M0C pin exact |
| P1 | 21 modèles M1 mal séquencés | tickets/single writer/lanes |
| P1 | constraint trop stricte | preflight/tests/rollback applicatif |
| P2 | JSON/artefact preuve dérive | Zod/version/checksum |

## 20. Décisions encore manquantes

- `OWNER_INPUT_REQUIRED` : durée hold et promotion ;
- `LEGAL_INPUT_REQUIRED` : rétention, CGV remboursement/report, délai ;
- ressources : enseignants, salles, NSI, modalité PC ;
- finance : coûts/marge ;
- M0B : preuves réelles staging/production et rôle extension ;
- seuils opérationnels observés : durée migration/locks/performance.

Ces inputs ne bloquent pas M0 ni la création additive M1 ; ils bloquent les fonctionnalités/gates correspondantes et toute publication.

## Backlog exécutable

Chaque action de ce plan possède un ticket dans [le backlog atomique](pre-rentree-2026-m0-m3-implementation-backlog.md). Aucun ticket sans owner, test, rollback, gate ou fichiers autorisés ne peut entrer en réalisation.

## Revue croisée A–I

| Axe | Résultat |
|---|---|
| plans ↔ schéma | mêmes 40 noms cibles ; M1 omet explicitement les champs dépendant de modèles différés, M3 complète guardian |
| plans ↔ états | 19 enums M1 et 2 M3 repris à l'identique ; 14 différés avec leurs modèles |
| migrations ↔ contraintes | M1 DDL simple, M2 tous checks/indexes/exclusions, M3 checks identité ; aucune contrainte orpheline |
| argent ↔ pricing | millimes/TND, brut 144/270/405/540, arrondi 140/270/410/540, aucun Float V2 |
| sécurité ↔ identité | parent VERIFIED active/right, coach assigned, aucun email authority, finance cloisonnée |
| V1 ↔ V2 | aucune suppression, dual-write, réinterprétation ou backfill Stage |
| capacité ↔ concurrence | locks ordonnés, recount, idempotence/retry, preuve dernière place |
| planning ↔ DB | exclusions `[)`, statuts actifs, annulation/remplacement et fallback DB |
| documents ↔ backlog | SEC/DB/TOOL/TEST/M1/M2/M3 couvrent chaque tâche ; ownership unique |

Un contrôle automatisé des noms/liens/comptages complète cette revue avant commit documentaire.
