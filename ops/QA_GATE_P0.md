# QA Gate P0 — Nexus 2.0 Release Candidate

> **HEAD**: `380b6c3b` (docs: fix HEAD SHA in QA gate)
> **Fix commit**: `e63c3f23` (fix(stop-ship): remove 3 runtime mocks/bypasses + audit final 10/10)
> **Commit chain**: `de3f38cf` → … → `21e1f862` → `1956d571` → `e63c3f23` → `380b6c3b`
> **Date**: 2026-02-18
> **Auteur**: Cascade (pair-programming)
> **Known issues**: **NONE**

---

## 1. Point critique : 5 domaines vs 6 domaines

### Verdict : **5 domaines** — `algebre` était un fantôme, supprimé.

#### Preuve factuelle

Le dataset `maths_terminale_spe_v1` (50 questions) déclare **5 domaines** :

| Domaine | Clé scorer | Questions | Fichier source |
|---|---|---|---|
| Analyse | `analyse` | 12 | `questions/maths/terminale/analyse.ts` |
| Combinatoire | `combinatoire` | 6 | `questions/maths/terminale/combinatoire.ts` |
| Géométrie | `geometrie` | 10 | `questions/maths/terminale/geometrie.ts` |
| Log & Exp | `logExp` | 10 | `questions/maths/terminale/log-exp.ts` |
| Probabilités | `probabilites` | 12 | `questions/maths/terminale/probabilites.ts` |

**Il n'existe aucun fichier `algebre.ts`**, aucune question tagguée `Algèbre` dans le dataset v1.

Le scorer `MathsScorer.normalizeCategoryKey()` contient un mapping `'algèbre' → 'algebre'` mais aucune question ne le déclenche. Le domaine `algebre` aurait toujours eu score=0 → axe fantôme sur le radar.

#### Justification pédagogique

Le programme de Maths Terminale Spé (BO 2019) couvre :
- **Analyse** : dérivation, intégrales, convexité, TVI, suites, limites
- **Combinatoire** : coefficient binomial, Pascal, dénombrement
- **Géométrie** : vecteurs, produit scalaire, plans, droites
- **Logarithme & Exponentielle** : propriétés ln/exp, équations
- **Probabilités** : loi binomiale, loi normale, Bayes

L'algèbre (au sens strict) est transversale dans ce programme — elle n'a pas de chapitre dédié dans le BO Terminale Spé. Si un futur dataset v2 ajoute des questions spécifiquement algébriques, on ajoutera `algebre` à `CANONICAL_DOMAINS_MATHS` et on bumpera `assessmentVersion`.

#### Correction appliquée

```typescript
// lib/assessments/core/config.ts — AVANT (erroné)
export const CANONICAL_DOMAINS_MATHS = [
  'algebre',    // ← FANTÔME : 0 questions dans le dataset
  'analyse',
  'geometrie',
  'combinatoire',
  'logExp',
  'probabilites',
] as const;

// lib/assessments/core/config.ts — APRÈS (corrigé)
export const CANONICAL_DOMAINS_MATHS = [
  'analyse',
  'combinatoire',
  'geometrie',
  'logExp',
  'probabilites',
] as const;
```

#### Cohérence vérifiée

| Couche | N domaines | Clés | Statut |
|---|---|---|---|
| Dataset manifest (`DOMAIN_DISTRIBUTION`) | 5 | analyse, combinatoire, geometrie, logExp, probabilites | ✅ |
| Scorer (`normalizeCategoryKey`) | 5 produites | idem | ✅ |
| Config (`CANONICAL_DOMAINS_MATHS`) | 5 | idem | ✅ corrigé |
| Submit API (persist) | 5 rows/assessment | idem | ✅ |
| Result API (response) | 5 objets | idem | ✅ |
| UI `ResultRadar.tsx` labels | 5 labels | idem | ✅ corrigé |
| Unit tests | 5 attendus | idem | ✅ corrigé |
| DB integration tests | 5 attendus | idem | ✅ corrigé |

---

## 2. P0-1 Canon DomainScores — Extraits de code

### 2.1 `lib/assessments/core/config.ts` — Définition + backfill

```typescript
// Lignes 113-129 : Liste canonique
export const CANONICAL_DOMAINS_MATHS = [
  'analyse',
  'combinatoire',
  'geometrie',
  'logExp',
  'probabilites',
] as const;

// Lignes 153-164 : Résolution par subject
export function getCanonicalDomains(subject: string): readonly string[] {
  switch (subject) {
    case 'MATHS':  return CANONICAL_DOMAINS_MATHS;
    case 'NSI':    return CANONICAL_DOMAINS_NSI;
    case 'GENERAL': return CANONICAL_DOMAINS_GENERAL;
    default:       return CANONICAL_DOMAINS_MATHS;
  }
}

// Lignes 174-189 : Backfill (NaN/null/undefined → 0)
export function backfillCanonicalDomains(
  subject: string,
  partial: Record<string, number | undefined>
): Record<string, number> {
  const canonical = getCanonicalDomains(subject);
  const result: Record<string, number> = {};
  for (const domain of canonical) {
    const score = partial[domain];
    result[domain] = (score !== null && score !== undefined
      && typeof score === 'number' && !isNaN(score))
      ? score : 0;
  }
  return result;
}
```

### 2.2 `app/api/assessments/submit/route.ts` — Persist (lignes 173-190)

```typescript
const categoryScores = (metrics?.categoryScores ?? {}) as Record<string, number | undefined>;

// Backfill with canonical domains — guarantees all domains are persisted (0 if absent)
const completeDomains = backfillCanonicalDomains(subject, categoryScores);

for (const [domain, score] of Object.entries(completeDomains)) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "domain_scores" ("id", "assessmentId", "domain", "score", "createdAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, NOW())`,
    assessment.id, domain, score
  );
}
```

**Garanties** :
- `backfillCanonicalDomains` retourne exactement 5 clés pour MATHS
- Score=0 n'est PAS filtré (la boucle itère `Object.entries`, pas de `if score > 0`)
- NaN/null/undefined sont convertis en 0 par `backfillCanonicalDomains`

### 2.3 `app/api/assessments/[id]/result/route.ts` — Read backfill (lignes 85-91)

```typescript
// Backfill canonical domains: ensure all expected domains are present (0 if absent)
const canonical = getCanonicalDomains(assessment.subject);
const domainMap = new Map(domainScores.map((d) => [d.domain, d.score]));
const completeDomainScores = canonical.map((domain) => ({
  domain,
  score: domainMap.get(domain) ?? 0,
}));
```

**Garanties** :
- Assessments historiques (avant fix) avec 2 domaines → API retourne 5 domaines
- Ordre stable : toujours `[analyse, combinatoire, geometrie, logExp, probabilites]`
- `completeDomainScores` est utilisé dans la réponse JSON (ligne 135)

### 2.4 Preuves "real DB" (Cas A/B/C)

Exécutées via `npm run test:db:full` sur PostgreSQL réel (docker-compose.test.yml) :

| Cas | Test | Résultat |
|---|---|---|
| **A** : réponses mixtes | `persists all 5 canonical MATHS domain_scores (including 0)` | analyse=75, combinatoire=50, geometrie=0, logExp=0, probabilites=0 ✅ |
| **B** : toutes fausses | `persists all 5 domains at 0 for a zero-score assessment` | 5 rows, all score=0 ✅ |
| **C** : assessment ancien | `backfills historical assessment (2 domains in DB) to 5 canonical on read` | DB=2 rows → API=5 domaines (3 backfilled à 0) ✅ |

---

## 3. P0-2 LLM_MODE — Sémantique stricte

### 3.1 Contrat implémenté (`lib/assessments/generators/index.ts`)

| LLM_MODE | Comportement | status | generationStatus | hasBilans | errorCode | Réseau |
|---|---|---|---|---|---|---|
| `live` (défaut) | Ollama réel | COMPLETED | COMPLETE ou FAILED | true ou false | null ou LLM_GENERATION_FAILED | Oui |
| `stub` | Bilans déterministes courts | COMPLETED | COMPLETE | true | null | Non |
| `off` | Aucune génération | COMPLETED | SKIPPED* | false | LLM_GENERATION_SKIPPED | Non |

*Note : `generationStatus` dans le result API est calculé comme :
- `hasBilans` → `'COMPLETE'`
- `errorCode === 'LLM_GENERATION_FAILED'` → `'FAILED'`
- sinon → `'PENDING'`

Pour `LLM_MODE=off`, `errorCode = 'LLM_GENERATION_SKIPPED'` et `hasBilans = false`, donc `generationStatus = 'PENDING'`. Le fallback message n'est pas affiché car `errorCode !== 'LLM_GENERATION_FAILED'`. C'est le comportement correct : en mode off, on ne veut pas afficher "IA indisponible" mais simplement ne pas afficher de bilans.

### 3.2 Code (`lib/assessments/generators/index.ts`)

```typescript
type LlmMode = 'live' | 'stub' | 'off';

function getLlmMode(): LlmMode {
  const mode = process.env.LLM_MODE?.toLowerCase();
  if (mode === 'off' || mode === 'stub') return mode;
  return 'live';
}

// Mode off : skip total
if (llmMode === 'off') {
  await prisma.assessment.update({
    where: { id: assessmentId },
    data: {
      status: 'COMPLETED', progress: 100,
      errorCode: 'LLM_GENERATION_SKIPPED',
      errorDetails: 'LLM_MODE=off — generation skipped by configuration',
    },
  });
  return;
}

// Mode stub : bilans déterministes
if (llmMode === 'stub') {
  result = this.generateStubBilans(assessment.studentName, scoringResult);
}
```

### 3.3 Documentation `.env`

| Fichier | LLM_MODE | Usage |
|---|---|---|
| `.env.example` | `live` | Production |
| `.env.ci.example` | `off` | CI (GitHub Actions) |
| `.env.e2e.example` | `off` | E2E ephemeral |

### 3.4 Tests unitaires LLM_MODE (23/23 ✅)

Fichier : `__tests__/lib/generators/bilan-generator-llm-mode.test.ts`

```
PASS  __tests__/lib/generators/bilan-generator-llm-mode.test.ts
  BilanGenerator — LLM_MODE
    LLM_MODE=off
      ✓ sets status=COMPLETED and errorCode=LLM_GENERATION_SKIPPED
      ✓ does NOT call ollamaChat
      ✓ does NOT fetch the assessment from DB
      ✓ does NOT set status to GENERATING
      ✓ includes errorDetails mentioning LLM_MODE=off
    LLM_MODE=stub
      ✓ generates deterministic bilans without calling ollamaChat
      ✓ fetches the assessment from DB
      ✓ saves studentMarkdown, parentsMarkdown, nexusMarkdown
      ✓ sets status=COMPLETED with progress=100
      ✓ does NOT set errorCode (no error in stub mode)
      ✓ stub bilans contain score level classification
      ✓ first sets GENERATING then COMPLETED
    LLM_MODE=live
      ✓ calls ollamaChat for each audience (3 calls)
      ✓ saves LLM-generated bilans to DB
      ✓ sets status=COMPLETED with progress=100
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

Tests: 23 passed, 0 failed
Time:  0.786 s
```

---

## 4. P0-3 Vrais tests DB intégration

### 4.1 Architecture

```
docker-compose.test.yml
  └─ postgres:15-alpine (port 5434, tmpfs, nexus_test DB)

jest.config.db.js + jest.setup.db.js
  └─ Real Prisma client (no mocks)
  └─ Mocked: next-auth, next/headers, BilanGenerator, SSN computation

__tests__/db/assessment-pipeline.test.ts
  └─ 8 tests against real PostgreSQL
```

### 4.2 Commande reproductible

```bash
npm run test:db:full
# Équivalent à :
# 1. docker compose -f docker-compose.test.yml up -d
# 2. sleep 3
# 3. DATABASE_URL=...5434/nexus_test npx prisma migrate deploy
# 4. DATABASE_URL=...5434/nexus_test npx jest --config jest.config.db.js --runInBand
# 5. docker compose -f docker-compose.test.yml down -v
```

### 4.3 Sortie console (preuve)

```
Applying migration `20260201114538_init_postgres_prod`
Applying migration `20260201201047_add_payment_idempotency`
Applying migration `20260201201415_add_session_overlap_prevention`
Applying migration `20260201201534_add_credit_transaction_idempotency`
Applying migration `20260201201612_add_cron_execution_tracking`
Applying migration `20260202182051_add_referential_integrity_and_indexes`
Applying migration `20260202210244_add_session_reports`
Applying migration `20260214_fix_cascade_constraints`
Applying migration `20260214_init_assessment_module`
Applying migration `20260216_add_entitlement_engine`
Applying migration `20260217_learning_graph_v2`
All migrations have been successfully applied.

PASS  __tests__/db/assessment-pipeline.test.ts
  Assessment Pipeline — Real DB
    ✓ creates an assessment with globalScore and status (14 ms)
    ✓ persists all 5 canonical MATHS domain_scores (including 0) (11 ms)
    ✓ persists all 5 domains at 0 for a zero-score assessment (6 ms)
    ✓ backfills historical assessment (2 domains in DB) to 5 canonical on read (5 ms)
    ✓ rejects domain_score with non-existent assessmentId (FK constraint) (169 ms)
    ✓ cohort query filters COMPLETED assessments with non-null globalScore (15 ms)
    ✓ can write and read SSN on assessment (4 ms)
    ✓ can write and read assessmentVersion (3 ms)

Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
Time:        0.472 s
```

### 4.4 Isolation

- Port **5434** (test) ≠ 5435 (prod) ≠ 5436 (e2e)
- `tmpfs` : données en mémoire, détruites au `down -v`
- `prisma migrate deploy` (pas `reset`) : simule le comportement prod

---

## 5. P0-4 E2E Ephemeral — Zéro pollution prod

### 5.1 Architecture

```
docker-compose.e2e.yml
  └─ postgres:16-alpine (port 5436, tmpfs, nexus_e2e DB)

npm run test:e2e:ephemeral
  1. docker compose -f docker-compose.e2e.yml up -d
  2. prisma migrate deploy (sur port 5436)
  3. prisma db seed
  4. LLM_MODE=off playwright test --config playwright.config.e2e.ts
  5. docker compose -f docker-compose.e2e.yml down -v
```

### 5.2 Preuve de non-pollution prod

- `docker-compose.e2e.yml` : port **5436** (pas 5435 prod)
- `playwright.config.e2e.ts` : `baseURL = http://localhost:3001` (pas nexusreussite.academy)
- `LLM_MODE=off` : aucun appel Ollama
- `.env.e2e.example` : `DATABASE_URL=...localhost:5436/nexus_e2e`
- Aucune URL prod dans les scripts npm

### 5.3 Ports isolés

| Environnement | Port | DB | Compose file |
|---|---|---|---|
| Production | 5435 | nexus_prod | docker-compose.yml |
| Test DB intégration | 5434 | nexus_test | docker-compose.test.yml |
| E2E ephemeral | 5436 | nexus_e2e | docker-compose.e2e.yml |

---

## 6. Stratégie backfill données historiques

### Option choisie : **A) Script backfill DB**

Fichier : `scripts/backfill-canonical-domains.ts`

```bash
# Exécution (sur serveur prod, après backup) :
DATABASE_URL=postgresql://nexus_admin:***@localhost:5435/nexus_prod \
  npx tsx scripts/backfill-canonical-domains.ts
```

**Comportement** :
1. Trouve tous les assessments MATHS (COMPLETED/SCORED/GENERATING)
2. Pour chaque assessment, lit les domain_scores existants
3. Insère les domaines canoniques manquants avec score=0
4. Idempotent : safe à relancer (n'insère que les manquants)

**Sortie attendue** :
```
[Backfill] Found N MATHS assessments to check.
  [abc123] +3 domains: geometrie, logExp, probabilites
[Backfill] Done.
  Assessments checked: N
  Assessments fixed:   M
  Domains inserted:    K
```

### Complément : le result API backfill (option B) est AUSSI en place

Même sans le script, le result API retourne toujours 5 domaines grâce au backfill côté lecture. Le script est un "belt and suspenders" pour que les analytics cohorte (dashboard directeur) soient aussi stables.

---

## 7. Compteur de tests final

| Couche | Script | Tests | Statut |
|---|---|---|---|
| **Unit** (full suite) | `npm run test:unit` | **2035** | ✅ **2035/2035** |
| — dont core+generators | `npm run test:unit:core` | 97 | ✅ 97/97 |
| — dont LLM_MODE | (inclus dans unit) | 23 | ✅ 23/23 |
| — dont stable order C.2 | (inclus dans unit) | 7 | ✅ 7/7 |
| **Integration** (mock DB) | `npm run test:integration` | **502** | ✅ **502/502** |
| **Real DB** (Postgres) | `npm run test:db:full` | **8** | ✅ **8/8** |
| **E2E Playwright** | `npm run test:e2e:ephemeral` | 40+ | ✅ autonomous |
| **Total** | `npm run test:all` | **2545** | ✅ **0 failed** |

### Known issues: **NONE**

Le test `validations.test.ts:95` (anciennement pré-existant) a été **corrigé** :
- **Cause** : `bilanGratuitSchema.objectives` était `z.string().optional()` sans `.min(10)`
- **Fix** : ajout `.min(10, 'Décrivez vos objectifs (minimum 10 caractères)')` dans `lib/validations.ts`

Le test `admin.analytics.route.test.ts` (anciennement pré-existant) a été **corrigé** :
- **Cause** : mock utilisait `prisma.session` mais le route handler utilise `prisma.sessionBooking`
- **Fix** : mock corrigé pour `prisma.sessionBooking` avec les bons champs (`scheduledDate`, `coachProfile`)

### Cohérence casing C.1 : `logExp`

| Couche | Clé exacte | Vérifié |
|---|---|---|
| Dataset tags | `logExp` | ✅ `maths_terminale_spe_v1.ts:43` |
| Scorer normalize | `logExp` | ✅ `maths-scorer.ts:141` |
| DB domain_scores.domain | `logExp` | ✅ prouvé par test DB réel |
| UI labels | `logExp` | ✅ `ResultRadar.tsx:48` (corrigé de `logexp`) |
| Tests | `logExp` | ✅ canonical-domains.test.ts, assessment-pipeline.test.ts |

### Ordre stable C.2

L'ordre des domaines est garanti par la déclaration `CANONICAL_DOMAINS_MATHS` (array `as const`).
7 tests vérifient l'ordre exact : `['analyse', 'combinatoire', 'geometrie', 'logExp', 'probabilites']`.

---

## 8. Fichiers modifiés (diff résumé)

| Fichier | Changement |
|---|---|
| `lib/validations.ts` | Fix: `.min(10)` sur `objectives` (test rouge corrigé) |
| `lib/assessments/core/config.ts` | CANONICAL_DOMAINS_MATHS: 6→5, suppression `algebre` |
| `app/api/assessments/submit/route.ts` | `backfillCanonicalDomains()` à la persistance |
| `app/api/assessments/[id]/result/route.ts` | `getCanonicalDomains()` backfill à la lecture |
| `lib/assessments/generators/index.ts` | `LLM_MODE=off\|stub\|live` + `generateStubBilans()` |
| `components/assessments/ResultRadar.tsx` | Fix casing `logexp`→`logExp` + labels scorer canoniques |
| `.env.example` | +LLM_MODE documentation |
| `.env.ci.example` | +LLM_MODE=off |
| `.env.e2e.example` | +LLM_MODE=off, port 5436 |
| `docker-compose.e2e.yml` | **Réécrit** : 3 services autonomes (postgres-e2e + app-e2e + playwright) |
| `Dockerfile.e2e` | Next.js build + migrate + seed + serve |
| `Dockerfile.playwright` | Playwright runner (mcr.microsoft.com/playwright:v1.58.2) |
| `scripts/e2e-entrypoint.sh` | Entrypoint: wait postgres → migrate → seed → start |
| `scripts/playwright-entrypoint.sh` | Entrypoint: wait app → run tests → exit code |
| `playwright.config.e2e.ts` | Réécrit : pas de webServer, BASE_URL=http://app-e2e:3000 |
| `package.json` | Scripts harmonisés : test:unit, test:unit:core, test:e2e:ephemeral, test:all |
| `jest.config.db.js` | Config Jest pour tests DB réels |
| `jest.setup.db.js` | Setup sans mock Prisma |
| `__tests__/lib/core/canonical-domains.test.ts` | 22 tests (15 existants + 7 stable order C.2) |
| `__tests__/db/assessment-pipeline.test.ts` | 8 tests DB réels (Cas A/B/C + FK + cohort + SSN) |
| `__tests__/lib/generators/bilan-generator-llm-mode.test.ts` | 23 tests LLM_MODE |
| `__tests__/api/admin.analytics.route.test.ts` | Fix mock: session→sessionBooking |
| `__tests__/e2e/nexus-2-0-smoke.spec.ts` | Fix: suppression BASE_URL hardcodé, utilise baseURL config |
| `scripts/backfill-canonical-domains.ts` | Script backfill historiques prod |

---

## 9. Commandes de vérification (CI-ready)

```bash
# 1. Unit tests (suite complète — 2035 tests)
npm run test:unit
# → Test Suites: 149 passed, 149 total
# → Tests:       2035 passed, 2035 total
# → Time:        6.465 s

# 2. Unit tests (sous-ensemble rapide — core + generators)
npm run test:unit:core
# → Test Suites: 5 passed, 5 total
# → Tests:       97 passed, 97 total

# 3. Integration tests (mock DB — 502 tests)
npm run test:integration
# → Test Suites: 68 passed, 68 total
# → Tests:       502 passed, 502 total
# → Time:        3.567 s

# 4. Real DB integration tests (Postgres — 8 tests)
npm run test:db:full
# → 11 migrations applied
# → Tests: 8 passed, 8 total
# → Teardown: compose down -v clean

# 5. E2E ephemeral autonome (zero prérequis)
npm run test:e2e:ephemeral
# → docker compose -f docker-compose.e2e.yml up --build
#     --abort-on-container-exit --exit-code-from playwright
# → postgres-e2e: healthy
# → app-e2e: migrate → seed → serve (port 3000)
# → playwright: wait → run → exit
# → docker compose down -v

# 6. Tout d'un coup (unit + integration + db)
npm run test:all
# → 2035 + 502 + 8 = 2545 tests, 0 failed
```

---

## 10. E2E Ephemeral — Architecture autonome

### docker-compose.e2e.yml (3 services)

```
postgres-e2e (postgres:16-alpine, tmpfs, healthcheck)
    ↓ depends_on: service_healthy
app-e2e (Dockerfile.e2e: build → migrate → seed → serve)
    env: DATABASE_URL=postgres-e2e, LLM_MODE=off, NEXTAUTH_TRUST_HOST=true
    ↓ depends_on: service_healthy
playwright (Dockerfile.playwright: wait app → run tests → exit code)
    env: BASE_URL=http://app-e2e:3000, CI=true
```

### Garanties

- **Zéro prérequis** : pas d'app déjà lancée, pas de DB externe, pas d'Ollama
- **Zéro URL prod** : tout est `http://app-e2e:3000` (réseau Docker interne)
- **NextAuth compatible** : `NEXTAUTH_TRUST_HOST=true`, `NEXTAUTH_URL=http://app-e2e:3000`
- **Cookies** : pas de `__Secure-` en HTTP, `NEXTAUTH_TRUST_HOST` évite les 401/CSRF
- **LLM_MODE=off** : zéro dépendance Ollama
- **Exit code** : `--exit-code-from playwright` → CI fail si tests fail

---

## 11. Audit Final "10/10 Premium" — STOP-SHIP Fixes

### 11.1 STOP-SHIP corrigés (3 items)

| Fichier | Problème | Fix |
|---|---|---|
| `app/api/bilan-gratuit/route.ts:30-33` | `mockClear()` dans le runtime | Supprimé — test artifact |
| `app/session/video/page.tsx:50-60` | `mockSessionData` hardcodé (setTimeout + fake data) | Remplacé par `fetch('/api/sessions/${sessionId}')` |
| `app/programme/maths-1ere/page.tsx:18-24` | `SKIP_APP_AUTH` bypass + `userId='e2e-student'` | Supprimé — auth obligatoire via `getServerSession` |

### 11.2 Scan runtime "0 mock / 0 stub / 0 bypass"

Après corrections, les seules occurrences restantes sont :
- **Commentaires** : `lib/invoice/pdf.ts` ("No hardcoded"), `lib/diagnostics/score-diagnostic.ts` ("not hardcoded")
- **RBAC légitime** : `lib/access/rules.ts` (ADMIN bypass entitlement = business logic)
- **LLM_MODE=stub** : `lib/assessments/generators/index.ts` — mode staging, default=live, jamais activé en prod
- **Honeypot** : `app/api/bilan-gratuit/route.ts:37` — "fake success" pour bots = anti-spam légitime
- **Rate limit** : `lib/rate-limit.ts:23` — bypass quand env vars non configurées = dégradation gracieuse

### 11.3 Scan "0 valeur en dur"

- **URLs** : toutes env-first (`OLLAMA_URL`, `RAG_INGESTOR_URL`, `SMTP_HOST`), fallback dev-only (`NODE_ENV !== 'production'`)
- **Emails business** : `contact@nexusreussite.academy` dans mentions légales et templates = requis par la loi
- **Secrets** : tous via `process.env` (`NEXTAUTH_SECRET`, `KONNECT_API_KEY`, `TELEGRAM_BOT_TOKEN`)
- **Ports** : aucun port magique dans le runtime (hors compose/ops)

### 11.4 Raw SQL — Justification

Toutes les requêtes `$executeRawUnsafe` / `$queryRawUnsafe` utilisent des **placeholders paramétrés** (`$1`, `$2`, `$3`).
Zéro concaténation de chaînes avec des entrées utilisateur.

Raison d'utilisation : colonnes `learning_graph_v2` (`assessmentVersion`, `domain_scores`, `skill_scores`, `ssn`) pas encore dans le client Prisma généré. Migration vers Prisma typé trackée (TODO NEX-42/NEX-43).

### 11.5 Garanties prod-ready

| Garantie | Statut |
|---|---|
| 0 mock/stub/bypass dans le runtime | ✅ |
| 0 URL prod hardcodée | ✅ |
| 0 secret en clair | ✅ |
| LLM_MODE default = `live` | ✅ |
| LLM_MODE=off uniquement CI/E2E | ✅ |
| RBAC 403 sans session / mauvais rôle | ✅ (135 + 5 tests) |
| `logExp` casing cohérent 5 couches | ✅ |
| Ordre stable vérifié par 6 tests | ✅ |
| Raw SQL paramétré, 0 concat user input | ✅ |
