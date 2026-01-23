# Guide des Tests — Nexus Réussite

**Dernière mise à jour :** 21 janvier 2026

## 1) Vue d’ensemble
- **Unit tests** : `__tests__/lib/*`
- **Integration tests** : `__tests__/api/*`
- **UI/components** : `__tests__/components/*`, `__tests__/pages/*`
- **E2E (Playwright)** : `__tests__/e2e/*`

⚠️ Le dossier `e2e/` contient aussi des scénarios Playwright, mais **la config par défaut pointe vers `__tests__/e2e/`**. Si vous voulez utiliser `e2e/`, changez `playwright.config.ts` ou lancez Playwright avec un autre `testDir`.

## 2) Lancer les tests
```bash
# Jest (unit + integration)
npm test

# Unit tests uniquement
npm run test:unit

# Integration tests uniquement
npm run test:integration

# Playwright (E2E) — config par défaut
npm run test:e2e

# Playwright UI
npm run test:e2e:ui
```

### Variante E2E « standalone »
Le fichier `playwright.config.e2e.ts` lance `.next/standalone` :
```bash
npx playwright test -c playwright.config.e2e.ts
```

## 3) Tests présents (réel)
### Unit / Lib
- `__tests__/lib/credits.test.ts`
- `__tests__/lib/validations.test.ts`
- `__tests__/lib/diagnostic-form.test.tsx`
- `__tests__/lib/bilan-gratuit-form.test.tsx`
- `__tests__/lib/form-validation-simple.test.ts`

### Components / Pages
- `__tests__/components/*` (bilan-gratuit, diagnostic, offres, navigation)
- `__tests__/pages/homepage.test.tsx`

### Integration (API)
- `__tests__/api/bilan-gratuit.test.ts`
- `__tests__/api-bilan-gratuit.test.ts`
- `__tests__/bilan-gratuit-integration.test.tsx`

### E2E (Playwright)
- `__tests__/e2e/homepage-audit.spec.ts`
- `__tests__/e2e/offres-page.e2e.test.tsx`

## 4) Notes importantes
- Les tests API s’exécutent en **Node environment** (`jest.config.integration.js`).
- Les tests Playwright peuvent nécessiter un serveur local déjà lancé (config `playwright.config.ts` gère `npm run dev`).
- Certains tests E2E utilisent des sélecteurs dépendants du contenu : vérifiez la stabilité des textes/DOM si vous modifiez les pages publiques.

