# Déploiement Production — Runbook

Ce guide décrit le déploiement, les vérifications post-déploiement et le rollback pour Nexus Réussite.

## Prérequis
- Docker + Docker Compose sur le serveur
- Fichier `.env` à la racine (copié depuis `.env.production.example` et complété)
- Image Docker de l’application (artifact de release: `nexus-app-vX.Y.Z.tar`)

## Déploiement rapide (recommandé)
1) Copier l’artifact et le dépôt (ou au minimum `docker-compose.prod.yml`, `config/nginx.prod.conf`, `scripts/` et `.env`).
2) Lancer le script:
   ```bash
   bash scripts/deploy/prod-deploy.sh nexus-app-vX.Y.Z.tar
   ```
   Le script:
   - charge l’image
   - démarre Postgres
   - démarre l’app + Nginx
   - applique les migrations Prisma
   - vérifie `/api/health`

## Variables essentielles (.env)
- App/Auth: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- DB: `DATABASE_URL` (ou trio `POSTGRES_*` + service compose `postgres`)
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
- OpenAI (ARIA): `OPENAI_API_KEY`, `OPENAI_MODEL` (ex: gpt-4o-mini)
- Konnect: `KONNECT_API_URL`, `KONNECT_API_KEY`, `KONNECT_WEBHOOK_SECRET`, `KONNECT_RETURN_URL`, `KONNECT_CANCEL_URL`
- Sentry (optionnel): `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE`

## Vérifications post-déploiement
- TLS/Nginx: site accessible en HTTPS, HSTS présent
- `/api/health`: 200 et DB connectée
- Auth: connexion parent/admin
- SSR guards: redirections /dashboard/* correctes selon rôle
- Konnect:
  - init OK (redirection vers page de paiement)
  - webhook signé OK (voir script ci-dessous)
- Bilan gratuit: création parent/élève + email de bienvenue via SMTP
- ARIA: réponse simple (OPENAI_MODEL défini)
- Logs: format JSON (lib/logger) pour erreurs critiques

## Maintenance Nginx
- Activer: `docker exec -it nexus-nginx sh -c 'mkdir -p /var/www/maintenance && touch /var/www/maintenance/ON'`
- Désactiver: `docker exec -it nexus-nginx sh -c 'rm -f /var/www/maintenance/ON'`

## Webhook Konnect (test signé)
Utiliser le script `scripts/deploy/test-konnect-webhook.sh`:
```bash
KONNECT_WEBHOOK_SECRET={{KONNECT_WEBHOOK_SECRET}} \
BASE_URL=https://nexusreussite.academy \
bash scripts/deploy/test-konnect-webhook.sh '{"payment_id":"<id|externalId>","status":"completed"}'
```
Retourne le code HTTP et la réponse JSON.

## Rollback
1) Arrêter services si nécessaire: `docker compose -f docker-compose.prod.yml down`
2) Charger image précédente: `docker load -i nexus-app-vPREV.tar`
3) Redémarrer: `docker compose -f docker-compose.prod.yml up -d`
4) Si migrations incompatibles: restaurer un backup Postgres (prévoir `pg_dump` avant déploiement).

## Sentry (opt-in)
- Installer `@sentry/nextjs` et définir `SENTRY_DSN`.
- `instrumentation.ts` active Sentry automatiquement si DSN présent (aucun impact sinon).
