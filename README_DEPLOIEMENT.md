# README Déploiement — Nexus Réussite

**Dernière mise à jour :** 21 janvier 2026

## 1) État réel
- `Dockerfile.prod` et `docker-compose.prod.yml` existent, **mais le schéma Prisma est SQLite**. Ces fichiers sont à adapter si vous visez PostgreSQL en production.
- Aucun fichier `.env.production` n’est versionné dans le dépôt.
- Le build `standalone` est activé et copie les assets publics.

## 2) Déploiement recommandé (SQLite)
```bash
npm install
npm run db:generate
npm run db:push
npm run build
npm run start
```

## 3) Déploiement Docker (à adapter)
Si vous souhaitez PostgreSQL via Docker, **modifiez `prisma/schema.prisma`**, régénérez les migrations, et ajustez les variables d’environnement avant d’utiliser `docker-compose.prod.yml`.

## 4) Scripts utiles
- `scripts/prepare-deployment.sh` : prépare un build standalone (attend un `.env.production` externe)
- `scripts/copy-public-assets.js` : copie `public/` vers `.next/standalone/public`

