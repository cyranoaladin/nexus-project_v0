# Tests Strategy — Nexus Réussite

**Dernière mise à jour :** 21 février 2026

## Statut Actuel (CI vert ✅)

| Type | Suites | Tests | Failures | Skipped |
|------|--------|-------|----------|---------|
| **Unit + API** | 206 | 2 593 | 0 | 0 |
| **DB Intégration** | 7 | 68 | 0 | 0 |
| **E2E (Chromium)** | 19 | 207 | 0 | 0 |
| **Total** | **232** | **2 868** | **0** | **0** |

- ✅ **Lint** : 0 errors, 0 warnings
- ✅ **TypeCheck** : `tsc --noEmit` — 0 errors
- ✅ **Build** : Next.js production build OK

## Architecture des Tests

### Séparation Unit / DB

Les tests Jest sont séparés en deux configs pour éviter les conflits :

- **`jest.config.js`** — Unit + API (parallel, jsdom + Web Fetch polyfill)
  - Prisma mocké via Proxy auto-créant des `jest.fn()`
  - Exclut les dirs DB : `concurrency/`, `database/`, `db/`, `transactions/`

- **`jest.config.db.js`** — DB intégration (serial, node)
  - Vrai client Prisma (`testPrisma`) connecté à PostgreSQL
  - `maxWorkers: 1`, `--runInBand` pour éviter les contentions
  - Truncate + UUID pour isolation complète

### E2E (Playwright)

- NextAuth v5 (Auth.js) — compatible Edge Runtime
- Build standalone + seed DB E2E (`scripts/seed-e2e-db.ts`)
- Credentials dynamiques (`e2e/.credentials.json`)
- `continue-on-error: true` en CI (ne bloque pas le merge)

## Commandes

```bash
npm test                    # Unit + API (parallel)
npm run test:db-integration # DB intégration (serial)
npm run test:all            # Les deux séquentiellement
npm run test:e2e            # Playwright E2E
```

## CI Pipeline (7 jobs)

| Job | Scope | DB | Timeout |
|-----|-------|-----|---------|
| `lint` | ESLint | Non | — |
| `typecheck` | `tsc --noEmit` | Non | — |
| `unit` | Jest unit + API | Non | — |
| `integration` | Jest DB | Oui (PostgreSQL) | — |
| `e2e` | Playwright | Oui (nexus_e2e) | 20 min |
| `security` | npm audit + semgrep | Non | — |
| `build` | Next.js build | Non | — |
