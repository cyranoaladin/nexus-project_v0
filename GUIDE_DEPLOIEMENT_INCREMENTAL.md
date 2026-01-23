# Guide de Déploiement Incrémental

**Dernière mise à jour :** 21 janvier 2026

Ce guide propose un déploiement par étapes. Il est aligné sur l’implémentation actuelle (SQLite).

## Étapes
1. Préparer l’environnement (`.env.production` ou variables équivalentes)
2. Build standalone : `npm run build`
3. Démarrer l’app : `npm run start`
4. Vérifier `/api/health`

## Note
Les fichiers Docker/PostgreSQL sont des **templates** à adapter si vous migrez vers PostgreSQL.

