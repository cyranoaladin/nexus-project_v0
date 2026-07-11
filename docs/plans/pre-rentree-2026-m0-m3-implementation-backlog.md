# Pré-rentrée 2026 M0–M3 Atomic Implementation Backlog

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans and TDD for each ticket. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Découper M0A–M3 en tickets indépendants, testables et réversibles.

**Architecture:** Chaque ticket commence par un test ou une preuve qui échoue, produit un seul invariant et un commit. Les tickets Prisma sont séquentiels ; M0A et M0B/C peuvent être préparés en parallèle.

**Tech Stack:** Git worktrees, TypeScript/Jest, Prisma 6.19.2, PostgreSQL 15, Docker.

---

## Interdictions globales

`G` dans les tickets signifie : aucun pricing, frontend, dashboard, API V2 publique, table/colonne V1, migration déjà appliquée, secret ou donnée réelle. Aucun push/merge sans mandat. Tout fichier non listé nécessite arrêt et revue d'ownership.

## M0A-R sécurité — revue et fermeture des écarts

> **Supersession :** Les tickets SEC-01 à SEC-07 ont été reclassés après fusion de
> G-SEC/G-PAY sur main. Voir le [plan M0A-R recadré](pre-rentree-2026-m0a-security-implementation-plan.md)
> et la [réconciliation](../audits/2026-07-pre-rentree-current-main-security-reconciliation.md).

### SEC-01 — Inventaire des routes → `ALREADY_IMPLEMENTED_REVIEW_ONLY`

Inventaire existant : `API_GUARD_INVENTORY.md` (176 routes, P0=0, P1=2), script `audit-api-guards.mjs`, test `audit-api-guards.classification.test.ts`. M0A-R exécute le script et vérifie l'absence de routes V2 pré-ouvertes.

### SEC-02 — Auth fail-closed → `ALREADY_IMPLEMENTED_REVIEW_ONLY`

Guards `requireAuth`/`requireAnyRole` retournent 401/403, session vérifie id/role/email. Tests existants. M0A-R relit et confirme.

### SEC-03 — Moteur policy V2 → `DEFERRED_TO_M1`

Les types `PreRentreeAction`/`PreRentreeResource`/`AuthorizationDecision` restent documentés mais ne seront implémentés qu'avec les routes V2 (M1+). Créer un module sans consommateur violerait YAGNI.

### SEC-04 — Scopes ABAC DB → `DEFERRED_TO_M3`

Dépend de `PreRentreeGuardianRelationship` (M3) et `PreRentreeTeacherAssignment` (M1). Guards V1 actifs.

### SEC-05 — Redaction des refus → `GAP_CLOSURE_REQUIRED`

Aucun helper redaction n'existe. M0A-R évalue le risque réel et corrige si écart P0/P1 démontré.

### SEC-06 — Factures/documents → `ALREADY_IMPLEMENTED_REVIEW_ONLY`

`buildInvoiceAccessWhere`, `notFoundResponse`, download RBAC, realpath, storage-root sur main avec tests. M0A-R exécute et vérifie.

### SEC-07 — Webhook fail-closed → `ALREADY_IMPLEMENTED_REVIEW_ONLY` + `GAP_CLOSURE_REQUIRED` (hex)

Signature HMAC + timingSafeEqual + fail-closed 501 sur main. Écart : validation hex. Payload parsing, idempotence, state machine → `DEFERRED_TO_PAYMENT_EVIDENCE`.

## M0B/M0C/M0D

### DB-01 — Probe PostgreSQL

- **Objectif/étapes :** tests URL/redaction → script read-only → preuves dev/stage/prod.
- **Modèle :** Terra high, revue Sol. **Taille :** S. **Parallèle :** oui M0A.
- **Fichiers autorisés :** script m0b, tests, evidence. **Interdits :** G + production write.
- **Dépendances/gates :** accès approuvé ; sortie versions/privileges/timezone.
- **Tests/acceptation :** aucun secret, trois environnements renseignés.
- **Rollback/risques :** aucun write ; risque preuve partielle = NO-GO.

### DB-02 — Preuve btree_gist

- **Objectif/étapes :** table temporaire → overlap/adjacency → documenter fallback trigger.
- **Modèle :** Terra high, revue Sol xhigh. **Taille :** S. **Parallèle :** après DB-01.
- **Fichiers autorisés :** SQL test/scripts/tests/evidence. **Interdits :** G + migration réelle.
- **Dépendances/gates :** DB-01 ; sortie capability GO ou BLOCKED.
- **Tests/acceptation :** 23P01 overlap, adjacency acceptée.
- **Rollback/risques :** rollback table temp ; risque privilege extension.

### DB-03 — Backup/restore

- **Objectif/étapes :** guards → dump checksum → restore isolé → compare/report.
- **Modèle :** Terra high + infra, revue Sol. **Taille :** M. **Parallèle :** après DB-01.
- **Fichiers autorisés :** scripts/evidence, aucun dump Git. **Interdits :** G + restore production.
- **Dépendances/gates :** DB-01 ; sortie GATE-BACKUP evidence.
- **Tests/acceptation :** migrations/extensions/counts identiques.
- **Rollback/risques :** supprimer DB isolée après preuve ; dump sensible.

### TOOL-01 — Pinner Node/Prisma

- **Objectif/étapes :** test versions rouge → package/lock/Docker E2E → npm ci/generate.
- **Modèle :** Terra high, revue Sol. **Taille :** M. **Parallèle :** oui DB/M0A.
- **Fichiers autorisés :** package/lock, Dockerfile.e2e, checker/tests. **Interdits :** G + upgrade autre que 6.19.2.
- **Dépendances/gates :** plan M0C ; sortie Node20/Prisma exact.
- **Tests/acceptation :** aucun global Prisma non piné, CLI=Client.
- **Rollback/risques :** revert outillage ; risque build E2E.

### TOOL-02 — Workflow create-only/deploy/drift

- **Objectif/étapes :** tests DB/shadow guards → scripts migration → lane vide.
- **Modèle :** Terra high, revue Sol xhigh. **Taille :** M. **Parallèle :** après TOOL-01/DB-01.
- **Fichiers autorisés :** scripts m0c/tests/CI ciblée. **Interdits :** G + db push.
- **Dépendances/gates :** TOOL-01, DB-01 ; sortie drift harness GO.
- **Tests/acceptation :** refuse DB dangereuse, diff vide.
- **Rollback/risques :** scripts retirables ; risque faux allowlist.

### TEST-01 — Stack DB isolée

- **Objectif/étapes :** guard DB → compose tmpfs → setup/teardown.
- **Modèle :** Terra high, revue Sol. **Taille :** M. **Parallèle :** après DB-01/TOOL-01.
- **Fichiers autorisés :** compose test, scripts test, Jest config. **Interdits :** G + env réel.
- **Dépendances/gates :** DB-01, TOOL-01 ; sortie harness isolé.
- **Tests/acceptation :** mauvaise URL refusée, aucun volume restant.
- **Rollback/risques :** down -v stack identifiée ; risque suppression mauvais volume.

### TEST-02 — Factories et lanes V1

- **Objectif/étapes :** tests déterminisme → factories → lane fresh/snapshot manifest.
- **Modèle :** Terra high, revue Sol. **Taille :** M. **Parallèle :** après TEST-01.
- **Fichiers autorisés :** fixtures/tests migration. **Interdits :** G + PII réelle.
- **Dépendances/gates :** TEST-01 ; sortie M0D GO.
- **Tests/acceptation :** formats V1, familles/coachs/salles/capacité reproductibles.
- **Rollback/risques :** DB jetable ; risque fixture cachant contrainte.

## M1

### M1-01 — Édition/module/variante

- **Objectif/étapes :** tests métadonnées → 19 enums + 4 modèles → validate.
- **Modèle :** Terra high, revue Sol xhigh. **Taille :** M. **Parallèle :** non sur schema.
- **Fichiers autorisés :** schema, tests catalogue. **Interdits :** G + migration finale avant revue.
- **Dépendances/gates :** M0B/C/D GO ; sortie 4 modèles.
- **Tests/acceptation :** uniques/defaults/types exacts.
- **Rollback/risques :** revert avant migration ; enum drift.

### M1-02 — Cohorte/séance/ressources

- **Objectif/étapes :** tests FK/defaults → 6 modèles → generate.
- **Modèle :** Terra high, revue Sol. **Taille :** M. **Parallèle :** après M1-01.
- **Fichiers autorisés :** schema/tests planning core. **Interdits :** G + exclusions M2.
- **Dépendances/gates :** M1-01 ; sortie 10 modèles cumulés.
- **Tests/acceptation :** ressources nullables DRAFT, aucune cascade.
- **Rollback/risques :** revert ; risque double source teacher/room.

### M1-03 — Demande/sélection/consentement

- **Objectif/étapes :** test sans compte/idempotence → 3 modèles.
- **Modèle :** Terra high, revue Sol. **Taille :** M. **Parallèle :** après M1-01, pas simultané schema.
- **Fichiers autorisés :** schema/tests application + schema Zod constraints. **Interdits :** G + route.
- **Dépendances/gates :** M1-01 ; sortie 13 modèles.
- **Tests/acceptation :** PII minimale, JSON Zod/version contracté.
- **Rollback/risques :** revert ; risque collecte excessive.

### M1-04 — Proposition/inscription

- **Objectif/étapes :** money/snapshot tests → 4 modèles → bloquer enrollment avant M3.
- **Modèle :** Terra high, revue Sol xhigh. **Taille :** L. **Parallèle :** non schema.
- **Fichiers autorisés :** schema/tests contract/money + schema Zod snapshot. **Interdits :** G + paiement.
- **Dépendances/gates :** M1-03, money contract ; sortie 17 modèles.
- **Tests/acceptation :** millimes, immutable snapshot, aucun guardian contourné.
- **Rollback/risques :** revert ; risque contrat incomplet.

### M1-05 — Affectation/hold/audit/run

- **Objectif/étapes :** tests FK/idempotence → 4 modèles.
- **Modèle :** Terra high, revue Sol. **Taille :** M. **Parallèle :** non schema.
- **Fichiers autorisés :** schema/tests core capacity/audit + schemas Zod audit/materialization. **Interdits :** G + service.
- **Dépendances/gates :** M1-04 ; sortie 21 modèles.
- **Tests/acceptation :** run/hold uniques, audit minimal.
- **Rollback/risques :** revert ; durée hold reste absente du code.

### M1-06 — Migration core

- **Objectif/étapes :** create-only → scan SQL → fresh/snapshot/drift → preuve.
- **Modèle :** Terra high, revue Sol xhigh. **Taille :** L. **Parallèle :** non.
- **Fichiers autorisés :** migration M1/schema/tests/evidence. **Interdits :** G + edit migration après apply.
- **Dépendances/gates :** M1-01..05 ; sortie M1 GO.
- **Tests/acceptation :** 21/19, zéro drop/cascade/V1 diff.
- **Rollback/risques :** tables inertes ; risque SQL généré inattendu.

## M2

### M2-01 — StudentScheduleClaim

- **Objectif/étapes :** test overlap sans modèle → modèle/back-relations → generate.
- **Modèle :** Terra high, revue Sol. **Taille :** S. **Parallèle :** non schema.
- **Fichiers autorisés :** schema/tests claim. **Interdits :** G + guardian.
- **Dépendances/gates :** M1 intégré ; sortie modèle M2 unique.
- **Tests/acceptation :** FK/unique/rebuild contract.
- **Rollback/risques :** table inerte ; projection dérivée.

### M2-02 — Checks et index partiels

- **Objectif/étapes :** tests violations → SQL checks/indexes → catalog verify.
- **Modèle :** Sol xhigh. **Taille :** M. **Parallèle :** après M2-01.
- **Fichiers autorisés :** migration M2/tests. **Interdits :** G + service rules non DB.
- **Dépendances/gates :** preflight vide ; sortie 23514/23505 mappings.
- **Tests/acceptation :** money/date/archive/hold/default variant.
- **Rollback/risques :** drop test only ; risque check trop strict.

### M2-03 — Exclusion enseignant/cohorte

- **Objectif/étapes :** tests overlap/adjacency → GiST SQL → concurrence.
- **Modèle :** Sol xhigh. **Taille :** M. **Parallèle :** même migration, séquentiel.
- **Fichiers autorisés :** migration/tests exclusion. **Interdits :** G + noms divergents.
- **Dépendances/gates :** DB-02, M2-01 ; sortie 23P01 exact.
- **Tests/acceptation :** statuts actifs, PRIMARY periods.
- **Rollback/risques :** constraints conservées ; capability.

### M2-04 — Exclusion salle

- **Objectif/étapes :** test deux writes salle → exclusion SQL → mapping erreur.
- **Modèle :** Terra high, revue Sol obligatoire. **Taille :** S. **Parallèle :** tests préparables avec M2-03.
- **Fichiers autorisés :** migration/tests room. **Interdits :** G.
- **Dépendances/gates :** DB-02 ; sortie room conflict DB.
- **Tests/acceptation :** nullable DRAFT, adjacency.
- **Rollback/risques :** drop test only ; blackout différé.

### M2-05 — Exclusion élève et migration proof

- **Objectif/étapes :** concurrence claims → exclusion → fresh/snapshot/drift/evidence.
- **Modèle :** Sol xhigh. **Taille :** L. **Parallèle :** non final.
- **Fichiers autorisés :** migration/tests/evidence. **Interdits :** G.
- **Dépendances/gates :** M2-01..04 ; sortie M2 GO.
- **Tests/acceptation :** aucun overlap, migration exacte, V1 intact.
- **Rollback/risques :** writes off/table conservée ; rebuild mismatch.

## M3

### M3-01 — Schema guardian

- **Objectif/étapes :** tests enums/model → table/FKs/checks/index → migration.
- **Modèle :** Terra high, règles/revue Sol xhigh. **Taille :** L. **Parallèle :** après M1, possible en parallèle M2 sur baseline distincte puis intégration séquentielle.
- **Fichiers autorisés :** schema/migration M3/tests. **Interdits :** G + parentId.
- **Dépendances/gates :** M1, enrollment=0 ; sortie schema M3.
- **Tests/acceptation :** M:N, no cascade, required enrollment FK.
- **Rollback/risques :** flags off/table conservée ; lock column.

### M3-02 — Registre droits/policies

- **Objectif/étapes :** tests droits inconnus → union/Zod → policy relation active.
- **Modèle :** Sol xhigh. **Taille :** M. **Parallèle :** après M3-01, avec inventory.
- **Fichiers autorisés :** guardian-rights/service/tests. **Interdits :** G + email authority.
- **Dépendances/gates :** SEC-03, M3-01 ; sortie deny-by-default.
- **Tests/acceptation :** dates/status/rights exacts.
- **Rollback/risques :** parent V2 off ; droits trop larges.

### M3-03 — Inventory/dry-run

- **Objectif/étapes :** golden catégories → inventory → plan checksum, zéro write.
- **Modèle :** Sol xhigh règles, Terra high code. **Taille :** M. **Parallèle :** avec M3-02.
- **Fichiers autorisés :** scripts inventory/plan/tests/reports. **Interdits :** G + PII Git.
- **Dépendances/gates :** M3-01, TEST-02 ; sortie plan revu.
- **Tests/acceptation :** huit catégories, déterministe, no mutation.
- **Rollback/risques :** supprimer artefact hors Git ; classification fausse.

### M3-04 — Apply/verify reprenable

- **Objectif/étapes :** tests interruption/idempotence → apply batch → verify/report.
- **Modèle :** Terra high, revue sécurité Sol. **Taille :** L. **Parallèle :** non.
- **Fichiers autorisés :** scripts apply/verify/tests/evidence. **Interdits :** G + auto VERIFIED/fusion.
- **Dépendances/gates :** M3-03 review ; sortie candidats pending cohérents.
- **Tests/acceptation :** same plan no-op, V1 hashes identiques.
- **Rollback/risques :** rollback batch/revoke ; mauvaise relation.

### M3-05 — IDOR/coexistence/evidence

- **Objectif/étapes :** intégrer scopes SEC-04 → tests parent multi → V1 NR → preuve.
- **Modèle :** Sol xhigh. **Taille :** L. **Parallèle :** final.
- **Fichiers autorisés :** authorization scope/tests/evidence/gates. **Interdits :** G + route publique.
- **Dépendances/gates :** SEC-04, M3-01..04 ; sortie M3/M0A scope GO.
- **Tests/acceptation :** VERIFIED only, 404 IDOR, parentId inchangé.
- **Rollback/risques :** parent V2 off/revoke ; fuite PII P0.

## Définition de terminé d'un ticket

Test rouge observé, changement minimal, test vert, suites de non-régression ciblées, diff/ownership propres, rollback testé/documenté, commit unique et gate de sortie prouvée. Un ticket bloqué ne transmet pas une supposition au suivant.
