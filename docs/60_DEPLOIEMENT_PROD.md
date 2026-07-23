# Déploiement Production

## ⚠️ IMPORTANT - Script de déploiement

### Script DESTRUCTEUR déplacé
Le script `scripts/deploy-production.sh` contenait `docker compose down --volumes --remove-orphans` qui supprime tous les volumes Docker (y compris la base de données).

**Action P0-3 (2026-04-29):**
- Script déplacé vers `scripts/legacy/deploy-production-dangerous.sh`
- Ajouté garde-fou: requiert `CONFIRM_DANGEROUS_DEPLOY=yes`
- **NE PAS UTILISER EN PRODUCTION**

### Scripts publics neutralisés

Les helpers `scripts/deploy-production-safe.sh`, `scripts/deploy-git-pull.sh`,
`scripts/test-ssh-connection.sh` et `scripts/ops/backup-db.sh` sont désormais
des garde-fous qui échouent volontairement. L'ancienne topologie Docker ne
correspond pas au runtime standalone observé et ne doit pas être réactivée.

Le déploiement et le rollback relèvent d'un runbook privé, contrôlé par le
propriétaire et testé en staging. Le présent document ne constitue pas une
autorisation ni une procédure opératoire.

### Contrat de sécurité
Test contractuel: `__tests__/config/deploy-contract.test.ts`
- Vérifie l'absence de `down --volumes` dans les scripts actifs
- Vérifie l'absence de `docker volume rm` dans les scripts actifs
- Vérifie l'absence de `system prune --volumes` dans les scripts actifs

## Pré-requis environnement
Variables critiques:
- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

Variables opérationnelles majeures:
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
- Paiement: `KONNECT_API_KEY`, `KONNECT_WALLET_ID`, `KONNECT_WEBHOOK_SECRET`
- LLM/RAG: `OLLAMA_URL`, `RAG_INGESTOR_URL`, `LLM_MODE`
- Notifications: `TELEGRAM_BOT_TOKEN`

Preuves code:
- `lib/env-validation.ts`
- `docker-compose.prod.yml`

## Migration DB
Commande canonique:
- `npx prisma migrate deploy`

Preuves code:
- `docker-compose.prod.yml` (service `migrate`)
- `scripts/start-prod-local.sh` (vérification migration)
- `ops/RUNBOOK_MIGRATION_PROD.md`

## Pipeline déploiement (compose prod)
```mermaid
flowchart TD
  A[postgres healthy] --> B[migrate service]
  B --> C[nexus-app standalone]
  C --> D[nginx reverse proxy]
  D --> E[/api/health]
```

Preuves code:
- `docker-compose.prod.yml`
- `Dockerfile.prod`

## Smoke tests post-deploy (checklist)
- [ ] `GET /api/health` retourne 200 derrière nginx.
- [ ] Connexion `/auth/signin` fonctionnelle.
- [ ] Redirection `/dashboard` selon rôle.
- [ ] Endpoint admin protégé (`/api/admin/dashboard` -> 401/403 sans admin).
- [ ] Submit assessment (`/api/assessments/submit`) puis polling status/result.
- [ ] Paiement: init endpoint (`/api/payments/konnect` ou `/api/payments/wise`) en environnement ciblé.

Preuves code:
- `docker-compose.prod.yml` (healthcheck)
- `ops/PROD_DEPLOY_2026-02-17.md`
- `ops/PROD_DEPLOY_2026-02-18.md`

## Observabilité minimale
- Logs applicatifs + sécurité (`logger`, middleware security events).
- Validation env au boot (fail-fast prod).
- Sentry prévu via `SENTRY_DSN` (optionnel).

Preuves code:
- `middleware.ts` (`logSecurityEvent`)
- `lib/env-validation.ts` (`SENTRY_DSN` optionnel)
- `instrumentation.ts`

> **ATTENTION**
> Aucune procédure de déploiement ne doit activer de bypass middleware/auth en production (`SKIP_MIDDLEWARE`, `DISABLE_MIDDLEWARE` restent dev-only selon `middleware.ts`).
