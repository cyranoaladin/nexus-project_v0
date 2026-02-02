# Test Scripts - Quick Reference

Documentation rapide des scripts de test disponibles dans `package.json`.

---

## 🧪 Tests Unitaires

```bash
# Run all unit tests
npm run test:unit

# Run unit tests in watch mode (auto-rerun on file change)
npm run test:unit:watch

# Run with coverage report
npm run test:coverage
```

**Scope**: Composants UI, helpers, validation, logique pure
**Environnement**: JSDOM (Jest)
**Fichiers**: `__tests__/components/**/*.test.tsx`, `__tests__/lib/**/*.test.ts`
**Durée**: ~30 secondes

---

## 🔗 Tests d'Intégration

```bash
# Run all integration tests
npm run test:integration

# Run integration tests in watch mode
npm run test:integration:watch
```

**Scope**: Endpoints API, transactions DB
**Environnement**: Node.js (Jest) + PostgreSQL
**Fichiers**: `__tests__/api/**/*.test.ts`
**Durée**: ~1-2 minutes
**Prérequis**: PostgreSQL running (port 5434)

---

## 🌐 Tests E2E

### Setup & Teardown

```bash
# Setup E2E database (required before first run)
npm run test:e2e:setup

# Teardown E2E database (cleanup)
npm run test:e2e:teardown

# Full E2E flow (setup → test → teardown)
npm run test:e2e:full
```

### Run Tests

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run with browser visible (headed mode)
npm run test:e2e:headed

# Run in debug mode (step through)
npm run test:e2e:debug

# Run only Chromium tests
npm run test:e2e:chromium
```

**Scope**: Parcours utilisateur complets (UI + API + DB)
**Environnement**: Playwright (Chrome/Firefox/Safari)
**Fichiers**: `e2e/**/*.spec.ts`
**Durée**: ~3-5 minutes (tous navigateurs)
**Prérequis**: App running on port 3000, E2E DB setup

---

## 🚀 Scripts Globaux

### test:all

```bash
npm run test:all
```

**Exécute**: Unit → Integration → E2E (full flow)
**Durée**: ~5-7 minutes
**Usage**: Avant commit important ou release

---

### test:ci

```bash
npm run test:ci
```

**Exécute**: Unit + Integration (optimisé CI)
**Options**: `--coverage --maxWorkers=2`
**Durée**: ~2-3 minutes
**Usage**: Dans pipeline CI/CD (GitHub Actions)

---

### verify

```bash
npm run verify
```

**Exécute**: Lint → TypeCheck → test:all → Build
**Durée**: ~8-10 minutes
**Usage**: Pre-commit hook, validation complète

---

### verify:quick

```bash
npm run verify:quick
```

**Exécute**: Lint → TypeCheck → Unit → Integration (pas E2E)
**Durée**: ~3-4 minutes
**Usage**: Validation rapide avant push

---

## 📊 Autres Scripts

```bash
# Run unit + integration tests together
npm run test

# Run tests in watch mode (unit + integration)
npm run test:watch
```

---

## 🎯 Workflow Recommandé

### Développement Local

```bash
# En continu pendant le développement
npm run test:unit:watch

# Avant chaque commit
npm run verify:quick

# Avant merge vers main
npm run verify
```

### CI/CD Pipeline

```bash
# GitHub Actions (fast feedback)
npm run test:ci

# Nightly build (comprehensive)
npm run verify
```

### Debug Tests

```bash
# Debug unit test spécifique
npm run test:unit -- __tests__/lib/validation.test.ts

# Debug E2E avec UI
npm run test:e2e:ui

# Debug E2E step-by-step
npm run test:e2e:debug
```

---

## ⚠️ Troubleshooting

### E2E Tests Fail: "Connection refused"

**Problème**: App not running or wrong port

**Solution**:
```bash
# Check if app is running on port 3000
lsof -i :3000

# Start app if needed
npm run dev
```

---

### E2E Tests Fail: "Database error"

**Problème**: E2E database not setup

**Solution**:
```bash
# Reset E2E database
npm run test:e2e:teardown
npm run test:e2e:setup
```

---

### Integration Tests Fail: "Cannot connect to database"

**Problème**: PostgreSQL not running

**Solution**:
```bash
# Start dev database
docker-compose up -d

# Check status
docker-compose ps
```

---

### Tests Take Too Long

**Solutions**:
```bash
# Run only unit tests (fastest)
npm run test:unit

# Run with specific maxWorkers
npm run test:unit -- --maxWorkers=4

# Run only changed files
npm run test:unit -- --onlyChanged
```

---

## 📈 Métriques

| Script | Durée | Tests | Coverage |
|--------|-------|-------|----------|
| `test:unit` | ~30s | 113 | 70%+ |
| `test:integration` | ~1-2min | 20+ | 80%+ |
| `test:e2e` | ~3-5min | 33+ | N/A |
| `test:all` | ~5-7min | 166+ | Combined |
| `verify` | ~8-10min | All + Build | Full |

---

## 🔗 Références

- **TEST_STRATEGY.md** - Stratégie complète de tests
- **playwright.config.ts** - Configuration E2E
- **jest.config.unit.js** - Configuration tests unitaires
- **jest.config.integration.js** - Configuration tests intégration

---

**Dernière mise à jour**: 2026-02-01
**Version**: 1.0
