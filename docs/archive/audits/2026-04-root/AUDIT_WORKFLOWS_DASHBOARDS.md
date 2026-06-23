# Audit Complet — Workflows & Dashboards Nexus Réussite

**Date** : 15 février 2026  
**Périmètre** : Authentification, inscription, bilans, questionnaire pré-stage, dashboards (élève, parent, admin, coach, assistante)  
**Commit audité** : `404fd44e` (main, déployé en production)

---

## Table des matières

1. [Architecture Globale](#1-architecture-globale)
2. [Workflow Authentification](#2-workflow-authentification)
3. [Workflow Inscription / Bilan Gratuit](#3-workflow-inscription--bilan-gratuit)
4. [Workflow Bilan Pallier 2 / Questionnaire Pré-Stage](#4-workflow-bilan-pallier-2--questionnaire-pré-stage)
5. [Workflow Réservation Stage](#5-workflow-réservation-stage)
6. [Dashboard Élève](#6-dashboard-élève)
7. [Dashboard Parent](#7-dashboard-parent)
8. [Dashboard Admin](#8-dashboard-admin)
9. [Dashboard Coach](#9-dashboard-coach)
10. [Dashboard Assistante](#10-dashboard-assistante)
11. [Sécurité Transversale](#11-sécurité-transversale)
12. [Synthèse des Anomalies](#12-synthèse-des-anomalies)
13. [Recommandations Prioritaires](#13-recommandations-prioritaires)

---

## 1. Architecture Globale

### Stack technique
- **Framework** : Next.js 15.5.12 (App Router, standalone output)
- **Auth** : NextAuth.js v4 (JWT strategy, CredentialsProvider)
- **ORM** : Prisma (PostgreSQL 15)
- **UI** : TailwindCSS, shadcn/ui, Framer Motion, Lucide icons
- **IA** : Ollama (llama3.2), ChromaDB, RAG Ingestor
- **Email** : Nodemailer (SMTP)
- **Rate Limiting** : Upstash Redis (@upstash/ratelimit)
- **Analytics** : GA4/GTM + Plausible (client-side)

### Schéma de données (28 tables)
- **5 rôles** : `ADMIN`, `ASSISTANTE`, `COACH`, `PARENT`, `ELEVE`
- **Modèles critiques** : `User`, `Student`, `ParentProfile`, `StudentProfile`, `CoachProfile`, `SessionBooking`, `Diagnostic`, `StageReservation`, `Assessment`, `Payment`, `Subscription`

### Routes applicatives auditées
| Route | Type | Accès |
|-------|------|-------|
| `/auth/signin` | Page | Public |
| `/auth/mot-de-passe-oublie` | Page | Public |
| `/bilan-gratuit` | Page + API | Public |
| `/bilan-pallier2-maths` | Page + API | Public |
| `/stages/fevrier-2026/diagnostic` | Page | Public |
| `/api/reservation` | API | Public (POST), Staff (GET) |
| `/dashboard/eleve` | Page + API | ELEVE |
| `/dashboard/parent` | Page + API | PARENT |
| `/dashboard/admin` | Page + API | ADMIN |
| `/dashboard/coach` | Page + API | COACH |
| `/dashboard/assistante` | Page + API | ASSISTANTE |

---

## 2. Workflow Authentification

### Flux complet
```
Utilisateur → /auth/signin → signIn("credentials") → NextAuth authorize()
  → Prisma findUnique(email) → bcrypt.compare(password) → JWT token
  → Session callback (role, firstName, lastName) → Redirect /dashboard/{role}
```

### Fichiers clés
- `lib/auth.ts` — Configuration NextAuth (authOptions)
- `app/api/auth/[...nextauth]/route.ts` — Handler NextAuth
- `app/auth/signin/page.tsx` — Page de connexion
- `middleware.ts` — Protection routes + RBAC

### Points positifs ✅
- **JWT strategy** : pas de session DB, performant
- **bcrypt** avec salt rounds 12 (sécurisé)
- **PII masking** dans les logs : `email.replace(/(?<=.{2}).*(?=@)/, '***')`
- **Validation du rôle** dans les callbacks JWT et session (double vérification)
- **Rate limiting** sur `/api/auth/callback/credentials` (5 req/15min)
- **Redirection par rôle** correcte (ADMIN→admin, PARENT→parent, etc.)
- **Security headers** complets : HSTS, X-Frame-Options, X-Content-Type-Options, CSP, Referrer-Policy
- **Logging structuré** des événements auth (success, failed, error)
- **Analytics tracking** : `track.signinAttempt()`, `track.signinSuccess()`, `track.signinError()`

### Anomalies détectées 🔴🟡

| Sévérité | Anomalie | Fichier | Détail |
|----------|----------|---------|--------|
| 🔴 **CRITIQUE** | Mot de passe oublié non implémenté | `app/auth/mot-de-passe-oublie/page.tsx:27` | `await new Promise(resolve => setTimeout(resolve, 2000))` — simulation pure, aucun email envoyé. L'utilisateur voit "Email envoyé !" mais rien ne se passe. |
| 🔴 **CRITIQUE** | Pas de page d'inscription autonome | — | Le seul moyen de créer un compte est via `/bilan-gratuit`. Pas de `/auth/register` ou `/auth/signup`. |
| 🟡 **MAJEUR** | NEXTAUTH_SECRET auto-généré en dev | `lib/auth.ts:19-25` | Secret aléatoire à chaque restart → sessions invalidées. Risque si `NODE_ENV` mal configuré en prod. |
| 🟡 **MAJEUR** | CSP permet `unsafe-inline` et `unsafe-eval` | `middleware.ts:24` | Requis par GSAP et style-jsx, mais ouvre la porte aux attaques XSS. |
| 🟡 **MODÉRÉ** | `DISABLE_MIDDLEWARE` bypass complet | `middleware.ts:41` | Si `DISABLE_MIDDLEWARE=true` en env, toute la sécurité middleware est désactivée. Risque si variable fuite en prod. |
| 🟡 **MODÉRÉ** | Pas de verrouillage de compte après N échecs | `lib/auth.ts` | Le rate limiting middleware protège, mais pas de blocage persistant côté DB. |
| 🟢 **MINEUR** | `console.log` dans dashboard élève | `app/dashboard/eleve/page.tsx:127` | `console.log('[Student Dashboard] Data received:', data)` — fuite de données en console navigateur. |

---

## 3. Workflow Inscription / Bilan Gratuit

### Flux complet
```
Parent → /bilan-gratuit (2 étapes)
  Étape 1: Infos parent (prénom, nom, email, phone, password)
  Étape 2: Infos élève (prénom, nom, classe, niveau, objectifs, matières, modalité)
  → POST /api/bilan-gratuit
    → Zod validation (bilanGratuitSchema)
    → Check email unique
    → bcrypt.hash(password, 12)
    → Transaction Prisma:
      1. Créer User (PARENT) + ParentProfile
      2. Créer User (ELEVE) + StudentProfile + Student
    → Email de bienvenue (non-bloquant)
    → Redirect /bilan-gratuit/confirmation
```

### Fichiers clés
- `app/bilan-gratuit/page.tsx` — Formulaire 2 étapes (602 lignes)
- `app/api/bilan-gratuit/route.ts` — API d'inscription
- `lib/validations.ts` — Schéma Zod `bilanGratuitSchema`
- `app/bilan-gratuit/confirmation/page.tsx` — Page de confirmation
- `lib/email.ts` — Email de bienvenue

### Points positifs ✅
- **Validation Zod** côté serveur stricte (min lengths, email format, enum subjects)
- **Validation côté client** par étape (UX progressive)
- **Transaction Prisma** atomique (parent + élève créés ensemble ou pas du tout)
- **Email unique** vérifié avant inscription
- **bcrypt 12 rounds** pour le hash
- **Email de bienvenue** non-bloquant (l'inscription réussit même si l'email échoue)
- **Analytics tracking** du funnel complet (start → step → success/error)
- **Programme query param** préservé depuis les offres (`?programme=hybride`)

### Anomalies détectées 🔴🟡

| Sévérité | Anomalie | Fichier | Détail |
|----------|----------|---------|--------|
| 🔴 **CRITIQUE** | Email élève prédictible et non-unique | `api/bilan-gratuit/route.ts:71` | `${firstName.toLowerCase()}.${lastName.toLowerCase()}@nexus-student.local` — Si deux élèves ont le même nom, **collision garantie** → crash Prisma unique constraint. |
| 🔴 **CRITIQUE** | Élève hérite du mot de passe parent | `api/bilan-gratuit/route.ts:76` | `password: hashedPassword` — L'élève a le même mot de passe que le parent. Pas de mot de passe propre ni de flow d'activation. |
| 🟡 **MAJEUR** | Pas de rate limiting sur POST /api/bilan-gratuit | `api/bilan-gratuit/route.ts` | Aucun `checkRateLimit()` — un bot peut spammer des inscriptions. |
| 🟡 **MAJEUR** | Pas de honeypot sur le formulaire d'inscription | `app/bilan-gratuit/page.tsx` | Contrairement à `/api/reservation` qui a un honeypot, le bilan gratuit n'en a pas. |
| 🟡 **MAJEUR** | Pas de CAPTCHA | `app/bilan-gratuit/page.tsx` | Aucune protection anti-bot (reCAPTCHA, hCaptcha, Turnstile). |
| 🟡 **MODÉRÉ** | Validation client incomplète | `app/bilan-gratuit/page.tsx:108-127` | La validation client ne vérifie que la présence (`!formData.x`) mais pas les min lengths, formats email, etc. Le serveur Zod rattrape, mais l'UX est dégradée. |
| 🟡 **MODÉRÉ** | Page confirmation en thème clair | `app/bilan-gratuit/confirmation/page.tsx:13` | `bg-neutral-50` (fond blanc) alors que tout le site est en dark theme (`bg-surface-darker`). Incohérence visuelle. |
| 🟡 **MODÉRÉ** | Pas de redirection vers login après inscription | `confirmation/page.tsx` | Le CTA principal est "Retour à l'Accueil", pas "Se connecter". L'utilisateur ne sait pas qu'il peut se connecter immédiatement. |
| 🟢 **MINEUR** | Commentaire SQLite résiduel | `api/bilan-gratuit/route.ts:32` | `'DB check failed, attempting to initialize sqlite file path'` — référence à SQLite alors que le projet utilise PostgreSQL. |

---

## 4. Workflow Bilan Pallier 2 / Questionnaire Pré-Stage

### Flux complet
```
Élève/Parent → /bilan-pallier2-maths (formulaire multi-étapes, ~493 lignes)
  → Identité, contexte scolaire, performance, compétences par domaine
  → Mini-test chronométré, auto-évaluations, questions ouvertes
  → POST /api/bilan-pallier2-maths
    → Zod validation (bilanDiagnosticMathsSchema v1.3)
    → Idempotency check (header ou email+5min dedup)
    → Definition engine (getDefinition)
    → Scoring V1 (backward compat) + V2 (TrustScore, RiskIndex, priorities)
    → Save DB (status: SCORED)
    → Generate LLM bilans (3 audiences: élève, parents, nexus) via Ollama
    → Update DB (status: ANALYZED ou FAILED)
    → Generate signed tokens (HMAC-SHA256, 30 jours)
    → Response: scoring + publicShareId + tokens

  Consultation → /bilan-pallier2-maths/resultat/[id]
    → GET ?share=<publicShareId> (public, sans nexusMarkdown)
    → GET ?t=<signedToken> (audience-restricted, expiring)
    → GET ?id=<id> (staff-only, full data)
    → Auto-polling 10s si status != ANALYZED
```

### Fichiers clés
- `app/bilan-pallier2-maths/page.tsx` — Formulaire (493 lignes)
- `app/api/bilan-pallier2-maths/route.ts` — Pipeline POST + GET (391 lignes)
- `lib/validations.ts` — `bilanDiagnosticMathsSchema` (v1.3)
- `lib/diagnostics/score-diagnostic.ts` — Scoring V2
- `lib/diagnostics/bilan-renderer.ts` — Renderers 3 audiences
- `lib/diagnostics/signed-token.ts` — HMAC-SHA256 tokens
- `lib/diagnostics/safe-log.ts` — PII-safe logging
- `lib/bilan-generator.ts` — Pipeline RAG→LLM
- `app/bilan-pallier2-maths/resultat/[id]/page.tsx` — Consultation (941 lignes)

### Points positifs ✅
- **Pipeline robuste** : Validate → Score → Save → Generate → Update
- **Idempotency** : header `Idempotency-Key` + fallback email+5min dedup
- **3 niveaux d'accès** : public (share), signed token (audience-restricted), staff (full)
- **HMAC-SHA256 signed tokens** avec expiration 30 jours
- **PII-safe logging** : jamais de données personnelles dans les logs
- **Fallback gracieux** : si LLM échoue, le scoring est quand même sauvegardé
- **Error tracking** structuré : errorCode, errorDetails, retryCount
- **Data minimization** sur le GET list (scoring summary only, pas le payload complet)
- **Definition engine** : multi-niveau, multi-EDS, versionné
- **TrustScore** (0-100) + inconsistency detection (4 règles)
- **66 tests** couvrant scoring, renderer, signed tokens

### Anomalies détectées 🔴🟡

| Sévérité | Anomalie | Fichier | Détail |
|----------|----------|---------|--------|
| 🟡 **MAJEUR** | POST non protégé par auth | `api/bilan-pallier2-maths/route.ts:24` | N'importe qui peut soumettre un diagnostic. Pas de rate limiting non plus. Risque de spam. |
| 🟡 **MAJEUR** | `specialtyAverage` duplique `mathAverage` | `api/bilan-pallier2-maths/route.ts:104` | `specialtyAverage: validatedData.performance.mathAverage` — bug de copier-coller, devrait être un champ distinct. |
| 🟡 **MODÉRÉ** | RAG toujours désactivé | `route.ts:125-126` | `ragAvailable: false, ragHitCount: 0` — la collection ChromaDB est vide, les bilans LLM n'ont pas de contexte pédagogique. |
| 🟡 **MODÉRÉ** | Génération synchrone bloquante | `route.ts:112-183` | La réponse HTTP attend la fin de la génération LLM (~3min). L'utilisateur attend longtemps. |
| 🟢 **MINEUR** | Cast `as unknown as Parameters<typeof requireAnyRole>[0]` | `route.ts:322` | Contournement TypeScript pour passer un string[] au lieu de UserRole[]. |

---

## 5. Workflow Réservation Stage

### Flux complet
```
Parent → /stages/fevrier-2026 (page 93K lignes)
  → Formulaire réservation
  → POST /api/reservation
    → Rate limiting (10 req/min/IP)
    → Honeypot check (website/url/honeypot fields)
    → Zod validation (stageReservationSchema)
    → Upsert DB (anti-duplicate email+academyId)
    → Telegram notification (non-bloquant)
    → Email diagnostic invitation (non-bloquant)
    → Response 201/200

  Diagnostic → /stages/fevrier-2026/diagnostic?email=xxx
    → StageDiagnosticQuiz component
    → QCM de positionnement
```

### Points positifs ✅
- **Rate limiting** actif
- **Honeypot** anti-bot
- **Upsert** anti-duplicate (unique constraint email+academyId)
- **Telegram notification** en temps réel
- **Email diagnostic** automatique après inscription
- **RBAC** sur GET (ADMIN/ASSISTANTE only)
- **PII-safe logging** (pas de noms/emails dans les logs)
- **Race condition handling** : catch Prisma unique constraint → 409

### Anomalies détectées 🟡

| Sévérité | Anomalie | Fichier | Détail |
|----------|----------|---------|--------|
| 🟡 **MODÉRÉ** | Page stages de 93K lignes | `app/stages/page.tsx` | Fichier monolithique extrêmement long. Devrait être découpé en composants. |
| 🟡 **MODÉRÉ** | Diagnostic accessible sans vérification | `stages/fevrier-2026/diagnostic/page.tsx` | L'email est saisi par l'utilisateur sans vérification qu'il correspond à une réservation existante. |

---

## 6. Dashboard Élève

### Route : `/dashboard/eleve` → API `/api/student/dashboard`

### Fonctionnalités
- Solde de crédits (calculé depuis CreditTransaction)
- Prochaine session planifiée
- Historique des sessions récentes
- Badges obtenus
- Stats ARIA (messages du jour, conversations)
- Réservation de session (onglet booking)
- Widget ARIA (chat IA flottant)

### Points positifs ✅
- **Auth check** côté client (`session.user.role !== 'ELEVE'`) + côté API (`getServerSession`)
- **Données complètes** : crédits, sessions, badges, ARIA stats
- **UI soignée** : dark theme, cards, animations
- **Onglet booking** intégré

### Anomalies détectées 🟡

| Sévérité | Anomalie | Fichier | Détail |
|----------|----------|---------|--------|
| 🟡 **MAJEUR** | `console.log` en production | `app/dashboard/eleve/page.tsx:127` | `console.log('[Student Dashboard] Data received:', data)` — expose les données dashboard dans la console navigateur. |
| 🟡 **MODÉRÉ** | Calcul crédits côté API non fiable | `api/student/dashboard/route.ts:75-77` | `creditTransactions.reduce(...)` sur les 10 dernières transactions seulement (`take: 10`). Si l'élève a plus de 10 transactions, le solde est faux. |
| 🟡 **MODÉRÉ** | Pas de `loading.tsx` / `error.tsx` | `app/dashboard/eleve/` | Gestion loading/error dans le composant client, pas via les conventions Next.js App Router. |

---

## 7. Dashboard Parent

### Route : `/dashboard/parent` → API `/api/parent/dashboard`

### Fonctionnalités
- Liste des enfants avec crédits, abonnement, prochaine session
- Sélecteur d'enfant
- Historique des paiements
- Dialogs : ajout enfant, achat crédits, changement abonnement, add-on ARIA, factures
- Réservation de session

### Points positifs ✅
- **Auth check** côté client + API (role PARENT, status 403 si mauvais rôle)
- **Relation parent→enfants** correcte via ParentProfile→Student
- **Dialogs modulaires** bien séparés
- **Paiements** listés avec historique

### Anomalies détectées 🟡

| Sévérité | Anomalie | Fichier | Détail |
|----------|----------|---------|--------|
| 🟡 **MAJEUR** | Données mockées en dur | `api/parent/dashboard/route.ts:135-136` | `subscription: "Standard"`, `subscriptionDetails: null`, `progress: 0`, `subjectProgress: {}` — données fictives, pas de vraie logique. |
| 🟡 **MAJEUR** | Coach name hardcodé | `api/parent/dashboard/route.ts:111` | `coachName: 'Coach'` — le nom du coach n'est pas résolu depuis la DB. |
| 🟡 **MODÉRÉ** | `console.error` exposé | `app/dashboard/parent/page.tsx:91` | `console.error('Error fetching dashboard data:', err)` — en production. |
| 🟡 **MODÉRÉ** | `dynamic` manquant | `api/parent/dashboard/route.ts` | Pas de `export const dynamic = 'force-dynamic'` — risque de cache statique Next.js. |

---

## 8. Dashboard Admin

### Route : `/dashboard/admin` → API `/api/admin/dashboard`

### Fonctionnalités
- Stats globales : users, students, coaches, revenue, subscriptions, sessions
- Growth metrics (mois courant vs précédent)
- System health status
- Activités récentes (sessions, users, subscriptions, credit transactions)
- User growth et revenue growth (6 mois)
- Sous-pages : users, analytics, activities, subscriptions, tests

### Points positifs ✅
- **RBAC via `requireRole(UserRole.ADMIN)`** avec `lib/guards.ts`
- **Stats exhaustives** avec 17 requêtes Prisma parallèles (`Promise.all`)
- **Revenue combinée** (payments + subscriptions)
- **Growth %** calculé correctement
- **Activités récentes** multi-sources triées par date
- **Data minimization** : pas de données sensibles exposées

### Anomalies détectées 🟡

| Sévérité | Anomalie | Fichier | Détail |
|----------|----------|---------|--------|
| 🟡 **MAJEUR** | 17 requêtes Prisma séquentielles dans Promise.all | `api/admin/dashboard/route.ts:56-223` | Bien que parallélisées, c'est 17 requêtes DB à chaque chargement. Pas de cache. Performance dégradée si beaucoup de données. |
| 🟡 **MODÉRÉ** | `userGrowth` groupBy sur `createdAt` | `route.ts:198-208` | `groupBy: ['createdAt']` groupe par timestamp exact, pas par mois. Chaque user est un groupe distinct → graphique inutilisable. |
| 🟡 **MODÉRÉ** | `revenueGrowth` même problème | `route.ts:211-222` | Même bug que userGrowth — groupBy timestamp au lieu de mois. |
| 🟡 **MODÉRÉ** | Auth check dupliquée côté client | `app/dashboard/admin/page.tsx:79` | `session.user.role !== 'ADMIN'` vérifié côté client en plus du middleware + API. Redondant mais pas nuisible. |

---

## 9. Dashboard Coach

### Route : `/dashboard/coach` → API `/api/coach/dashboard`

### Fonctionnalités
- Profil coach (pseudonym, tag, spécialités)
- Sessions du jour
- Stats semaine (total, completed, upcoming)
- Planning semaine complet
- Liste des étudiants récents avec solde crédits
- Gestion disponibilités (onglet)
- Dialog rapport de session

### Points positifs ✅
- **Auth check** côté API (role COACH)
- **Sessions du jour** filtrées correctement
- **Stats semaine** calculées dynamiquement
- **Étudiants distincts** via `distinct: ['studentId']`
- **Parsing JSON** sécurisé pour les subjects (`try/catch`)

### Anomalies détectées 🟡

| Sévérité | Anomalie | Fichier | Détail |
|----------|----------|---------|--------|
| 🟡 **MAJEUR** | N+1 query problem | `api/coach/dashboard/route.ts:146-165` | Boucle `for...of` avec 2 requêtes Prisma par étudiant (`findUnique` + `findFirst`). Si 20 étudiants → 40 requêtes supplémentaires. |
| 🟡 **MODÉRÉ** | `dynamic` manquant sur le dashboard parent mais présent ici | — | Incohérence entre les API routes. |

---

## 10. Dashboard Assistante

### Route : `/dashboard/assistante` → API `/api/assistant/dashboard`

### Fonctionnalités
- Stats : étudiants, coaches, sessions, revenue, pending items
- Sessions du jour
- Activités récentes
- Sous-pages : coaches, credits, credit-requests, paiements, students, subscription-requests, subscriptions
- Notifications (bell)
- Gestion sessions

### Points positifs ✅
- **Auth check** côté API (role ASSISTANTE)
- **Stats complètes** avec pending counts (bilans, payments, credit requests, subscription requests)
- **Revenue combinée** (payments + subscriptions)
- **Navigation riche** avec sous-pages dédiées

### Anomalies détectées 🟡

| Sévérité | Anomalie | Fichier | Détail |
|----------|----------|---------|--------|
| 🟡 **MAJEUR** | Sessions du jour sans noms | `api/assistant/dashboard/route.ts:134` | `studentName: ''`, `coachName: ''` — les noms ne sont pas résolus. L'assistante voit des sessions sans savoir qui est concerné. |
| 🟡 **MODÉRÉ** | `pendingBilans` = parents créés dans les 7 jours | `route.ts:76-82` | Approximation grossière. Un parent inscrit il y a 6 jours dont le bilan est traité est toujours compté comme "pending". |

---

## 11. Sécurité Transversale

### Middleware (`middleware.ts`)

| Contrôle | Statut | Détail |
|----------|--------|--------|
| **HSTS** | ✅ | `max-age=31536000; includeSubDomains; preload` |
| **X-Frame-Options** | ✅ | `SAMEORIGIN` |
| **X-Content-Type-Options** | ✅ | `nosniff` |
| **X-XSS-Protection** | ✅ | `1; mode=block` |
| **Referrer-Policy** | ✅ | `strict-origin-when-cross-origin` |
| **Permissions-Policy** | ✅ | `geolocation=(), microphone=(), camera=()` |
| **CSP** | ⚠️ | `unsafe-inline` + `unsafe-eval` requis (GSAP, style-jsx) |
| **Rate limiting auth** | ✅ | 5 req/15min sur login |
| **Rate limiting ARIA** | ✅ | 20 req/min (chat), standard (feedback) |
| **RBAC middleware** | ✅ | Redirect si rôle incorrect |
| **ADMIN bypass** | ✅ | Admin peut accéder à tous les dashboards |

### Guards (`lib/guards.ts`)

| Guard | Utilisé par |
|-------|-------------|
| `requireAuth()` | Base pour tous les guards |
| `requireRole(role)` | Admin dashboard |
| `requireAnyRole(roles[])` | Bilan GET (ADMIN, ASSISTANTE, COACH) |
| `isOwner(session, userId)` | Disponible mais peu utilisé |
| `isStaff(session)` | Disponible mais peu utilisé |
| `isErrorResponse()` | Type guard pour les réponses d'erreur |

### Rate Limiting (`lib/rate-limit.ts`)

| Endpoint | Limite | Backend |
|----------|--------|---------|
| Auth | 5 req/15min | Upstash Redis |
| AI/ARIA | 20 req/min | Upstash Redis |
| API général | 100 req/min | Upstash Redis |
| **Sans Redis** | **Aucune limite** | Fail-open (log warning) |

### Anomalies sécurité globales

| Sévérité | Anomalie | Détail |
|----------|----------|--------|
| 🔴 **CRITIQUE** | Rate limiting fail-open sans Redis | Si `UPSTASH_REDIS_REST_URL` n'est pas configuré, **toutes les limites sont désactivées**. En dev c'est normal, mais si la variable manque en prod, aucune protection. |
| 🟡 **MAJEUR** | Pas de CSRF protection explicite | NextAuth gère le CSRF pour ses propres routes, mais les API custom (`/api/bilan-gratuit`, `/api/reservation`) n'ont pas de token CSRF. |
| 🟡 **MAJEUR** | `DISABLE_MIDDLEWARE` env variable | Si cette variable est `true`, **tout le middleware est bypassé** (auth, RBAC, rate limiting, security headers). |
| 🟡 **MODÉRÉ** | Pas de Content-Length limit | Les API POST n'ont pas de limite de taille de body. Un attaquant peut envoyer un payload de plusieurs MB. |

---

## 12. Synthèse des Anomalies

### Par sévérité

| Sévérité | Count | Exemples |
|----------|-------|----------|
| 🔴 **CRITIQUE** | 4 | Mot de passe oublié fake, email élève collision, password partagé parent/élève, rate limit fail-open |
| 🟡 **MAJEUR** | 14 | Pas de rate limit sur inscription, données mockées parent dashboard, N+1 queries coach, sessions sans noms assistante, CSP unsafe, pas de CAPTCHA |
| 🟡 **MODÉRÉ** | 12 | RAG désactivé, groupBy timestamp, console.log prod, thème incohérent, crédits calculés sur 10 transactions |
| 🟢 **MINEUR** | 3 | Commentaire SQLite, cast TypeScript, import commenté |

### Par domaine

| Domaine | Critiques | Majeures | Modérées |
|---------|-----------|----------|----------|
| **Authentification** | 2 | 3 | 2 |
| **Inscription** | 2 | 3 | 3 |
| **Bilan Pré-Stage** | 0 | 1 | 2 |
| **Réservation Stage** | 0 | 0 | 2 |
| **Dashboard Élève** | 0 | 1 | 1 |
| **Dashboard Parent** | 0 | 2 | 2 |
| **Dashboard Admin** | 0 | 1 | 2 |
| **Dashboard Coach** | 0 | 1 | 0 |
| **Dashboard Assistante** | 0 | 1 | 1 |
| **Sécurité** | 1 | 2 | 1 |

---

## 13. Recommandations Prioritaires

### P0 — Corrections immédiates (avant mise en production élargie)

1. **Implémenter le reset password** : Créer un vrai flow avec token signé, email, et page de reset. Le fake actuel est trompeur pour l'utilisateur.

2. **Fixer l'email élève** : Utiliser `cuid()` ou UUID dans l'email élève pour garantir l'unicité :
   ```typescript
   email: `student-${cuid()}@nexus-student.local`
   ```

3. **Séparer le mot de passe élève** : Soit générer un mot de passe aléatoire pour l'élève (envoyé par email), soit ne pas mettre de mot de passe et forcer un flow d'activation.

4. **Vérifier que Redis est configuré en prod** : Ajouter un check au démarrage qui refuse de lancer l'app si `UPSTASH_REDIS_REST_URL` est absent en production.

### P1 — Corrections importantes (semaine suivante)

5. **Ajouter rate limiting sur `/api/bilan-gratuit`** : `checkRateLimit(request, 'api')` en début de handler.

6. **Ajouter un honeypot + CAPTCHA** sur le formulaire d'inscription.

7. **Fixer le calcul des crédits élève** : Retirer le `take: 10` sur `creditTransactions` ou calculer le solde via `student.credits` directement.

8. **Résoudre les noms dans le dashboard assistante** : Inclure les relations `student` et `coach` dans les requêtes de sessions.

9. **Fixer le N+1 query du coach dashboard** : Utiliser un seul `findMany` avec `include` au lieu d'une boucle.

10. **Fixer `userGrowth` et `revenueGrowth`** dans le dashboard admin : Grouper par mois avec `$queryRaw` ou post-processing.

### P2 — Améliorations (sprint suivant)

11. **Supprimer les `console.log`/`console.error`** des composants client en production.
12. **Ajouter `export const dynamic = 'force-dynamic'`** sur toutes les API routes dashboard.
13. **Harmoniser le thème** de la page confirmation (dark theme).
14. **Ajouter un CTA "Se connecter"** sur la page de confirmation.
15. **Remplacer les données mockées** du dashboard parent (subscription, progress).
16. **Migrer GSAP → CSS animations** pour supprimer `unsafe-eval` du CSP.
17. **Fixer le bug `specialtyAverage`** qui duplique `mathAverage`.
18. **Ajouter `loading.tsx` et `error.tsx`** pour chaque route dashboard (convention App Router).

---

*Rapport généré le 15 février 2026 — Audit exhaustif du projet Nexus Réussite*
