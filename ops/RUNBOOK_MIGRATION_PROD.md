# Runbook — Migration Prisma en Production

> **Règle** : la migration doit être exécutée par un runner qui "voit" les fichiers de migration
> du commit déployé ET une `DATABASE_URL` qui résout correctement.

---

## Architecture

```
┌─────────────────────┐     ┌──────────────────────┐
│  Host (88.99.254.59) │     │  Docker Network       │
│                     │     │                      │
│  /opt/nexus         │     │  nexus-next-app      │
│  ├── prisma/        │     │  (port 3000 interne) │
│  │   └── migrations/│     │  DB_URL: postgres-db  │
│  └── node_modules/  │     │                      │
│                     │     │  nexus-postgres-db   │
│  Port exposé:       │◄────│  (port 5432 interne) │
│  127.0.0.1:5435     │     │                      │
└─────────────────────┘     └──────────────────────┘
```

## Problème

Le container `nexus-next-app` est un build **figé** (image Docker multi-stage).
Quand on fait `git pull` sur le host, les nouveaux fichiers de migration sont sur le host
mais **pas** dans le container (ancien build).

`npx prisma migrate deploy` depuis le container → "No pending migrations" (faux négatif).

## Procédure standard

### Pré-requis

```bash
# Sur le host, dans /opt/nexus
cd /opt/nexus
git fetch --all && git pull origin main

# Vérifier que node/npx sont disponibles sur le host
node -v   # >= 18
npx --version

# Installer les dépendances (prisma CLI)
npm ci
```

### Étape 1 — Construire la DATABASE_URL host-compatible

La `DATABASE_URL` dans `.env` pointe vers `postgres-db:5432` (réseau Docker interne).
Depuis le host, il faut utiliser le port exposé `127.0.0.1:5435`.

```bash
# Extraire le mot de passe depuis .env
source .env
# URL-encoder les caractères spéciaux (ex: == → %3D%3D)
HOST_DB_URL="postgresql://${POSTGRES_USER}:<URL_ENCODED_PASSWORD>@127.0.0.1:5435/${POSTGRES_DB}?schema=public"
```

**Attention** : si le mot de passe contient `=`, `+`, `/`, `@`, il faut les URL-encoder :
- `=` → `%3D`
- `+` → `%2B`
- `/` → `%2F`
- `@` → `%40`

### Étape 2 — Backup (obligatoire)

```bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec nexus-postgres-db pg_dump -U nexus_admin -Fc nexus_prod \
  > /root/backups/nexus/nexus_prod_pre_migrate_${TIMESTAMP}.dump
ls -lh /root/backups/nexus/nexus_prod_pre_migrate_${TIMESTAMP}.dump
```

### Étape 3 — Migration

```bash
DATABASE_URL="${HOST_DB_URL}" npx prisma migrate deploy
```

Sorties attendues :
- `Applying migration 20260217_xxx` → OK
- `All migrations have been successfully applied.` → OK

**Si échec** :
1. Ne PAS continuer
2. Vérifier les logs d'erreur
3. Si lock timeout → attendre et réessayer
4. Si erreur SQL → restaurer le backup :
   ```bash
   docker cp /root/backups/nexus/nexus_prod_pre_migrate_${TIMESTAMP}.dump \
     nexus-postgres-db:/tmp/restore.dump
   docker exec nexus-postgres-db pg_restore -U nexus_admin -d nexus_prod \
     --clean --if-exists /tmp/restore.dump
   ```

### Étape 4 — Prisma Generate (host)

```bash
npx prisma generate
```

### Étape 5 — Rebuild container

```bash
docker compose build next-app
docker compose up -d next-app
```

### Étape 6 — Vérification

```bash
# Container healthy
docker ps --filter name=nexus-next-app --format '{{.Names}} {{.Status}}'

# HTTP 200
curl -s -o /dev/null -w '%{http_code}' https://nexusreussite.academy/

# Migration status
DATABASE_URL="${HOST_DB_URL}" npx prisma migrate status
# → "Database schema is up to date!"
```

---

## Checklist rapide

- [ ] `git pull` → commit attendu vérifié
- [ ] `npm ci` sur host
- [ ] Backup DB avec timestamp
- [ ] `DATABASE_URL` host-compatible (127.0.0.1:5435)
- [ ] `npx prisma migrate deploy` → succès
- [ ] `npx prisma generate`
- [ ] `docker compose build next-app`
- [ ] `docker compose up -d next-app`
- [ ] Container healthy
- [ ] HTTP 200 sur page publique
- [ ] Smoke tests RBAC + workflow

---

## Rollback

```bash
# 1. Restaurer DB
docker cp /root/backups/nexus/nexus_prod_pre_migrate_YYYYMMDD_HHMMSS.dump \
  nexus-postgres-db:/tmp/restore.dump
docker exec nexus-postgres-db pg_restore -U nexus_admin -d nexus_prod \
  --clean --if-exists /tmp/restore.dump

# 2. Revenir au commit précédent
cd /opt/nexus
git checkout <previous_commit>

# 3. Rebuild + restart
docker compose build next-app
docker compose up -d next-app
```

---

*Créé le 2026-02-17*
*Basé sur le post-mortem du déploiement Nexus 2.0*
