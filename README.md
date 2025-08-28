# Nexus Réussite – README (Source de Vérité)

## 1) Nexus Réussite : Vue d'ensemble

- Mission du Projet: Nexus Réussite est une plateforme d’accompagnement scolaire qui propose des parcours personnalisés (coaching, sessions, bilans pédagogiques, assistant IA « ARIA ») pour aider les élèves à progresser, réussir le Bac et structurer leur méthode de travail. La plateforme centralise les interactions entre élèves, parents, coachs, assistante et admin (dashboards, réservations, abonnements/crédits, documents PDF).
- Stack Technologique Principale:
  - Front/Back: Next.js 14 (App Router), React 18, TypeScript
  - Auth: NextAuth (Credentials) + PrismaAdapter
  - ORM & Base de données: Prisma + PostgreSQL
  - Tests: Jest (unitaires & intégration) + Playwright (E2E)
  - UI: Tailwind CSS (pattern shadcn-like), Radix UI
  - IA & Services: OpenAI SDK (ARIA), services internes RAG/PDF (mockés en tests)
  - PDF: Mustache → LaTeX → PDF via `latexmk`

---

## 2) Architecture du Projet

### Structure des Dossiers Clés

- `app/`
  - App Router Next.js (pages Server/Client) et API Routes sous `app/api/**`.
  - Endpoints clés (exemples):
    - `app/api/auth/[...nextauth]`: authentification NextAuth
    - `app/api/bilans/generate`: génération de bilans (orchestration IA → LaTeX → PDF)
    - `app/api/bilans/[id]/status` et `.../download`: état et téléchargement d’un PDF
    - `app/api/students/[id]/bilans`: listage des bilans d’un élève
    - `app/api/sessions/book`: réservation de session (débit crédits, conflits, statut)
    - `app/api/aria/chat`: interaction ARIA (limites freemium, orchestration IA)
    - `app/api/consistency`: rapport de cohérence des données (contrôles d’invariants)
    - `app/api/health`: probe DB
- `lib/`
  - Logique métier & utilitaires: `auth.ts` (NextAuth options + JWT enrichi), `prisma.ts` (client Prisma), `consistency.ts` (rapport cohérence), `jitsi.ts` (URLs visio), `credits.ts`, `rate-limit.ts`, `logger.ts`, `aria/*` (orchestrateur et services), `env.ts` (validation env), etc.
- `components/`
  - Composants UI (shadcn-like) et composites (ARIA chat, bilan, sections, dashboards).
- `apps/web/server/`
  - Bilan orchestrator côté serveur: prompts OpenAI, validation Zod, rendu Mustache → LaTeX et compilation PDF.
  - Fichiers: `server/bilan/orchestrator.ts`, `server/bilan/schema.ts`, `server/bilan/latex-template.mustache.tex`, `server/openai/promptBuilders.ts`, `server/openai/client.ts`.
- `apps/web/lib/`
  - `storage.ts`: interface de stockage, implémentation locale (`LocalStorage`) retournant des URLs `/files/...`.
- `prisma/`
  - `schema.prisma`: modèles (utilisateurs, profils, sessions, abonnements, paiements, bilans, ARIA, notifications, badges, pricing...)
  - `seed.ts`: seed exhaustif de données (rôles, abonnements, sessions, paiements, bilans variés)
- `e2e/`
  - Tests Playwright: auth, rôles (RBAC), réservations, paiements (mock), ARIA (freemium/premium), bilans (génération/accès), smoke, a11y.
- `__tests__/`
  - Tests Jest: unitaires (logique pure, validations Zod, prompts) et intégration (API + Prisma).
- `server/`
  - Services Node spécifiques (OpenAI, Bilan) en miroir de `apps/web/server/` quand nécessaire.
- `services/`
  - Scripts/poches techniques (ex: PDF, RAG, utilitaires) – utilisés en dev/tests.

### Flux de Données Typique

1. Un utilisateur clique dans un composant React (ex: « Générer un bilan »).
2. Le composant effectue un `fetch` vers une API Route (`app/api/**`).
3. L’API exécute la logique serveur (Prisma, orchestrateur IA/LaTeX/PDF, stockage) et met à jour la DB.
4. La réponse JSON (ex: `id`, `pdfUrl`, `status`) met à jour l’UI (lien de téléchargement, état, toasts).

---

## 3) Système d'Authentification et Rôles Utilisateurs (NextAuth)

### Fournisseurs d’Authentification

- `CredentialsProvider` (email/password) configuré dans `lib/auth.ts`, avec PrismaAdapter (sessions JWT, `NEXTAUTH_SECRET`).

### Modèle de Données Utilisateur (extraits de `prisma/schema.prisma`)

- `User`: `id`, `email`, `password?`, `role: UserRole` (`ADMIN`, `ASSISTANTE`, `COACH`, `PARENT`, `ELEVE`), `firstName?`, `lastName?`.
  - Profils liés: `ParentProfile`, `StudentProfile`, `CoachProfile`.
  - Relations: paiements, sessions (bookings), messages, notifications.
- `Student`: entité métier élève (liée à `User` et `ParentProfile`) avec crédits, statistiques sessions, `freemiumUsage` ARIA, garantie, badges, bilans, subscriptions, transactions de crédits, conversations ARIA, etc.
- Autres tables clés: `Subscription`, `CreditTransaction`, `Session`, `Payment`, `Bilan`, `AriaConversation/AriaMessage`, `Badge/StudentBadge`, `Notification`, `SessionBooking/SessionNotification/SessionReminder`, `ProductPricing`.

### Matrice des Rôles (exemples d’actions critiques)

- ADMIN:
  - Accéder aux endpoints admin (`app/api/admin/**`), gérer utilisateurs, analytics et ingestion RAG.
  - Consulter rapports cohérence (`/api/consistency`).
- ASSISTANTE:
  - Gérer `subscription-requests`, paiements de test, crédits étudiants.
  - Accéder au dashboard assistante.
- PARENT:
  - Voir enfants, bilans (`/api/students/[id]/bilans`), abonnements/demandes.
  - Débloquer ARIA premium (CTA souscriptions).
- ELEVE:
  - Réserver sessions (via UI + `/api/sessions/book`), consulter crédits, chatter avec ARIA (`/api/aria/chat`).
  - Télécharger bilans générés.
- COACH:
  - Gérer disponibilités, consulter sessions planifiées, produire/consulter rapports.

La logique d’autorisation se base sur la session JWT enrichie dans `lib/auth.ts` (ajout de `studentId`/`parentId` pour les élèves).

---

## 4) Fonctionnalités Métier Clés

### Système de Cours et Inscriptions (Réservations)

- Route: `POST app/api/sessions/book`.
- Entrée validée par Zod: `coachId`, `studentId`, `subject`, `scheduledDate`, `startTime`, `duration`, `creditsToUse`, `title`.
- Logique:
  - Vérification authentification (NextAuth), Content-Type, parsing JSON.
  - Transaction Prisma: calcul solde de crédits (agrégat `creditTransaction`), vérification des conflits pour le coach (même créneau), création `session` avec statut `SCHEDULED`, débit des crédits (`CreditTransaction` type `USAGE`).
  - Réponse `{ success: true, sessionId }` ou erreur explicite.

### Sessions de Visioconférence (Jitsi)

- Utilitaires: `lib/jitsi.ts` pour générer des URL de salle (déterministes ou uniques) avec `NEXT_PUBLIC_JITSI_SERVER_URL`.
- `buildJitsiUrlWithConfig` ajoute les paramètres d’interface et de profil (langue, pré-join, droits host vs student).
- Intégration UI: iframe Jitsi avec l’URL construite; accès via détails de la session planifiée.

### Agent IA "ARIA" (OpenAI)

- Fichiers: `apps/web/server/openai/client.ts`, `apps/web/server/openai/promptBuilders.ts`, `lib/aria/services.ts`, `lib/aria/orchestrator.ts`.
- Rôle des services:
  - LLM_SERVICE: client OpenAI (chat completions) pour réponses ARIA et génération des contenus de bilans.
  - RAG_SERVICE: service d’augmentation par documents (ingestion RAG côté admin et exploitation en réponse) – mocké/stub en tests.
  - PDF_SERVICE: rendu Mustache→LaTeX→PDF + stockage – implémenté localement et mocké en E2E.
- Flux (élève pose une question): UI chat → `POST /api/aria/chat` → rate-limit → vérification session JWT (ids élève/parent) → contrôle freemium (5/jour) → `AriaOrchestrator.handleQuery(message, subject)` → réponse `{ response, documentUrl? }`.

### Génération de PDF (Bilans)

- Orchestrateur: `apps/web/server/bilan/orchestrator.ts`.
  - `generateBilan`: construit messages (prompts), appelle OpenAI (`gpt-4o-mini`), extrait le JSON, valide avec `apps/web/server/bilan/schema.ts` (Zod), renvoie l’objet conforme.
  - `renderLatex`: rendu Mustache avec template `latex-template.mustache.tex`.
  - `compileLatex`: compile avec `latexmk` (override via `TEXBIN`), retourne chemin PDF.
- Route d’écriture (extrait): `app/api/bilans/generate/route.ts`
  - récupère l’élève; appelle `generateBilan`, rend LaTeX, compile, pousse via `LocalStorage.put` (URL `/files/...`), créé un `Bilan` (DB) et renvoie `{ id, pdfUrl }`.

---

## 5) Stratégie de Test

### Types de Tests

- Unitaires (Jest): logique pure (calculs crédits, validations Zod, prompts, orchestrateur avec mocks).
- Intégration (Jest): API routes avec Prisma; base SQLite/DB test selon config; couverture élevée visée.
- End‑to‑End (Playwright): parcours critiques (auth, rôles, réservations, ARIA freemium/premium, génération/accès PDF bilans). Chromium-only en CI pour stabilité.

### Données de Test

- `prisma/seed.ts`: seed complet et idempotent couvrant rôles, sessions (multi‑statuts), paiements (multi‑statuts), abonnements, bilans variés, badges.
- E2E: stubs pour endpoints coûteux/externes (ARIA/RAG/PDF), sélecteurs stables `data-testid`.

### Lancement des Tests

- Unit/Intégration + couverture:

```bash
npm run test:coverage
```

- E2E (Chromium):

```bash
npm run test:e2e
```

- E2E UI runner:

```bash
npm run test:e2e:ui
```

Référence détaillée: `README_TESTS.md`.

---

## 6) Guide de Démarrage pour Développeur

### Prérequis

- Node.js ≥ 20
- PostgreSQL local (ou Docker)
- `latexmk` (ou `tectonic`) pour compiler LaTeX en PDF

### Installation

```bash
# Installer dépendances
npm ci

# Prisma Client
npx prisma generate

# Appliquer migrations
npx prisma migrate dev --name init

# Seed (optionnel)
npm run db:seed
```

### Variables d'Environnement

- Fichier `.env.local` à créer depuis `env.local.template` ou `env.example`.
- Variables clés:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nexus_dev?schema=public
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev-secret
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_JITSI_SERVER_URL=https://meet.jit.si
TEXBIN=latexmk
```

- Certaines validations sont gérées par `lib/env.ts` (Zod). En E2E, `.env.e2e` est chargé via `dotenv-cli`.

### Lancement du Projet

```bash
npm run dev
# http://localhost:3000
```

### Santé & Cohérence

- `GET /api/health` → vérifie l’accès DB.
- `GET /api/consistency` → rapport de cohérence (rôles, sessions, abonnements, paiements, badges, bilans) – 200 si OK sinon 500.

---

Ce document est la source de vérité fonctionnelle et technique de Nexus Réussite. Il couvre l’architecture, l’authentification, les fonctionnalités clés (sessions/ARIA/bilans), la stratégie de tests et l’onboarding développeur pour un passage en production fiable.
