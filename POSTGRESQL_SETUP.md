# PostgreSQL — Note d’intégration (Optionnel)

**Dernière mise à jour :** 21 janvier 2026

Le projet est **actuellement configuré en SQLite**. PostgreSQL n’est **pas** branché dans `prisma/schema.prisma`.

## Si vous voulez PostgreSQL
1. Modifier `prisma/schema.prisma` : `provider = "postgresql"`
2. Régénérer les migrations
3. Mettre à jour `DATABASE_URL`
4. Réviser les scripts Docker/compose si besoin

Ce guide sert de mémo pour une migration future.

