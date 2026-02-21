# Nexus Réussite — Plateforme de Pilotage Éducatif

> **Source de vérité unique** — Dernière mise à jour : 21 février 2026

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
| **Styling** | Tailwind CSS v4 + Radix UI + Framer Motion | 4.1 |
| **Auth** | NextAuth v5 (Auth.js) — Credentials + JWT | 5.0.0-beta.30 |
| **ORM** | Prisma Client | 6.13 |
| **DB** | PostgreSQL + pgvector | 15+ |
| **IA / LLM** | Ollama (LLaMA 3.2, Qwen 2.5) via OpenAI SDK | — |
| **RAG** | ChromaDB + FastAPI Ingestor | — |
| **Email** | Nodemailer (SMTP) | 7.x |
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
├── app/                            # Next.js App Router
│   ├── page.tsx                    # Homepage (landing, GSAP animations)
│   ├── layout.tsx                  # Root layout (providers, fonts, SEO, JSON-LD)
│   ├── globals.css                 # Design tokens + global styles
│   ├── sitemap.ts                  # Dynamic sitemap generation
│   ├── robots.ts                   # Robots.txt (disallow /dashboard, /api, /auth)
│   │
│   ├── auth/                       # Pages d'authentification
│   │   ├── signin/                 # Connexion (email + password)
│   │   ├── activate/               # Activation compte élève (token)
│   │   ├── mot-de-passe-oublie/    # Demande reset password
│   │   └── reset-password/         # Nouveau mot de passe (token)
│   │
│   ├── dashboard/                  # Dashboards protégés par rôle
│   │   ├── layout.tsx              # Layout partagé (sidebar, navigation)
│   │   ├── admin/                  # ADMIN (stats, users, analytics, factures)
│   │   ├── assistante/             # ASSISTANTE (élèves, coachs, paiements)
│   │   ├── coach/                  # COACH (sessions, disponibilités)
│   │   ├── parent/                 # PARENT (enfants, crédits, abonnements)
│   │   ├── eleve/                  # ELEVE (sessions, ressources, ARIA)
│   │   └── trajectoire/            # Trajectoire de progression
│   │
│   ├── api/                        # 80+ API routes
│   │   ├── auth/                   # NextAuth + reset-password
│   │   ├── admin/                  # Admin (dashboard, users, invoices, analytics)
│   │   ├── assistant/              # Assistante (dashboard, students, coaches)
│   │   ├── parent/                 # Parent (dashboard, children, credits)
│   │   ├── student/                # Student (dashboard, sessions, trajectory)
│   │   ├── coach/                  # Coach (dashboard, sessions)
│   │   ├── aria/                   # ARIA IA (chat, feedback)
│   │   ├── assessments/            # Diagnostic engine
│   │   ├── payments/               # Paiements (bank-transfer, validate)
│   │   ├── sessions/               # Session booking (book, cancel, video)
│   │   ├── invoices/               # Facturation
│   │   ├── diagnostics/            # Diagnostic definitions
│   │   └── health/                 # Healthcheck
│   │
│   ├── bilan-gratuit/              # Formulaire bilan stratégique (lead gen)
│   ├── bilan-pallier2-maths/       # Quiz diagnostique multi-matières
│   ├── offres/                     # Page tarifs & formules
│   ├── stages/                     # Stages intensifs (vacances)
│   ├── programme/                  # 24 sous-pages programmes éducatifs
│   ├── accompagnement-scolaire/    # Services soutien scolaire
│   ├── plateforme-aria/            # Vitrine ARIA
│   ├── equipe/                     # Équipe pédagogique
│   ├── contact/                    # Formulaire contact
│   └── access-required/            # Page refus d'accès (entitlement)
│
├── auth.ts                         # NextAuth config (Credentials, JWT, authorize)
├── auth.config.ts                  # Callbacks (authorized, jwt, session, redirect)
├── middleware.ts                    # Edge middleware (auth guard)
│
├── lib/                            # Logique métier
│   ├── prisma.ts                   # Prisma client singleton
│   ├── rbac.ts                     # RBAC policy map (35+ policies, 11 resources)
│   ├── credits.ts                  # Système de crédits (debit, refund, balance)
│   ├── session-booking.ts          # Service réservation sessions
│   ├── constants.ts                # Constantes métier (plans, pricing, crédits)
│   ├── access/                     # Feature gating (entitlements)
│   │   ├── features.ts             # 10 feature keys
│   │   ├── rules.ts                # Résolution d'accès
│   │   └── guard.ts                # Guards serveur/API
│   ├── entitlement/                # Moteur entitlements (activate, suspend)
│   │   ├── engine.ts               # Mode-aware: SINGLE, EXTEND, STACK
│   │   └── types.ts                # Product registry + codes
│   ├── invoice/                    # Moteur facturation (PDF, numérotation)
│   ├── diagnostics/                # Définitions diagnostiques (4 matières)
│   ├── assessments/                # Scoring engine
│   ├── aria.ts                     # Client ARIA (Ollama via OpenAI SDK)
│   ├── aria-streaming.ts           # Streaming responses
│   ├── scoring-engine.ts           # Scoring stages (25 tests)
│   ├── trajectory.ts               # Moteur trajectoire élève
│   ├── badges.ts                   # Gamification
│   ├── next-step-engine.ts         # Recommandations prochaines étapes
│   ├── email.ts                    # Templates email
│   └── validation/                 # Schémas Zod
│
├── components/                     # Composants React
│   ├── ui/                         # 60+ primitives (shadcn/ui + custom)
│   ├── sections/                   # 32 sections landing page
│   ├── dashboard/                  # 16 composants dashboard
│   ├── stages/                     # 24 composants stages
│   ├── assessments/                # 9 composants évaluation
│   ├── layout/                     # CorporateNavbar, CorporateFooter
│   ├── navigation/                 # 9 composants navigation
│   └── providers.tsx               # SessionProvider wrapper
│
├── prisma/
│   ├── schema.prisma               # 1287 lignes, 35+ modèles, 8 enums
│   ├── migrations/                 # 17 migrations
│   └── seed.ts                     # Seed production (9 users, 5 coachs)
│
├── __tests__/                      # 224 fichiers tests (Jest)
├── e2e/                            # 27 fichiers E2E (Playwright)
├── scripts/                        # 38 scripts utilitaires
├── .github/workflows/ci.yml        # CI pipeline (7 jobs)
├── docker-compose.prod.yml         # Docker Compose production
├── Dockerfile.prod                 # Dockerfile production (standalone)
└── package.json                    # 176 lignes, 80+ dépendances
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

### Modèles Principaux (35+)

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

## 6. Sitemap Complet

### Pages Publiques

```
/                              Homepage (landing, GSAP animations)
├── /offres                    Tarifs & formules d'abonnement
├── /stages                    → redirect /stages/fevrier-2026
│   └── /stages/fevrier-2026   Stage intensif + QCM diagnostique
├── /bilan-gratuit             Formulaire bilan stratégique (lead gen)
│   └── /bilan-gratuit/confirmation
├── /bilan-pallier2-maths      Quiz diagnostique multi-matières
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
└── /programme/                24 sous-pages programmes éducatifs
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

### Pages Authentifiées

```
/auth/signin · /auth/activate · /auth/mot-de-passe-oublie · /auth/reset-password

/dashboard/admin           + /users /analytics /activities /subscriptions /facturation /tests
/dashboard/assistante      + /students /coaches /subscriptions /subscription-requests
                             /credit-requests /credits /paiements /docs
/dashboard/coach           (onglets: Tableau de Bord, Disponibilités)
/dashboard/parent          + /children /abonnements /paiement
/dashboard/eleve           + /sessions /mes-sessions /ressources
/dashboard/trajectoire     Trajectoire de progression
/access-required           Page refus d'accès (entitlement)
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

## 8. API Routes (80+)

### Authentification

| Méthode | Route | Description |
|---------|-------|-------------|
| GET/POST | `/api/auth/[...nextauth]` | Handlers NextAuth v5 |
| POST | `/api/auth/reset-password` | Reset password (demande + exécution) |

### Admin (`/api/admin/`)

`dashboard` · `analytics` · `activities` · `users` · `users/[id]` · `subscriptions` · `invoices` · `invoices/[id]` · `invoices/[id]/pdf` · `documents` · `recompute-ssn` · `test-email` · `directeur`

### Assistante (`/api/assistant/`)

`dashboard` · `students` · `activate-student` · `coaches` · `coaches/[id]` · `subscriptions` · `subscription-requests` · `credit-requests`

### Parent (`/api/parent/`)

`dashboard` · `children` · `credit-request` · `subscriptions` · `subscription-requests`

### Élève (`/api/student/`)

`dashboard` · `activate` · `sessions` · `credits` · `documents` · `nexus-index` · `resources` · `trajectory`

### Coach (`/api/coach/`)

`dashboard` · `sessions`

### Transversales

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/aria/chat` | Chat IA (entitlement-gated) |
| POST | `/api/aria/feedback` | Feedback réponse IA |
| POST | `/api/sessions/book` | Réservation session (entitlement-gated) |
| POST | `/api/sessions/cancel` | Annulation session |
| POST | `/api/payments/bank-transfer/confirm` | Déclaration virement |
| GET | `/api/payments/pending` | Paiements en attente (staff) |
| GET | `/api/payments/check-pending` | Anti-double paiement |
| POST | `/api/payments/validate` | Validation/rejet paiement |
| GET | `/api/health` | Healthcheck |
| POST | `/api/bilan-gratuit` | Inscription bilan gratuit |
| POST | `/api/contact` | Formulaire contact |
| POST | `/api/reservation` | Réservation stage |
| POST | `/api/stages/submit-diagnostic` | Soumission QCM stage |
| GET | `/api/notifications` | Notifications |

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

ARIA est l'assistant IA 24/7, alimenté par **Ollama** avec **RAG** sur contenus pédagogiques via **ChromaDB**.

```
Élève → POST /api/aria/chat
    ├── requireFeatureApi('aria_maths' | 'aria_nsi')
    ├── RAG Search (ChromaDB: ressources_pedagogiques_terminale)
    ├── Ollama (OPENAI_BASE_URL=http://ollama:11434/v1)
    │   └── llama3.2 (2GB) ou qwen2.5:32b (19GB)
    └── Sauvegarde AriaConversation + AriaMessage
```

| Modèle | Taille | Usage |
|--------|--------|-------|
| `llama3.2:latest` | 2 GB | Chat pédagogique (défaut) |
| `qwen2.5:32b` | 19 GB | Analyses approfondies |
| `nomic-embed-text` | 274 MB | Embeddings RAG |

---

## 11. Diagnostic & Évaluation

### Moteur Multi-Matières

Pipeline : PDF programme → JSON généré → YAML mapping (vérité) → JSON compilé → TS definitions

| Définition | Domaines | Compétences |
|------------|----------|-------------|
| `maths-premiere-p2` | 6 (algèbre, analyse, géométrie, proba, algo, logique) | ~25 |
| `maths-terminale-p2` | 5 (analyse, algèbre, géométrie, proba, algorithmique) | ~30 |
| `nsi-premiere-p2` | 5 (données, traitement, algo, python, architecture) | ~28 |
| `nsi-terminale-p2` | 6 (structures, algo avancé, BDD, réseaux, OS, python) | ~30 |

### Scoring Engine (`lib/scoring-engine.ts`)

- Score global pondéré par domaine
- Indice de confiance et de précision
- Radar de compétences par domaine
- Forces et faiblesses identifiées
- 25 tests unitaires

### Stages Intensifs

- **Réservation** : `/api/reservation` (Zod → upsert → Telegram notification)
- **QCM** : 50 questions (30 Maths + 20 NSI), 3 niveaux de poids
- **Interface** : Machine à état (intro → quiz → transition → submitting → success)
- **Rendu LaTeX** : KaTeX dynamique pour formules mathématiques
- **Raccourcis clavier** : A/B/C/D, N=NSP, Enter=Suivant

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

---

## 14. Tests

### Couverture

| Type | Framework | Fichiers | Tests |
|------|-----------|----------|-------|
| **Unitaires** | Jest + jsdom | 224 | ~2 600+ |
| **Intégration** | Jest + node + PostgreSQL | inclus | inclus |
| **E2E** | Playwright + Chromium | 27 | 196+ |

### Commandes

```bash
npm test                    # Jest (unit + integration)
npm run test:unit           # Jest unit only (jsdom)
npm run test:integration    # Jest integration (node + DB)
npm run test:e2e            # Playwright E2E
npx playwright test --project=chromium  # E2E Chromium only
```

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
Serveur: 88.99.254.59 (Hetzner Dedicated)
Domaine: https://nexusreussite.academy

Conteneurs Docker (13 healthy):
├── nexus-next-app     (port 3001→3000, standalone)
├── nexus-postgres-db  (port 5435→5432)
├── ollama             (qwen2.5:32b + llama3.2 + nomic-embed-text)
├── chromadb           (collection: ressources_pedagogiques_terminale)
├── rag-ingestor       (FastAPI, port 8001)
└── ... (redis, etc.)
```

### Docker

- **`Dockerfile.prod`** : Multi-stage build, standalone output, `HOSTNAME=0.0.0.0`
- **`docker-compose.prod.yml`** : Orchestration complète (app, DB, Ollama, ChromaDB, ingestor)
- Healthcheck : `curl http://127.0.0.1:3000/api/health`

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
| `SMTP_HOST` | Serveur SMTP | — |
| `SMTP_PORT` | Port SMTP | `587` |
| `SMTP_USER` | User SMTP | — |
| `SMTP_PASS` | Password SMTP | — |
| `TELEGRAM_BOT_TOKEN` | Bot Telegram (notifications) | — |
| `TELEGRAM_CHAT_ID` | Chat ID Telegram | — |
| `AUTH_TRUST_HOST` | Trust host header (CI/proxy) | `true` |
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
npm test               # Jest (all)
npm run test:e2e       # Playwright E2E
npm run db:generate    # Prisma generate
npm run db:push        # Prisma push schema
npm run db:seed        # Seed database
npm run db:studio      # Prisma Studio (GUI)
```

---

> **Nexus Réussite** — Plateforme de Pilotage Éducatif  
> © 2026 Nexus Réussite. Tous droits réservés.
