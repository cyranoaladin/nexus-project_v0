# Nexus Réussite — Plateforme de Pilotage Éducatif

> **Source de vérité unique** — Dernière mise à jour : 23 février 2026

**Nexus Réussite** est une plateforme SaaS de pilotage éducatif pour le marché tunisien (lycée → baccalauréat). Elle combine **coachs Agrégés/Certifiés**, une **IA pédagogique (ARIA)** et des **dashboards temps réel par rôle**.

**Production** : `https://nexusreussite.academy` · **Serveur** : Hetzner Dedicated (88.99.254.59)

---

## Table des Matières

1. [Stack Technique](#1-stack-technique)
2. [Architecture du Projet](#2-architecture-du-projet)
3. [Modèle de Données](#3-modèle-de-données)
4. [Rôles & Permissions (RBAC)](#4-rôles--permissions-rbac)
5. [Authentification & Sécurité](#5-authentification--sécurité)
6. [Sitemap Complet](#6-sitemap-complet)
7. [Workflows Utilisateur par Rôle](#7-workflows-utilisateur-par-rôle)
8. [API Routes](#8-api-routes)
9. [Crédits, Abonnements & Facturation](#9-crédits-abonnements--facturation)
10. [ARIA — IA Pédagogique](#10-aria--ia-pédagogique)
11. [Diagnostic & Évaluation](#11-diagnostic--évaluation)
12. [Réservation de Sessions](#12-réservation-de-sessions)
13. [Paiements](#13-paiements)
14. [Tests](#14-tests)
15. [CI/CD Pipeline](#15-cicd-pipeline)
16. [Déploiement](#16-déploiement)
17. [Variables d'Environnement](#17-variables-denvironnement)
18. [Démarrage Rapide](#18-démarrage-rapide)

---

## 1. Stack Technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| **Framework** | Next.js (App Router, standalone) | 15.5 |
| **UI** | React + TypeScript strict | 18.3 / 5.x |
| **Styling** | Tailwind CSS v4 + Radix UI + CVA variants + Framer Motion | 4.1 |
| **Auth** | NextAuth v5 (Auth.js) — Credentials + JWT | 5.0.0-beta.30 |
| **ORM** | Prisma Client | 6.13 |
| **DB** | PostgreSQL + pgvector | 15+ |
| **IA / LLM** | Ollama (LLaMA 3.2, Qwen 2.5) via OpenAI SDK | — |
| **RAG** | pgvector + FastAPI Ingestor v2 (migré depuis ChromaDB) | — |
| **Email** | Nodemailer (SMTP Hostinger) + Telegram Bot | 7.x |
| **Validation** | Zod | 3.23 |
| **State** | Zustand | 5.x |
| **Charts** | Recharts | 3.7 |
| **PDF** | PDFKit + @react-pdf/renderer | — |
| **Icons** | Lucide React | 0.536 |
| **Tests** | Jest 29 + Playwright 1.58 | — |
| **CI/CD** | GitHub Actions (7 jobs) | — |
| **Conteneurs** | Docker + Docker Compose | — |

## 2. Architecture du Projet

```
┌─────────────────────────────────────────────────────────────────┐
│                    NEXUS RÉUSSITE PLATFORM                       │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │  Parent   │  │  Élève   │  │  Coach   │  │Admin/Assistante│  │
│  │Dashboard  │  │Dashboard │  │Dashboard │  │  Dashboard     │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬───────────┘  │
│       │              │              │              │              │
│  ┌────▼──────────────▼──────────────▼──────────────▼────────────┐│
│  │              Next.js 15 App Router (API Routes)              ││
│  │  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌────────────────┐   ││
│  │  │NextAuth │ │  RBAC    │ │Entitle- │ │Session Booking │   ││
│  │  │  v5     │ │  Engine  │ │  ments  │ │   Service      │   ││
│  │  └─────────┘ └──────────┘ └─────────┘ └────────────────┘   ││
│  │  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌────────────────┐   ││
│  │  │ Credits │ │ Invoice  │ │  ARIA   │ │  Diagnostic    │   ││
│  │  │ Engine  │ │  Engine  │ │   AI    │ │    Engine      │   ││
│  │  └─────────┘ └──────────┘ └─────────┘ └────────────────┘   ││
│  └──────────────────────┬──────────────────────────────────────┘│
│                         │                                        │
│  ┌──────────────────────▼──────────────────────────────────────┐│
│  │         PostgreSQL + pgvector │ Ollama LLM │ ChromaDB       ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Arborescence Détaillée

```
nexus-project_v0/
├── app/                            # Next.js App Router (74 pages)
│   ├── page.tsx                    # Homepage (landing, 9 sections GSAP)
│   ├── layout.tsx                  # Root layout (providers, fonts, SEO, JSON-LD)
│   ├── globals.css                 # Design tokens HSL + global styles (35K)
│   ├── sitemap.ts                  # Dynamic sitemap generation
│   ├── robots.ts                   # Robots.txt (disallow /dashboard, /api, /auth)
│   │
│   ├── auth/                       # Pages d'authentification (4 pages)
│   │   ├── signin/                 # Connexion (email + password)
│   │   ├── activate/               # Activation compte élève (token)
│   │   ├── mot-de-passe-oublie/    # Demande reset password
│   │   └── reset-password/         # Nouveau mot de passe (token)
│   │
│   ├── dashboard/                  # Dashboards protégés par rôle (32 pages)
│   │   ├── layout.tsx              # Layout partagé (sidebar, navigation)
│   │   ├── page.tsx                # Redirect vers /dashboard/{role}
│   │   ├── admin/                  # ADMIN: 8 pages (stats, users, analytics, factures, tests, docs)
│   │   ├── assistante/             # ASSISTANTE: 9 pages (élèves, coachs, paiements, crédits, docs)
│   │   ├── coach/                  # COACH: 4 pages (sessions, étudiants, disponibilités)
│   │   ├── parent/                 # PARENT: 7 pages (enfants, abo, paiement, ressources + modales)
│   │   ├── eleve/                  # ELEVE: 4 pages (sessions, ressources, booking)
│   │   └── trajectoire/            # Trajectoire de progression (tous rôles)
│   │
│   ├── api/                        # 81 API routes
│   │   ├── auth/                   # NextAuth + reset-password
│   │   ├── admin/                  # Admin (12 routes: dashboard, users, invoices, analytics, docs, SSN)
│   │   ├── assistant/              # Assistante (8 routes: dashboard, students, coaches, credits)
│   │   ├── parent/                 # Parent (5 routes: dashboard, children, credits, subscriptions)
│   │   ├── student/                # Student (8 routes: dashboard, sessions, credits, trajectory, docs)
│   │   ├── coach/                  # Coach (3 routes: dashboard, sessions, reports)
│   │   ├── aria/                   # ARIA IA (3 routes: chat, conversations, feedback)
│   │   ├── assessments/            # Évaluations (6 routes: submit, result, status, export, predict)
│   │   ├── payments/               # Paiements (5 routes: bank-transfer, validate, clictopay)
│   │   ├── sessions/               # Session booking (3 routes: book, cancel, video)
│   │   ├── invoices/               # Facturation (PDF, reçu)
│   │   ├── diagnostics/            # Diagnostic definitions
│   │   ├── subscriptions/          # Changement abo, add-on ARIA
│   │   ├── notify/                 # Email notifications (CSRF + rate limit)
│   │   └── health/                 # Healthcheck
│   │
│   ├── bilan-gratuit/              # Formulaire bilan stratégique (lead gen + assessment)
│   ├── bilan-pallier2-maths/       # Quiz diagnostique multi-matières (4 définitions)
│   │   ├── resultat/[id]/          # Résultats 3 audiences (signed tokens, polling LLM)
│   │   └── dashboard/              # Admin suivi diagnostics
│   ├── assessments/[id]/           # Processing + résultats (SSN, radar, heatmap)
│   ├── offres/                     # Page tarifs & formules
│   ├── stages/                     # Stages intensifs (diagnostic QCM, bilans, dashboard)
│   ├── programme/                  # Programmes interactifs (maths-1ere: 22 composants, maths-terminale)
│   ├── admin/                      # Pages admin hors sidebar (directeur, stages)
│   ├── accompagnement-scolaire/    # Services soutien scolaire
│   ├── plateforme-aria/            # Vitrine ARIA
│   ├── equipe/                     # Équipe pédagogique
│   ├── contact/                    # Formulaire contact
│   ├── session/video/              # Visioconférence Jitsi Meet
│   └── access-required/            # Page refus d'accès (entitlement)
│
├── auth.ts                         # NextAuth config (Credentials, JWT, authorize)
├── auth.config.ts                  # Callbacks (authorized, jwt, session, redirect)
├── middleware.ts                    # Edge middleware (auth guard)
│
├── lib/                            # Logique métier (132 fichiers)
│   ├── prisma.ts                   # Prisma client singleton
│   ├── rbac.ts                     # RBAC policy map (35+ policies, 11 resources)
│   ├── guards.ts                   # Guards serveur (requireRole, requireAnyRole)
│   ├── credits.ts                  # Système de crédits (debit, refund, balance)
│   ├── session-booking.ts          # Service réservation sessions
│   ├── constants.ts                # Constantes métier (plans, pricing, crédits)
│   ├── access/                     # Feature gating (10 features, 3 fichiers)
│   │   ├── features.ts             # 10 feature keys + fallback modes
│   │   ├── rules.ts                # Résolution d'accès (pure function)
│   │   └── guard.ts                # Guards serveur/API (requireFeature, requireFeatureApi)
│   ├── entitlement/                # Moteur entitlements (activate, suspend)
│   │   ├── engine.ts               # Mode-aware: SINGLE, EXTEND, STACK
│   │   └── types.ts                # Product registry + codes
│   ├── invoice/                    # Moteur facturation (11 fichiers: PDF, séquence, email, storage)
│   ├── diagnostics/                # Diagnostic engine (17 fichiers)
│   │   ├── score-diagnostic.ts     # Scoring V2 + TrustScore + priorities
│   │   ├── bilan-renderer.ts       # 3 renderers (élève, parents, nexus)
│   │   ├── signed-token.ts         # HMAC-SHA256 signed tokens
│   │   ├── definitions/            # 4 définitions compilées (maths/NSI × 1ère/Tle)
│   │   └── types.ts                # Types diagnostiques
│   ├── assessments/                # Assessment engine (31 fichiers: questions, scoring, generators)
│   ├── core/                       # Core engines (SSN, ML predict, UAI, cohort stats)
│   │   ├── ssn/computeSSN.ts       # Score Scolaire Normalisé
│   │   ├── ml/predictSSN.ts        # Ridge regression + stabilité trend
│   │   ├── uai/computeUAI.ts       # Unified Academic Index
│   │   └── statistics/             # Cohort stats + normalize
│   ├── aria.ts                     # Client ARIA (Ollama via OpenAI SDK)
│   ├── aria-streaming.ts           # Streaming responses
│   ├── ollama-client.ts            # Client Ollama natif (health, generate, chat)
│   ├── rag-client.ts               # Client RAG Ingestor (search, stats, context)
│   ├── bilan-generator.ts          # Pipeline RAG→LLM (3 bilans séquentiels)
│   ├── scoring-engine.ts           # Scoring stages (25 tests)
│   ├── trajectory.ts               # Moteur trajectoire élève
│   ├── nexus-index.ts              # Nexus Index (score composite)
│   ├── badges.ts                   # Gamification
│   ├── next-step-engine.ts         # Recommandations prochaines étapes
│   ├── email/                      # SMTP mailer (Hostinger) + templates
│   ├── telegram/                   # Telegram Bot client (notifications)
│   ├── theme/                      # Design system (tokens.ts + variants.ts CVA)
│   ├── middleware/                  # Logger, rate limit, error handling
│   ├── validation/                 # Schémas Zod (6 fichiers)
│   ├── services/                   # Student activation service
│   └── pdf/                        # Assessment PDF template (react-pdf)
│
├── components/                     # Composants React (158 fichiers)
│   ├── ui/                         # 60+ primitives (shadcn/ui + ARIA chat + session booking)
│   ├── sections/                   # 32 sections landing page (GSAP animations)
│   ├── dashboard/                  # 16 composants dashboard (KPIs, trajectoire, synthèse)
│   ├── stages/                     # 24 composants stages (quiz, réservation, bilan)
│   ├── assessments/                # 9 composants évaluation (SSN, radar, heatmap, simulation)
│   ├── admin/                      # DocumentUploadForm (coffre-fort)
│   ├── layout/                     # CorporateNavbar, CorporateFooter, DashboardLayout
│   ├── navigation/                 # 9 composants navigation (sidebar, mobile, config par rôle)
│   └── providers.tsx               # SessionProvider wrapper
│
├── prisma/
│   ├── schema.prisma               # 1286 lignes, 38 modèles, 20 enums
│   ├── migrations/                 # 16 migrations (init → pgvector → user_documents)
│   └── seed.ts                     # Seed production (9 users, 5 coachs, profils)
│
├── programmes/                     # Pipeline programmes éducatifs
│   ├── generated/                  # JSON générés depuis PDFs (4 fichiers)
│   └── mapping/                    # YAML source de vérité (4 fichiers)
│
├── tools/programmes/               # Scripts ETL (generate, compile)
├── __tests__/                      # 226 fichiers tests (Jest)
├── e2e/                            # 38 fichiers E2E (Playwright)
├── scripts/                        # 41 scripts utilitaires
├── docs/                           # 49 fichiers documentation
├── .github/workflows/ci.yml        # CI pipeline (7 jobs)
├── docker-compose.prod.yml         # Docker Compose production
├── Dockerfile.prod                 # Dockerfile production (standalone)
└── package.json                    # 80+ dépendances
```

---

## 3. Modèle de Données

### Diagramme Entité-Relation (simplifié)

```
User (5 rôles) ──1:1──▶ ParentProfile ──1:N──▶ Student
     │                                           │
     ├──1:1──▶ CoachProfile                      ├──▶ Subscription
     │           (pseudonym, subjects)            ├──▶ CreditTransaction
     │                                            ├──▶ SessionBooking ◀── Coach
     ├──▶ Notification                            ├──▶ AriaConversation → AriaMessage
     ├──▶ Entitlement (product access)            ├──▶ Assessment → DomainScore, SkillScore
     └──▶ UserDocument (coffre-fort)              ├──▶ Badge / StudentBadge
                                                  └──▶ Trajectory (milestones JSON)

Invoice ──▶ InvoiceItem (productCode) ──▶ Entitlement
Payment ──▶ ClicToPayTransaction
StageReservation (standalone, scoringResult JSON)
```

### Modèles Principaux (38 modèles, 16 migrations)

| Modèle | Description | Relations clés |
|--------|-------------|----------------|
| `User` | Utilisateur (5 rôles) | → ParentProfile, Student, CoachProfile |
| `Student` | Entité élève (source de vérité) | → parent, subscriptions, sessions, badges |
| `CoachProfile` | Profil coach (pseudonyme, matières) | → sessions, reports |
| `Subscription` | Abonnement mensuel | → student |
| `SessionBooking` | Réservation de session | → student, coach, parent, report |
| `CreditTransaction` | Mouvement de crédits | → student, session |
| `AriaConversation` | Conversation IA | → student, messages |
| `Assessment` | Évaluation multi-matières | → domainScores, skillScores |
| `Invoice` | Facture client | → items, entitlements, accessTokens |
| `Entitlement` | Droit d'accès produit | → user, sourceInvoice |
| `Payment` | Paiement | → user, clicToPayTransaction |
| `Trajectory` | Plan de progression | → student, milestones (JSON) |
| `StageReservation` | Inscription stage | email, scoringResult (JSON) |

### Énumérations

| Enum | Valeurs |
|------|---------|
| `UserRole` | `ADMIN` · `ASSISTANTE` · `COACH` · `PARENT` · `ELEVE` |
| `Subject` | `MATHEMATIQUES` · `NSI` · `FRANCAIS` · `PHILOSOPHIE` · `HISTOIRE_GEO` · `ANGLAIS` · `ESPAGNOL` · `PHYSIQUE_CHIMIE` · `SVT` · `SES` |
| `SessionStatus` | `SCHEDULED` · `CONFIRMED` · `IN_PROGRESS` · `COMPLETED` · `CANCELLED` · `NO_SHOW` · `RESCHEDULED` |
| `SubscriptionStatus` | `ACTIVE` · `INACTIVE` · `CANCELLED` · `EXPIRED` |
| `PaymentStatus` | `PENDING` · `COMPLETED` · `FAILED` · `REFUNDED` |
| `InvoiceStatus` | `DRAFT` · `SENT` · `PAID` · `CANCELLED` |
| `EntitlementStatus` | `ACTIVE` · `SUSPENDED` · `EXPIRED` · `REVOKED` |

---

## 4. Rôles & Permissions (RBAC)

### Matrice des Rôles

| Rôle | Capacités principales |
|------|----------------------|
| **ADMIN** | MANAGE sur les 11 ressources (users, bilans, sessions, paiements, abonnements, config, rapports, facturation, notifications) |
| **ASSISTANTE** | READ/UPDATE students, VALIDATE bilans, MANAGE réservations, READ paiements, MANAGE abonnements/notifications, activation comptes élèves |
| **COACH** | READ_OWN sessions, CREATE rapports, READ_OWN students, UPDATE disponibilités |
| **PARENT** | READ_OWN enfants, CREATE réservations, READ_OWN paiements/abonnements, demandes changement abo |
| **ELEVE** | READ_SELF profil/sessions/crédits, accès ARIA (si entitlement), accès ressources pédagogiques |

### Système d'Accès à 3 Couches

**Couche 1 — Middleware Edge** (`middleware.ts` + `auth.config.ts`)
- `/dashboard/*` → requiert `isLoggedIn`
- `/auth/*` + déjà connecté → redirect `/dashboard/{role}`

**Couche 2 — Guards Client-Side** (chaque page dashboard)
- `useSession()` + vérification du rôle → redirect `/auth/signin` si incorrect

**Couche 3 — Guards API Server-Side** (`lib/rbac.ts` + `lib/access/guard.ts`)
- `enforcePolicy('admin.dashboard')` → vérifie rôle + ownership
- `requireFeatureApi('aria_maths')` → vérifie entitlements
- 35+ policies déclaratives, 11 ressources × 9 actions

### Feature Gating (Entitlements)

| Feature Key | Description | Fallback | Rôles Exemptés |
|-------------|-------------|----------|----------------|
| `platform_access` | Accès plateforme | REDIRECT | ADMIN, ASSISTANTE, COACH |
| `hybrid_sessions` | Sessions hybrides | DISABLE | ADMIN, ASSISTANTE |
| `immersion_mode` | Mode immersion | DISABLE | ADMIN, ASSISTANTE |
| `aria_maths` | ARIA Mathématiques | REDIRECT | ADMIN |
| `aria_nsi` | ARIA NSI | REDIRECT | ADMIN |
| `credits_use` | Utilisation crédits | REDIRECT | ADMIN, ASSISTANTE |
| `admin_facturation` | Facturation admin | REDIRECT | ADMIN |

---

## 5. Authentification & Sécurité

### Flux de Connexion

```
/auth/signin → email + password → signIn("credentials")
    │
    ▼
auth.ts → authorize()
    ├── prisma.user.findUnique(email)
    ├── bcrypt.compare(password, hash)
    ├── Vérifie activatedAt !== null (élèves)
    └── Retourne {id, email, role, firstName, lastName}
    │
    ▼
JWT Token → Cookie: authjs.session-token
    │
    ▼
Redirect → /dashboard/{role}
```

### Flux d'Activation Élève (Modèle B)

```
Admin/Assistante/Parent
    → POST /api/assistant/activate-student
    → Crée User (role=ELEVE, activatedAt=null)
    → Génère activationToken hashé + email

Élève → /auth/activate?token=xxx
    → GET vérifie token + expiration
    → POST {token, password} → hash + set activatedAt=now()
    → Redirect /auth/signin?activated=true
```

### Flux Mot de Passe Oublié

```
/auth/mot-de-passe-oublie → POST /api/auth/reset-password {email}
    → Token hashé + email (toujours "success" anti-enumeration)
/auth/reset-password?token=xxx → POST {token, newPassword}
    → Redirect /auth/signin
```

### Mesures de Sécurité

- **Hashing** : bcryptjs (salt rounds: 10)
- **Session** : JWT strategy (pas d'adapter DB)
- **Cookie** : `authjs.session-token` (httpOnly, sameSite: lax)
- **CSRF** : Protection native NextAuth v5
- **Rate Limiting** : Upstash Redis (configurable)
- **Password Reset** : Tokens hashés, expiration, CSRF, rejet mots de passe courants
- **Anti-Enumeration** : Réponse "success" systématique sur forgot password
- **Élèves non activés** : Bloqués au login
- **Robots.txt** : Interdit `/dashboard`, `/api`, `/auth`, `/session`

## 6. Sitemap Complet (74 pages)

> Détail complet dans [NAVIGATION_MAP.md](./NAVIGATION_MAP.md)

### Pages Publiques (30 pages)

```
/                              Homepage (landing, 9 sections GSAP)
├── /offres                    Tarifs & formules d'abonnement
├── /stages                    → redirect /stages/fevrier-2026
│   ├── /stages/fevrier-2026   Stage intensif + réservation
│   │   ├── /diagnostic        QCM 50 questions (30 Maths + 20 NSI)
│   │   └── /bilan/[id]       Résultats scoring stage
│   └── /stages/dashboard-excellence
├── /bilan-gratuit             Formulaire bilan stratégique (lead gen)
│   ├── /confirmation
│   └── /assessment            Évaluation en ligne
├── /bilan-pallier2-maths      Quiz diagnostique multi-matières
│   ├── /confirmation
│   ├── /dashboard             Admin suivi diagnostics
│   └── /resultat/[id]        Bilans 3 audiences (signed tokens)
├── /assessments/[id]
│   ├── /processing            Page d'attente scoring
│   └── /result                SSN, radar, heatmap, simulation
├── /programme/maths-1ere      Programme interactif (22 composants)
├── /programme/maths-terminale Programme interactif
├── /accompagnement-scolaire   Services soutien scolaire
├── /plateforme-aria           Présentation IA ARIA
├── /famille                   Page famille
├── /equipe                    Équipe pédagogique
├── /notre-centre              Le centre Nexus
├── /academy                   Académie
├── /consulting                Consulting éducatif
├── /contact                   Formulaire de contact
├── /conditions                CGU
├── /mentions-legales          Mentions légales
├── /maths-1ere                Page legacy
└── /access-required           Page refus d'accès (entitlement)
```

### Redirections

| Source | Destination | Type |
|--------|-------------|------|
| `/inscription` | `/bilan-gratuit` | 307 |
| `/questionnaire` | `/bilan-gratuit` | 307 |
| `/tarifs` | `/offres` | 307 |
| `/academies-hiver` | `/stages` | 301 |
| `/plateforme` | `/plateforme-aria` | 301 |
| `/education` | `/accompagnement-scolaire` | 301 |
| `/dashboard` | `/dashboard/{role}` | redirect |

### Pages Authentifiées (40 pages)

```
Auth (4) :
  /auth/signin · /auth/activate · /auth/mot-de-passe-oublie · /auth/reset-password

Admin (8+3) :
  /dashboard/admin + /users /analytics /activities /subscriptions /facturation /tests /documents
  /admin/directeur · /admin/stages/fevrier-2026

Assistante (9) :
  /dashboard/assistante + /students /coaches /subscriptions /subscription-requests
    /credit-requests /credits /paiements /docs

Coach (4) :
  /dashboard/coach + /sessions /students /availability

Parent (7) :
  /dashboard/parent + /children /abonnements /paiement /paiement/confirmation /ressources

Élève (4) :
  /dashboard/eleve + /mes-sessions /sessions /ressources

Commun :
  /dashboard (redirect) · /dashboard/trajectoire · /session/video
```

## 7. Workflows Utilisateur par Rôle

### Parent

```
Découverte → /bilan-gratuit (formulaire parent+enfant)
    → Assistante crée compte → Email activation élève
    → /auth/signin → /dashboard/parent
    → Actions: réserver session, acheter crédits, changer abo,
      ajouter enfant, déclarer virement, consulter factures
```

### Élève

```
Email activation → /auth/activate?token=xxx → choix mot de passe
    → /auth/signin → /dashboard/eleve
    → Actions: consulter sessions, accéder ARIA (si entitlement),
      passer diagnostic, consulter ressources, voir trajectoire
```

### Coach

```
/auth/signin → /dashboard/coach
    → Actions: gérer disponibilités, consulter sessions,
      rédiger rapports de session, consulter profils élèves
```

### Admin / Assistante

```
/auth/signin → /dashboard/admin ou /dashboard/assistante
    → Admin: KPIs, gestion users CRUD, analytiques, facturation
    → Assistante: élèves (activation), coachs, abonnements,
      crédits, validation paiements, documents
```

---

## 8. API Routes (81 endpoints)

> Détail complet dans [NAVIGATION_MAP.md](./NAVIGATION_MAP.md#8-api-routes-81-endpoints)

### Par domaine

| Domaine | Routes | Endpoints clés |
|---------|--------|----------------|
| **Auth** | 2 | NextAuth handlers, reset-password |
| **Admin** | 12 | dashboard, users CRUD, invoices, analytics, documents, SSN, test-email, directeur |
| **Assistante** | 8 | dashboard, students, activate-student, coaches, subscriptions, credit-requests |
| **Parent** | 5 | dashboard, children, credit-request, subscriptions, subscription-requests |
| **Élève** | 8 | dashboard, activate, sessions, credits, documents, nexus-index, resources, trajectory |
| **Coach** | 3 | dashboard, sessions, session reports |
| **ARIA** | 3 | chat (🔑), conversations, feedback |
| **Assessments** | 6 | submit, result, status, export, predict, test |
| **Sessions** | 3 | book (🔑), cancel, video (Jitsi) |
| **Coaches** | 2 | availability, available |
| **Paiements** | 5 | bank-transfer/confirm, check-pending, pending, validate, clictopay/init |
| **Facturation** | 3 | invoice PDF, receipt PDF, document download |
| **Abonnements** | 2 | change, aria-addon |
| **Diagnostics** | 5 | definitions, bilan-gratuit, bilan-pallier2-maths (+retry), submit-diagnostic |
| **Transversales** | 14 | health, contact, reservation (+verify), notifications, notify/email, messages, me/next-step, analytics/event, badges, programme progress |

---

## 9. Crédits, Abonnements & Facturation

### Formules d'Abonnement

| Plan | Prix/mois | Crédits/mois | Caractéristiques |
|------|-----------|-------------|------------------|
| **ACCÈS PLATEFORME** | 150 TND | 0 | Accès 24/7, suivi, ARIA (1 matière) |
| **HYBRIDE** ⭐ | 450 TND | 4 | + Coach référent, support prioritaire |
| **IMMERSION** | 750 TND | 8 | + Bilan trimestriel, suivi intensif |

### Packs Spécifiques

| Pack | Prix |
|------|------|
| **Grand Oral** | 750 TND |
| **Bac de Français** | 1 200 TND |
| **Orientation Parcoursup** | 900 TND |

### Tarifs Horaires

| Type | Prix/heure |
|------|-----------|
| **Individuel** | 60 TND |
| **Groupe** | 40 TND |

### Coûts en Crédits

| Prestation | Crédits |
|-----------|---------|
| Cours en ligne | 1.00 |
| Cours présentiel | 1.25 |
| Atelier groupe | 1.50 |

### Moteur de Crédits (`lib/credits.ts`)

- `calculateCreditCost(serviceType)` — Coût selon type
- `checkCreditBalance(studentId, required)` — Solde (transactions non expirées)
- `debitCredits(studentId, amount, sessionId)` — Débit idempotent
- `refundCredits(studentId, amount, sessionId)` — Remboursement

### Moteur d'Entitlements (`lib/entitlement/engine.ts`)

Activation mode-aware lors du paiement :

| Mode | Produits | Comportement |
|------|----------|-------------|
| **SINGLE** | Stages, Premium | Noop si déjà actif |
| **EXTEND** | Abonnements, Add-ons | Prolonge `endsAt` |
| **STACK** | Packs crédits | Toujours créer + accumuler |

---

## 10. ARIA — IA Pédagogique

ARIA est l'assistant IA 24/7, alimenté par **Ollama** avec **RAG** sur contenus pédagogiques via **pgvector** (migré depuis ChromaDB).

```
Élève → POST /api/aria/chat
    ├── requireFeatureApi('aria_maths' | 'aria_nsi')
    ├── RAG Search (pgvector via FastAPI Ingestor v2.3)
    │   └── 211 chunks (142 Maths + 69 NSI, 4 PDFs + 4 compétences MD)
    ├── Ollama (OPENAI_BASE_URL=http://ollama:11434/v1)
    │   └── llama3.2 (2GB, défaut) — CPU inference (~3min pour bilans)
    ├── Streaming response (lib/aria-streaming.ts)
    └── Sauvegarde AriaConversation + AriaMessage

Bilan Pipeline (POST /api/bilan-pallier2-maths) :
    ├── Scoring V2 (TrustScore + priorities)
    ├── RAG Search (domaines faibles, types d'erreurs, préparation exam)
    ├── 3 appels Ollama séquentiels (élève, parents, nexus) — ~3min total
    └── Stockage DB (status: ANALYZED, analysisResult JSON)
```

| Modèle | Taille | Usage |
|--------|--------|-------|
| `llama3.2:latest` | 2 GB | Chat pédagogique + bilans (défaut) |
| `phi3:mini` | 2.2 GB | Alternative légère |
| `nomic-embed-text:v1.5` | 274 MB | Embeddings RAG |

### RAG Ingestor v2.3

- **Backend** : pgvector (migré depuis ChromaDB)
- **18 endpoints** : search, ingest, admin CRUD, collections, metrics
- **Auto-classifier** : `classify_education_content()` via llama3.2
- **Filtres** : subject, level, type, doc_type, domain (ChromaDB `$and` queries)
- **Client** : `lib/rag-client.ts` (ragSearchBySubject, ragCollectionStats, buildRAGContext)

---

## 11. Diagnostic & Évaluation

### Moteur Multi-Matières (`lib/diagnostics/`)

Pipeline : PDF programme → JSON généré → YAML mapping (vérité) → JSON compilé → TS definitions

| Définition | Domaines | Compétences |
|------------|----------|-------------|
| `maths-premiere-p2` | 6 (algèbre, analyse, géométrie, proba, algo, logique) | ~25 |
| `maths-terminale-p2` | 5 (analyse, algèbre, géométrie, proba, algorithmique) | ~30 |
| `nsi-premiere-p2` | 5 (données, traitement, algo, python, architecture) | ~28 |
| `nsi-terminale-p2` | 6 (structures, algo avancé, BDD, réseaux, OS, python) | ~30 |

### Scoring V2 (`lib/diagnostics/score-diagnostic.ts`)

- **TrustScore** (0-100) + trustLevel (high/medium/low)
- **RiskIndex** rebalancé : 60% proof + 40% declarative
- **Détection d'incohérences** : 4 règles automatiques
- **Priorités calculées** : TopPriorities, QuickWins, HighRisk
- **Couverture programme** : chapitres vus/total, ratio, skills évalués

### Bilan Renderer (`lib/diagnostics/bilan-renderer.ts`)

3 renderers déterministes Markdown :
- **renderEleveBilan** : tutoiement, scores, priorités, micro-plan 5/15/30 min, prérequis
- **renderParentsBilan** : vouvoiement, labels qualitatifs (pas de scores bruts)
- **renderNexusBilan** : tables techniques, TrustScore, domain map, verbatims, couverture

### Signed Tokens (`lib/diagnostics/signed-token.ts`)

- HMAC-SHA256 signed tokens avec expiry
- Accès par audience (élève, parents) via `?t=<signedToken>`
- Audience Nexus rejetée (requiert auth staff)
- Idempotency-Key header support

### Assessment Engine (`lib/assessments/`, `lib/core/`)

- **SSN** (Score Scolaire Normalisé) : `lib/core/ssn/computeSSN.ts`
- **UAI** (Unified Academic Index) : `lib/core/uai/computeUAI.ts`
- **ML Predict** : Ridge regression + stabilité trend (`lib/core/ml/predictSSN.ts`)
- **Cohort Stats** : normalisation, percentiles (`lib/core/statistics/`)
- **Composants** : SSNCard, ResultRadar, SkillHeatmap, SimulationPanel

### Scoring Engine Stages (`lib/scoring-engine.ts`)

- Score global pondéré par domaine
- Indice de confiance et de précision
- Radar de compétences par domaine
- Forces et faiblesses identifiées
- 25 tests unitaires

### Stages Intensifs

- **Réservation** : `/api/reservation` (Zod → upsert → Telegram notification)
- **QCM** : 50 questions (30 Maths + 20 NSI), 3 niveaux de poids (W1=15, W2=20, W3=15)
- **Interface** : Machine à état (intro → quiz → transition → submitting → success)
- **Rendu LaTeX** : KaTeX dynamique pour formules mathématiques
- **Raccourcis clavier** : A/B/C/D, N=NSP, Enter=Suivant
- **Bilans** : `/stages/fevrier-2026/bilan/[reservationId]`
- **Dashboard Admin** : `/admin/stages/fevrier-2026` (KPIs, table, CSV export)

---

## 12. Réservation de Sessions

### Service (`lib/session-booking.ts`)

```
Parent/Élève → choix coach + matière + créneau
    → Vérification disponibilité coach (CoachAvailability)
    → Vérification solde crédits (checkCreditBalance)
    → requireFeatureApi('credits_use')
    → Création SessionBooking (status: SCHEDULED)
    → Débit crédits (debitCredits, idempotent)
    → Notification coach + parent
```

### Cycle de Vie d'une Session

```
SCHEDULED → CONFIRMED → IN_PROGRESS → COMPLETED
    │           │                         │
    ├→ CANCELLED (+ refund crédits)       └→ SessionReport (coach)
    ├→ RESCHEDULED
    └→ NO_SHOW
```

---

## 13. Paiements

### Architecture Actuelle

Konnect et Wise ont été **supprimés**. Le système actuel :

**Virement Bancaire (E2E flow)** :
1. Parent déclare virement → `POST /api/payments/bank-transfer/confirm`
2. Payment créé (PENDING) + Notification ADMIN/ASSISTANTE
3. Anti-double : `GET /api/payments/check-pending` (bannière amber si PENDING)
4. Staff valide/rejette → `POST /api/payments/validate`
5. Si approuvé (transaction atomique) :
   - Payment → COMPLETED
   - Subscription activée + crédits alloués
   - Invoice générée (PAID) + PDF rendu
   - PDF stocké dans `data/invoices/` + `storage/documents/`
   - UserDocument créé (coffre-fort numérique)

**ClicToPay** (Banque Zitouna) : Skeleton API (501), en cours d'intégration.

### Notifications

- **Email** : SMTP Hostinger (`lib/email/mailer.ts`) — templates bilan_ack, internal
- **Telegram** : Bot @nexusreussitebot (`lib/telegram/client.ts`) — réservations, paiements
- **In-app** : `GET /api/notifications` — cloche notification dans sidebar
- **Sécurité** : CSRF check, rate limit, body size 64KB max (`POST /api/notify/email`)

---

## 14. Tests

### Couverture

| Type | Framework | Suites | Tests |
|------|-----------|--------|-------|
| **Unitaires + API** | Jest + jsdom | 161+ | 2 250+ |
| **DB Intégration** | Jest + node + PostgreSQL | 65+ | 468+ |
| **E2E** | Playwright + Chromium | 38 fichiers | 207+ |

### Commandes

```bash
npm test                    # Jest unit + API (parallel, exclut DB dirs)
npm run test:db-integration # Jest DB integration (serial, --runInBand)
npm run test:all            # Les deux séquentiellement
npm run test:e2e            # Playwright E2E
npx playwright test --project=chromium  # E2E Chromium only
```

### Configs Jest

| Config | Environnement | Scope |
|--------|---------------|-------|
| `jest.config.js` | jsdom (custom fetch polyfill) | Unit + API (exclut `concurrency/`, `database/`, `db/`, `transactions/`) |
| `jest.config.db.js` | node | DB integration (serial, `maxWorkers: 1`) |

### Suites de Tests Notables

- **RBAC** : `__tests__/lib/rbac.test.ts` (21 tests)
- **Access/Features** : `__tests__/lib/access/` (56 tests, 4 suites)
- **Scoring Engine** : `__tests__/lib/scoring-engine.test.ts` (25 tests)
- **Diagnostic Mapping** : `__tests__/lib/programmes/` (84 tests)
- **Auth E2E** : `e2e/qa-auth-workflows.spec.ts` + `e2e/auth-and-booking.spec.ts`

---

## 15. CI/CD Pipeline

### GitHub Actions (`.github/workflows/ci.yml`)

7 jobs parallèles, déclenchés sur push/PR vers `main` :

```
┌───────┐  ┌───────────┐  ┌──────┐  ┌─────────────┐
│ lint  │  │ typecheck  │  │ unit │  │ integration │
│ESLint │  │ tsc --noEmit│  │ Jest │  │ Jest + PG   │
└───────┘  └───────────┘  └──────┘  └─────────────┘
┌─────┐  ┌──────────┐  ┌───────┐
│ e2e │  │ security │  │ build │
│Playw│  │audit+semg│  │Next.js│
└─────┘  └──────────┘  └───────┘
```

| Job | Description | Timeout |
|-----|-------------|---------|
| `lint` | ESLint check | — |
| `typecheck` | `tsc --noEmit` | — |
| `unit` | Jest (jsdom, pas de DB) | — |
| `integration` | Jest (node + PostgreSQL service) | — |
| `e2e` | Playwright + app standalone + DB E2E | 20 min |
| `security` | npm audit + semgrep + OSV scanner | — |
| `build` | Next.js production build | — |

### Timeouts E2E

- Playwright `globalTimeout` : 11 min (graceful exit + report)
- Step `timeout-minutes` : 12 min
- Job `timeout-minutes` : 20 min
- E2E a `continue-on-error: true` (ne bloque pas le merge)

---

## 16. Déploiement

### Infrastructure Production

```
Serveur: 88.99.254.59 (Hetzner Dedicated, i7-8700 12 cores, 62GB RAM)
Domaine: https://nexusreussite.academy
SSL: Let's Encrypt (auto-renew)
Reverse Proxy: Nginx → 127.0.0.1:3001

Conteneurs Docker (13+ healthy):
├── nexus-next-app     (port 3001→3000, standalone, Next.js 15.5)
├── nexus-postgres-db  (port 5435→5432, PostgreSQL 15-alpine)
├── ollama             (llama3.2:latest 2GB + phi3:mini 2.2GB + nomic-embed-text 274MB)
├── chromadb           (collection: ressources_pedagogiques_terminale, 211 chunks)
├── rag-ingestor       (FastAPI v2.3, port 8001, pgvector backend)
├── prometheus + grafana (monitoring RAG)
└── Korrigo (7 conteneurs séparés — NE PAS TOUCHER)

Réseaux Docker:
├── nexus_nexus-network  (app ↔ DB)
├── rag_v2_net           (ollama ↔ ingestor ↔ chroma)
└── infra_rag_net        (nexus-next-app ↔ ollama/ingestor, bridge externe)
```

### Docker

- **`Dockerfile.prod`** : Multi-stage build, standalone output, `HOSTNAME=0.0.0.0`
- **`docker-compose.prod.yml`** : Orchestration Nexus (app + DB)
- **RAG Compose** : `/opt/rag-service/infra/docker-compose.v2.yml` (ollama, ingestor, chroma, prometheus, grafana)
- Healthcheck : `curl http://127.0.0.1:3000/api/health`

```bash
# Nexus
docker compose -f docker-compose.prod.yml up -d next-app

# RAG (sur le serveur)
cd /opt/rag-service/infra
docker compose -f docker-compose.v2.yml -f docker-compose.prod.v2.yml up -d [service]
```

> **Important** : `docker compose restart` ne recharge PAS le `.env`. Utiliser `docker compose up -d next-app` pour recréer le conteneur avec les nouvelles variables.

### Seed Production (9 users)

| Email | Rôle | Password |
|-------|------|----------|
| `admin@nexus-reussite.com` | ADMIN | admin123 |
| `helios@nexus-reussite.com` | COACH | admin123 |
| `zenon@nexus-reussite.com` | COACH | admin123 |
| `athena@nexus-reussite.com` | COACH | admin123 |
| `hermes@nexus-reussite.com` | COACH | admin123 |
| `clio@nexus-reussite.com` | COACH | admin123 |
| `parent@example.com` | PARENT | admin123 |
| `student@example.com` | ELEVE | admin123 |
| `test@example.com` | ELEVE | admin123 |

---

## 17. Variables d'Environnement

### Requises

| Variable | Description | Exemple |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `NEXTAUTH_SECRET` | Secret JWT (32+ chars en prod) | `your-secret-here` |
| `NEXTAUTH_URL` | URL canonique de l'app | `https://nexusreussite.academy` |

### Optionnelles

| Variable | Description | Défaut |
|----------|-------------|--------|
| `OPENAI_BASE_URL` | URL Ollama (mode OpenAI compat) | `http://ollama:11434/v1` |
| `OPENAI_MODEL` | Modèle LLM | `llama3.2` |
| `OLLAMA_URL` | URL Ollama native | `http://ollama:11434` |
| `OLLAMA_MODEL` | Modèle Ollama | `llama3.2:latest` |
| `OLLAMA_TIMEOUT` | Timeout Ollama (ms) | `180000` |
| `RAG_INGESTOR_URL` | URL FastAPI ingestor | `http://ingestor:8001` |
| `RAG_SEARCH_TIMEOUT` | Timeout RAG (ms) | `10000` |
| `UPSTASH_REDIS_REST_URL` | Redis rate limiting | (vide = désactivé) |
| `UPSTASH_REDIS_REST_TOKEN` | Token Redis | — |
| `SMTP_HOST` | Serveur SMTP | `smtp.hostinger.com` |
| `SMTP_PORT` | Port SMTP (STARTTLS, pas 465) | `587` |
| `SMTP_SECURE` | TLS implicite | `false` |
| `SMTP_USER` | User SMTP | — |
| `SMTP_PASS` | Password SMTP | — |
| `MAIL_FROM` | Expéditeur emails | `Nexus Réussite <contact@nexusreussite.academy>` |
| `MAIL_REPLY_TO` | Reply-to emails | `contact@nexusreussite.academy` |
| `INTERNAL_NOTIFICATION_EMAIL` | Email notifications internes | `contact@nexusreussite.academy` |
| `MAIL_DISABLED` | Désactiver emails | `false` |
| `TELEGRAM_BOT_TOKEN` | Bot Telegram (notifications) | — |
| `TELEGRAM_CHAT_ID` | Chat ID Telegram | — |
| `TELEGRAM_DISABLED` | Désactiver Telegram | `false` |
| `AUTH_TRUST_HOST` | Trust host header (CI/proxy) | `true` |
| `LLM_MODE` | Mode LLM (live/mock) | `live` |
| `NEXT_TELEMETRY_DISABLED` | Désactiver télémétrie Next.js | `1` |
| `LOG_LEVEL` | Niveau de log | `info` |
| `RATE_LIMIT_WINDOW_MS` | Fenêtre rate limit (ms) | `60000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requêtes par fenêtre | `100` |
| `NODE_ENV` | Environnement | `production` |

---

## 18. Démarrage Rapide

### Développement Local

```bash
# 1. Cloner et installer
git clone <repo-url>
cd nexus-project_v0
npm install

# 2. Configurer l'environnement
cp env.local.example .env.local
# Éditer .env.local avec DATABASE_URL, NEXTAUTH_SECRET, etc.

# 3. Base de données
npx prisma generate
npx prisma db push
npx prisma db seed    # 9 users de démo

# 4. Lancer
npm run dev           # http://localhost:3000
```

### Production (Docker)

```bash
docker compose -f docker-compose.prod.yml up -d
```

### Scripts Utiles

```bash
npm run build          # Build production
npm run start          # Start production server
npm run lint           # ESLint
npm run typecheck      # TypeScript check
npm test               # Jest unit + API (parallel)
npm run test:db-integration  # Jest DB integration (serial)
npm run test:all       # Unit + DB séquentiellement
npm run test:e2e       # Playwright E2E
npm run db:generate    # Prisma generate
npm run db:push        # Prisma push schema
npm run db:seed        # Seed database
npm run db:studio      # Prisma Studio (GUI)
```

---

> **Nexus Réussite** — Plateforme de Pilotage Éducatif  
> © 2026 Nexus Réussite. Tous droits réservés.
