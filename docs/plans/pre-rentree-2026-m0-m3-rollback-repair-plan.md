# Pré-rentrée 2026 M0–M3 Rollback and Repair Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revenir à un service V1 sûr ou réparer V2 sans suppression destructive.

**Architecture:** Le rollback primaire est applicatif : flags fermés, writes V2 stoppés, tables additives conservées. La restauration DB est réservée à une corruption confirmée et suit M0B ; les réparations sont idempotentes, planifiées et auditées.

**Tech Stack:** feature flags, Prisma/PostgreSQL, pg_dump/restore, scripts plan/apply/verify.

---

## Scénarios

| Situation | Action immédiate | Réparation/rollback | GO de reprise |
|---|---|---|---|
| avant application | arrêter, corriger plan/branche | aucun DDL | revue plan/tests |
| échec migration | ne pas relancer aveuglément | vérifier `_prisma_migrations`, DB/locks ; rollback transaction attendu | cause comprise, DB cohérente |
| migration appliquée sans activation | garder tables, flags off | nouvelle migration corrective additive | drift/tests verts |
| données DRAFT présentes | interdire writes/public | manifest, script repair plan/apply/verify | invariants restaurés |
| contrainte M2 erronée | flags/writes off | migration corrective nommée ; ne pas éditer l'appliquée | concurrency tests verts |
| backfill M3 partiel | parent V2 off | reprise batch/checksum, aucun delete | verify complet |
| erreur sécurité/autorisation | couper API/public/dashboard V2 | patch M0A, révoquer grants/relations si nécessaire | revue sécurité/IDOR |
| relation responsable corrompue | couper accès parent concerné/V2 | REVOKE relation, nouvelle relation vérifiée, audit | double contrôle humain |
| drift Prisma | stop migration/deploy | comparer schema/migrations/DB, migration corrective | diff vide |
| btree_gist indisponible | ne pas appliquer M2 | fallback trigger ADR ou NO-GO | DB guarantee testée |

## Ordre de fermeture

1. `PRE_RENTREE_V2_PUBLIC=false`.
2. `PRE_RENTREE_V2_API=false` pour commandes ; diagnostics admin sûrs seulement.
3. `PRE_RENTREE_V2_DASHBOARDS=false` si fuite/contrat DTO.
4. Stopper workers V2 ; aucun outbox M0–M3 n'est actif.
5. Fermer allocations, laisser expirer/libérer holds DRAFT/test.
6. Capturer SHA, migrations, counts, constraints et logs redacted.
7. Décider repair, rollback applicatif ou restore.

L'application V1 précédente doit fonctionner avec les tables additives. Ne jamais router une donnée V2 vers `StageReservation` pour compenser.

## Scripts de réparation futurs

Chaque famille suit `inventory → plan → checksum → apply --batch-size requis → verify → report` :

- `scripts/pre-rentree/repair/rebuild-student-schedule-claims.ts` ;
- `scripts/pre-rentree/repair/expire-seat-holds.ts` ;
- `scripts/pre-rentree/repair/guardian-relations.ts` ;
- `scripts/pre-rentree/repair/materialization-consistency.ts`.

Règles : DB allowlistée, dry-run défaut, idempotence, transaction par lot, aucun SQL Unsafe avec entrée, aucun hard delete, audit/correlationId, rapport avant/après sans PII.

## Restauration

Restaurer seulement sur corruption structurelle/données confirmée et décision responsable infra + Nexus. Procédure : stopper writes globaux si nécessaire, nouveau backup incident, vérifier checksum du dernier bon dump, restaurer isolément, comparer, définir perte potentielle/RPO, puis bascule contrôlée. Ne jamais restaurer directement par-dessus la production sans répétition isolée.

## Escalade

| Niveau | Critère | Décideurs |
|---|---|---|
| P0 | fuite PII/IDOR, corruption financière/V1, migration destructive | sécurité + infra + responsable Nexus |
| P1 | V2 DRAFT incohérente, exclusion/capacité défaillante | Sol + infra |
| P2 | preuve/report/fixture non conforme sans impact runtime | owner du lot + reviewer |

Tout P0 gèle M0–M3, conserve les artefacts redacted et exige une nouvelle décision GO.

## Checklist GO/NO-GO

- [ ] flags fermés testés ;
- [ ] V1 smoke et comptes historiques intacts ;
- [ ] backup/restore disponibles ;
- [ ] diagnostic sans secret/PII ;
- [ ] repair dry-run/checksum revus ;
- [ ] apply idempotent/reprenable ;
- [ ] verify avant/après ;
- [ ] reviewer indépendant ;
- [ ] aucune suppression V1/table/colonne/enum ;
- [ ] décision GO horodatée.

NO-GO si la seule stratégie est un drop, db push, modification de migration appliquée, fusion automatique de compte ou SQL manuel non reproductible.
