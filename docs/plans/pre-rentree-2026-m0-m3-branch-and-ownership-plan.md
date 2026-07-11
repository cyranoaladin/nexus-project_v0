# Pré-rentrée 2026 M0–M3 Branch and Ownership Plan

> **For agentic workers:** REQUIRED: Use superpowers:using-git-worktrees before implementation and superpowers:executing-plans for each branch. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Isoler M0A, M0B/C, M1, M2 et M3 avec owners, fichiers et ordre d'intégration non ambigus.

**Architecture:** M0A et M0B/C sont parallélisables après validation du plan. Les branches Prisma sont séquentielles : M1 sur baseline approuvée, M2 et M3 repartent du M1 intégré ; le backfill M3 attend M0A vérifié.

**Tech Stack:** Git worktrees, branches locales, commits atomiques, revue Sol xhigh.

---

## Branches/worktrees futurs — ne pas créer dans cette phase

| Lot | Branche future | Worktree recommandé | Modèle/raisonnement | Entrée |
|---|---|---|---|---|
| M0A | `security/pre-rentree-2026-m0a` | `/home/alaeddine/Bureau/nexus-wt-pre-rentree-m0a` | Sol xhigh | plan approuvé, baseline fetchée |
| M0B/C | `infra/pre-rentree-2026-m0b-m0c` | `/home/alaeddine/Bureau/nexus-wt-pre-rentree-m0bc` | Terra high, revue Sol xhigh | plan approuvé |
| M0D | `test/pre-rentree-2026-m0d` | `/home/alaeddine/Bureau/nexus-wt-pre-rentree-m0d` | Terra high, revue Sol | M0B/C contrats stables |
| M1 | `feat/pre-rentree-2026-m1-schema` | `/home/alaeddine/Bureau/nexus-wt-pre-rentree-m1` | Terra high, revue Sol xhigh | M0B/M0C GO |
| M2 | `feat/pre-rentree-2026-m2-integrity` | `/home/alaeddine/Bureau/nexus-wt-pre-rentree-m2` | Sol xhigh ou Terra high + revue Sol obligatoire | M1 intégré |
| M3 | `feat/pre-rentree-2026-m3-guardian` | `/home/alaeddine/Bureau/nexus-wt-pre-rentree-m3` | Sol xhigh règles, Terra high implémentation, revue sécurité Sol | M1 intégré ; backfill après M0A |

Chaque branche part du SHA intégré réellement approuvé, pas du SHA documentaire supposé. `git fetch origin --prune`, status clean, merge-base et diff sont enregistrés. Aucun push sans mission ultérieure explicite.

## Réservations de fichiers

| Lot | Écriture exclusive | Lecture/revue | Interdit |
|---|---|---|---|
| M0A | `lib/guards.ts`, `lib/api-guard.ts`, `lib/rbac*`, `lib/stages/v2/authorization/**`, routes/tests sécurité ciblés | toutes routes | schema/migrations/pricing/pages |
| M0B | scripts `m0b`, compose test DB, preuves DB | Docker/CI | production write, schema Prisma |
| M0C | `package*.json`, Dockerfiles, CI/toolchain scripts | schema/migrations | upgrade Prisma autre que 6.19.2, db push |
| M0D | compose test, factories, Jest config, tests migration | schema en lecture | données réelles, app routes |
| M1 | `prisma/schema.prisma`, migration core, tests M1 | plans/ADR | M2/M3 SQL, modèle différé, V1 mutation |
| M2 | schema claim, migration integrity, tests M2 | M1 | modèle guardian, services/API |
| M3 | schema guardian, migration M3, scripts backfill, policies/tests parent | M1/M0A | parentId V1, fusion email, routes UI |

`prisma/schema.prisma` et `prisma/migrations` n'ont qu'un writer à la fois. M2/M3 ne commencent leur édition qu'après que M1 est présent dans leur baseline.

## Dépendances et fusion logique

```text
Plan approuvé
 ├─ M0A sécurité ───────────────┐
 ├─ M0B capacités ─┐           │
 └─ M0C outillage ─┴─ M0D ── M1 core ─┬─ M2 intégrité
                                      └─ M3 schema ── M3 backfill
M0A VERIFIED_IN_TEST ────────────────────────────────┘
```

Ordre de fusion recommandé : M0C → M0B/M0D → M0A → M1 → M2 → M3 schema → M3 backfill/policies. M0A/M0B peuvent être préparés en parallèle ; l'ordre final s'adapte aux conflits, mais M1 n'est jamais fusionné avant M0B/C GO, M2 jamais avant M1, backfill M3 jamais avant M0A.

## Commits attendus

- M0A : inventaire tests, auth fail-closed, policy engine, scope/redaction, gaps docs/factures/webhook, preuve.
- M0B/C : toolchain pin, DB probe, exclusion proof, backup/restore proof, harness.
- M0D : DB guard, stack, factories, lanes migration.
- M1 : catalogue, planning, application, contrat, capacité/audit, migration finale.
- M2 : claim model, checks/indexes, exclusions, tests concurrence, preuve.
- M3 : schema/constraints, inventory/plan, apply/verify, policies IDOR, preuve.

Un commit ne mélange pas schema et correction UI/pricing. Les commits de travail peuvent être regroupés seulement avant application d'une migration et avec historique de revue conservé.

## Gates par branche

| Branche | Gate entrée | Gate sortie |
|---|---|---|
| M0A | `DESIGN_BASELINE_DEFINED` | `VERIFIED_IN_TEST` |
| M0B | baseline DB accessible read-only | DB capability + backup/restore GO |
| M0C | lockfile audité | Node/Prisma/drift GO |
| M0D | M0B/C contrats | test harness GO |
| M1 | M0B/C GO | 21/19, fresh/V1, zero destructive |
| M2 | M1 intégré + extension | contraintes/concurrence GO |
| M3 | M1 + M0A pour backfill | relation/backfill/IDOR GO |

## Procédure de handoff

Chaque owner fournit : SHA, fichiers, commandes/tests et sorties, risques, rollback, gates, status Git. Le reviewer vérifie le diff depuis la vraie baseline et ne présume aucun commit d'une autre branche. Un conflit sémantique schema/guard arrête l'intégration ; pas de résolution ours/theirs aveugle.
