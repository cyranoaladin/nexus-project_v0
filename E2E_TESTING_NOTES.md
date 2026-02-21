# E2E Testing Notes

**Dernière mise à jour :** 21 février 2026

## Statut — RÉSOLU ✅

L'incompatibilité Edge Runtime (`EvalError: Code generation from strings disallowed`) est **résolue** depuis la migration vers NextAuth v5 (Auth.js). Le middleware fonctionne nativement en Edge Runtime.

## Architecture E2E actuelle

- **Config** : `playwright.config.ts` (testDir: `e2e/`)
- **Serveur** : build standalone (`.next/standalone`)
- **DB** : `nexus_e2e` (seed via `scripts/seed-e2e-db.ts`)
- **Résultats CI** : 19 fichiers, 207 tests, 194+ passed

## Lancer les tests

```bash
npm run test:e2e            # Playwright E2E
npm run test:e2e:ui         # UI mode (debug interactif)
npm run test:e2e:headed     # Voir le navigateur
```

## Historique

Ce fichier documentait un blocage E2E causé par `next-auth v4` + Edge Runtime.
La migration vers NextAuth v5 a résolu le problème. Les workarounds (middleware swap, `DISABLE_MIDDLEWARE`) ne sont plus nécessaires.
