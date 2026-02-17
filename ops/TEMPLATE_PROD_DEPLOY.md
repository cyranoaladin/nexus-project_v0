# PROD DEPLOY — <DATE> — <TITLE>

> **Template** — Copier ce fichier pour chaque déploiement prod.
> Nommer : `ops/PROD_DEPLOY_<YYYY-MM-DD>_<SHORT_COMMIT>.md`

---

## 1. Commit déployé

```
$ git rev-parse HEAD
<COMMIT_SHA>
```

Commits inclus :
- `<sha>` — <description>

---

## 2. Backup pré-déploiement

```bash
# Commande
docker exec nexus-postgres-db pg_dump -U nexus_admin -Fc nexus_prod \
  > /root/backups/nexus/nexus_prod_pre_<tag>_<YYYYMMDD_HHMMSS>.dump

# Taille
ls -lh /root/backups/nexus/nexus_prod_pre_<tag>_*.dump

# Checksum
sha256sum /root/backups/nexus/nexus_prod_pre_<tag>_*.dump

# Contenu (pg_restore --list)
docker cp /root/backups/nexus/<dump_file> nexus-postgres-db:/tmp/audit.dump
docker exec nexus-postgres-db pg_restore --list /tmp/audit.dump | head -20
```

---

## 3. Prisma Migrate Status

```
$ DATABASE_URL='...' npx prisma migrate status
→ Database schema is up to date!
```

### Migrations appliquées

```sql
SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at;
```

---

## 4. Extraction SQL — Vérification schéma

```sql
-- Tables cibles
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN (...);

-- Colonnes ajoutées
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '...' AND column_name IN (...);
```

---

## 5. Smoke Tests

### Pages publiques (HTTP 200)

```bash
curl -s -o /dev/null -w '%{http_code}' https://nexusreussite.academy/<page>
→ 200
```

### RBAC — Négatif (sans session)

```bash
curl -s https://nexusreussite.academy/api/admin/directeur/stats
→ 403
```

### RBAC — Positif (session ADMIN)

```bash
# Login + cookie
curl -s -b cookies.txt https://nexusreussite.academy/api/admin/directeur/stats
→ 200
```

### Workflow — Submit → Result

```bash
curl -s -X POST https://nexusreussite.academy/api/assessments/submit -H "Content-Type: application/json" -d '{...}'
→ 201

curl -s https://nexusreussite.academy/api/assessments/<id>/result
→ 200
```

---

## 6. Test résilience (1x par release majeure)

```bash
# Stop Ollama
docker stop infra-ollama-1

# Submit assessment
curl -s -X POST .../api/assessments/submit ...
→ 201

# Verify result
curl -s .../api/assessments/<id>/result
→ 200, status=COMPLETED, errorCode=LLM_GENERATION_FAILED

# Restart Ollama
docker start infra-ollama-1
```

---

## 7. Environnement vérifié

| Variable | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `postgresql://...@postgres-db:5432/nexus_prod` |
| `NEXTAUTH_URL` | `https://nexusreussite.academy` |
| `OLLAMA_URL` | `http://ollama:11434` |
| Container | `nexus-next-app` Up (healthy) |
| Disque | `<X>%` utilisé |

---

## 8. Checklist

- [ ] Commit SHA vérifié
- [ ] Backup avec checksum
- [ ] Migrations appliquées
- [ ] Schéma SQL vérifié
- [ ] Smoke tests pages 200
- [ ] RBAC 403/200
- [ ] Workflow submit/result
- [ ] Test résilience LLM (si release majeure)
- [ ] Container healthy
- [ ] Validé par Lead

---

*Généré le <DATE>*
*Opérateur : <NOM>*
*Validé par : <LEAD>*
