# Guide de Déploiement Complet — Nexus Réussite

**Dernière mise à jour :** 21 janvier 2026

## 1) Choix d’architecture (réel)
- **Actuel** : Prisma + SQLite.
- **Optionnel** : PostgreSQL (nécessite de modifier `prisma/schema.prisma` + migrations).

## 2) Déploiement simple (SQLite)
```bash
npm install
npm run db:generate
npm run db:push
npm run build
npm run start
```

## 3) Déploiement Docker (à adapter)
Le fichier `docker-compose.prod.yml` est prévu pour PostgreSQL. Pour l’utiliser :
1. Basculer Prisma en PostgreSQL.
2. Régénérer les migrations.
3. Mettre à jour `DATABASE_URL` et variables Docker.

## 4) Proxy / SSL
Si vous utilisez Nginx en reverse proxy, configurez un vhost standard qui pointe vers le port de l’app (ex: 3000).

