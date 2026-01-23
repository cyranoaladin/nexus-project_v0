# Guide de Déploiement (Synthèse)

**Dernière mise à jour :** 21 janvier 2026

## Déploiement recommandé (SQLite)
```bash
npm install
npm run db:generate
npm run db:push
npm run build
npm run start
```

## Vérification rapide
- `GET /api/health`

## Notes
- Le projet est **configuré en SQLite**. Pour PostgreSQL, il faut modifier Prisma et les migrations.

