# Guide des Tests — Nexus Réussite

**Dernière mise à jour :** 21 février 2026

## 1) Vue d'ensemble

| Type | Framework | Config | Suites | Tests |
|------|-----------|--------|--------|-------|
| **Unit + API** | Jest + jsdom | `jest.config.js` | 206 | 2 593 |
| **DB Intégration** | Jest + node + PostgreSQL | `jest.config.db.js` | 7 | 68 |
| **E2E** | Playwright + Chromium | `playwright.config.ts` | 19 | 207 |

### Arborescence des tests

```
__tests__/                    # 216 fichiers Jest
├── api/                      # Tests API routes (mocked Prisma)
├── components/               # Tests composants React (jsdom)
├── pages/                    # Tests pages (jsdom)
├── lib/                      # Tests logique métier
│   ├── access/               # Feature gating (56 tests)
│   ├── programmes/           # Diagnostic mapping (84 tests)
│   ├── rbac.test.ts          # RBAC policies (21 tests)
│   └── scoring-engine.test.ts # Scoring (25 tests)
├── concurrency/              # Tests concurrence DB (serial)
├── database/                 # Tests schéma DB (serial)
├── db/                       # Tests pipeline DB (serial)
├── transactions/             # Tests transactions DB (serial)
├── setup/                    # test-database.ts, helpers
│   └── test-database.ts      # testPrisma client, truncate, UUID data
└── e2e/                      # Tests E2E Jest (homepage audit)

e2e/                          # 19 fichiers Playwright
├── auth-and-booking.spec.ts  # Auth + booking flow
├── qa-auth-workflows.spec.ts # QA auth workflows
├── parent-dashboard.spec.ts  # Parent dashboard
├── student-journey.spec.ts   # Student journey
├── helpers/                  # Auth, credentials, DB helpers
└── ...
```

## 2) Lancer les tests

```bash
# Unit + API (parallel, exclut les dirs DB)
npm test

# DB intégration (serial, --runInBand)
npm run test:db-integration

# Les deux séquentiellement
npm run test:all

# Playwright E2E
npm run test:e2e

# Playwright UI mode
npm run test:e2e:ui

# Playwright Chromium uniquement
npx playwright test --project=chromium
```

## 3) Architecture Jest

### Deux configs séparées

- **`jest.config.js`** — Unit + API tests
  - Environnement : `jest-environment-jsdom-with-fetch.js` (jsdom + Web Fetch API polyfill)
  - Setup : `jest.setup.js` (Proxy Prisma mock, ESM mocks, crypto polyfill)
  - Exclut : `concurrency/`, `database/`, `db/`, `transactions/`
  - Parallèle : oui (workers par défaut)

- **`jest.config.db.js`** — DB integration tests
  - Environnement : node
  - Setup : `__tests__/setup/test-database.ts` (testPrisma, truncate, UUID data)
  - Inclut : `concurrency/`, `database/`, `db/`, `transactions/`
  - Serial : `maxWorkers: 1`, `--runInBand`

### Mocking Prisma

Les tests unitaires utilisent un **Proxy-based Prisma mock** (`jest.setup.js`) qui auto-crée des `jest.fn()` pour chaque méthode appelée. Les tests DB utilisent `testPrisma` (vrai client connecté à PostgreSQL).

## 4) E2E (Playwright)

- Config : `playwright.config.ts` (testDir: `e2e/`)
- Serveur : build standalone (`.next/standalone`)
- DB : `nexus_e2e` (seed via `scripts/seed-e2e-db.ts`)
- Credentials : `e2e/.credentials.json` (généré par le seed)
- CI : job dédié avec PostgreSQL service + build + seed

## 5) CI/CD

Les tests sont exécutés dans 3 jobs CI séparés :

| Job | Script | DB requise |
|-----|--------|------------|
| `unit` | `npm test -- --ci --coverage` | Non |
| `integration` | `npm run test:db-integration -- --ci` | Oui (PostgreSQL service) |
| `e2e` | `npx playwright test --project=chromium` | Oui (nexus_e2e) |

## 6) Notes importantes

- Les tests DB nécessitent PostgreSQL (local port 5435 ou CI port 5432)
- Les hooks `beforeAll`/`afterAll` des tests DB ont un timeout de 30s
- Les données de test utilisent des UUID v4 pour éviter les collisions
- `TRUNCATE ... RESTART IDENTITY CASCADE` est exécuté entre les suites DB
- Les tests E2E nécessitent un build préalable + seed de la DB E2E
