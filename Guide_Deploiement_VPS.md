# Guide Déploiement VPS (Template)

**Dernière mise à jour :** 21 janvier 2026

Ce guide est un **template**. Les scripts VPS du dossier `scripts/` sont **hard‑codés** (IP, chemin, branche). Avant utilisation, adaptez :
- `scripts/test-ssh-connection.sh`
- `scripts/deploy-git-pull.sh`
- `scripts/deploy-incremental.sh`

## Déploiement simple
1. Cloner le repo sur le VPS
2. Configurer les variables d’environnement (`.env.production` ou équivalent)
3. Build + start

```bash
npm install
npm run db:generate
npm run db:push
npm run build
npm run start
```

## Note DB
Le projet utilise SQLite par défaut. Pour PostgreSQL, basculer Prisma et migrations.

