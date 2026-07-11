# Pré-rentrée 2026 M0B Database Capability Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prouver que développement, staging et production supportent PostgreSQL 15, les transactions et l'intégrité temporelle requises avant M1/M2.

**Architecture:** M0B est une collecte de preuves read-only suivie d'un test de sauvegarde/restauration isolé. `btree_gist` est la stratégie principale ; un trigger transactionnel avec advisory locks est le fallback documenté si l'extension ne peut pas être installée.

**Tech Stack:** PostgreSQL 15, `pgvector/pgvector:pg15`, `psql`, `pg_dump`, `pg_restore`, Docker Compose.

---

## Environnements et owners

| Environnement | Exécution | Responsable | Preuve |
|---|---|---|---|
| développement isolé | autorisée dans le worktree d'implémentation | Terra high | `m0b-development.txt` |
| CI/test éphémère | job dédié PostgreSQL 15 | Terra high | artefact CI |
| staging | fenêtre contrôlée, lecture puis restauration isolée | responsable infra + Terra | journal daté |
| production | **commandes read-only seulement dans M0B**, sur autorisation explicite | responsable infra | journal expurgé |

Ne jamais afficher `DATABASE_URL`, mot de passe ou dump. Les commandes ci-dessous utilisent une variable déjà injectée dans le processus.

## Commandes de capacité read-only

```bash
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
SELECT version();
SELECT current_database(), current_user;
SHOW server_version;
SHOW server_encoding;
SHOW lc_collate;
SHOW lc_ctype;
SHOW timezone;
SHOW default_transaction_isolation;
SHOW transaction_isolation;
SHOW max_connections;
SHOW statement_timeout;
SHOW lock_timeout;
SHOW idle_in_transaction_session_timeout;
SELECT name, default_version, installed_version
FROM pg_available_extensions
WHERE name IN ('btree_gist', 'vector')
ORDER BY name;
SELECT extname, extversion
FROM pg_extension
WHERE extname IN ('btree_gist', 'vector')
ORDER BY extname;
SELECT
  has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_in_database,
  has_schema_privilege(current_user, 'public', 'USAGE') AS can_use_public,
  has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_in_public;
SELECT c.conname, c.contype, c.conrelid::regclass AS table_name,
       pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
WHERE c.contype = 'x'
ORDER BY table_name::text, c.conname;
SQL
```

Attendu : serveur majeur 15 ; UTF8 ; timezone connue (UTC recommandé côté DB, sans substituer `edition.timeZone`) ; isolation `read committed` disponible et transaction `SERIALIZABLE` acceptée ; `btree_gist` installée ou disponible ; contrainte d'exclusion historique `SessionBooking` visible.

## Test transactionnel isolé

Uniquement sur la base de test dédiée :

```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;
SELECT transaction_isolation FROM pg_settings WHERE name='default_transaction_isolation';
SELECT 1;
ROLLBACK;
```

Deux connexions de test doivent prouver `SELECT ... FOR UPDATE`, timeout borné, deadlock détecté (`40P01`) et conflit sérialisable (`40001`). Aucun paramètre global production n'est modifié ; `lock_timeout` et `statement_timeout` sont réglés localement par transaction future.

## Extension btree_gist

### Déjà installée

- [ ] Relever version et owner de l'extension.
- [ ] Vérifier la migration historique qui l'a créée.
- [ ] Exécuter sur DB jetable une exclusion `text WITH =` + `tstzrange WITH &&`.
- [ ] Restaurer un dump contenant l'extension dans l'environnement isolé.

### Disponible mais non installée

M2 inclura, en première instruction transactionnelle :

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
```

Le responsable infra doit confirmer le rôle autorisé à déployer. Le service applicatif ordinaire ne reçoit pas `CREATE EXTENSION`.

### Non installable : fallback garanti

Le fallback n'est pas une simple validation applicative. Une migration M2 alternative crée une fonction trigger qui :

1. calcule une clé par type/ID de ressource ;
2. appelle `pg_advisory_xact_lock(hashtextextended(key, 0))` ;
3. cherche sous le même transaction snapshot toute plage active avec `startAt < NEW.endAt AND endAt > NEW.startAt` ;
4. lève `SQLSTATE 23P01` avec un nom métier stable en cas de conflit ;
5. s'exécute `BEFORE INSERT OR UPDATE` sur séances et claims élève.

Ce fallback exige une ADR complémentaire, des tests multi-connexions et la preuve que tout restore recrée fonctions/triggers. Si les triggers ou advisory locks sont également interdits, M2 est `NO-GO` et le statut devient `BLOCKED_BY_DATABASE_CAPABILITY`.

## Sauvegarde et restauration obligatoires

### Sauvegarde

```bash
umask 077
pg_dump "$DATABASE_URL" \
  --format=custom --compress=9 --no-owner --no-acl \
  --file="$EVIDENCE_DIR/pre-rentree-m0b-before.dump"
sha256sum "$EVIDENCE_DIR/pre-rentree-m0b-before.dump" \
  > "$EVIDENCE_DIR/pre-rentree-m0b-before.dump.sha256"
```

### Restauration isolée

```bash
createdb "$RESTORE_DATABASE_NAME"
pg_restore --exit-on-error --no-owner --no-acl \
  --dbname="$RESTORE_DATABASE_URL" \
  "$EVIDENCE_DIR/pre-rentree-m0b-before.dump"
```

La base restaurée est un environnement isolé sans application publique. Le dump n'est jamais commité.

### Comparaison

```sql
SELECT schemaname, relname, n_live_tup
FROM pg_stat_user_tables
ORDER BY schemaname, relname;

SELECT COUNT(*) FROM "users";
SELECT COUNT(*) FROM "students";
SELECT COUNT(*) FROM "stages";
SELECT COUNT(*) FROM "stage_reservations";
SELECT COUNT(*) FROM "payments";
SELECT COUNT(*) FROM "invoices";
```

Comparer source/restauration : checksum du dump, liste migrations Prisma, extensions, contraintes et comptes des tables critiques. `n_live_tup` n'est qu'indicatif ; les `COUNT(*)` font foi. Le rapport contient date UTC, environnement, SHA Git, versions, opérateur, reviewer, résultats et décision GO/NO-GO.

## Environnement de test isolé

- image exacte `pgvector/pgvector:pg15` ;
- port/volume dédiés et nom aléatoire par worker ;
- base jamais égale à la DB locale principale ;
- `DATABASE_URL` test validée par host/port/db allowlist avant reset ;
- migrations V1 via `prisma migrate deploy`, puis futures M1/M2/M3 ;
- `CREATE EXTENSION` exécuté par le rôle migrateur, pas le rôle application ;
- teardown `docker compose down -v` seulement après vérification de l'identité de stack.

## Tasks

### Task 1: Script read-only de collecte

**Files future:**
- Create: `scripts/pre-rentree/m0b/check-db-capabilities.sh`
- Test: `__tests__/scripts/pre-rentree-m0b-capabilities.test.ts`

- [ ] Tester refus d'URL absente, production sans `--read-only-production`, sortie redacted.
- [ ] Implémenter les requêtes ci-dessus avec `ON_ERROR_STOP`.
- [ ] Produire JSON + texte sans secret.
- [ ] Commit : `chore(db): add pre-rentree capability probe`.

### Task 2: Test btree_gist et fallback

**Files future:**
- Create: `scripts/pre-rentree/m0b/test-btree-gist.sql`
- Create: `__tests__/integration/pre-rentree-m0b-btree-gist.db.test.ts`

- [ ] Créer table temporaire et exclusion `[)`.
- [ ] Prouver overlap refusé et adjacency acceptée.
- [ ] Documenter le fallback trigger sans l'activer tant que l'extension fonctionne.
- [ ] Commit : `test(db): prove temporal exclusion capability`.

### Task 3: Backup/restore proof

**Files future:**
- Create: `scripts/pre-rentree/m0b/backup-restore-proof.sh`
- Create: `docs/evidence/pre-rentree-2026/m0b-backup-restore.md`

- [ ] Ajouter les gardes d'environnement et permissions 0600.
- [ ] Réaliser backup puis restore isolé.
- [ ] Comparer migrations/extensions/contraintes/comptes.
- [ ] Faire signer responsable + reviewer.
- [ ] Commit documentaire de preuve, jamais le dump.

## Gate GO/NO-GO

GO M0B : PostgreSQL 15 prouvé sur les trois environnements, extension ou fallback DB garanti, transactions/locks prouvés, sauvegarde restaurée et comparée, rôle migrateur identifié. NO-GO : version inconnue, restore non testé, extension/fallback impossibles, environnement de test non isolé ou secrets dans les artefacts.
