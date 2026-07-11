# Pré-rentrée 2026 M0C Prisma Toolchain Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre Prisma, Node, Docker et CI déterministes avant de générer M1.

**Architecture:** Une seule version Prisma exacte alimente CLI et Client dans tous les environnements. Les migrations sont créées en `--create-only` sur DB isolée, inspectées, puis appliquées par `migrate deploy`; `db push` est interdit hors prototype jetable et interdit sans exception en production.

**Tech Stack:** Node 20.x, npm lockfile v3, Prisma CLI/Client 6.19.2, PostgreSQL 15, Docker/CI GitHub Actions.

---

## Audit des versions

| Surface | État observé | Risque | Cible M0C |
|---|---|---|---|
| `package.json` client | `@prisma/client ^6.19.2` | résolution future non déterministe | `6.19.2` exact |
| `package.json` CLI | `prisma ^6.13.0` | plage asymétrique | `6.19.2` exact |
| `package-lock.json` | CLI/client `6.19.2` | aligné aujourd'hui | régénéré par `npm install --save-exact` puis `npm ci` |
| CI | Node `20.x`, `npm ci`, `npx prisma` | correct si deps installées | conserver, ajouter vérification versions |
| Docker prod | `node:20-alpine`, `npm ci` | tag mutable | Node 20 + digest enregistré dans preuve release |
| Docker E2E | `node:18-alpine` | divergence de major | aligner Node 20 |
| Docker E2E runtime | `npm install -g prisma tsx` | CLI globale non pinée, peut devenir Prisma 7 | supprimer le global ou pinner `prisma@6.19.2` ; préférer binaire local |
| poste actuel | Node 22 observé | différent de CI/prod | implémentation/test canonique sous Node 20 |
| PostgreSQL | image `pgvector/pgvector:pg15` | tag mutable/capacité cible à prouver | PostgreSQL majeur 15, digest documenté |

La version canonique de cette phase est **Prisma 6.19.2** pour CLI et Client. Tout upgrade de major/minor est un lot séparé, jamais combiné à M1–M3.

## Fichiers futurs

| Action | Fichier | Règle |
|---|---|---|
| Modify | `package.json` | versions Prisma exactes, `engines.node` compatible Node 20 si approuvé |
| Modify | `package-lock.json` | uniquement via npm, review du diff |
| Modify | `Dockerfile.e2e` | Node 20 et binaire Prisma local |
| Review/Modify | `Dockerfile`, `Dockerfile.prod`, `Dockerfile.playwright` | aucune version Prisma globale |
| Modify | `.github/workflows/ci.yml` | job drift/migration et version proof |
| Create | `scripts/pre-rentree/m0c/check-toolchain.sh` | compare versions sans installer via réseau |
| Create | `docs/evidence/pre-rentree-2026/m0c-toolchain.md` | SHA, versions, commandes |

## Commandes canoniques

Après `npm ci`, toujours utiliser le binaire local :

```bash
node --version
npm --version
./node_modules/.bin/prisma --version
node -p "require('@prisma/client/package.json').version"
./node_modules/.bin/prisma format --schema prisma/schema.prisma
./node_modules/.bin/prisma validate --schema prisma/schema.prisma
./node_modules/.bin/prisma generate --schema prisma/schema.prisma
```

Attendu : Node major 20 ; CLI/Client 6.19.2. `npx prisma` sans `npm ci` est interdit car il peut télécharger une version différente.

## Stratégie migrate dev/create-only

Seulement dans une DB de développement isolée et avec une shadow DB distincte :

```bash
export DATABASE_URL="$MIGRATION_DEV_DATABASE_URL"
export SHADOW_DATABASE_URL="$MIGRATION_SHADOW_DATABASE_URL"
./node_modules/.bin/prisma migrate dev \
  --create-only \
  --name pre_rentree_v2_core \
  --schema prisma/schema.prisma
```

Avant la commande, le script valide que les deux noms de DB comportent un suffixe test/ephemeral et diffèrent. Après génération : inspecter SQL, `git diff`, absence de drop/rename/cascade, puis appliquer sur une nouvelle DB par `migrate deploy`.

## Stratégie migrate deploy

```bash
./node_modules/.bin/prisma migrate status --schema prisma/schema.prisma
./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma
./node_modules/.bin/prisma migrate status --schema prisma/schema.prisma
```

Production utilise uniquement `migrate deploy` avec le rôle migrateur, après M0B backup/restore et GO. Le rôle runtime ne possède pas les droits DDL.

## SQL manuel et contraintes hors Prisma

- M1 : SQL généré Prisma puis revue ; checks simples nommés peuvent être ajoutés à la migration non encore appliquée.
- M2 : migration `--create-only`, puis SQL manuel pour `CREATE EXTENSION IF NOT EXISTS`, exclusions GiST, index partiels et checks.
- M3 : table/relation générées puis SQL manuel pour index partiels et backfill séparé.
- Une migration déjà appliquée n'est jamais éditée. Toute correction crée une nouvelle migration additive.
- Chaque élément SQL manuel a commentaire `-- invariant`, nom stable, test positif/négatif et commande rollback documentaire.

## Drift

Sur DB éphémère migrée depuis zéro :

```bash
./node_modules/.bin/prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL" \
  --exit-code
```

Attendu : exit 0 et diff vide. Refaire après migration d'un snapshot V1. Une différence stoppe le lot ; `db push` ne sert jamais à la corriger.

## Politique db push/reset

- `prisma db push` : interdit en production, staging, CI de migration et toute DB partagée.
- Le script `db:push` existant doit être documenté comme local/prototype uniquement ou supprimé dans un lot outillage séparé après revue.
- `migrate reset --force` : uniquement base éphémère dont l'identité a été validée ; jamais DB locale principale ou distante.
- Aucun seed ne doit contourner les migrations.

## Tasks

### Task 1: Test de version fail-fast

**Files:**
- Create: `scripts/pre-rentree/m0c/check-toolchain.sh`
- Test: `__tests__/scripts/pre-rentree-m0c-toolchain.test.ts`

- [ ] Tester absence `node_modules`, Node major non 20 et CLI/client divergents.
- [ ] Implémenter lecture locale sans `npx` téléchargement.
- [ ] Ajouter au job CI migration.
- [ ] Commit : `chore(prisma): enforce pinned V2 toolchain`.

### Task 2: Aligner manifestes et Docker E2E

**Files:**
- Modify: `package.json`, `package-lock.json`, `Dockerfile.e2e`
- Test: build Docker E2E ciblé.

- [ ] Écrire le test/grep qui refuse `npm install -g prisma` non piné et Node 18.
- [ ] Pinner CLI/client 6.19.2 et Node 20 E2E.
- [ ] Exécuter `npm ci`, version check, `prisma generate`.
- [ ] Commit : `chore(prisma): align CLI client and Node runtime`.

### Task 3: Harness create-only/deploy/drift

**Files:**
- Create: `scripts/pre-rentree/m0c/create-migration.sh`
- Create: `scripts/pre-rentree/m0c/verify-migration-drift.sh`
- Test: `__tests__/scripts/pre-rentree-m0c-migration-guards.test.ts`

- [ ] Tester le refus d'une DB non allowlistée, shadow identique et commande `db push`.
- [ ] Encapsuler les commandes exactes sans secrets.
- [ ] Vérifier fresh DB et snapshot V1.
- [ ] Commit : `chore(prisma): add guarded migration workflow`.

## Rollback applicatif

Si M0C échoue avant migration : revenir au commit outillage, aucun DDL. Après migration additive : garder tables, revenir à l'application précédente compatible V1, flags V2 fermés. Une incompatibilité Prisma Client entraîne rebuild avec la version 6.19.2, jamais `db push`.

## GO/NO-GO

GO : Node 20 sur CI/prod/E2E, CLI=Client=6.19.2 local/CI/Docker, `npm ci`, validate/format/generate verts, fresh/snapshot/drift verts, aucune commande non gardée. NO-GO : téléchargement implicite Prisma, Node major divergent, shadow non isolée, drift ou besoin de `db push`.
