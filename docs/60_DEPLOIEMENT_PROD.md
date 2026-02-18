# Déploiement Production

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
