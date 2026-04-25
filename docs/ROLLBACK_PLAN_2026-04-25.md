# Plan de déploiement et de rollback — PR feat/dashboards-premiere-finalization

## État DB prod au 25/04/2026 17h

- 6 migrations appliquées proprement
- Aucune entrée fantôme dans `_prisma_migrations`
- Table `maths_progress` structurée avec colonne `track` (default `EDS_GENERALE`)
- Table `students` avec `gradeLevel`, `academicTrack`, `specialties`, `stmgPathway`, `updatedTrackAt`
- Colonne `survivalMode` ABSENTE — sera ajoutée par la migration de la PR

## Migration apportée par cette PR

- `20260504000000_add_survival_mode/migration.sql`
  - CREATE TABLE `survival_progress`
  - ADD COLUMN `students.survivalMode boolean NOT NULL DEFAULT false`
  - ADD COLUMN `students.survivalModeReason text NULLABLE`

Cette migration est **rétro-compatible** : aucune modification destructive,
aucune coercion de type, aucune perte de données possible.

## Procédure de déploiement

```bash
cd /opt/nexus

# 1. Backup DB (filename horodaté)
docker exec nexus-postgres-prod pg_dump -U nexus_admin -d nexus_prod -F c \
  -f /backups/pre-merge-survival-$(date +%Y%m%d-%H%M).dump

# 2. Pull main (après merge de la PR)
git fetch origin
git checkout main
git pull --ff-only

# 3. Drop le deploy-patch.patch local (intégré au repo)
rm -f deploy-patch.patch

# 4. Apply migration
docker compose -f docker-compose.prod.yml run --rm migrate npx prisma migrate deploy

# 5. Reload app
docker compose -f docker-compose.prod.yml up -d --build nexus-app

# 6. Healthcheck
sleep 15
curl -f http://127.0.0.1:3001/api/health || echo "❌ HEALTH FAILED — rollback"
```

## Rollback (si healthcheck échoue ou erreurs 500 > 1%)

```bash
# 1. Stop app
docker compose -f docker-compose.prod.yml stop nexus-app

# 2. Rollback DB au snapshot
docker exec -i nexus-postgres-prod pg_restore -U nexus_admin -d nexus_prod -c \
  < /backups/pre-merge-survival-XXX.dump

# 3. Revert au commit précédent
git reset --hard <commit-before-merge>

# 4. Rebuild
docker compose -f docker-compose.prod.yml up -d --build nexus-app
```

## Critères de déclenchement du rollback

- Healthcheck KO pendant > 60s après déploiement
- Erreurs 500 dans les logs `/api/student/dashboard` > 1% sur 5 minutes
- Latence p95 > 1s pour `/api/student/dashboard`
- Régression visuelle critique signalée par un élève dans les 30 min post-deploy

## Personne en charge du go/no-go

Shark (Alaeddine Ben Rhouma)
