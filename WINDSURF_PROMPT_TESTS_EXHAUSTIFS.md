# IMPLÉMENTATION EXHAUSTIVE DE LA SUITE DE TESTS NEXUS RÉUSSITE

## CONTEXTE PROJET — LIS EN PREMIER

Tu travailles sur **Nexus Réussite**, une plateforme SaaS éducative (Next.js 15 App Router, TypeScript strict, PostgreSQL + pgvector, Prisma ORM, NextAuth v5, Ollama LLM, FastAPI RAG).

**Avant toute chose, lis ces fichiers dans cet ordre :**
1. `README.md` — stack complète, 81 API routes, 38 modèles Prisma, RBAC, workflows
2. `NAVIGATION_MAP.md` — 74 pages, matrice d'accès, feature gating
3. `lib/rbac.ts` — 35+ policies, 11 ressources × 9 actions
4. `lib/access/rules.ts` — résolution entitlements
5. `prisma/schema.prisma` — 38 modèles, 20 enums
6. `jest.config.js` + `jest.config.db.js` + `playwright.config.ts` — configs de test existantes
7. `__tests__/` — parcours les fichiers existants pour comprendre les patterns de mock utilisés
8. `e2e/` — parcours les fixtures et helpers existants

**Contraintes techniques NON NÉGOCIABLES :**
- Jest 29 : environnement `jsdom` (unit/API) ou `node` (DB integration, `jest.config.db.js`)
- Prisma mocké via `jest.mock('@/lib/prisma')` avec `prismaMock` typé
- NextAuth mocké via `jest.mock('next-auth')` + `jest.mock('@/lib/auth')`
- Playwright 1.58 avec Chromium, fixtures d'auth state réutilisables
- Coverage thresholds : branches 60%, functions 69%, lines 70%, statements 70%
- Tous les nouveaux fichiers dans `__tests__/` (unit) ou `e2e/` (E2E)
- Tests DB integration dans `__tests__/database/` avec `jest.config.db.js` (serial, node)
- Pattern AAA obligatoire : Arrange / Act / Assert avec commentaires

---

## MISSION GLOBALE

Implémenter une suite de tests **exhaustive et priorisée** couvrant les 15 catégories suivantes, dans l'ordre des passes décrit ci-dessous. Chaque passe doit être **complète et fonctionnelle** avant de passer à la suivante.

**Objectif final :** 0 erreur, 0 bug, 0 faille de sécurité, 100% des routes API couvertes, 100% des workflows business testés.

---

## PASSE 1 — TESTS UNITAIRES (Catégorie 1) ⭐ P0 CRITIQUE

### Instructions pour cette passe

Pour chaque fichier listé ci-dessous :
1. Lis le fichier source correspondant dans `lib/`
2. Identifie **tous** les chemins d'exécution (branches, conditions, boucles)
3. Écris les tests en couvrant : happy path + cas d'erreur + edge cases (valeurs limites, null, undefined, vide)
4. Vérifie que le fichier de test **compile sans erreur TypeScript**

---

### 1.1 Moteurs de Calcul

#### `__tests__/lib/scoring-engine.complete.test.ts` — COMPLÉTER
**Source :** `lib/scoring-engine.ts`

Cas manquants à ajouter :
```typescript
// Pondérations W1/W2/W3 (15/20/15)
it('should apply W1=15 weight to first-level questions')
it('should apply W2=20 weight to second-level questions')
it('should apply W3=15 weight to third-level questions')
// NSP (Ne Sait Pas)
it('should treat NSP answers as 0 points without penalization')
it('should count NSP in coverage but not in score')
// Edge cases
it('should return score=0 when all answers are NSP')
it('should return score=100 when all answers are correct at max weight')
it('should handle empty answers array gracefully')
it('should handle answers with unknown questionIds')
it('should produce consistent results with same inputs (deterministic)')
// Domaines mixtes (Maths + NSI)
it('should separate Maths score from NSI score correctly')
it('should compute global score as weighted average of domain scores')
// Indice de confiance
it('should set trustLevel=low when fewer than 10 questions answered')
it('should set trustLevel=high when more than 40 questions answered')
```

#### `__tests__/lib/score-diagnostic.complete.test.ts` — COMPLÉTER
**Source :** `lib/diagnostics/score-diagnostic.ts`

```typescript
// TrustScore
it('should compute TrustScore=100 for full coverage with consistent answers')
it('should compute TrustScore=0 for empty submission')
it('should apply 60% proof / 40% declarative split in RiskIndex')
// 4 règles de détection d'incohérences
it('should detect inconsistency rule 1: high declarative + low proof')
it('should detect inconsistency rule 2: all correct on hard, all wrong on easy')
it('should detect inconsistency rule 3: speed anomaly (all answered < 30s)')
it('should detect inconsistency rule 4: perfect score on unseen chapters')
// Priorités
it('should include only domains below threshold in TopPriorities')
it('should identify QuickWins as high-effort domains close to passing')
it('should flag HighRisk domains with both low score and high weight')
// Couverture programme
it('should compute chapitresVus/chapitresTotal ratio correctly')
it('should return couverture=0 when no chapters seen')
it('should return couverture=1 when all chapters covered')
```

#### `__tests__/lib/core/ssn.test.ts` — NOUVEAU
**Source :** `lib/core/ssn/computeSSN.ts`

```typescript
describe('computeSSN', () => {
  it('should return SSN=50 for average student (median of cohort)')
  it('should return SSN=100 for top student (no peers with higher score)')
  it('should return SSN=0 for bottom student')
  it('should handle single-student cohort (score=50 by convention)')
  it('should handle empty cohort gracefully')
  it('should normalize scores to [0, 100] range')
  it('should be stable: same inputs → same SSN')
  it('should compute percentile correctly for 100-student cohort')
  it('should handle identical scores in cohort (no division by zero)')
  it('should weight recent assessments more than older ones')
})
```

#### `__tests__/lib/core/uai.test.ts` — NOUVEAU
**Source :** `lib/core/uai/computeUAI.ts`

```typescript
describe('computeUAI', () => {
  it('should compute UAI as weighted combination of SSN + trajectory + engagement')
  it('should return UAI in [0, 100] range')
  it('should give higher UAI to student with improving trend')
  it('should give lower UAI to student with declining trend')
  it('should handle missing trajectory data (fallback to SSN only)')
  it('should handle zero engagement (UAI degraded but not zero)')
})
```

#### `__tests__/lib/core/ml-predict.test.ts` — NOUVEAU
**Source :** `lib/core/ml/predictSSN.ts`

```typescript
describe('predictSSN - Ridge Regression', () => {
  it('should predict upward trend for student with 3 improving assessments')
  it('should predict downward trend for student with 3 declining assessments')
  it('should return null when fewer than 3 data points available')
  it('should clamp prediction to [0, 100] range')
  it('should mark stability=true when predicted variance < threshold')
  it('should not overfit to a single outlier assessment')
  it('should handle all-identical scores (flat trend, stability=true)')
})
```

#### `__tests__/lib/core/cohort-stats.test.ts` — NOUVEAU
**Source :** `lib/core/statistics/`

```typescript
describe('CohortStats', () => {
  it('should compute mean correctly for cohort')
  it('should compute standard deviation correctly')
  it('should normalize a score: (x - mean) / stddev')
  it('should compute p10, p25, p50, p75, p90 percentiles')
  it('should handle cohort of size 1 without crash')
  it('should handle cohort of size 0 returning defaults')
  it('should handle all-zero scores cohort')
  it('should handle NaN values by filtering them out')
})
```

#### `__tests__/lib/nexus-index.complete.test.ts` — COMPLÉTER
**Source :** `lib/nexus-index.ts`

```typescript
it('should include SSN, UAI, badges count, ARIA usage, session attendance in composite')
it('should return NexusIndex=0 for new student with no data')
it('should cap NexusIndex at 100')
it('should weight SSN as the dominant factor (≥40% of composite)')
it('should penalize 0 session attendance')
it('should reward ARIA usage up to a ceiling')
it('should be deterministic for identical inputs')
```

#### `__tests__/lib/credits.complete.test.ts` — COMPLÉTER
**Source :** `lib/credits.ts`

```typescript
// Manquants critiques
it('should return 0 balance for student with no transactions')
it('should exclude expired credit transactions from balance')
it('should sum only CREDIT type transactions for positive balance')
it('should subtract DEBIT type transactions from balance')
it('should not debit if balance is insufficient (throw InsufficientCreditsError)')
it('should be idempotent: debit with same sessionId twice → only charged once')
it('should refund correctly and increase balance')
it('should not refund twice for same sessionId (idempotency)')
it('should compute cost=1.00 for ONLINE_COURSE serviceType')
it('should compute cost=1.25 for PRESENTIEL_COURSE serviceType')
it('should compute cost=1.50 for GROUP_WORKSHOP serviceType')
```

---

### 1.2 Bilan & Diagnostic

#### `__tests__/lib/bilan-renderer.complete.test.ts` — COMPLÉTER
**Source :** `lib/diagnostics/bilan-renderer.ts`

```typescript
// renderEleveBilan
it('should use tutoiement ("tu") in eleve bilan, never vouvoiement')
it('should include micro-plan with 5min/15min/30min sections')
it('should include prerequis section when weak domains identified')
it('should display numeric scores for eleve audience')
it('should adapt content for NSI vs Maths discipline')
it('should adapt content for Premiere vs Terminale level')
// renderParentsBilan
it('should use vouvoiement ("vous") in parents bilan, never tutoiement')
it('should NOT include raw numeric scores in parents bilan')
it('should use qualitative labels (Maîtrisé/En cours/À consolider)')
it('should focus on actionable recommendations for parents')
// renderNexusBilan
it('should include TrustScore as numeric value in nexus bilan')
it('should include domain coverage table in nexus bilan')
it('should include verbatims from student answers')
it('should include technical domain map with skill-level breakdown')
// Tous les renderers
it('should produce valid Markdown (parseable without errors)')
it('should not include undefined or null placeholders in output')
it('should handle empty priorités gracefully')
it('should handle student with perfect scores')
it('should handle student with all-zero scores')
```

#### `__tests__/lib/signed-token.complete.test.ts` — COMPLÉTER
**Source :** `lib/diagnostics/signed-token.ts`

```typescript
it('should sign and verify a valid token successfully')
it('should reject a tampered token payload')
it('should reject a token with wrong HMAC signature')
it('should reject an expired token (exp in past)')
it('should reject a token for wrong audience (nexus audience without auth)')
it('should accept eleve audience token for eleve page')
it('should accept parents audience token for parents page')
it('should reject parents token on eleve page (wrong audience)')
it('should not replay: same token verified twice still valid (no state)')
it('should handle Idempotency-Key header correctly')
it('should produce different tokens for different diagnosticIds')
it('should produce different tokens for different audiences')
```

#### `__tests__/lib/bilan-generator.test.ts` — NOUVEAU
**Source :** `lib/bilan-generator.ts`

```typescript
describe('BilanGenerator Pipeline', () => {
  // Setup: mock RAG client + Ollama client
  it('should call RAG search with weak domains as query')
  it('should call RAG search with error types as query')
  it('should call RAG search with exam preparation query')
  it('should call Ollama 3 times sequentially (eleve + parents + nexus)')
  it('should pass eleve context to first Ollama call')
  it('should pass different context to parents Ollama call')
  it('should include RAG context in Ollama prompts')
  it('should return all 3 bilans on success')
  it('should continue with partial bilans if 1 Ollama call fails (LLM fallback)')
  it('should mark status=COMPLETED even if all LLM calls fail (graceful degradation)')
  it('should timeout gracefully if Ollama takes >180s')
  it('should not persist PII in Ollama prompts (masked)')
})
```

---

### 1.3 Entitlements & Access

#### `__tests__/lib/entitlement/engine.complete.test.ts` — COMPLÉTER
**Source :** `lib/entitlement/engine.ts`

```typescript
// SINGLE mode
it('should create entitlement on first activation (SINGLE mode)')
it('should be noop if entitlement already ACTIVE in SINGLE mode')
it('should reactivate SUSPENDED entitlement in SINGLE mode')
// EXTEND mode
it('should extend endsAt by plan duration if already ACTIVE (EXTEND mode)')
it('should set new endsAt if currently EXPIRED (EXTEND mode)')
it('should accumulate extensions correctly for multiple renewals')
// STACK mode
it('should always create a new entitlement record in STACK mode')
it('should stack credits correctly (sum of all ACTIVE transactions)')
it('should be idempotent via sourceInvoiceId (no duplicate on retry)')
// Suspension & Révocation
it('should set status=SUSPENDED on suspension')
it('should set status=REVOKED on revocation (irreversible)')
it('should not reactivate REVOKED entitlement')
// Expiration
it('should return isExpired=true when endsAt < now()')
it('should return isActive=false for EXPIRED entitlements in feature check')
```

#### `__tests__/lib/access/rules.complete.test.ts` — COMPLÉTER
**Source :** `lib/access/rules.ts`

Générer la **matrice complète** (10 features × 5 rôles × entitlement present/absent = 100 cas) :

```typescript
const FEATURES = ['platform_access','hybrid_sessions','immersion_mode',
  'aria_maths','aria_nsi','credits_use','admin_facturation',
  'ai_feedback','advanced_analytics','priority_support'] as const;

const ROLES = ['ADMIN','ASSISTANTE','COACH','PARENT','ELEVE'] as const;

// Pour chaque feature × role × hasEntitlement → assert résolution correcte
describe('Access Rules Matrix (100 cases)', () => {
  FEATURES.forEach(feature => {
    ROLES.forEach(role => {
      describe(`${feature} × ${role}`, () => {
        it('should grant access when role is exempt', ...)
        it('should grant access when entitlement is ACTIVE', ...)
        it('should deny access when entitlement is EXPIRED', ...)
        it('should deny access when no entitlement exists', ...)
        it('should apply correct fallback mode (HIDE/DISABLE/REDIRECT)', ...)
      })
    })
  })
})
```

---

### 1.4 Facturation & Paiements

#### `__tests__/lib/invoice/invoice-engine.test.ts` — NOUVEAU
**Source :** `lib/invoice/`

```typescript
describe('Invoice Engine', () => {
  // Création
  it('should create invoice with status=DRAFT by default')
  it('should auto-generate sequential invoice number (INV-YYYY-NNNN format)')
  it('should not skip numbers in sequence under concurrent creation')
  it('should compute totalAmount as sum of all InvoiceItems')
  it('should apply TVA if applicable')
  // Transitions
  it('should allow DRAFT → SENT transition')
  it('should allow SENT → PAID transition')
  it('should allow DRAFT/SENT → CANCELLED transition')
  it('should reject PAID → CANCELLED transition')
  it('should reject CANCELLED → any transition')
  it('should reject PAID → SENT transition (no going back)')
  // PDF
  it('should render PDF with invoice number, date, items, total')
  it('should render PDF with client name and address')
  it('should produce valid PDF buffer (starts with %PDF)')
  // Activation entitlements
  it('should activate entitlements for all productCodes on PAID transition')
  it('should not activate entitlements on DRAFT or SENT status')
  // Email
  it('should send invoice email with PDF attachment on SENT transition')
  it('should throttle: reject if same invoice sent within 1 hour')
  // Access tokens
  it('should generate access token for invoice download')
  it('should revoke access token after invoice is CANCELLED')
  it('should reject revoked access token')
  // Storage
  it('should store PDF in data/invoices/ on PAID')
  it('should store PDF in storage/documents/ on PAID')
  it('should create UserDocument record on PAID')
})
```

#### `__tests__/lib/payments.complete.test.ts` — COMPLÉTER
**Source :** `lib/payments.ts`

```typescript
it('should execute payment validation as atomic transaction (all-or-nothing)')
it('should rollback if subscription activation fails during validation')
it('should rollback if credit allocation fails during validation')
it('should rollback if invoice generation fails during validation')
it('should prevent double payment via check-pending guard')
it('should return PENDING status correctly via check-pending')
it('should mark Payment as COMPLETED on validation')
it('should mark Payment as REJECTED on rejection')
it('should not allocate credits on rejection')
it('should send email confirmation on successful validation')
it('should send Telegram notification on successful validation')
```

---

### 1.5 Session Booking

#### `__tests__/lib/session-booking.complete.test.ts` — COMPLÉTER
**Source :** `lib/session-booking.ts`

```typescript
// Disponibilité
it('should reject booking if coach has no availability for that slot')
it('should reject booking if slot overlaps with existing SCHEDULED session')
it('should reject booking if slot overlaps with CONFIRMED session')
it('should allow booking if only CANCELLED sessions overlap (freed slot)')
// Crédits
it('should check entitlement credits_use before booking')
it('should reject booking if student balance < required credits')
it('should debit correct credit amount based on session type')
it('should debit credits idempotently (same booking request twice → charged once)')
// Cycle de vie complet
it('should transition SCHEDULED → CONFIRMED correctly')
it('should transition CONFIRMED → IN_PROGRESS at session start time')
it('should transition IN_PROGRESS → COMPLETED at session end time')
it('should transition to CANCELLED and refund credits')
it('should transition to NO_SHOW without refunding credits')
it('should transition to RESCHEDULED and create new booking')
// Notifications
it('should notify coach on new booking creation')
it('should notify parent on booking confirmation')
it('should notify student on cancellation')
```

#### `__tests__/lib/jitsi.test.ts` — COMPLÉTER
**Source :** `lib/jitsi.ts`

```typescript
it('should generate unique room name based on sessionId')
it('should include JWT token for authenticated users')
it('should include student displayName in JWT claims')
it('should include coach displayName in JWT claims')
it('should return valid Jitsi URL format')
it('should not expose JITSI_SECRET in room URL')
it('should use different rooms for different sessions')
```

---

### 1.6 ARIA & RAG

#### `__tests__/lib/aria.complete.test.ts` — COMPLÉTER
**Source :** `lib/aria.ts`

```typescript
it('should call Ollama with correct model and system prompt')
it('should include RAG context in Ollama messages')
it('should return streaming response object')
it('should handle Ollama connection refused gracefully (ECONNREFUSED)')
it('should handle Ollama timeout (>180s) with descriptive error')
it('should not expose OPENAI_BASE_URL in error messages')
it('should save AriaConversation to DB on first message')
it('should append AriaMessage to existing conversation on follow-up')
it('should apply pedagogy-appropriate tone for student audience')
```

#### `__tests__/lib/aria-streaming.complete.test.ts` — COMPLÉTER
**Source :** `lib/aria-streaming.ts`

```typescript
it('should parse Server-Sent Events format correctly')
it('should emit text chunks progressively')
it('should handle [DONE] signal and close stream')
it('should handle malformed chunk without crashing')
it('should reassemble split chunks correctly')
it('should handle network error mid-stream gracefully')
it('should emit error event on stream failure')
```

#### `__tests__/lib/rag-client.complete.test.ts` — COMPLÉTER
**Source :** `lib/rag-client.ts`

```typescript
it('should search with subject filter correctly (MATHEMATIQUES)')
it('should search with level filter (premiere vs terminale)')
it('should search with type filter (cours vs exercice)')
it('should search with domain filter (analyse, algebre...)')
it('should apply AND logic for multiple filters')
it('should return top-N results sorted by relevance score')
it('should return empty array when no results match')
it('should fallback gracefully when RAG ingestor is unreachable (HTTP 503)')
it('should timeout after RAG_SEARCH_TIMEOUT ms')
it('should build RAG context string from search results')
it('should truncate context if too long for LLM context window')
it('should fetch collection stats correctly')
it('should return zero stats when collection is empty')
```

---

### 1.7 Auth & Security

#### `__tests__/lib/auth.complete.test.ts` — COMPLÉTER
**Source :** `auth.ts`, `auth.config.ts`

```typescript
// authorize()
it('should return user object for valid email+password')
it('should return null for non-existent email')
it('should return null for wrong password')
it('should return null for ELEVE with activatedAt=null (not yet activated)')
it('should return user for ELEVE with activatedAt set')
it('should include role in returned user object')
it('should bcrypt.compare password correctly')
// JWT callbacks
it('should include userId, role, firstName, lastName in JWT token')
it('should refresh JWT on each request (sliding expiry)')
// Session callbacks
it('should expose userId and role in session.user')
it('should NOT expose password hash in session')
// authorized callback (middleware)
it('should allow access to /dashboard when isLoggedIn=true')
it('should deny access to /dashboard when isLoggedIn=false')
it('should redirect /auth/signin to /dashboard when already authenticated')
```

#### `__tests__/lib/guards.test.ts` — NOUVEAU
**Source :** `lib/guards.ts`

```typescript
describe('requireRole', () => {
  it('should pass for user with matching role')
  it('should throw 403 for user with wrong role')
  it('should throw 401 for unauthenticated user')
})
describe('requireAnyRole', () => {
  it('should pass if user has any of the allowed roles')
  it('should throw 403 if user has none of the allowed roles')
})
describe('isErrorResponse', () => {
  it('should identify error response correctly')
  it('should return false for successful response')
})
```

#### `__tests__/lib/rate-limit.complete.test.ts` — COMPLÉTER
**Source :** `lib/rate-limit.ts`

```typescript
it('should allow requests within the window limit')
it('should block the (limit+1)th request with 429')
it('should reset counter after window expires')
it('should use Redis backend when UPSTASH_REDIS_REST_URL is set')
it('should fallback to in-memory when Redis is not configured')
it('should use IP as default rate limit key')
it('should allow custom key (e.g. userId-based)')
it('should include Retry-After header in 429 response')
```

---

### 1.8 Validation Zod

#### `__tests__/lib/validation/users.test.ts` — NOUVEAU
**Source :** `lib/validation/users.ts`

```typescript
describe('createUserSchema', () => {
  it('should validate valid user creation payload')
  it('should reject invalid email format')
  it('should reject password shorter than 8 chars')
  it('should reject password without at least 1 digit')
  it('should reject invalid role value')
  it('should make password optional for OAuth users')
})
describe('updateUserSchema', () => {
  it('should allow partial updates (email only)')
  it('should treat empty string password as undefined (not update hash)')
  it('should reject invalid role transition')
})
```

#### `__tests__/lib/validation/sessions.test.ts` — NOUVEAU

```typescript
describe('sessionBookingSchema', () => {
  it('should validate valid booking payload')
  it('should reject past date/time for booking')
  it('should reject unknown serviceType')
  it('should reject negative duration')
  it('should require coachId as valid CUID')
  it('should require studentId as valid CUID')
})
describe('sessionReportSchema', () => {
  it('should validate valid report')
  it('should reject empty content string')
  it('should require rating between 1 and 5')
})
```

#### `__tests__/lib/validation/payments.test.ts` — NOUVEAU

```typescript
it('should validate bank transfer declaration payload')
it('should reject negative amount')
it('should reject amount > 10000 (sanity limit)')
it('should reject invalid currency')
it('should validate payment validation/rejection payload')
it('should require reason on rejection')
```

---

### 1.9 Utilitaires

#### `__tests__/lib/email.complete.test.ts` — COMPLÉTER
**Source :** `lib/email/mailer.ts`

```typescript
it('should send email via SMTP transport on success')
it('should skip sending when MAIL_DISABLED=true')
it('should include correct From header (MAIL_FROM env)')
it('should include Reply-To header (MAIL_REPLY_TO env)')
it('should handle SMTP connection error gracefully (not throw)')
it('should render HTML template for bilan_ack correctly')
it('should render HTML template for internal notification correctly')
it('should sanitize user-provided content in templates (no XSS)')
it('should log error on failure without exposing credentials')
```

#### `__tests__/lib/telegram.complete.test.ts` — COMPLÉTER
**Source :** `lib/telegram/client.ts`

```typescript
it('should send message via Telegram Bot API')
it('should skip sending when TELEGRAM_DISABLED=true')
it('should format reservation notification correctly')
it('should format payment notification correctly')
it('should handle HTTP error from Telegram API gracefully')
it('should include chat ID from TELEGRAM_CHAT_ID env')
it('should not expose BOT_TOKEN in error messages')
```

#### `__tests__/lib/translations.test.ts` — COMPLÉTER
**Source :** `lib/translations.ts`

```typescript
it('should return correct French string for every key')
it('should interpolate {variable} placeholders correctly')
it('should return key name as fallback for missing translation')
it('should not have any undefined values in translation map')
it('should cover all UserRole enum values')
it('should cover all SessionStatus enum values')
it('should cover all SubscriptionStatus enum values')
it('should cover all PaymentStatus enum values')
```

---

## PASSE 2 — TESTS API (Catégorie 2) ⭐ P0 CRITIQUE

### Instructions pour cette passe

Pour chaque route API :
1. Lis le fichier `app/api/.../route.ts` correspondant
2. Identifie les méthodes HTTP, les schémas Zod de validation, les guards RBAC
3. Mock `prisma` + `getServerSession` + services externes (email, Telegram)
4. Structure : `describe('GET /api/admin/dashboard', () => { describe('Authentication', ...) describe('Happy Path', ...) describe('Error Cases', ...) })`

**Pattern de mock standard à réutiliser :**
```typescript
import { prismaMock } from '@/tests/mocks/prisma'
jest.mock('@/lib/prisma', () => ({ default: prismaMock }))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/email/mailer', () => ({ sendEmail: jest.fn() }))
jest.mock('@/lib/telegram/client', () => ({ sendTelegramMessage: jest.fn() }))
```

---

#### `__tests__/api/admin/dashboard.test.ts` — COMPLÉTER

```typescript
describe('GET /api/admin/dashboard', () => {
  it('should return 401 when not authenticated')
  it('should return 403 when authenticated as PARENT')
  it('should return 403 when authenticated as ELEVE')
  it('should return 403 when authenticated as COACH')
  it('should return 403 when authenticated as ASSISTANTE')
  it('should return 200 with KPIs when authenticated as ADMIN')
  it('should include totalUsers count in response')
  it('should include activeSubscriptions count in response')
  it('should include pendingPayments count in response')
  it('should include systemHealth status in response')
  it('should handle DB error gracefully (500 with error message)')
})
```

#### `__tests__/api/admin/users.complete.test.ts` — COMPLÉTER

```typescript
// GET (list)
it('should return all users for ADMIN')
it('should support search query parameter')
it('should filter by role parameter')
it('should paginate results (page + limit params)')
// POST (create)
it('should create user with hashed password')
it('should return 400 for invalid email format')
it('should return 409 for duplicate email')
it('should return 400 for missing required fields')
it('should return 400 for invalid role value')
// PATCH (update)
it('should update email without changing password hash')
it('should update password when new password provided')
it('should NOT update password when empty string provided')
it('should return 404 for non-existent userId')
// DELETE
it('should delete user and cascade related records')
it('should return 404 for non-existent userId')
it('should prevent deleting own account')
```

#### `__tests__/api/admin/documents.test.ts` — NOUVEAU

```typescript
it('should return 401 if not authenticated')
it('should return 403 if not ADMIN or ASSISTANTE')
it('should search users by name/email for document assignment')
it('should reject empty search query (min 2 chars)')
it('should upload file and create UserDocument record')
it('should reject file > 10MB')
it('should reject unsupported file types (only PDF, JPG, PNG)')
it('should link document to correct user (selectedUserId)')
it('should return download URL for uploaded document')
```

#### `__tests__/api/aria/chat.test.ts` — COMPLÉTER

```typescript
it('should return 401 when not authenticated')
it('should return 403 when entitlement aria_maths is missing for Maths question')
it('should return 403 when entitlement aria_nsi is missing for NSI question')
it('should grant access when ADMIN (exempt from entitlement check)')
it('should call RAG search with student message as query')
it('should call Ollama with RAG context included')
it('should return streaming response with correct Content-Type')
it('should save conversation to DB after response')
it('should create new AriaConversation on first message')
it('should append to existing AriaConversation on follow-up')
it('should return 503 when Ollama is unreachable')
it('should return 504 when Ollama times out')
it('should not leak internal error details to client')
```

#### `__tests__/api/sessions/book.complete.test.ts` — COMPLÉTER

```typescript
it('should return 401 when not authenticated')
it('should return 403 for ADMIN user (not a student/parent)')
it('should return 403 when credits_use entitlement is missing')
it('should return 409 when coach is not available at requested time')
it('should return 409 when coach already has a session at that time')
it('should return 402 when student credit balance is insufficient')
it('should create SessionBooking with status=SCHEDULED on success')
it('should debit correct credits on success')
it('should be idempotent: duplicate request with same params → same booking')
it('should send notification to coach on success')
it('should send notification to parent on success')
it('should return 400 for invalid coachId format')
it('should return 400 for past date/time')
it('should handle DB transaction failure with rollback')
```

#### `__tests__/api/payments/validate.complete.test.ts` — COMPLÉTER

```typescript
it('should return 403 for PARENT/ELEVE/COACH roles')
it('should return 404 for non-existent paymentId')
it('should execute atomic transaction on approval: payment + subscription + credits + invoice + document')
it('should rollback everything if subscription activation fails')
it('should rollback everything if credit allocation fails')
it('should rollback everything if invoice generation fails')
it('should mark payment as COMPLETED on approval')
it('should mark payment as REJECTED on rejection')
it('should require rejection reason in payload')
it('should not allocate credits on rejection')
it('should not create UserDocument on rejection')
it('should send email confirmation on approval')
it('should send Telegram notification on approval')
it('should return 400 for invalid action value')
```

#### `__tests__/api/bilan-pallier2-maths.test.ts` — NOUVEAU

```typescript
it('should return 400 for invalid form payload (missing required fields)')
it('should validate student level (premiere/terminale)')
it('should validate subject (MATHEMATIQUES/NSI)')
it('should compute scoring V2 synchronously')
it('should return scoringResult in response')
it('should trigger LLM bilan generation asynchronously')
it('should store diagnostic with status=PENDING initially')
it('should update status to ANALYZED after LLM completion')
it('should update status to COMPLETED even if LLM fails')
it('should generate signed tokens for eleve and parents audiences')
it('should return redirect URL to /resultat/[id]')
it('should handle concurrent submissions without race condition')
```

#### `__tests__/api/payments/bank-transfer.test.ts` — NOUVEAU

```typescript
it('should return 401 when not authenticated')
it('should return 403 for non-PARENT roles')
it('should create Payment with status=PENDING')
it('should reject if PENDING payment already exists for this parent (anti-double)')
it('should notify ADMIN and ASSISTANTE on declaration')
it('should return 400 for missing required fields')
it('should return 400 for invalid amount (negative, zero, > 10000)')
it('should validate IBAN format if provided')
```

---

## PASSE 3 — TESTS RBAC COMPLET (Catégorie 3) ⭐ P0 CRITIQUE

### Instructions

Créer UN fichier qui couvre **toutes les routes × tous les rôles** :

#### `__tests__/api/rbac-complete-matrix.test.ts` — NOUVEAU

```typescript
/**
 * RBAC Complete Matrix Test
 * 81 routes × 6 access levels (unauthenticated + 5 roles)
 * Minimum 486 assertions
 */

import { createMocks } from 'node-mocks-http'

// Route definitions avec expected access per role
const ROUTE_ACCESS_MATRIX = [
  // Format: [route, method, unauthenticated, ADMIN, ASSISTANTE, COACH, PARENT, ELEVE]
  // 401 = unauthenticated, 403 = wrong role, 200/201 = success, 'skip' = not applicable
  
  // Admin routes
  ['/api/admin/dashboard', 'GET', 401, 200, 403, 403, 403, 403],
  ['/api/admin/analytics', 'GET', 401, 200, 403, 403, 403, 403],
  ['/api/admin/activities', 'GET', 401, 200, 403, 403, 403, 403],
  ['/api/admin/users', 'GET', 401, 200, 403, 403, 403, 403],
  ['/api/admin/users', 'POST', 401, 201, 403, 403, 403, 403],
  ['/api/admin/subscriptions', 'GET', 401, 200, 403, 403, 403, 403],
  ['/api/admin/test-email', 'POST', 401, 200, 403, 403, 403, 403],
  ['/api/admin/recompute-ssn', 'POST', 401, 200, 403, 403, 403, 403],
  ['/api/admin/documents', 'GET', 401, 200, 200, 403, 403, 403], // ADMIN + ASSISTANTE
  
  // Assistant routes
  ['/api/assistant/dashboard', 'GET', 401, 403, 200, 403, 403, 403],
  ['/api/assistant/students', 'GET', 401, 403, 200, 403, 403, 403],
  ['/api/assistant/activate-student', 'POST', 401, 403, 200, 403, 403, 403],
  ['/api/assistant/coaches', 'GET', 401, 403, 200, 403, 403, 403],
  ['/api/assistant/subscriptions', 'GET', 401, 403, 200, 403, 403, 403],
  ['/api/assistant/credit-requests', 'GET', 401, 403, 200, 403, 403, 403],
  
  // Parent routes
  ['/api/parent/dashboard', 'GET', 401, 403, 403, 403, 200, 403],
  ['/api/parent/children', 'GET', 401, 403, 403, 403, 200, 403],
  ['/api/parent/credit-request', 'POST', 401, 403, 403, 403, 200, 403],
  ['/api/parent/subscriptions', 'GET', 401, 403, 403, 403, 200, 403],
  
  // Student routes
  ['/api/student/dashboard', 'GET', 401, 403, 403, 403, 403, 200],
  ['/api/student/sessions', 'GET', 401, 403, 403, 403, 403, 200],
  ['/api/student/credits', 'GET', 401, 403, 403, 403, 403, 200],
  ['/api/student/resources', 'GET', 401, 403, 403, 403, 403, 200],
  
  // Coach routes
  ['/api/coach/dashboard', 'GET', 401, 403, 403, 200, 403, 403],
  ['/api/coach/sessions', 'GET', 401, 403, 403, 200, 403, 403],
  
  // ARIA routes (entitlement-gated)
  ['/api/aria/chat', 'POST', 401, 200, 403, 403, 403, 403], // ADMIN exempt, ELEVE needs entitlement
  ['/api/aria/conversations', 'GET', 401, 200, 403, 403, 403, 200],
  ['/api/aria/feedback', 'POST', 401, 200, 403, 403, 403, 200],
  
  // Session routes
  ['/api/sessions/book', 'POST', 401, 403, 200, 403, 200, 200], // credits_use gated
  ['/api/sessions/cancel', 'POST', 401, 200, 200, 200, 200, 200],
  ['/api/sessions/video', 'POST', 401, 200, 200, 200, 200, 200],
  
  // Payment routes
  ['/api/payments/bank-transfer/confirm', 'POST', 401, 403, 403, 403, 200, 403],
  ['/api/payments/validate', 'POST', 401, 200, 200, 403, 403, 403],
  ['/api/payments/pending', 'GET', 401, 200, 200, 403, 403, 403],
  
  // Public routes (no auth required)
  ['/api/health', 'GET', 200, 200, 200, 200, 200, 200],
  ['/api/contact', 'POST', 200, 200, 200, 200, 200, 200],
  ['/api/bilan-gratuit', 'POST', 200, 200, 200, 200, 200, 200],
  
  // ... [CONTINUES FOR ALL 81 ROUTES]
] as const

describe('RBAC Complete Matrix', () => {
  ROUTE_ACCESS_MATRIX.forEach(([route, method, ...expectedCodes]) => {
    const roles = ['unauthenticated', 'ADMIN', 'ASSISTANTE', 'COACH', 'PARENT', 'ELEVE']
    expectedCodes.forEach((expectedCode, idx) => {
      if (expectedCode === 'skip') return
      it(`${method} ${route} → ${roles[idx]}: should return ${expectedCode}`, async () => {
        // Setup session mock based on role
        // Call route handler
        // Assert status code
      })
    })
  })
})
```

---

## PASSE 4 — TESTS E2E (Catégorie 4) ⭐ P0 CRITIQUE

### Instructions

1. Lis les fixtures existantes dans `e2e/fixtures/`
2. Utilise les helpers auth existants dans `e2e/global-setup.ts`
3. Structure chaque spec avec `test.describe` + `test.beforeAll` pour login
4. Utilise `page.waitForLoadState('networkidle')` pour les pages avec fetch
5. Préfère `getByRole`, `getByLabel`, `getByTestId` à `page.locator('css')`

#### `e2e/navigation-complete.spec.ts` — NOUVEAU

```typescript
test.describe('Public Navigation - All 30 pages', () => {
  // Test chaque page publique
  const PUBLIC_PAGES = [
    { url: '/', title: 'Nexus Réussite', hasH1: true },
    { url: '/offres', title: 'Offres', hasH1: true },
    { url: '/bilan-gratuit', title: 'Bilan Gratuit' },
    { url: '/stages', expectedRedirect: '/stages/fevrier-2026' },
    { url: '/contact', title: 'Contact' },
    { url: '/equipe', title: 'Équipe' },
    { url: '/accompagnement-scolaire', title: 'Accompagnement' },
    { url: '/plateforme-aria', title: 'ARIA' },
    { url: '/programme/maths-1ere', title: 'Mathématiques' },
    { url: '/notre-centre', title: 'Centre' },
    { url: '/conditions', title: 'Conditions' },
    // ... tous les 30
  ]
  
  PUBLIC_PAGES.forEach(({ url, title, expectedRedirect }) => {
    test(`${url} loads correctly`, async ({ page }) => {
      await page.goto(url)
      if (expectedRedirect) await page.waitForURL(expectedRedirect)
      await expect(page).toHaveTitle(new RegExp(title || '', 'i'))
      await expect(page.locator('h1')).toBeVisible()
      // Check no console errors
      const errors: string[] = []
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
      expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0)
    })
  })
  
  test('navbar all dropdown links are functional', async ({ page }) => {
    await page.goto('/')
    // Essentiel dropdown
    await page.getByRole('button', { name: /essentiel/i }).click()
    await expect(page.getByRole('link', { name: /accueil/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /offres/i })).toBeVisible()
    // ... test all dropdown items
  })
  
  test('all footer links navigate correctly', async ({ page }) => {
    await page.goto('/')
    const footerLinks = await page.locator('footer a').all()
    for (const link of footerLinks) {
      const href = await link.getAttribute('href')
      if (href?.startsWith('/')) {
        await page.goto(href)
        await expect(page).not.toHaveURL(/error|404/)
      }
    }
  })
  
  test('legacy redirections work', async ({ page }) => {
    const redirects = [
      ['/inscription', '/bilan-gratuit'],
      ['/questionnaire', '/bilan-gratuit'],
      ['/tarifs', '/offres'],
      ['/plateforme', '/plateforme-aria'],
      ['/education', '/accompagnement-scolaire'],
    ]
    for (const [from, to] of redirects) {
      await page.goto(from)
      await expect(page).toHaveURL(new RegExp(to))
    }
  })
})
```

#### `e2e/auth-complete.spec.ts` — COMPLÉTER

```typescript
test.describe('Authentication E2E', () => {
  // Login flows
  test('admin can login and reaches admin dashboard', async ({ page }) => {
    await page.goto('/auth/signin')
    await page.getByLabel(/email/i).fill('admin@nexus-reussite.com')
    await page.getByLabel(/mot de passe/i).fill('admin123')
    await page.getByRole('button', { name: /connexion/i }).click()
    await expect(page).toHaveURL(/dashboard\/admin/)
  })
  
  test('each role is redirected to correct dashboard after login', async ({ page }) => {
    const users = [
      { email: 'parent@example.com', password: 'admin123', dashboardPath: '/dashboard/parent' },
      { email: 'student@example.com', password: 'admin123', dashboardPath: '/dashboard/eleve' },
      { email: 'helios@nexus-reussite.com', password: 'admin123', dashboardPath: '/dashboard/coach' },
    ]
    for (const user of users) {
      await page.goto('/auth/signin')
      await page.getByLabel(/email/i).fill(user.email)
      await page.getByLabel(/mot de passe/i).fill(user.password)
      await page.getByRole('button', { name: /connexion/i }).click()
      await expect(page).toHaveURL(user.dashboardPath)
      // Logout
      await page.getByRole('button', { name: /déconnexion/i }).click()
    }
  })
  
  test('shows error for wrong password', async ({ page }) => {
    await page.goto('/auth/signin')
    await page.getByLabel(/email/i).fill('admin@nexus-reussite.com')
    await page.getByLabel(/mot de passe/i).fill('wrongpassword')
    await page.getByRole('button', { name: /connexion/i }).click()
    await expect(page.getByRole('alert')).toContainText(/incorrect|invalide/i)
    await expect(page).toHaveURL(/signin/)
  })
  
  test('shows error for non-existent email', async ({ page }) => { ... })
  test('shows error for unactivated student', async ({ page }) => { ... })
  
  test('already logged-in user is redirected from /auth/signin', async ({ page, context }) => {
    // Set auth cookie
    await context.addCookies([...adminAuthCookies])
    await page.goto('/auth/signin')
    await expect(page).toHaveURL(/dashboard\/admin/)
  })
  
  test('middleware redirects unauthenticated user to signin', async ({ page }) => {
    await page.goto('/dashboard/admin')
    await expect(page).toHaveURL(/auth\/signin/)
  })
  
  test('password reset flow works end-to-end', async ({ page }) => {
    await page.goto('/auth/mot-de-passe-oublie')
    await page.getByLabel(/email/i).fill('parent@example.com')
    await page.getByRole('button', { name: /envoyer/i }).click()
    await expect(page.getByText(/envoyé|lien/i)).toBeVisible()
    // Note: can't test email link without email interceptor - mock in unit tests
  })
})
```

#### `e2e/dashboard-admin.spec.ts` — NOUVEAU

```typescript
test.describe('Admin Dashboard E2E', () => {
  test.use({ storageState: 'e2e/fixtures/admin-auth.json' })
  
  test('admin dashboard loads with KPIs', async ({ page }) => {
    await page.goto('/dashboard/admin')
    await expect(page.getByText(/utilisateurs/i)).toBeVisible()
    await expect(page.getByText(/abonnements/i)).toBeVisible()
  })
  
  test('create user flow', async ({ page }) => {
    await page.goto('/dashboard/admin/users')
    await page.getByRole('button', { name: /créer|ajouter/i }).click()
    await page.getByLabel(/email/i).fill('newtest@nexus.com')
    await page.getByLabel(/prénom/i).fill('Test')
    await page.getByLabel(/nom/i).fill('User')
    await page.getByLabel(/rôle/i).selectOption('PARENT')
    await page.getByLabel(/mot de passe/i).fill('Test1234!')
    await page.getByRole('button', { name: /créer|confirmer/i }).click()
    await expect(page.getByText(/newtest@nexus.com/)).toBeVisible()
  })
  
  test('upload document to student coffre-fort', async ({ page }) => {
    await page.goto('/dashboard/admin/documents')
    await page.getByLabel(/rechercher.*élève/i).fill('student')
    await page.getByText(/student@example.com/).click()
    await page.setInputFiles('input[type="file"]', './e2e/fixtures/test-document.pdf')
    const uploadButton = page.getByRole('button', { name: /uploader|envoyer/i })
    await expect(uploadButton).toBeEnabled()
    await uploadButton.click()
    await expect(page.getByText(/succès|uploadé/i)).toBeVisible()
  })
  
  test('analytics page loads charts', async ({ page }) => { ... })
  test('activities page shows journal with pagination', async ({ page }) => { ... })
  test('test system page loads', async ({ page }) => { ... })
})
```

#### `e2e/dashboard-parent.spec.ts` — COMPLÉTER

```typescript
test.describe('Parent Dashboard E2E', () => {
  test.use({ storageState: 'e2e/fixtures/parent-auth.json' })
  
  test('add child dialog works', async ({ page }) => {
    await page.goto('/dashboard/parent')
    await page.getByRole('button', { name: /ajouter.*enfant/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    // Fill child form...
    // Submit...
    // Verify child appears in list
  })
  
  test('declare bank transfer and see pending banner', async ({ page }) => {
    await page.goto('/dashboard/parent/paiement')
    await page.getByLabel(/montant/i).fill('450')
    await page.getByLabel(/référence/i).fill('VIR-2026-TEST')
    await page.getByRole('button', { name: /déclarer/i }).click()
    await expect(page).toHaveURL(/confirmation/)
    // Return to dashboard
    await page.goto('/dashboard/parent')
    await expect(page.getByRole('alert', { name: /en cours.*analyse/i })).toBeVisible()
  })
  
  test('credit purchase dialog', async ({ page }) => { ... })
  test('subscription change dialog', async ({ page }) => { ... })
  test('aria addon dialog', async ({ page }) => { ... })
  test('invoice details dialog', async ({ page }) => { ... })
  test('download document from coffre-fort', async ({ page }) => { ... })
})
```

#### `e2e/bilan-diagnostic.spec.ts` — NOUVEAU

```typescript
test.describe('Bilan Pallier 2 Maths E2E', () => {
  test('complete form submission and view results', async ({ page }) => {
    await page.goto('/bilan-pallier2-maths')
    // Fill student info section
    await page.getByLabel(/prénom/i).fill('Mehdi')
    await page.getByLabel(/niveau/i).selectOption('premiere')
    await page.getByLabel(/matière/i).selectOption('MATHEMATIQUES')
    // Navigate through quiz sections
    // Answer all questions
    // Submit
    await page.getByRole('button', { name: /soumettre|terminer/i }).click()
    await expect(page).toHaveURL(/confirmation/)
    // Verify results page accessible
  })
  
  test('results page shows 3 audience tabs', async ({ page }) => {
    // Navigate to a known result with signed tokens
    // Verify eleve tab content (tutoiement, scores visible)
    // Verify parents tab content (vouvoiement, no raw scores)
    // Verify nexus tab is blocked for non-staff
  })
  
  test('polling mechanism updates status while LLM generates', async ({ page }) => {
    // Mock slow LLM response
    // Verify loading indicator
    // Verify auto-refresh triggers
    // Verify content appears after LLM completes
  })
})
```

#### `e2e/stages-fevrier2026.spec.ts` — COMPLÉTER

```typescript
test.describe('Stages Février 2026 E2E', () => {
  test('reservation form submission', async ({ page }) => {
    await page.goto('/stages/fevrier-2026')
    await page.getByLabel(/prénom/i).fill('Ahmed')
    await page.getByLabel(/email/i).fill('ahmed.test@email.com')
    await page.getByLabel(/niveau/i).selectOption('terminale')
    await page.getByRole('button', { name: /réserver|inscrire/i }).click()
    await expect(page.getByText(/confirmé|réservé/i)).toBeVisible()
  })
  
  test('QCM 50 questions with keyboard shortcuts', async ({ page }) => {
    await page.goto('/stages/fevrier-2026/diagnostic')
    // Verify intro screen
    await page.getByRole('button', { name: /commencer/i }).click()
    // First question visible
    await expect(page.getByText(/question 1/i)).toBeVisible()
    // Test keyboard shortcut A
    await page.keyboard.press('a')
    // Verify A is selected
    // Test N for NSP
    await page.keyboard.press('n')
    // Test Enter for next
    await page.keyboard.press('Enter')
    await expect(page.getByText(/question 2/i)).toBeVisible()
    // Test Maths/NSI transition (after question 30)
  })
  
  test('admin can export CSV from stages dashboard', async ({ page }) => {
    test.use({ storageState: 'e2e/fixtures/admin-auth.json' })
    await page.goto('/admin/stages/fevrier-2026')
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /export.*csv/i }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.csv$/)
  })
})
```

---

## PASSE 5 — SÉCURITÉ (Catégorie 5) ⭐ P0 CRITIQUE

#### `__tests__/security/jwt-escalation.complete.test.ts` — COMPLÉTER

```typescript
describe('JWT Role Escalation Prevention', () => {
  it('should reject manipulated JWT claiming ADMIN role')
  it('should reject JWT with modified userId')
  it('should reject JWT signed with wrong secret')
  it('should reject expired JWT')
  it('should reject JWT with future iat (issued at)')
  it('should not accept alg=none JWT attack')
  it('should verify signature on every request (not just cached)')
  it('should invalidate session when user is deleted from DB')
  it('should invalidate session when user role changes in DB')
})
```

#### `__tests__/security/idor.test.ts` — NOUVEAU

```typescript
describe('IDOR - Insecure Direct Object Reference', () => {
  it('parent A cannot access parent B children (GET /api/parent/children)')
  it('student A cannot access student B sessions (GET /api/student/sessions)')
  it('student A cannot access student B credits (GET /api/student/credits)')
  it('student A cannot access student B documents (GET /api/student/documents)')
  it('coach A cannot access coach B sessions (GET /api/coach/sessions)')
  it('parent cannot access invoice of another parent (GET /api/invoices/[id]/pdf)')
  it('student cannot access ARIA conversations of another student')
  it('parent cannot declare payment for another parent')
})
```

#### `__tests__/security/injection.test.ts` — NOUVEAU

```typescript
describe('SQL Injection Prevention', () => {
  const maliciousInputs = [
    "'; DROP TABLE users; --",
    "' OR '1'='1",
    "1; SELECT * FROM users",
    "admin'--",
    "' UNION SELECT password FROM users--",
  ]
  
  maliciousInputs.forEach(input => {
    it(`should safely handle SQL injection attempt: ${input.substring(0, 30)}`, async () => {
      // Test via search endpoint
      // Test via login endpoint
      // Test via contact form
      // All should return safe response, never 500 or data leak
    })
  })
})

describe('XSS Prevention', () => {
  const xssPayloads = [
    '<script>alert("xss")</script>',
    '"><img src=x onerror=alert(1)>',
    "javascript:alert('xss')",
    '<svg onload=alert(1)>',
  ]
  
  xssPayloads.forEach(payload => {
    it(`should sanitize XSS payload: ${payload.substring(0, 30)}`, async () => {
      // Submit via contact form, bilan-gratuit, etc.
      // Verify payload is escaped/sanitized in DB and response
    })
  })
})
```

#### `__tests__/security/rate-limiting.test.ts` — NOUVEAU

```typescript
describe('Rate Limiting', () => {
  it('should return 429 after exceeding login attempts (> 10 in 1 min)')
  it('should return Retry-After header on 429')
  it('should rate limit /api/notify/email (> 5 per minute)')
  it('should rate limit /api/contact (> 10 per minute)')
  it('should NOT rate limit /api/health')
  it('should reset rate limit counter after window expires')
  it('should rate limit per IP address')
})
```

#### `__tests__/security/csrf.test.ts` — COMPLÉTER

```typescript
describe('CSRF Protection', () => {
  it('should reject state-changing requests from different origin in production')
  it('should allow same-origin requests')
  it('should protect POST /api/notify/email with origin check')
  it('should reject missing Origin header on sensitive endpoints')
  it('should allow GET requests without CSRF token (read-only)')
})
```

#### `__tests__/security/path-traversal.test.ts` — NOUVEAU

```typescript
describe('Path Traversal Prevention', () => {
  it('should reject ../../etc/passwd in document download route')
  it('should reject null bytes in file paths')
  it('should reject absolute paths in file upload names')
  it('should sanitize filename to safe characters only')
  it('should not expose server file structure in error messages')
})
```

---

## PASSE 6 — CONCURRENCE & TRANSACTIONS (Catégorie 6) ⭐ P0 CRITIQUE

#### `__tests__/concurrency/double-booking.complete.test.ts` — COMPLÉTER

```typescript
describe('Double Booking Prevention', () => {
  it('should allow only 1 booking when 2 concurrent requests for same slot', async () => {
    // Setup: 2 different students wanting same coach slot
    // Execute: both requests simultaneously via Promise.all
    // Assert: exactly 1 SCHEDULED booking created, 1 rejected with 409
  })
  
  it('should use database-level locking to prevent race condition')
  it('should rollback failed booking without affecting successful one')
  it('should return clear 409 message on conflict')
})
```

#### `__tests__/concurrency/credit-race.complete.test.ts` — COMPLÉTER

```typescript
describe('Credit Debit Race Condition', () => {
  it('should prevent overdraft: 2 concurrent debits with only 1 credit available', async () => {
    // Setup: student with exactly 1 credit
    // Execute: 2 concurrent book requests (each costs 1 credit)
    // Assert: only 1 succeeds, balance never goes negative
  })
  
  it('should use optimistic locking or SELECT FOR UPDATE on credit check')
  it('should maintain correct balance after concurrent refund + debit')
})
```

#### `__tests__/transactions/payment-validation-rollback.complete.test.ts` — COMPLÉTER

```typescript
describe('Payment Validation Transaction Atomicity', () => {
  it('should rollback ALL changes if subscription activation fails mid-transaction')
  it('should rollback ALL changes if credit allocation fails mid-transaction')
  it('should rollback ALL changes if invoice creation fails mid-transaction')
  it('should leave payment status as PENDING on rollback (not FAILED)')
  it('should be idempotent: validating same payment twice has no extra effect')
  it('should handle concurrent validation of same payment (only 1 succeeds)')
})
```

---

## PASSE 7 — PERFORMANCE (Catégorie 7) 🔶 P1

#### `__tests__/performance/api-response-time.test.ts` — NOUVEAU

```typescript
describe('API Response Time SLA', () => {
  const SLA_MS = 500 // 500ms P95
  
  const ROUTES_TO_BENCHMARK = [
    { method: 'GET', path: '/api/health', sla: 50 },
    { method: 'GET', path: '/api/admin/dashboard', sla: SLA_MS },
    { method: 'GET', path: '/api/parent/dashboard', sla: SLA_MS },
    { method: 'GET', path: '/api/student/dashboard', sla: SLA_MS },
    { method: 'GET', path: '/api/admin/users', sla: SLA_MS },
    { method: 'POST', path: '/api/sessions/book', sla: 1000 },
    { method: 'POST', path: '/api/payments/validate', sla: 2000 },
  ]
  
  ROUTES_TO_BENCHMARK.forEach(({ method, path, sla }) => {
    it(`${method} ${path} responds within ${sla}ms`, async () => {
      const start = Date.now()
      // Make request
      const duration = Date.now() - start
      expect(duration).toBeLessThan(sla)
    })
  })
})
```

#### `__tests__/performance/n-plus-one.test.ts` — NOUVEAU

```typescript
describe('N+1 Query Prevention', () => {
  it('admin/users list does not trigger N+1 (should use single query with relations)')
  it('parent/children includes sessions in single query (not N queries per child)')
  it('student/sessions includes coachProfile in single query')
  it('aria/conversations includes messages count without N+1')
})
```

---

## PASSE 8 — ACCESSIBILITÉ (Catégorie 8) 🔶 P1

#### `e2e/accessibility.spec.ts` — NOUVEAU

```typescript
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility (axe-core)', () => {
  const PAGES_TO_CHECK = [
    '/', '/offres', '/bilan-gratuit', '/contact',
    '/auth/signin', '/stages/fevrier-2026',
  ]
  
  PAGES_TO_CHECK.forEach(url => {
    test(`${url} has no critical/serious accessibility violations`, async ({ page }) => {
      await page.goto(url)
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze()
      const criticalViolations = results.violations.filter(
        v => v.impact === 'critical' || v.impact === 'serious'
      )
      expect(criticalViolations).toHaveLength(0)
    })
  })
  
  test('all forms have associated labels', async ({ page }) => {
    await page.goto('/bilan-gratuit')
    const inputs = await page.locator('input:not([type="hidden"]):not([type="submit"])').all()
    for (const input of inputs) {
      const id = await input.getAttribute('id')
      const ariaLabel = await input.getAttribute('aria-label')
      const ariaLabelledBy = await input.getAttribute('aria-labelledby')
      expect(id || ariaLabel || ariaLabelledBy).toBeTruthy()
    }
  })
  
  test('tab navigation works on signin form', async ({ page }) => {
    await page.goto('/auth/signin')
    await page.keyboard.press('Tab') // email
    await page.keyboard.press('Tab') // password
    await page.keyboard.press('Tab') // submit button
    const focused = page.locator(':focus')
    await expect(focused).toHaveRole('button', { name: /connexion/i })
  })
  
  test('all icon-only buttons have aria-labels', async ({ page }) => {
    await page.goto('/')
    const iconButtons = await page.locator('button:not(:has-text(""))').all()
    for (const btn of iconButtons) {
      const ariaLabel = await btn.getAttribute('aria-label')
      const title = await btn.getAttribute('title')
      expect(ariaLabel || title).toBeTruthy()
    }
  })
  
  test('dialogs have aria-describedby', async ({ page }) => {
    test.use({ storageState: 'e2e/fixtures/parent-auth.json' })
    await page.goto('/dashboard/parent')
    await page.getByRole('button', { name: /ajouter.*enfant/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toHaveAttribute('aria-describedby')
  })
})
```

---

## PASSE 9 — BASE DE DONNÉES (Catégorie 10) ⭐ P0 CRITIQUE

#### `__tests__/database/schema-integrity.test.ts` — COMPLÉTER

```typescript
describe('Database Schema Integrity', () => {
  it('should have exactly 38 models in Prisma schema')
  it('should have exactly 20 enums in Prisma schema')
  it('should have all required indexes defined')
  it('should enforce unique constraint on User.email')
  it('should enforce unique constraint on StageReservation (email + academyId)')
  it('should cascade delete Student.sessions when Student is deleted')
  it('should cascade delete Student.ariaConversations when Student is deleted')
  it('should cascade delete Student.creditTransactions when Student is deleted')
  it('should set null on SessionBooking.coachId when CoachProfile is deleted')
  it('should have pgvector extension available')
})
```

#### `__tests__/database/migrations.test.ts` — NOUVEAU

```typescript
describe('Database Migrations', () => {
  it('should have exactly 16 migration files')
  it('should apply all migrations sequentially without error')
  it('should not have pending migrations after applying all')
  it('should have migration_lock.toml with correct provider=postgresql')
  it('should have add_reminder_sent migration applied')
})
```

---

## PASSE 10 — WORKFLOWS BUSINESS E2E COMPLETS (Catégorie 11) ⭐ P0 CRITIQUE

#### `e2e/workflow-inscription-session.spec.ts` — NOUVEAU

```typescript
test.describe('Workflow Complet: Inscription → Première Session', () => {
  test('full workflow from bilan-gratuit to booked session', async ({ browser }) => {
    // Step 1: Parent fills bilan-gratuit
    const publicPage = await browser.newPage()
    await publicPage.goto('/bilan-gratuit')
    // ... fill form ...
    await publicPage.getByRole('button', { name: /soumettre/i }).click()
    await expect(publicPage).toHaveURL(/confirmation/)
    
    // Step 2: Assistante creates student account (via API mock or real)
    // Step 3: Student activates account
    // Step 4: Parent declares bank transfer
    const parentPage = await browser.newPage()
    // ... set parent auth cookies ...
    await parentPage.goto('/dashboard/parent/paiement')
    // ... declare virement ...
    
    // Step 5: Assistante validates payment
    const assistantePage = await browser.newPage()
    // ... set assistante auth cookies ...
    await assistantePage.goto('/dashboard/assistante/paiements')
    // ... validate payment ...
    
    // Step 6: Verify subscription active + credits allocated
    await parentPage.goto('/dashboard/parent')
    await expect(parentPage.getByText(/abonnement actif/i)).toBeVisible()
    
    // Step 7: Eleve books session
    const elevePage = await browser.newPage()
    // ... set eleve auth cookies ...
    await elevePage.goto('/dashboard/eleve/sessions')
    // ... book session ...
    await expect(elevePage.getByText(/réservé|confirmé/i)).toBeVisible()
  })
})
```

#### `e2e/workflow-paiement-atomique.spec.ts` — NOUVEAU

```typescript
test.describe('Workflow Paiement: Transaction Atomique Complète', () => {
  test('payment validation creates subscription + credits + invoice + document atomically', async ({ page }) => {
    // Setup parent with pending payment
    // Assistante validates
    // Verify: Payment COMPLETED
    // Verify: Subscription ACTIVE
    // Verify: Credits allocated (correct amount for plan)
    // Verify: Invoice generated with PAID status
    // Verify: PDF accessible in data/invoices/
    // Verify: UserDocument in coffre-fort
    // Verify: Email sent to parent
    // Verify: Telegram notification sent
  })
  
  test('double payment attempt is blocked', async ({ page }) => {
    // Parent tries to declare second virement while first is PENDING
    // Verify: 409 response
    // Verify: amber banner visible on dashboard
  })
})
```

---

## PASSE 11 — DOCUMENTS & EXPORTS (Catégorie 12) 🔶 P1

#### `__tests__/lib/invoice/pdf-generation.test.ts` — COMPLÉTER

```typescript
describe('Invoice PDF Generation', () => {
  it('should generate valid PDF buffer (starts with %PDF-)')
  it('should include invoice number in PDF text')
  it('should include client name in PDF text')
  it('should include all line items with prices')
  it('should include total amount')
  it('should include issue date')
  it('should produce A4-sized PDF')
  it('should handle special characters in client name (accents, arabic)')
  it('should generate receipt PDF with different template')
  it('should generate assessment export PDF with radar chart')
  it('should not crash on empty line items array')
})
```

#### `__tests__/lib/csv-export.test.ts` — NOUVEAU

```typescript
describe('CSV Export (Stages)', () => {
  it('should export all reservations as valid CSV')
  it('should include headers: email, prénom, nom, niveau, date, score')
  it('should encode UTF-8 correctly (French characters)')
  it('should handle commas in data values (proper CSV quoting)')
  it('should handle empty reservations list (headers only)')
  it('should sort by registration date descending')
})
```

---

## PASSE 12 — NOTIFICATIONS (Catégorie 14) 🔶 P1

#### `__tests__/lib/notifications.test.ts` — NOUVEAU

```typescript
describe('In-App Notifications', () => {
  it('should create notification for ADMIN on new payment declaration')
  it('should create notification for ASSISTANTE on new subscription request')
  it('should create notification for PARENT on session booking confirmation')
  it('should create notification for ELEVE on coach session confirmation')
  it('should mark notification as read on GET with markRead=true')
  it('should return unread_count in notification list response')
  it('should not return notifications of other users')
  it('should paginate notifications (limit 20 default)')
})
```

---

## PASSE 13 — RÉGRESSION (Catégorie 15) ⭐ P0 CRITIQUE

#### `__tests__/regression/previously-fixed-bugs.test.ts` — NOUVEAU

```typescript
/**
 * Regression tests for previously fixed bugs.
 * Each test prevents re-introduction of a known bug.
 */

describe('Regression: Bug Fix Verification', () => {
  
  // Bug 1: PUT→PATCH fix on admin users update
  it('PATCH /api/admin/users/[id] accepts PATCH method (not PUT)', async () => {
    // Attempt PUT → should return 405
    // Attempt PATCH → should return 200
  })
  
  // Bug 2: Password vide sur update
  it('PATCH /api/admin/users/[id] does NOT update password when empty string provided', async () => {
    const originalHash = 'existing-hash'
    // Mock prisma to capture the update call
    // Send PATCH with password: ""
    // Assert: prisma.user.update was NOT called with password field
    // Assert: bcrypt.hash was NOT called
  })
  
  // Bug 3: DialogContent aria-describedby warning
  it('all Dialog components have aria-describedby attribute', async () => {
    // This is covered in accessibility E2E tests
    // Verify no React warning about missing aria-describedby in console
  })
  
  // Bug 4: Bouton upload documents activé seulement si file + selectedUser sont set
  it('upload button is disabled when no file selected', async () => {
    // render DocumentUploadForm component
    // verify button is disabled by default
    // set file only → still disabled
    // set user only → still disabled
    // set both → button enabled
  })
  
  // Bug 5: LLM failure ne bloque pas le status
  it('bilan status is COMPLETED even when all LLM calls fail', async () => {
    // Mock Ollama to throw error
    // Submit bilan
    // Verify DB record has status=COMPLETED (not stuck at PENDING)
    // Verify response contains partial results (no crash)
  })
  
  // Bug 6: Anti-double paiement bannière amber
  it('parent dashboard shows amber banner when PENDING payment exists', async () => {
    // Mock prisma to return a PENDING payment
    // GET /api/payments/check-pending
    // Assert: hasPendingPayment=true in response
    // In E2E: amber banner visible on /dashboard/parent
  })
})
```

---

## PASSE 14 — CONFIGURATION & BUILD (Catégorie 13) 🔵 P2

#### `__tests__/config/env-validation.test.ts` — COMPLÉTER

```typescript
describe('Environment Variables Validation', () => {
  // Required variables
  it('should fail startup when DATABASE_URL is missing')
  it('should fail startup when NEXTAUTH_SECRET is missing or too short')
  it('should fail startup when NEXTAUTH_URL is missing')
  // Optional with defaults
  it('should use default OPENAI_MODEL=llama3.2 when not set')
  it('should use default OLLAMA_TIMEOUT=180000 when not set')
  it('should disable email when MAIL_DISABLED=true')
  it('should disable Telegram when TELEGRAM_DISABLED=true')
  it('should disable rate limiting when UPSTASH_REDIS_REST_URL is not set')
  // Type validation
  it('should reject non-numeric SMTP_PORT value')
  it('should reject invalid URL format for DATABASE_URL')
  it('should reject invalid URL format for NEXTAUTH_URL')
})
```

#### `e2e/health-check.spec.ts` — NOUVEAU

```typescript
test.describe('Health Check', () => {
  test('GET /api/health returns 200', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty('status', 'ok')
    expect(body).toHaveProperty('database')
    expect(body).toHaveProperty('timestamp')
  })
  
  test('health check response time < 50ms', async ({ request }) => {
    const start = Date.now()
    await request.get('/api/health')
    expect(Date.now() - start).toBeLessThan(50)
  })
})
```

---

## RÉCAPITULATIF D'EXÉCUTION

### Ordre d'implémentation recommandé

```
Passe 1  → __tests__/lib/          (unitaires)       ~8h   P0
Passe 2  → __tests__/api/          (intégration API)  ~12h  P0
Passe 3  → __tests__/api/rbac-complete-matrix.test.ts ~4h   P0
Passe 4  → e2e/                    (E2E Playwright)   ~16h  P0
Passe 5  → __tests__/security/     (sécurité)         ~6h   P0
Passe 6  → __tests__/concurrency/  (race conditions)  ~4h   P0
Passe 13 → __tests__/regression/   (régressions)      ~2h   P0
Passe 7  → __tests__/performance/  (performance)      ~4h   P1
Passe 8  → e2e/accessibility.spec  (accessibilité)    ~4h   P1
Passe 9  → __tests__/database/     (DB intégrité)     ~3h   P0
Passe 10 → e2e/workflow-*.spec.ts  (workflows)        ~8h   P0
Passe 11 → __tests__/lib/invoice/  (documents)        ~3h   P1
Passe 12 → __tests__/lib/notifications (notifs)       ~2h   P1
Passe 14 → __tests__/config/       (configuration)    ~2h   P2
```

### Commandes d'exécution

```bash
# Unitaires + API
npm test

# DB Integration
npm run test:db-integration

# E2E
npx playwright test --project=chromium

# Coverage report
npm test -- --coverage

# Vérifier thresholds
npm test -- --coverageThreshold='{"global":{"branches":60,"functions":69,"lines":70,"statements":70}}'
```

### Métriques cibles

| Catégorie          | Tests attendus | Couverture cible |
|--------------------|---------------|------------------|
| Unitaires (14 sous) | ~450          | 85% branches     |
| API (81 routes)    | ~600          | 90% routes       |
| RBAC               | 486+          | 100% matrix      |
| E2E                | ~200          | 74 pages         |
| Sécurité           | ~80           | 100% OWASP Top10 |
| Concurrence        | ~30           | 100% critical    |
| Performance        | ~40           | SLA défini       |
| Accessibilité      | ~50           | WCAG 2.1 AA      |
| DB                 | ~50           | 100% schema      |
| Workflows          | ~40           | 7 workflows      |
| **TOTAL**          | **~2026**     | **>70% global**  |

---

> **Note  :** Implémente chaque passe dans un commit séparé. Après chaque passe, exécute `npm test` et `npm run typecheck` pour vérifier qu'il n'y a aucune erreur avant de passer à la suivante.
