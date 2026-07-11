# Pré-rentrée 2026 Migration SQL Execution Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Définir la création, revue, application et vérification des trois migrations additives M1–M3.

**Architecture:** Chaque migration est générée `--create-only`, complétée avant sa première application, testée fresh/V1 snapshot, puis déployée par `migrate deploy`. Les backfills restent des commandes de données séparées, idempotentes et auditables.

**Tech Stack:** Prisma 6.19.2, PostgreSQL 15, SQL contrôlé, pg_dump/restore.

---

## Noms futurs

Le timestamp réel est généré au moment de l'implémentation, sans renommer ensuite :

1. `<YYYYMMDDHHMMSS>_pre_rentree_v2_core`
2. `<YYYYMMDDHHMMSS>_pre_rentree_v2_integrity`
3. `<YYYYMMDDHHMMSS>_student_guardian_relationship`

Chaque dossier contient seulement `migration.sql`. Les plans/backfills/scripts ne sont jamais placés dans un dossier Prisma appliqué.

## Workflow commun

1. Revalider Git/origin/main et M0 gates.
2. `npm ci`; vérifier Node 20, Prisma CLI/Client 6.19.2.
3. Sauvegarde/restauration prouvée, DB dev/shadow allowlistées.
4. Écrire test qui échoue sans la migration.
5. Modifier schema Prisma selon le lot.
6. `prisma format`, `validate`, `generate`.
7. `prisma migrate dev --create-only --name <name>`.
8. Inspecter/compléter SQL avant toute application.
9. Scan interdit : DROP table/column, rename, enum historique supprimé, cascade V2, DML V1.
10. Appliquer `migrate deploy` sur fresh DB puis snapshot V1 rempli.
11. Tests/contraintes/drift/comptes V1.
12. Revue Sol xhigh, commit atomique, preuve.

`prisma db push` est interdit. Une migration déjà appliquée n'est jamais modifiée ; une correction est une nouvelle migration additive.

## Migration M1 core

| Élément | Contrat |
|---|---|
| Préconditions | M0A/B/C/D GO, DB sauvegardée, flags off |
| Généré attendu | 19 types enum, 21 tables, indexes/FKs Prisma |
| Tables | liste exacte du [plan M1](pre-rentree-2026-m1-core-schema-plan.md) |
| SQL manuel | aucun mécanisme M2 ; commentaires de provenance seulement |
| Backfill | aucun, tables vides |
| Locks | catalog locks et `ACCESS EXCLUSIVE` seulement sur nouvelles tables ; back-relations Prisma sans ALTER V1 |
| Compatibilité | application V1 ignore tables ; Client généré compatible |
| Vérification | 21/19, FK Restrict/SetNull, zéro ligne V1 modifiée, drift vide |
| Rollback logique | application précédente/flags off, tables conservées |
| Rollback physique | DB jetable seulement avant donnée : drop dans ordre FK inverse |

Le SQL généré doit créer les types Prisma nommés et les tables `pre_rentree_*`; aucun nom implicite ne doit diverger du plan.

## Migration M2 integrity

| Élément | Contrat |
|---|---|
| Préconditions | M1 appliqué, preflight vide, btree_gist/fallback GO |
| Généré attendu | table `pre_rentree_student_schedule_claims`, FKs/indexes ordinaires |
| SQL manuel | extension, exclusions, checks et index partiels exacts du [plan M2](pre-rentree-2026-m2-integrity-constraints-plan.md) |
| Backfill | aucun ; claims vides avant services |
| Ordre | table/FKs → preflight → extension → checks → uniques/index partiels → exclusions |
| Locks | ALTER court sur tables V2 vides/DRAFT ; fenêtre de migration, writes V2 off |
| Vérification | catalogues contraintes/indexes, tests overlap/adjacency/concurrence |
| Échec | transaction DDL rollback ; rapport contrainte/preflight, aucune correction automatique |
| Rollback logique | writes off, contraintes conservées |
| Rollback physique test | drop indexes/exclusions/checks/table claim en ordre inverse |

L'extension n'est pas supprimée au rollback : elle sert déjà à une contrainte V1 historique.

## Migration M3 guardian

| Élément | Contrat |
|---|---|
| Préconditions | M1/M2, M0A, enrollment count=0, backup |
| Généré attendu | 2 enums, table relation, back-relations, colonnes/FKs application+enrollment |
| SQL manuel | checks vérification/révocation/date, index primaire vérifié partiel |
| Backfill | hors migration : inventory→plan→review→apply→verify |
| Locks | ajout colonne/FK court ; writes V2 interdits ; V1 Student non altéré |
| Vérification | M:N, relations PENDING, scopes parent, parentId identique |
| Échec | rollback DDL transaction ; backfill lot transactionnel/reprenable |
| Rollback logique | parent V2 off, relations conservées/revoquées |
| Rollback physique | seulement DB jetable sans enrollment/application V2 |

Le SQL ne met jamais `verificationStatus=VERIFIED` par défaut et ne joint jamais sur email/téléphone.

## Vérification DDL

Les requêtes de preuve listent `_prisma_migrations`, les tables `pre_rentree_%`, `pg_constraint`, `pg_indexes` et `pg_extension`, puis comparent aux manifests de lot. Les comptes V1 avant/après incluent users, parent_profiles, students, stages, stage_sessions, stage_reservations, payments, invoices et user_documents.

## Temps de verrouillage

M1 crée uniquement de nouveaux objets. M2/M3 tournent avant write V2/public et avec `lock_timeout` local borné ; aucun lock n'attend indéfiniment. Toute table V2 devenue non vide déclenche estimation count/taille/durée sur staging et fenêtre dédiée. Avant activation et faible cardinalité, les indexes transactionnels sont retenus ; un index concurrent exige un plan séparé.

## Interdictions

- `prisma db push` en staging/production/CI migration ;
- modification d'une migration appliquée ;
- `DROP TABLE`, `DROP COLUMN`, rename destructif, suppression enum V1 ;
- update/delete V1 ;
- backfill dans migration de schéma ;
- `ON DELETE CASCADE` sur V2 ;
- seed/reset non gardé ; dump ou secret commité.

## GO/NO-GO production

GO par lot : sauvegarde restaurée, migration testée fresh/snapshot, durée/locks mesurés staging, drift vide, tests verts, reviewer, flags off. NO-GO : DDL destructif, extension inconnue, enrollment non vide avant M3, backfill dans migration, comptes V1 divergents ou rollback nécessitant un drop production.
