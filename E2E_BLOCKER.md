# E2E Test Blocker — RÉSOLU ✅

**Dernière mise à jour :** 21 février 2026

## Historique

Ce fichier documentait un blocage E2E causé par l'incompatibilité entre `next-auth v4` et Next.js 15 Edge Runtime (`EvalError: Code generation from strings disallowed`).

## Résolution

**Migration vers NextAuth v5 (Auth.js)** effectuée. Le middleware Edge est désormais compatible.

- **NextAuth** : v5.0.0-beta.30 (`auth.ts` + `auth.config.ts`)
- **Middleware** : `middleware.ts` utilise `auth` natif (pas de `withAuth`)
- **E2E** : 19 fichiers, 207 tests, 194+ passed en CI

## État actuel

```bash
npm run test:e2e   # Playwright E2E — fonctionne ✅
```

Ce fichier est conservé pour référence historique uniquement.
