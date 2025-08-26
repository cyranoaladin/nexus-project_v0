# Procédure de déploiement sur VPS (Production)

Objectif: déployer la stack (Next + Postgres + RAG + LLM + PDF) à partir d’images Docker versionnées, avec rollback possible.

Pré-requis VPS

- Docker et Docker Compose installés
- Domaine et reverse proxy HTTPS (Caddy/Traefik/Nginx) pointant sur le port 3000 (Next)
- Fichiers présents dans le WORKDIR (ex: `/opt/nexus`):
  - `docker-compose.yml` (repo)
  - `docker-compose.override.yml` (repo)
  - `docker-compose.rollback.yml` (repo)
  - `.env.production` (non versionné, `chmod 600`)
- Accès au registry (login Docker côté VPS si nécessaire)

Fichier `.env.production` (exemple de clés)

- `NODE_ENV=production`
- `NEXTAUTH_URL=https://nexusreussite.academy`
- `NEXTAUTH_SECRET={{NEXTAUTH_SECRET}}`
- `DATABASE_URL=postgresql://{{POSTGRES_USER}}:{{POSTGRES_PASSWORD}}@db:5432/nexus_reussite?schema=public`
- `POSTGRES_DB=nexus_reussite`
- `POSTGRES_USER={{POSTGRES_USER}}`
- `POSTGRES_PASSWORD={{POSTGRES_PASSWORD}}`
- `SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, SMTP_FROM`
- `OPENAI_API_KEY={{OPENAI_API_KEY}}`
- `RAG_SERVICE_URL=http://rag_service:8000`
- `PDF_GENERATOR_SERVICE_URL=http://pdf_generator_service:8000`
- `LLM_SERVICE_URL=http://llm_service:8000`

Variables d’environnement runtime (exporter avant `docker compose`)

- `REGISTRY` (ex: `ghcr.io/organisation`)
- `IMAGE_PREFIX` (ex: `nexus`)
- `IMAGE_TAG` (ex: `v1.2.3`)

Déploiement (manuel ou via CI)

1. Se connecter au VPS
2. Se placer dans le WORKDIR
3. Exporter `REGISTRY`, `IMAGE_PREFIX`, `IMAGE_TAG`
4. Vérifier `.env.production`
5. `docker compose pull && docker compose up -d`
6. Vérifier la santé:
   - `curl -fsS http://localhost:3000/api/health`
   - `curl -fsS http://localhost:8001/health`
   - `curl -fsS http://localhost:8002/health`
   - `curl -fsS http://localhost:8003/health`

Rollback

- Définir `PREV_IMAGE_TAG` (ex: `v1.2.2`)
- `docker compose -f docker-compose.rollback.yml up -d`
- Revalider les healthchecks

Bonnes pratiques

- Ne jamais stocker de secrets en clair dans le repo. Utiliser `.env.production` local au VPS.
- Forcer HTTPS au niveau reverse proxy et activer HSTS.
- Utiliser des tags SemVer pour déployer (workflow CI déployé sur tag `v*.*.*`).
- Conserver les logs applicatifs et systèmes (`journald`/`docker logs`) et prévoir une solution centralisée si besoin.
- Mettre en place une surveillance (`Uptime-Kuma`/`StatusCake`) + alertes.
