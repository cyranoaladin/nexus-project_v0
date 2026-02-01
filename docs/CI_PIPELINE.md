# CI Pipeline Documentation

Documentation complète du pipeline CI/CD pour Nexus Réussite.

---

## Vue d'ensemble

Le pipeline CI garantit la qualité du code avant merge dans `main`. Tous les jobs doivent passer (statut vert) pour pouvoir merger.

**Fichier**: `.github/workflows/ci.yml`

**Triggers**:
- `pull_request` vers `main` - Validation avant merge
- `push` sur `main` - Vérification après merge

**Durée totale**: ~15-20 minutes (jobs en parallèle)

---

## Architecture des Jobs

```
┌─────────────────────────────────────────────────────────┐
│                     Triggers                             │
│          (pull_request / push → main)                    │
└─────────────────────────────────────────────────────────┘
                        ↓
        ┌───────────────┴───────────────┐
        ↓                               ↓
┌──────────────┐              ┌──────────────┐
│   security   │              │   build      │
│ (npm audit   │              │ (production) │
│  semgrep     │              │              │
│  osv)        │              └──────────────┘
└──────────────┘
        ↓
┌──────────────┬──────────────┐
│     lint     │  typecheck   │
│  (ESLint)    │ (TypeScript) │
└──────┬───────┴──────┬───────┘
       │              │
       └──────┬───────┘
              ↓
    ┌─────────┴─────────┐
    ↓                   ↓
┌────────┐      ┌─────────────┐      ┌─────────┐
│  unit  │      │ integration │      │   e2e   │
│ (fast) │      │  (+ DB)     │      │ (+ srv) │
└────────┘      └─────────────┘      └─────────┘
    │                   │                  │
    └───────────┬───────┴──────────────────┘
                ↓
        ┌──────────────┐
        │  ci-success  │
        │ (all passed) │
        └──────────────┘
```

---

## Jobs Détaillés

### 1. **Lint** (ESLint)

**Objectif**: Vérifier le style de code et détecter les erreurs simples.

**Durée**: ~1 minute

**Commande locale**:
```bash
npm run lint
```

**Critères de succès**:
- Aucune erreur ESLint
- Warnings acceptés (ne bloquent pas)

**Cache**: npm dependencies

---

### 2. **TypeCheck** (TypeScript)

**Objectif**: Valider les types TypeScript.

**Durée**: ~2 minutes

**Commande locale**:
```bash
npm run typecheck
```

**Critères de succès**:
- Aucune erreur de type TypeScript
- Prisma client généré correctement

**Cache**: npm dependencies

**Note**: Certaines erreurs pré-existantes peuvent être tolérées temporairement (voir section Erreurs Connues).

---

### 3. **Unit Tests** (Jest + jsdom)

**Objectif**: Tester la logique pure (composants, helpers, validation).

**Durée**: ~3 minutes

**Environnement**:
- JSDOM (pas de DB)
- Mocks pour dépendances externes

**Commande locale**:
```bash
npm run test:unit
```

**Commande CI**:
```bash
npm run test:unit -- --ci --coverage --maxWorkers=2
```

**Critères de succès**:
- Tests passent
- Coverage > 70% (recommandé)

**Artifacts**:
- `coverage-unit/` - Rapport de couverture
- `unit-test-logs` - Logs en cas d'échec

**Dépendances**: lint, typecheck doivent passer

---

### 4. **Integration Tests** (Jest + PostgreSQL)

**Objectif**: Tester les endpoints API avec base de données réelle.

**Durée**: ~5 minutes

**Environnement**:
- Node.js (pas de browser)
- PostgreSQL 16 (service container)
- Port 5432

**Services**:
```yaml
postgres:
  image: postgres:16-alpine
  env:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
    POSTGRES_DB: nexus_test
  ports:
    - 5432:5432
```

**Commande locale**:
```bash
docker-compose up -d  # Start dev DB
npm run test:integration
```

**Commande CI**:
```bash
npm run test:integration -- --ci --maxWorkers=2
```

**Étapes**:
1. Start PostgreSQL service
2. Run `prisma migrate deploy`
3. Verify DB connection (smoke test)
4. Run integration tests

**Critères de succès**:
- DB accessible
- Migrations appliquées
- Tests passent

**Artifacts**:
- `integration-test-logs` - Logs en cas d'échec

**Dépendances**: lint, typecheck doivent passer

---

### 5. **E2E Tests** (Playwright)

**Objectif**: Tester les parcours utilisateur complets (UI + API + DB).

**Durée**: ~8 minutes

**Environnement**:
- Playwright (Chromium)
- Next.js server (production build)
- PostgreSQL E2E (service container)
- Port 5432 (DB), Port 3000 (app)

**Services**:
```yaml
postgres-e2e:
  image: postgres:16-alpine
  env:
    POSTGRES_DB: nexus_e2e
  ports:
    - 5432:5432
```

**Commande locale**:
```bash
npm run test:e2e:setup   # Setup DB
npm run build            # Build app
npm run start &          # Start server
npm run test:e2e         # Run tests
npm run test:e2e:teardown
```

**Commande CI**:
```bash
npx playwright test --project=chromium
```

**Étapes**:
1. Start PostgreSQL E2E service
2. Run migrations (`prisma migrate deploy`)
3. Seed test data (`seed-e2e-db.ts`)
4. Install Playwright browsers
5. Build Next.js (production)
6. Start server in background
7. Wait for server ready (curl check)
8. Run Playwright tests
9. Stop server
10. Upload artifacts

**Critères de succès**:
- Server starts successfully
- All E2E tests pass
- No flaky tests

**Artifacts**:
- `playwright-report/` - Rapport HTML (always)
- `playwright-screenshots/` - Screenshots (on failure)
- `e2e-logs` - Logs serveur (on failure)

**Dépendances**: lint, typecheck doivent passer

---

### 6. **Security Scan**

**Objectif**: Détecter les vulnérabilités de sécurité.

**Durée**: ~3 minutes

**Outils**:
1. **npm audit** - Vulnérabilités dépendances npm
2. **Semgrep** - Analyse statique code
3. **OSV Scanner** - Base vulnérabilités Google

**Commande locale**:
```bash
# npm audit
npm audit --json > audit-report.json

# Semgrep (requires Docker)
docker run --rm -v "${PWD}:/src" returntocorp/semgrep semgrep \
  --config=p/security-audit \
  --config=p/secrets \
  --config=p/typescript \
  /src
```

**npm audit**:
- Génère rapport JSON
- Évalue sévérité (low, moderate, high, critical)
- **Échec si**: moderate+ détecté
- Upload rapport même si success

**Semgrep**:
- Rules: security-audit, secrets, typescript, nextjs
- Génère SARIF (upload vers GitHub Security)
- Continue même si findings (warnings)

**OSV Scanner**:
- Scan package-lock.json
- Continue même si findings
- Upload rapport

**Critères de succès**:
- npm audit: 0 moderate+ vulnerabilities
- Semgrep: pas de critical findings
- OSV: informatif (ne bloque pas)

**Artifacts**:
- `npm-audit-report.json`
- `semgrep.sarif` (GitHub Security tab)
- `osv-report.json`

**Dépendances**: Aucune (run en parallèle)

---

### 7. **Build Production**

**Objectif**: Vérifier que le build Next.js fonctionne.

**Durée**: ~3 minutes

**Commande locale**:
```bash
npm run build
```

**Commande CI**:
```bash
npm run build
```

**Variables d'environnement**:
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nexus_prod
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<secret>
NODE_ENV=production
```

**Note**: Le DATABASE_URL est mock (non utilisé à build time).

**Critères de succès**:
- Build complète sans erreur
- Pas d'erreurs TypeScript
- Pas d'erreurs de bundling

**Artifacts**:
- `.next/` - Bundle de production (7 jours)
- Build size report (GitHub Step Summary)

**Dépendances**: lint, typecheck doivent passer

---

### 8. **CI Success** (Status Check)

**Objectif**: Agréger le statut de tous les jobs.

**Logique**:
```bash
if any job failed:
  exit 1  # CI fails
else:
  exit 0  # CI passes
```

**Dépendances**: TOUS les jobs (1-7)

**Critères de succès**:
- Tous les jobs précédents en `success`

**Affichage**:
```
✅ All CI checks passed!

ou

❌ CI Pipeline Failed
Lint: success
TypeCheck: success
Unit: failed
Integration: success
E2E: success
Security: success
Build: success
```

---

## Variables d'Environnement

### Secrets GitHub (à configurer)

| Secret | Description | Obligatoire |
|--------|-------------|-------------|
| `NEXTAUTH_SECRET` | Secret NextAuth (min 32 chars) | Recommandé |

**Configuration**:
```
GitHub Repo → Settings → Secrets and variables → Actions → New repository secret
```

**Valeur par défaut CI**: Si non défini, utilise `test-secret-min-32-chars-long-for-ci-environment`

### Variables Publiques

| Variable | Valeur | Usage |
|----------|--------|-------|
| `NODE_VERSION` | `20.x` | Version Node.js |
| `CI` | `true` | Mode CI activé |
| `FORCE_COLOR` | `1` | Couleurs dans logs |

---

## Cache & Optimisations

### Cache npm

**Action**: `actions/setup-node@v4` avec `cache: 'npm'`

**Cache**:
- `node_modules/`
- `~/.npm`

**Invalidation**: Si `package-lock.json` change

**Gain**: ~30 secondes par job

### Concurrency

**Configuration**:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

**Effet**: Cancel les runs en cours si nouveau commit pushed sur même branch.

**Bénéfice**: Économie de ressources CI

### Parallélisme

**Jobs en parallèle**:
- security (aucune dépendance)
- build (après lint + typecheck)
- unit, integration, e2e (après lint + typecheck)

**Séquence**:
```
0min: security, lint, typecheck
~3min: unit, integration, e2e, build (en parallèle)
~15min: ci-success
```

---

## Artifacts & Rapports

### Playwright Report (E2E)

**Path**: `playwright-report/`

**Upload**: Always (succès ou échec)

**Visualisation**:
```bash
# Télécharger artifact depuis GitHub Actions
npx playwright show-report playwright-report/
```

**Contenu**:
- Tests passés/échoués
- Screenshots
- Traces Playwright
- Durées

### Coverage Report (Unit)

**Path**: `coverage/`

**Upload**: Always

**Visualisation**:
```bash
open coverage/lcov-report/index.html
```

### Test Logs (on failure)

**Artifacts**:
- `unit-test-logs` - Logs tests unitaires
- `integration-test-logs` - Logs tests intégration
- `e2e-logs` - Logs E2E + traces Next.js

**Contenu**:
- `*.log`
- `npm-debug.log*`
- `.next/trace` (E2E seulement)

### Security Reports

**Artifacts**:
- `npm-audit-report.json` - Vulnérabilités npm
- `semgrep.sarif` - Findings Semgrep (GitHub Security tab)
- `osv-report.json` - OSV Scanner

**Visualisation Semgrep**:
```
GitHub Repo → Security → Code scanning alerts
```

### Build Artifacts

**Artifacts**:
- `nextjs-build` - `.next/` folder
- Build size report (Step Summary)

---

## Résolution Problèmes

### ❌ Lint Fails

**Symptômes**: ESLint errors

**Solutions**:
```bash
# Localement
npm run lint

# Auto-fix
npm run lint -- --fix

# Voir règles spécifiques
npx eslint <file> --debug
```

---

### ❌ TypeCheck Fails

**Symptômes**: TypeScript errors

**Solutions**:
```bash
# Localement
npm run typecheck

# Voir erreurs détaillées
npx tsc --noEmit --pretty

# Régénérer Prisma client
npx prisma generate
```

**Erreurs connues tolérées**:
- `__tests__/api/admin-users.test.ts` - Mock type issues (pré-existant)
- `__tests__/lib/guards.test.ts` - String literals vs enum (pré-existant)

---

### ❌ Unit Tests Fail

**Symptômes**: Tests unitaires échouent

**Solutions**:
```bash
# Localement (watch mode)
npm run test:unit:watch

# Run test spécifique
npm run test:unit -- <test-file>

# Voir erreurs détaillées
npm run test:unit -- --verbose
```

**Causes courantes**:
- Mock non configuré
- État partagé entre tests (pas de cleanup)
- Dépendance DB (devrait être mocké)

---

### ❌ Integration Tests Fail

**Symptômes**: Tests intégration échouent

**Solutions**:
```bash
# Vérifier DB running
docker-compose ps

# Start DB
docker-compose up -d

# Run migrations
npx prisma migrate deploy

# Run tests
npm run test:integration
```

**Causes courantes**:
- DB non accessible
- Migrations non appliquées
- Seed data manquant
- Port 5432 déjà utilisé

---

### ❌ E2E Tests Fail

**Symptômes**: Playwright tests échouent

**Solutions**:
```bash
# Local E2E flow
npm run test:e2e:setup
npm run build
npm run start &
npm run test:e2e:ui  # Debug mode
npm run test:e2e:teardown

# Voir rapport
npx playwright show-report
```

**Causes courantes**:
- Server non démarré
- DB E2E non seedée
- Sélecteurs UI obsolètes
- Timeout trop court
- Animations GSAP (attendre `isInViewport`)

**Debug**:
```bash
# Run avec trace
npx playwright test --trace on

# Run headed (voir navigateur)
npm run test:e2e:headed

# Run step-by-step
npm run test:e2e:debug
```

---

### ❌ Security Scan Fails

**Symptômes**: npm audit trouve moderate+ vulnerabilities

**Solutions**:
```bash
# Voir détails
npm audit

# Fix auto (si possible)
npm audit fix

# Fix breaking changes
npm audit fix --force

# Update package spécifique
npm update <package>
```

**Semgrep findings**:
- Review code
- Add `// nosemgrep: rule-id` si false positive
- Fix vulnerability

---

### ❌ Build Fails

**Symptômes**: Next.js build échoue

**Solutions**:
```bash
# Build localement
npm run build

# Voir logs détaillés
npm run build -- --debug

# Clear cache
rm -rf .next/
npm run build
```

**Causes courantes**:
- Erreur TypeScript non détectée par typecheck
- Import manquant
- Variable env manquante
- Out of memory (CI)

---

## Maintenance

### Ajouter un Job

1. Ajouter section dans `.github/workflows/ci.yml`:
```yaml
new-job:
  name: New Job
  runs-on: ubuntu-latest
  needs: [lint, typecheck]  # Dépendances
  steps:
    - uses: actions/checkout@v4
    - # ... steps
```

2. Ajouter dépendance dans `ci-success`:
```yaml
needs: [lint, typecheck, unit, integration, e2e, security, build, new-job]
```

3. Documenter dans `CI_PIPELINE.md`

### Mettre à Jour Dépendances Actions

**Commande**:
```bash
# Voir versions
grep "uses:" .github/workflows/ci.yml

# Update manuellement ou avec Dependabot
```

**Actions critiques**:
- `actions/checkout@v4`
- `actions/setup-node@v4`
- `actions/upload-artifact@v4`
- `returntocorp/semgrep-action@v1`
- `google/osv-scanner-action@v1`

### Optimiser Durée CI

**Stratégies**:
1. Augmenter `maxWorkers` (attention mémoire)
2. Skip tests non critiques sur draft PR
3. Use matrix strategy (run tests en parallèle sur plusieurs OS)
4. Cache Playwright browsers
5. Use turbo for monorepo

---

## Métriques CI

### Durées Cibles

| Job | Durée Cible | Durée Max Acceptable |
|-----|-------------|----------------------|
| lint | 1min | 2min |
| typecheck | 2min | 3min |
| unit | 3min | 5min |
| integration | 5min | 8min |
| e2e | 8min | 12min |
| security | 3min | 5min |
| build | 3min | 5min |
| **TOTAL** | **15min** | **25min** |

### Success Rate Cible

- **Main branch**: 100% (toujours vert)
- **PRs**: > 95% (échecs acceptables si bug trouvé)

### Monitoring

**GitHub Actions dashboard**:
```
https://github.com/<org>/<repo>/actions
```

**Métriques à surveiller**:
- Success rate (% jobs passés)
- Durée moyenne par job
- Failures patterns (quel job échoue souvent)
- Queue time (latence avant start)

---

## Références

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Playwright CI Guide](https://playwright.dev/docs/ci)
- [Semgrep CI Setup](https://semgrep.dev/docs/semgrep-ci/)
- [OSV Scanner](https://google.github.io/osv-scanner/)
- [TEST_STRATEGY.md](./TEST_STRATEGY.md) - Stratégie tests détaillée
- [TEST_SCRIPTS.md](./TEST_SCRIPTS.md) - Scripts tests locaux

---

**Dernière mise à jour**: 2026-02-01
**Version**: 1.0
**Auteur**: Claude Code (CI Infrastructure)
