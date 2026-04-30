# P0 Deployment Plan - Non-Destructive with Rollback

**Date:** 29 avril 2026
**PR:** #32 - fix(security): harden production go-live blockers
**Commit:** 9dfd9592

---

## Executive Summary

This deployment plan outlines the non-destructive deployment of P0 security hardening changes to production. The deployment includes:
- Removal of SSL keys from Git tracking
- Neutralization of destructive deployment script
- SSL certificate backup before git pull
- Safe deployment script with safeguards

**CRITICAL:** SSL rotation in production is NOT included in this deployment. It requires a separate, coordinated operation with full backup.

---

## Pre-Deployment Checklist

### Infrastructure
- [ ] Verify production server access: root@<PROD_SSH_TARGET>
- [ ] Verify SSH key authentication works
- [ ] Verify Docker Compose is installed
- [ ] Verify nexus-app and nexus-postgres containers are healthy

### Backups
- [ ] Backup PostgreSQL database: `docker exec nexus-postgres-prod pg_dump -U postgres nexus_prod > backups/db-$(date +%Y%m%d-%H%M%S).sql`
- [ ] Backup storage/public directory: `tar -czf backups/storage-$(date +%Y%m%d-%H%M%S).tar.gz storage/public`
- [ ] Backup SSL certificates: `cp -r nginx/ssl backups/ssl-$(date +%Y%m%d-%H%M%S)/`
- [ ] Verify backup files exist and are not empty
- [ ] Note backup locations for rollback

### Code Review
- [ ] PR #32 is approved and reviewed
- [ ] All CI checks pass (398 suites, 5205 tests)
- [ ] Contract tests pass (5/5)
- [ ] No destructive commands in active scripts
- [ ] Hook pre-commit passes

### Communication
- [ ] Notify stakeholders of deployment window
- [ ] Prepare rollback communication
- [ ] Schedule maintenance window (recommended: low-traffic period)

---

## Deployment Steps

### Step 1: Pre-Deployment Verification (Local)

```bash
# Verify branch is clean
git status

# Verify commit hash
git log --oneline -1
# Expected: 9dfd9592 feat(deploy): add automatic SSL backup before git pull

# Run tests
npm test
# Expected: 398 passed, 5205 tests

# Run contract tests
npm test -- __tests__/config/deploy-contract.test.ts
# Expected: 5 passed
```

### Step 2: Backup Production (SSH into server)

```bash
ssh root@88.99.254.59

cd /opt/nexus

# Create backup directory
mkdir -p backups/$(date +%Y%m%d-%H%M%S)

# Backup database
docker exec nexus-postgres-prod pg_dump -U postgres nexus_prod > backups/$(date +%Y%m%d-%H%M%S)/db.sql

# Backup storage/public
tar -czf backups/$(date +%Y%m%d-%H%M%S)/storage.tar.gz storage/public

# Backup SSL certificates
cp -r nginx/ssl backups/$(date +%Y%m%d-%H%M%S)/ssl/

# Verify backups
ls -lh backups/$(date +%Y%m%d-%H%M%S)/
```

### Step 3: Deploy Using Safe Script

```bash
# Set confirmation environment variables
export CONFIRM_PRODUCTION_DEPLOY=yes

# Run safe deployment script
./scripts/deploy-production-safe.sh

# The script will:
# 1. Check repo is clean
# 2. Show current commit
# 3. Verify recent DB backup
# 4. Backup SSL certificates automatically
# 5. git pull --ff-only
# 6. Build nexus-app only (no postgres restart)
# 7. Restart nexus-app container
# 8. Run healthcheck
```

### Step 4: Post-Deployment Verification

```bash
# Check container status
docker ps -a | grep nexus

# Check nexus-app logs
docker logs nexus-app-prod --tail 100

# Check healthcheck
curl -f http://localhost:3000/api/health || exit 1

# Check HTTPS
curl -f https://nexusreussite.academy/api/health || exit 1

# Verify SSL certificates are still present
ls -la nginx/ssl/
```

---

## Rollback Procedure

### Immediate Rollback (if deployment fails)

```bash
ssh root@88.99.254.59
cd /opt/nexus

# Restore previous commit
git checkout <previous-commit-hash>

# Restore database (if needed)
docker exec -i nexus-postgres-prod psql -U postgres nexus_prod < backups/<timestamp>/db.sql

# Restore storage/public (if needed)
tar -xzf backups/<timestamp>/storage.tar.gz -C /opt/nexus

# Restore SSL certificates (if needed)
cp -r backups/<timestamp>/ssl/* nginx/ssl/

# Rebuild and restart nexus-app (must rebuild to apply previous commit)
docker compose -f docker-compose.prod.yml build nexus-app
docker compose -f docker-compose.prod.yml up -d nexus-app

# Verify
docker logs nexus-app-prod --tail 50
curl -f http://localhost:3000/api/health
```

### Rollback to Previous Working State

If deployment is successful but issues arise later:

```bash
# Revert the PR merge
git revert <merge-commit-hash>

# Redeploy using safe script
./scripts/deploy-production-safe.sh
```

---

## Risk Mitigation

### SSL Certificate Risk
**Risk:** SSL certificates deleted during git pull
**Mitigation:**
- Automatic backup before git pull in deploy script
- Manual backup verification before deployment
- Rollback procedure to restore certificates
- **NOT FIXED:** Rotation SSL requires separate operation

### Database Risk
**Risk:** Database corruption or data loss
**Mitigation:**
- Mandatory DB backup before deployment
- No database schema changes in P0
- No Prisma migrations in P0
- Rollback procedure to restore database

### Container Risk
**Risk:** Container startup failure
**Mitigation:**
- Build only nexus-app (no postgres restart)
- Healthcheck before marking deployment successful
- Rollback to previous image if startup fails

### Git Merge Conflict Risk
**Risk:** git pull --ff-only fails
**Mitigation:**
- Script exits with error before any destructive action
- Manual merge required if conflict
- No deployment until conflict resolved

---

## Post-Deployment Tasks (NOT in P0)

### SSL Rotation (Separate Operation)
- [ ] Execute SSL rotation procedure from docs/SECURITY_SSL_KEYS_ROTATION_2026-04-29.md
- [ ] Verify new certificates are valid
- [ ] Fix permissions: chmod 600 nginx/ssl/privkey.pem
- [ ] Restart nginx container
- [ ] Verify HTTPS works with new certificates

### P1 Audits
- [ ] Audit DB as single source of truth
- [ ] Audit remaining branches with proper notation
- [ ] Audit dashboards and pedagogy
- [ ] Audit RAG/LLM/ARIA in production
- [ ] Smoke test facturation assistante

---

## Success Criteria

Deployment is considered successful when:
- [ ] All pre-deployment checks pass
- [ ] All backups completed and verified
- [ ] Safe deployment script completes without errors
- [ ] nexus-app container starts successfully
- [ ] Healthcheck passes: `/api/health`
- [ ] HTTPS works: `https://nexusreussite.academy`
- [ ] SSL certificates are still present
- [ ] No database errors in logs
- [ ] No container crashes within 5 minutes

---

## Contact Information

**Deployment Lead:** [Name]
**On-Call Engineer:** [Name]
**Stakeholders:** [List]

**Emergency Rollback:** Execute rollback procedure immediately if any success criterion fails.
