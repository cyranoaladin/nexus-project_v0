# Pré-rentrée 2026 M0D Test Environment Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fournir un environnement PostgreSQL 15 reproductible prouvant migrations, sécurité, identité, capacité et collisions sans donnée réelle.

**Architecture:** Une stack Docker dédiée crée des bases éphémères allowlistées. Les migrations V1 puis M1–M3 sont déployées exactement comme en production ; des factories typées créent uniquement les lignes nécessaires et les tests de concurrence utilisent plusieurs PrismaClient réels.

**Tech Stack:** `pgvector/pgvector:pg15`, `btree_gist`, Prisma 6.19.2, Jest node, Docker Compose, TypeScript factories.

---

## Isolation obligatoire

- fichier futur `docker-compose.pre-rentree-test.yml` ; projet Compose `nexus_pre_rentree_test_<runId>` ;
- port alloué et base nommée `nexus_pre_rentree_test_<runId>[_wN]` ;
- refus si host non loopback/nom Docker allowlisté, port production, ou DB sans suffixe test ;
- aucune lecture de `.env.production` ; variables injectées par le harness ;
- volumes `tmpfs`, teardown avec vérification du project name ;
- tests DB M0–M3 en `--runInBand` sauf bases distinctes par worker ;
- tests de concurrence dans une même suite mais avec 2–20 connexions réelles ;
- jamais la base locale principale, staging ou production.

## Construction de la base

```text
PostgreSQL 15 vide
  → migrations V1 complètes (`prisma migrate deploy`)
  → assertions snapshot V1
  → future migration M1
  → future migration M2
  → future migration M3
  → fixtures synthétiques
  → suites
  → rapports
  → destruction du volume
```

`CREATE EXTENSION btree_gist` est vérifié avant M2. Une seconde lane restaure un snapshot V1 synthétique rempli, puis applique M1–M3 et compare les lignes V1.

## Fichiers futurs

| Fichier | Responsabilité |
|---|---|
| `docker-compose.pre-rentree-test.yml` | PostgreSQL 15 tmpfs dédié |
| `scripts/pre-rentree/test/assert-test-database.ts` | garde URL/host/port/db avant toute mutation |
| `scripts/pre-rentree/test/setup-db.ts` | create, migrate V1→M3, extension, proof |
| `scripts/pre-rentree/test/teardown-db.ts` | cleanup sûr |
| `__tests__/fixtures/pre-rentree-v2/factories.ts` | builders V1/V2 sans I/O implicite |
| `__tests__/fixtures/pre-rentree-v2/scenarios.ts` | scénarios composés et IDs |
| `__tests__/fixtures/pre-rentree-v2/constants.ts` | valeurs de test, jamais catalogue runtime |
| `jest.pre-rentree-db.config.js` | environnement node, runInBand/concurrency timeout |
| `__tests__/integration/pre-rentree-v2/*.db.test.ts` | intégrité M1–M3 |

## Factories requises

```ts
type FactoryContext = {
  prisma: PrismaClient;
  runId: string;
  sequence: number;
  clock: TestClock;
};

createUser(ctx, { role, email?: `${string}@example.test` })
createParentProfile(ctx, { userId })
createStudentV1(ctx, { userId, parentId, gradeLevel })
createCoachProfile(ctx, { userId, subjects })
createLegacyStageScenario(ctx, { formatHours: 9 | 12 | 15 | 18 | 20 | 30 })
createEditionV2(ctx, overrides?)
createModuleVariantV2(ctx, { gradeLevel, subject, variantCode })
createCohortWithSessionsV2(ctx, { capacity, teacherId?, roomId? })
createApplicationV2(ctx, { selections: 1 | 2 | 3 | 4 })
createProposalEnrollmentV2(ctx, { pack: 1 | 2 | 3 | 4 })
createGuardianRelationshipV2(ctx, { status, rights, validUntil? })
createSeatHoldV2(ctx, { status, expiresAt })
```

Chaque factory reçoit explicitement le client/clock, retourne les IDs et n'utilise ni `Math.random` non seedé, ni email/téléphone réel. Téléphones synthétiques non routables, emails `example.test`, noms `Test Parent <runId>`.

## Scénarios minimaux

| Scénario | Contenu |
|---|---|
| rôles | ADMIN, ASSISTANTE, COACH, PARENT, ELEVE + grants V2 futurs |
| famille A | parent A, deux enfants, relation vérifiée et non vérifiée |
| famille B | parent B, enfant B pour IDOR |
| multi-responsables | un élève, deux ParentProfile, droits différents |
| coachs | coach Math/NSI, Français, PC, coach non affecté |
| salles | salle 1/2, capacité 5, salle blackout |
| planning | 60 séances socle + overlaps ciblés |
| capacité | cohortes max 3/4/5, quatre places consommées |
| finance | snapshots 1–4 packs, paiement synthétique, aucun identifiant fournisseur réel |
| V1 | stages 9/12/15/18/20/30 h et `intensif-renfort`, réservations/paiements historiques |

## Nettoyage

- La stratégie primaire est destruction de la DB/volume, pas `deleteMany` en cascade.
- Pour test unitaire transactionnel : transaction rollback si le code testé n'ouvre pas sa propre transaction.
- Tests de transactions imbriquées/locks : base dédiée, teardown par runId après fermeture de tous les clients.
- Un timeout teardown échoue la CI ; il ne passe pas en warning.
- Le harness journalise seulement noms techniques de DB/containers, jamais credentials.

## Tests parallèles

- unitaires/policies : parallèles, sans DB ;
- intégration CRUD : une DB par worker ou `--runInBand` ;
- migrations/drift : séquentiels ;
- concurrence dernière place/exclusions : séquentiels au niveau Jest, concurrence interne réelle ;
- aucun partage d'horloge ou d'IDs entre workers ;
- limites pool : `max_connections` M0B, nombre de workers borné en conséquence.

## Anonymisation

Aucune copie de production n'est autorisée par défaut. Si une copie de référence devient indispensable, elle passe par un pipeline approuvé qui supprime/remplace noms, emails, téléphones, adresses, documents, tokens, contenus pédagogiques, références bancaires et logs. Le résultat est vérifié avant import et reste dans un environnement isolé à rétention `LEGAL_INPUT_REQUIRED`.

## Tasks

### Task 1: Guard de DB de test

**Files:**
- Create: `scripts/pre-rentree/test/assert-test-database.ts`
- Test: `__tests__/scripts/pre-rentree-test-database-guard.test.ts`

- [ ] Tester URLs production/staging, host distant, mauvais port/nom, URL absente.
- [ ] Implémenter allowlist explicite et `override:false`.
- [ ] Commit : `test(db): guard pre-rentree test database`.

### Task 2: Stack PostgreSQL 15 reproductible

**Files:**
- Create: `docker-compose.pre-rentree-test.yml`
- Create: `scripts/pre-rentree/test/setup-db.ts`
- Create: `scripts/pre-rentree/test/teardown-db.ts`

- [ ] Écrire test shell/TS de project name et volume tmpfs.
- [ ] Démarrer, attendre `pg_isready`, migrer et vérifier extensions.
- [ ] Teardown et vérifier absence de volume/container.
- [ ] Commit : `test(db): add isolated pre-rentree PostgreSQL harness`.

### Task 3: Factories V1/V2

**Files:**
- Create: `__tests__/fixtures/pre-rentree-v2/factories.ts`
- Create: `__tests__/fixtures/pre-rentree-v2/scenarios.ts`
- Test: `__tests__/fixtures/pre-rentree-v2/factories.test.ts`

- [ ] Écrire tests de déterminisme, unicité et absence de domaines/téléphones réels.
- [ ] Implémenter une factory à la fois, sans `any`/JSON non validé.
- [ ] Créer les scénarios famille/coach/capacité/V1.
- [ ] Commit : `test(fixtures): add deterministic pre-rentree scenarios`.

### Task 4: Deux lanes migration

**Files:**
- Create: `jest.pre-rentree-db.config.js`
- Create: `__tests__/integration/pre-rentree-v2/migration-fresh.db.test.ts`
- Create: `__tests__/integration/pre-rentree-v2/migration-v1-snapshot.db.test.ts`

- [ ] Lane vide : toutes migrations, checks de schéma.
- [ ] Lane V1 remplie : snapshot comptes, appliquer M1–M3, comparer.
- [ ] Vérifier zéro modification des tables/lignes V1.
- [ ] Commit : `test(migrations): cover fresh and populated V1 upgrades`.

## GO/NO-GO

GO : DB isolée prouvée, Prisma/PG exacts, factories déterministes, aucune PII, lanes fresh/V1, concurrence réelle et teardown fiable. NO-GO : test possible sur DB principale, données réelles, mock pour exclusion/lock, reset non gardé ou test P0 dépendant de l'ordre global.
