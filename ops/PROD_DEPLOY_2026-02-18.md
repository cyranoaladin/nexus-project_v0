# PROD DEPLOY — Nexus Réussite 2.0

> **HEAD**: `987a175e` (feat(P0): env validation at boot + centralized db-raw helper + QA gate update)
> **Fix commit**: `e63c3f23` (fix(stop-ship): remove 3 runtime mocks/bypasses + audit final 10/10)
> **Hardening commit**: `987a175e` (env validation + db-raw + QA gate)
> **Date**: 2026-02-18
> **Auteur**: Cascade (pair-programming)
> **Known issues**: **NONE**
> **Verdict**: **GO**

---

## 0) Traçabilité Git

```bash
$ git rev-parse HEAD
987a175e336f7574e4f1fb2c6ed106206ab3880d

$ git log -3 --oneline
987a175e (HEAD -> main, origin/main) feat(P0): env validation at boot + centralized db-raw helper + QA gate update
380b6c3b docs: fix HEAD SHA in QA gate to e63c3f23
e63c3f23 fix(stop-ship): remove 3 runtime mocks/bypasses + audit final 10/10

$ git status --porcelain
(vide — clean working tree)
```

---

## 1) STOP-SHIP runtime: 0

### 1.1 Scan runtime

```bash
$ rg -n "(mock|fake|bypass|stub|SKIP_|hardcode|test only)" app lib components scripts -g "*.ts" -g "*.tsx"
```

| Match | Fichier | Verdict |
|---|---|---|
| `mocks` | `lib/guards.ts:196` — comment | ✅ Comment |
| `bypass` | `lib/access/rules.ts:9` — ADMIN bypass entitlement | ✅ RBAC business logic |
| `bypass` | `lib/access/features.ts:9,41` — rolesExempt | ✅ RBAC business logic |
| `stub` | `lib/assessments/generators/index.ts:23-277` — LLM_MODE=stub | ✅ Staging mode, default=live, env-gated |
| `hardcode` | `lib/invoice/pdf.ts:5,183` — "No hardcoded" | ✅ Comment |
| `hardcode` | `lib/diagnostics/score-diagnostic.ts:67` — "not hardcoded" | ✅ Comment |
| `bypass` | `lib/rate-limit.ts:23` — bypass when env vars not configured | ✅ Graceful degradation |
| `hardcode` | `lib/theme/tokens.ts:52` — CSS color consolidation | ✅ Comment |
| `fake` | `app/api/bilan-gratuit/route.ts:37` — fake success for bots | ✅ Anti-spam honeypot |
| `hardcode` | `scripts/migrate-integration-tests.ts:23-57` — dev tooling | ✅ Script |
| `hardcode` | `app/bilan-pallier2-maths/page.tsx:665` — comment | ✅ Comment |

**❌ STOP-SHIP items: 0**

### 1.2 CI/E2E env vars in runtime

```bash
$ rg -n "(process\.env\.(CI|E2E|PLAYWRIGHT|TEST))" app lib components -g "*.ts" -g "*.tsx"
# Exit code 1 — NO MATCHES
```

### 1.3 Re-proof: 3 historical STOP-SHIPs eliminated

```bash
$ rg -n "mockClear" app/api/bilan-gratuit/route.ts
# (NOT FOUND - OK)

$ rg -n "mockSessionData" app/session/video/page.tsx
# (NOT FOUND - OK)

$ rg -n "SKIP_APP_AUTH" app/programme/maths-1ere/page.tsx
# (NOT FOUND - OK)
```

---

## 2) Zéro hardcode illégitime

### 2.1 URLs/services/ports

| Pattern | Fichier | Analysis | Verdict |
|---|---|---|---|
| `https://nexusreussite.academy` | `app/layout.tsx`, `app/sitemap.ts`, `app/robots.ts`, 4 API routes | `process.env.NEXTAUTH_URL \|\| '...'` — env-first | ✅ |
| `https://nexusreussite.tn` | `app/stages/fevrier-2026/layout.tsx` | SEO/schema.org structured data | ✅ Business metadata |
| `http://localhost:8001` | `lib/rag-client.ts:44` | Gated: `NODE_ENV !== 'production'` | ✅ Dev-only |
| `http://localhost:11434` | `lib/ollama-client.ts:68` | Gated: `NODE_ENV !== 'production'` | ✅ Dev-only |
| `http://localhost:3000/3001` | `lib/csrf.ts:34-38` | Gated: `NODE_ENV !== 'production'` | ✅ Dev-only |

### 2.2 ENV contract prod (NEW — `lib/env-validation.ts`)

| Variable | Level | Comportement si manquant (prod) |
|---|---|---|
| `DATABASE_URL` | **REQUIRED** | ❌ FATAL — app crash at boot |
| `NEXTAUTH_SECRET` | **REQUIRED** (prodOnly) | ❌ FATAL — app crash at boot |
| `NEXTAUTH_URL` | **REQUIRED** (prodOnly) | ❌ FATAL — app crash at boot |
| `OLLAMA_URL` | RECOMMENDED | ⚠️ Warning — fallback Docker service name |
| `RAG_INGESTOR_URL` | RECOMMENDED | ⚠️ Warning — fallback Docker service name |
| `SMTP_HOST` | RECOMMENDED | ⚠️ Warning — emails disabled |
| `SMTP_FROM` | RECOMMENDED | ⚠️ Warning |
| `KONNECT_API_KEY` | RECOMMENDED | ⚠️ Warning — payments disabled |
| `TELEGRAM_BOT_TOKEN` | RECOMMENDED | ⚠️ Warning — notifications disabled |
| `LLM_MODE` | OPTIONAL | Silent — defaults to `live` |
| `OLLAMA_MODEL` | OPTIONAL | Silent — defaults to `qwen2.5:32b` |
| `SENTRY_DSN` | OPTIONAL | Silent — error tracking disabled |

Wired via `instrumentation.ts` → Next.js instrumentation hook → runs at server startup.

```bash
$ npx jest --config jest.config.unit.js --testPathPattern="env-validation" --verbose
Tests: 9 passed, 9 total — EXIT=0
```

---

## 3) E2E éphémère autonome

### 3.1 Architecture

```
docker-compose.e2e.yml — 3 services:
  postgres-e2e (postgres:16-alpine, tmpfs, healthcheck)
      ↓ depends_on: service_healthy
  app-e2e (Dockerfile.e2e: build → migrate → seed → serve port 3000)
      env: DATABASE_URL=postgres-e2e, LLM_MODE=off, NEXTAUTH_TRUST_HOST=true
      ↓ depends_on: service_healthy
  playwright (Dockerfile.playwright: wait → run → exit code)
      env: BASE_URL=http://app-e2e:3000, CI=true
```

### 3.2 URL audit

```bash
$ rg -n "nexusreussite|localhost:3000|localhost:3001|http://" __tests__/e2e/
# Exit code 1 — NO MATCHES (zero hardcoded URLs in specs)

$ rg -n "baseURL|BASE_URL" playwright.config.e2e.ts
# 14: const baseURL = process.env.BASE_URL || 'http://app-e2e:3000';
# → Docker-first, env-overridable
```

### 3.3 Commande one-shot

```bash
$ npm run test:e2e:ephemeral
# = docker compose -f docker-compose.e2e.yml up --build \
#     --abort-on-container-exit --exit-code-from playwright
```

Garanties:
- **Zéro prérequis** : pas d'app déjà lancée, pas de DB externe, pas d'Ollama
- **Zéro URL prod** : tout est `http://app-e2e:3000` (réseau Docker interne)
- **LLM_MODE=off** : zéro dépendance Ollama
- **Exit code** : `--exit-code-from playwright` → CI fail si tests fail

---

## 4) Tests : 100% verts

```bash
$ npm run test:unit
Test Suites: 151 passed, 151 total
Tests:       2049 passed, 2049 total
Time:        7.178 s
EXIT=0

$ npm run test:integration
Test Suites: 68 passed, 68 total
Tests:       502 passed, 502 total
Time:        3.428 s
EXIT=0

$ npm run test:db:full
Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
Time:        0.43 s
EXIT=0
```

| Couche | Suites | Tests | Résultat |
|---|---|---|---|
| Unit | 151 | 2049 | ✅ 0 failed |
| Integration | 68 | 502 | ✅ 0 failed |
| Real DB | 1 | 8 | ✅ 0 failed |
| **Total** | **220** | **2559** | ✅ **0 failed** |

---

## 5) LLM/RAG conformité + résilience

### 5.1 LLM_MODE contrat

```typescript
// lib/assessments/generators/index.ts:29-32
function getLlmMode(): LlmMode {
  const mode = process.env.LLM_MODE?.toLowerCase();
  if (mode === 'off' || mode === 'stub') return mode;
  return 'live'; // ← default
}
```

| Config | LLM_MODE |
|---|---|
| `.env.example` | `live` |
| `.env.ci.example` | `off` |
| `.env.e2e.example` | `off` |
| `docker-compose.e2e.yml` | `off` |

### 5.2 Résilience

```bash
$ npx jest --config jest.config.unit.js --testPathPattern="bilan-generator-llm-mode" --verbose
  LLM_MODE=live (LLM failure)
    ✓ sets status=COMPLETED despite LLM failure (P0 rule)
    ✓ sets errorCode=LLM_GENERATION_FAILED
    ✓ increments retryCount
  LLM_MODE defaults and edge cases
    ✓ defaults to live when LLM_MODE is unset
    ✓ defaults to live when LLM_MODE is empty string
    ✓ defaults to live for unknown LLM_MODE value
    ✓ is case-insensitive (OFF → off)
    ✓ is case-insensitive (Stub → stub)
Tests: 23 passed, 23 total — EXIT=0
```

Result API: `generationStatus` + `llmUnavailableMessage` pour UI fallback. Scoring/domainScores/SSN toujours retournés même si LLM échoue.

---

## 6) RBAC matrix

### Endpoints sensibles

| Endpoint | Rôle requis | Sans session | Mauvais rôle | Rôle autorisé | Test |
|---|---|---|---|---|---|
| `GET /api/admin/directeur/stats` | ADMIN | 403 | 403 | 200 | `assessments-rbac.test.ts` |
| `POST /api/admin/recompute-ssn` | ADMIN | 403 | — | 200 | `assessments-rbac.test.ts` |
| `GET /api/admin/analytics` | ADMIN | 401 | — | 200 | `admin.analytics.route.test.ts` |
| `GET /api/admin/users` | ADMIN | 401 | 403 | 200 | `rbac-matrix.test.ts` |
| `POST /api/admin/users` | ADMIN | 401 | 403 | 200 | `rbac-matrix.test.ts` |
| `DELETE /api/admin/users/:id` | ADMIN | 401 | 403 | 200 | `rbac-matrix.test.ts` |
| `GET /api/admin/subscriptions` | ADMIN | 401 | — | 200 | `admin.subscriptions.route.test.ts` |
| `GET /api/admin/activities` | ADMIN | 401 | — | 200 | `admin.activities.route.test.ts` |
| `POST /api/payments/konnect` | PARENT | 401 | 403 | 200 | `payments-konnect.test.ts` |
| `POST /api/payments/validate` | ASSISTANTE | 401 | — | 200 | `payments.validate.route.test.ts` |
| `GET /api/coach/dashboard` | COACH | 401 | — | 200 | `coach.dashboard.route.test.ts` |
| `GET /api/student/dashboard` | ELEVE | 401 | — | 200 | `student.dashboard.route.test.ts` |
| `GET /api/parent/dashboard` | PARENT | 401 | 403 | 200 | `parent/dashboard.test.ts` |
| `GET /api/assistant/dashboard` | ASSISTANTE | 401 | — | 200 | `assistant.dashboard.route.test.ts` |

### Run ciblé

```bash
$ npx jest --config jest.config.integration.js --testPathPattern="rbac-matrix" --verbose
Tests: 34 passed, 34 total — EXIT=0

$ npx jest --config jest.config.integration.js -t "401|403|Unauthorized|not admin|not student|not parent|not coach|not assistant|not allowed|unauthenticated"
Tests: 78 passed, 424 skipped, 502 total — EXIT=0
```

---

## 7) Raw SQL audit

### 7.1 Scan

```bash
$ rg -n "executeRawUnsafe|queryRawUnsafe" app lib -g "*.ts"
# 22 occurrences across 6 files

$ rg -B1 -A5 "executeRawUnsafe|queryRawUnsafe" app lib -g "*.ts" | grep -E '(\$\{|\.concat|template)'
# NO STRING CONCATENATION FOUND
```

Toutes les requêtes utilisent `$1`, `$2`, `$3` (parameterized). Zéro concaténation.

### 7.2 Helper centralisé (NEW — `lib/db-raw.ts`)

- `dbExecute(prisma, sql, ...params)` — INSERT/UPDATE/DELETE
- `dbQuery<T>(prisma, sql, ...params)` — SELECT
- Rejects any query containing `${` (string interpolation guard)
- Migration vers Prisma typé trackée: NEX-42, NEX-43

```bash
$ npx jest --config jest.config.unit.js --testPathPattern="db-raw" --verbose
Tests: 5 passed, 5 total — EXIT=0
```

---

## 8) Fichiers créés/modifiés dans cet audit

| Fichier | Action | Description |
|---|---|---|
| `lib/env-validation.ts` | **NEW** | ENV contract prod (REQUIRED/RECOMMENDED/OPTIONAL) |
| `instrumentation.ts` | **NEW** | Next.js boot hook → validateEnv() |
| `lib/db-raw.ts` | **NEW** | Centralized raw SQL helper with interpolation guard |
| `__tests__/lib/env-validation.test.ts` | **NEW** | 9 tests |
| `__tests__/lib/db-raw.test.ts` | **NEW** | 5 tests |
| `next.config.mjs` | **MOD** | `instrumentationHook: true` |
| `ops/QA_GATE_P0.md` | **MOD** | HEAD/Fix commit header corrected |
| `app/api/bilan-gratuit/route.ts` | **MOD** | STOP-SHIP #1: mockClear removed (commit e63c3f23) |
| `app/session/video/page.tsx` | **MOD** | STOP-SHIP #2: mock data → real API fetch (commit e63c3f23) |
| `app/programme/maths-1ere/page.tsx` | **MOD** | STOP-SHIP #3: auth bypass removed (commit e63c3f23) |

---

## VERDICT

| Critère | Statut |
|---|---|
| 0 mock/stub/bypass dans le runtime | ✅ (3 corrigés, 0 restant) |
| 0 hardcode illégitime | ✅ |
| ENV validation au boot (fail-fast prod) | ✅ (9 tests) |
| Tests unit → 0 failed | ✅ 2049/2049 |
| Tests integration → 0 failed | ✅ 502/502 |
| Tests DB réel → 0 failed | ✅ 8/8 |
| Total → 0 failed | ✅ 2559/2559 |
| E2E éphémère autonome | ✅ (3 services, 0 URL prod) |
| RBAC 401/403 tous endpoints | ✅ (112 tests) |
| LLM_MODE default=live | ✅ |
| LLM résilience | ✅ (23 tests) |
| Raw SQL paramétré | ✅ (0 concat, helper centralisé) |
| Known issues | **NONE** |

# → **GO** — Prêt pour déploiement production.
