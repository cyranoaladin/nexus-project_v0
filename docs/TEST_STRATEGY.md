# Test Strategy - Nexus Réussite

## 🎯 Objectifs

1. **Qualité** : Garantir un code fiable et maintenable
2. **Vélocité** : Tests rapides pour feedback immédiat
3. **Confiance** : Déployer en production sans régression
4. **Documentation** : Tests comme documentation vivante

---

## 📊 Pyramide de Tests

```
           /\
          /  \    E2E Tests (5%)
         /    \   - 1 test: premium-home.spec.ts
        /------\  - Chromium (CI)
       /        \
      / Integration \ (25%)
     /    Tests      \  - API routes
    /________________\  - Database interactions
   /                  \
  /   Unit Tests (70%)  \
 /______________________\ - Pure functions
                          - Business logic
                          - Utilities
```

### Répartition Cible

| Type | Quantité | Couverture | Durée |
|------|----------|------------|-------|
| **Unit** | ~50-70 tests | 70%+ | < 5s |
| **Integration** | ~15-25 tests | 70%+ | < 30s |
| **E2E** | ~5-10 tests | Parcours critiques | < 2min |

---

## 🧪 Types de Tests

### 1. Unit Tests

**Objectif** : Tester des fonctions isolées

**Framework** : Jest + Testing Library (jsdom)

**Configuration** : `jest.config.unit.js`

**Portée** :
- `__tests__/lib/**/*.test.ts(x)`
- Fonctions pures (validations, utils, calculations)
- Hooks React custom
- Composants UI simples

**Exemple** :

```typescript
// __tests__/lib/validations.test.ts
import { validateEmail } from '@/lib/validations'

describe('validateEmail', () => {
  it('should accept valid email', () => {
    expect(validateEmail('test@example.com')).toBe(true)
  })

  it('should reject invalid email', () => {
    expect(validateEmail('invalid')).toBe(false)
  })
})
```

**Coverage Threshold** : 70% (branches, functions, lines, statements)

---

### 2. Integration Tests

**Objectif** : Tester les API routes avec base de données

**Framework** : Jest (Node environment)

**Configuration** : `jest.config.integration.js`

**Portée** :
- `__tests__/api/**/*.test.ts`
- API routes (`app/api/**/route.ts`)
- Database interactions (Prisma)
- External services (mocked)

**Setup** : `jest.setup.integration.js`
- Mock Prisma client
- Mock NextAuth
- Mock external APIs (OpenAI, SMTP, etc.)

**Exemple** :

```typescript
// __tests__/api/health.test.ts
import { GET } from '@/app/api/health/route'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma')

describe('GET /api/health', () => {
  it('should return 200 when database is connected', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }])

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('ok')
  })
})
```

**Coverage Threshold** : 70%

---

### 3. E2E Tests

**Objectif** : Tester les parcours utilisateurs critiques

**Framework** : Playwright

**Configuration** : `playwright.config.ts`

**Portée** :
- `e2e/**/*.spec.ts`
- Parcours complets (navigation, forms, interactions)
- Multi-browser (Chromium prioritaire en CI)

**Browsers** :
- ✅ Chromium (CI + local)
- ⚪ Firefox (local only)
- ⚪ WebKit (local only)

**Tests Critiques** :

| Test | Fichier | Parcours |
|------|---------|----------|
| Premium Home Journey | `e2e/premium-home.spec.ts` | Hero → Paths → Offer → Contact |

**Best Practices** :
- `reducedMotion: 'reduce'` pour performances
- `waitUntil: 'networkidle'` pour fiabilité
- `force: true` pour clicks sur éléments GSAP pinned
- Timeouts 15s pour animations lourdes

**Exemple** :

```typescript
// e2e/premium-home.spec.ts
test('Hero Section loads with premium content', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })

  const heading = page.getByRole('heading', {
    name: /L'Intelligence Artificielle et le Web3/i
  })

  await expect(heading).toBeVisible({ timeout: 15000 })
})
```

---

## 🗂️ Matrice de Couverture

### Modules Critiques

| Module | Unit | Integration | E2E | Priorité |
|--------|------|-------------|-----|----------|
| **Auth** | `lib/auth.ts` | `/api/auth/*` | Login flow | 🔴 P0 |
| **Payments** | `lib/payments.ts` | `/api/payments/*` | - | 🔴 P0 |
| **Credits** | `lib/credits.ts` | `/api/student/credits` | - | 🔴 P0 |
| **Sessions** | `lib/session-booking.ts` | `/api/sessions/*` | Booking flow | 🟠 P1 |
| **ARIA** | `lib/aria.ts` | `/api/aria/*` | Chat interaction | 🟠 P1 |
| **Validations** | `lib/validations.ts` | - | Form validation | 🟡 P2 |
| **Email** | `lib/email.ts` | - | - | 🟡 P2 |
| **Healthcheck** | - | `/api/health` | - | 🟢 P3 |

### Couverture Actuelle

**Unit Tests** (`__tests__/lib/`) :
- ✅ `validations.test.ts` (8 tests)
- ✅ `credits.test.ts` (5 tests)
- ✅ `credits.refund-idempotency.test.ts` (3 tests)
- ✅ `payments.upsert-externalId.test.ts` (2 tests)
- ✅ `bilan-gratuit-form.test.tsx` (multiple)
- ✅ `diagnostic-form.test.tsx` (multiple)

**Integration Tests** (`__tests__/api/`) :
- ✅ `health.test.ts` (5 tests) ← NEW
- ✅ `bilan-gratuit.test.ts` (multiple)

**E2E Tests** (`e2e/`) :
- ✅ `premium-home.spec.ts` (5 tests)

---

## 🚀 Commandes de Test

### Local

```bash
# Unit tests
npm run test:unit              # Run once
npm run test:unit -- --watch   # Watch mode

# Integration tests
npm run test:integration       # Run once

# All Jest tests (unit + integration)
npm test

# Coverage report
npm run test:coverage

# E2E tests
npm run test:e2e              # All browsers
npm run test:e2e:ui           # UI mode (debug)
npx playwright test --project=chromium  # Single browser
```

### CI (GitHub Actions)

```yaml
# .github/workflows/tests.yml
- Lint
- TypeScript type check
- Build production
- Unit tests
- Integration tests
- E2E tests (Chromium)
```

**CI Database** : PostgreSQL 15 (service container)

---

## 🎭 Mocking Strategy

### External Services

**Toujours mocker** :
- ✅ OpenAI API (`lib/aria.ts`)
- ✅ SMTP (Nodemailer)
- ✅ Payment gateways (Konnect, Wise)
- ✅ Prisma (integration tests)

**Exemple Mock Prisma** :

```typescript
// jest.setup.integration.js
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), create: jest.fn() },
    session: { findMany: jest.fn() },
    // ... autres modèles
  }
}))
```

### NextAuth

```typescript
// Mock session
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: { id: '1', role: 'ELEVE', email: 'test@example.com' }
    },
    status: 'authenticated'
  })
}))
```

---

## 🔒 Test Security & Sanitization

### Error Handling Tests

Tous les endpoints API doivent avoir des tests vérifiant :

1. **No Information Disclosure**
   ```typescript
   it('should NOT expose error details', async () => {
     const response = await GET()
     const data = await response.json()

     expect(data.error).toBeUndefined()
     expect(JSON.stringify(data)).not.toContain('SECRET')
   })
   ```

2. **Proper Status Codes**
   - 200 : Success
   - 400 : Client error (bad input)
   - 401 : Unauthorized
   - 403 : Forbidden
   - 503 : Service unavailable (not 500)

3. **Input Validation**
   ```typescript
   it('should reject invalid email', async () => {
     const response = await POST({ email: 'invalid' })
     expect(response.status).toBe(400)
   })
   ```

---

## 📈 Coverage Reports

### Local

```bash
npm run test:coverage
```

Output : `coverage/lcov-report/index.html`

### CI

Coverage reports are uploaded as artifacts on CI failures :
- `playwright-report/` (E2E failures)
- `npm-audit-report.json` (Security vulnerabilities)

---

## 🔄 Test Workflow

### Développement

1. **TDD** (Test-Driven Development) pour business logic critique
   ```
   RED → GREEN → REFACTOR
   ```

2. **Écrire tests AVANT code** pour :
   - Validations
   - Calculs crédits
   - Logique paiements
   - Idempotence

3. **Écrire tests APRÈS code** pour :
   - UI components
   - Pages
   - Endpoints simples CRUD

### Pull Request

**Checklist** :
- [ ] Tous les tests passent localement
- [ ] Coverage ≥ 70%
- [ ] Nouveaux tests pour nouvelles fonctionnalités
- [ ] Tests de sécurité pour endpoints sensibles
- [ ] E2E tests mis à jour si parcours modifié

### CI/CD

**Pipeline** :
```
Checkout → Install → Generate Prisma → Migrate DB
  ↓
Lint → TypeCheck → Build
  ↓
Unit Tests → Integration Tests
  ↓
E2E Tests (Chromium)
  ↓
✅ Merge si tout passe
```

**Fail-Fast** : Le pipeline s'arrête à la première erreur

---

## 🐛 Debugging Tests

### Jest

```bash
# Run single test file
npm run test:unit -- __tests__/lib/validations.test.ts

# Run tests matching pattern
npm run test:unit -- --testNamePattern="email"

# Verbose output
npm run test:unit -- --verbose

# Debug mode (Node inspector)
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Playwright

```bash
# UI mode (visual debugger)
npm run test:e2e:ui

# Debug mode
npx playwright test --debug

# Headed mode (see browser)
npx playwright test --headed

# Trace viewer (après échec)
npx playwright show-trace trace.zip
```

---

## 📋 Conventions de Nommage

### Fichiers

```
__tests__/
  lib/
    validations.test.ts          ← Unit test
  api/
    health.test.ts               ← Integration test
  components/
    HomePage.test.tsx            ← Component test
e2e/
  premium-home.spec.ts           ← E2E test
```

### Describe Blocks

```typescript
// Route tests
describe('GET /api/health', () => {})

// Function tests
describe('validateEmail', () => {})

// Component tests
describe('HomePage', () => {})
```

### Test Names

```typescript
// ✅ Bon : describe le comportement attendu
it('should return 200 when database is connected', () => {})
it('should reject invalid email format', () => {})

// ❌ Éviter : décrit l'implémentation
it('calls prisma.user.findUnique', () => {})
```

---

## 🎯 Objectifs de Couverture

### Court Terme (Q1 2026)

- [x] Unit tests : 70% coverage
- [x] Integration tests : 70% coverage
- [x] E2E tests : 1 parcours critique (Home Journey)
- [ ] Tous les endpoints API ont au moins 1 test

### Moyen Terme (Q2 2026)

- [ ] Unit tests : 80% coverage
- [ ] Integration tests : 80% coverage
- [ ] E2E tests : 5 parcours (Auth, Booking, Payment, ARIA, Admin)
- [ ] Visual regression tests (Chromatic / Percy)

### Long Terme (Q3 2026)

- [ ] Unit tests : 90% coverage
- [ ] Integration tests : 90% coverage
- [ ] E2E tests : 10 parcours (tous rôles)
- [ ] Performance tests (Lighthouse CI)
- [ ] Accessibility tests (axe-core)

---

## 📚 Ressources

- [Jest Documentation](https://jestjs.io/)
- [Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

---

**Dernière mise à jour** : 2026-02-01
**Maintainers** : Équipe Nexus Réussite
