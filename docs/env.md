# Gestion des Variables d'Environnement et Injection de Secrets

Ce document décrit la gestion des variables d'environnement et l'injection de secrets (Doppler/Vault/env) pour Nexus Réussite.

## Fichiers .env

- `.env` base
- `.env.local` pour le dev
- `.env.production` pour la prod

## Variables requises (exemples)

Voir `env.example` et ajoutez:

```
JITSI_ENABLED=true
JITSI_BASE_URL=https://meet.jit.si
```

## Injection de secrets (Production)

### A. Variables d'environnement système (Docker)

Définissez vos secrets dans `.env.production` et référencez-les dans `docker-compose.yml` via `env_file` ou `environment`.

### B. Gestionnaire de secrets (Doppler / Vault)

Utilisez une CLI (ex: Doppler) pour exporter dans l'env avant le démarrage.

Exemple de wrapper:

```bash
#!/bin/bash
if command -v doppler >/dev/null 2>&1; then
  eval "$(doppler export --format bash)"
fi
exec "$@"
```

### Variables critiques à vérifier

- DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET
- SMTP_* (email), OPENAI_API_KEY
- CRON_SECRET, KONNECT_* si utilisé
