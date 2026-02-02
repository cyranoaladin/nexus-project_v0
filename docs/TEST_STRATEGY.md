# Stratégie de Tests - Nexus Réussite Platform

**Version**: 1.0
**Date**: 2026-02-01
**Objectif**: Suite de tests complète, fiable, déterministe, et 100% verte en CI

---

## Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Trois Niveaux de Tests](#trois-niveaux-de-tests)
3. [Conventions et Standards](#conventions-et-standards)
4. [Infrastructure de Test](#infrastructure-de-test)
5. [Matrice RBAC](#matrice-rbac)
6. [Élimination du Flakiness](#élimination-du-flakiness)
7. [Exécution Locale vs CI](#exécution-locale-vs-ci)
8. [Scripts de Test](#scripts-de-test)
9. [Best Practices](#best-practices)

---

## Vue d'Ensemble

### Objectifs Principaux

✅ **Déterminisme**: Chaque test produit le même résultat à chaque exécution
✅ **Rapidité**: Suite complète < 5 minutes en local, < 10 minutes en CI  
✅ **Fiabilité**: 100% de réussite en CI (0 flakiness)
✅ **Couverture**: >80% sur code critique, 100% sur endpoints sensibles
✅ **Isolation**: Aucune dépendance réseau externe ou état partagé

### Métriques Cibles

| Métrique | Cible | Actuel |
|----------|-------|--------|
| **Tests Unit** | >300 tests | 113 tests |
| **Tests Integration** | >50 tests | ~20 tests |
| **Tests E2E** | >20 tests | 1 test |
| **Couverture Code** | >80% | TBD |
| **Temps Exécution** | <5min local | ~3min |
| **Taux de Succès CI** | 100% | TBD |

---

## Trois Niveaux de Tests

### 1. Tests Unitaires (Unit Tests)

**Objectif**: Tester des unités de code isolées (fonctions, composants, helpers)  
**Environnement**: JSDOM (via Jest)  
**Scope**: Logique pure, validation, composants UI

**Fichiers**:
- \`__tests__/components/**/*.test.tsx\` - Composants React
- \`__tests__/lib/**/*.test.ts\` - Helpers, validations, utils
- Config: \`jest.config.unit.js\`

**Caractéristiques**:
- ✅ Rapides (<1s par test)
- ✅ Pas de DB, pas de réseau
- ✅ Mocks pour dépendances externes
- ✅ Test IDs stables (\`data-testid\`)

**Convention de Nommage**:
- \`*.test.ts\` pour helpers/lib
- \`*.test.tsx\` pour composants React

---

### 2. Tests d'Intégration (Integration Tests)

**Objectif**: Tester l'interaction entre couches (API + DB réelle)  
**Environnement**: Node.js (via Jest)  
**Scope**: Endpoints API, transactions DB, workflows backend

**Fichiers**:
- \`__tests__/api/**/*.test.ts\` - Endpoints API
- Config: \`jest.config.integration.js\`

**Caractéristiques**:
- ✅ DB PostgreSQL réelle (via Docker)
- ✅ Transactions isolées (rollback après chaque test)
- ✅ Fixtures standardisées
- ✅ Pas de dépendances réseau externes (mocks)

**Convention de Nommage**:
- \`*.test.ts\` pour tous les tests d'intégration

---

### 3. Tests End-to-End (E2E Tests)

**Objectif**: Tester des parcours utilisateur réels (UI + API + DB)  
**Environnement**: Navigateurs réels (via Playwright)  
**Scope**: Flows critiques, authentification, workflows métier

**Fichiers**:
- \`e2e/**/*.spec.ts\` - Scénarios E2E
- Config: \`playwright.config.ts\`

**Caractéristiques**:
- ✅ DB éphémère isolée (container Docker)
- ✅ Navigateurs Chrome/Firefox/Safari
- ✅ Screenshots + traces en cas d'échec
- ✅ Pas de réseau externe (mocks API tierces)

**Convention de Nommage**:
- \`*.spec.ts\` pour tous les tests E2E

---

## Conventions et Standards

### Ports et URLs - Convention Unique

**Décision**: Tous les environnements utilisent le port **3000** pour l'app Next.js

| Environnement | App Port | DB Port | Base URL |
|---------------|----------|---------|----------|
| **Development** | 3000 | 5434 | http://localhost:3000 |
| **E2E Local** | 3000 | 5435 | http://localhost:3000 |
| **CI** | 3000 | 5432 | http://localhost:3000 |

**Raison**: Uniformité facilite le débogage et élimine les erreurs de configuration

---

### Database Isolation

**Principe**: Chaque niveau de test a sa propre DB isolée

**Development** (\`docker-compose.yml\`):
- Port: 5434
- DB: nexus_dev

**E2E** (\`docker-compose.e2e.yml\`):
- Port: 5435  
- DB: nexus_e2e
- tmpfs: In-memory for speed

**CI** (GitHub Actions service):
- Port: 5432
- DB: nexus_test

---

## Infrastructure de Test

### Setup DB E2E Éphémère

**Workflow**:
1. Start container (docker-compose.e2e.yml)
2. Run migrations (prisma migrate deploy)
3. Seed fixtures (scripts/seed-e2e-db.ts)
4. Run E2E tests
5. Stop container + cleanup volumes

**Scripts**:
- \`scripts/setup-e2e-db.sh\` - Setup DB
- \`scripts/teardown-e2e-db.sh\` - Cleanup
- \`scripts/seed-e2e-db.ts\` - Seed test data

---

## Matrice RBAC

**Objectif**: Vérifier que chaque rôle a les bonnes permissions

| Endpoint | Anonymous | STUDENT | PARENT | COACH | ADMIN |
|----------|-----------|---------|--------|-------|-------|
| \`GET /api/sessions\` | ✅ | ✅ | ✅ | ✅ | ✅ |
| \`POST /api/sessions/book\` | ❌ 401 | ✅ | ✅ | ❌ 403 | ✅ |
| \`DELETE /api/sessions/:id\` | ❌ 401 | ❌ 403 | ❌ 403 | ✅ (own) | ✅ |
| \`GET /api/users\` | ❌ 401 | ❌ 403 | ❌ 403 | ❌ 403 | ✅ |
| \`GET /api/admin/*\` | ❌ 401 | ❌ 403 | ❌ 403 | ❌ 403 | ✅ |

---

## Élimination du Flakiness

### Sources Communes

1. ❌ Dépendances réseau externes
2. ❌ Timeouts arbitraires
3. ❌ État partagé
4. ❌ Sélecteurs CSS fragiles
5. ❌ Animations/GSAP
6. ❌ Race conditions

### Solutions

#### Data Test IDs Stables

❌ **Mauvais**: \`await page.locator('.btn-primary').click();\`  
✅ **Bon**: \`await page.getByTestId('book-button').click();\`

#### Attentes Explicites

❌ **Mauvais**: \`await page.waitForTimeout(3000);\`  
✅ **Bon**: \`await expect(page.getByTestId('toast')).toBeVisible({ timeout: 5000 });\`

#### Réduire Animations

\`\`\`typescript
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});
\`\`\`

---

## Scripts de Test

\`\`\`bash
# Tests unitaires
npm run test:unit

# Tests d'intégration  
npm run test:integration

# Tests E2E
npm run test:e2e:setup
npm run test:e2e
npm run test:e2e:teardown

# Tous les tests
npm run test:all

# Vérification complète
npm run verify
\`\`\`

---

## Best Practices

### 1. Tests Indépendants

Chaque test doit pouvoir s'exécuter isolément

### 2. Arrange-Act-Assert (AAA)

\`\`\`typescript
it('calculates total', () => {
  // Arrange
  const sessions = [{ price: 50 }];
  
  // Act
  const total = calculateTotal(sessions);
  
  // Assert
  expect(total).toBe(50);
});
\`\`\`

### 3. Fixtures Réutilisables

\`\`\`typescript
export const testUsers = {
  admin: { email: 'admin@test.com', role: 'ADMIN' },
  parent: { email: 'parent@test.com', role: 'PARENT' },
};
\`\`\`

---

## Checklist Pre-Commit

- [ ] \`npm run lint\` passe
- [ ] \`npm run typecheck\` passe
- [ ] \`npm run test:unit\` passe
- [ ] \`npm run build\` réussit

**Script rapide**: \`npm run verify\`

---

**Dernière mise à jour**: 2026-02-01  
**Version**: 1.0
