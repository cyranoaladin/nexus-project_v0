# Déploiement Production — Nexus Réussite

**Dernière mise à jour :** 21 janvier 2026

## 1) Constat actuel
- `next.config.mjs` active `output: 'standalone'`.
- Le build exécute `scripts/copy-public-assets.js` pour copier `public/` dans `.next/standalone/public`.
- Les images Next.js sont **désoptimisées** (`images.unoptimized: true`).

## 2) Build recommandé
```bash
npm install
npm run db:generate
npm run db:push
npm run build
```

## 3) Démarrage production
```bash
npm run start
```

## 4) Points d’attention
- La base de données est **SQLite** par défaut. Les fichiers Docker/Postgres présents dans le repo ne sont pas alignés avec le schéma actuel.
- Si vous déployez via `.next/standalone`, vérifiez la présence de `.next/standalone/public`.

