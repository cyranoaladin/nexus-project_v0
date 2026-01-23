# Documentation Tests E2E (Playwright)

**Dernière mise à jour :** 21 janvier 2026

## 1) Configuration utilisée
- Config par défaut : `playwright.config.ts`
- TestDir : `__tests__/e2e`
- Base URL : `http://localhost:3000` (ou `BASE_URL`)
- Serveur auto : `npm run dev`

Config alternative : `playwright.config.e2e.ts` (mode standalone)

## 2) Lancer les tests
```bash
# Standard (dev server)
npm run test:e2e

# UI mode
npm run test:e2e:ui

# Standalone (nécessite build préalable)
npm run build
npx playwright test -c playwright.config.e2e.ts
```

## 3) Suites disponibles (actuelles)
Dans `__tests__/e2e/` :
- `homepage-audit.spec.ts`
- `offres-page.e2e.test.tsx`

Le dossier `e2e/` contient d’autres scénarios Playwright qui **ne sont pas exécutés** par défaut.

## 4) Variables utiles
- `BASE_URL` : override du host cible
- `NEXTAUTH_SECRET` et `DATABASE_URL` sont injectées dans `playwright.config.e2e.ts` (standalone)

