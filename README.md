# Nexus Réussite — Documentation Technique Complète

> State: projet finalisé en développement, prêt au déploiement production (VPS). Cette documentation sert de base de passage de relais et d’audit interne complet.

## 0. Introduction

- Vision: pédagogie augmentée (humain + IA) pour Bac/Parcoursup, excellence premium.
- Composants: Frontend Next.js, API backend, PostgreSQL + Prisma, IA ARIA, RAG, Bilans, Auth (NextAuth), micro-services optionnels.
- Etat: sécurisé, testable localement, pipelines RAG/ARIA opérationnels en dev.

## 1. Architecture générale

```mermaid
flowchart LR
  A[Next.js App Router] --> B[API Routes /app/api/*]
  B --> DB[(PostgreSQL + pgvector)]
  B --> REDIS[(Redis)]
  B --> MINIO[(MinIO S3)]
  B --> LLM[LLM Service / OpenAI]
  B --> RAG[RAG Service]
  B --> PDF[PDF Generator]
  B --> EMB[Embeddings Service]
```

Stack:

- Frontend: Next.js 14+, TypeScript, Tailwind CSS, shadcn/ui.
- Backend: API Routes (App Router), services modulaires sous `server/*`.
- DB: PostgreSQL + Prisma, `pgvector`.
- Cache/queues: Redis, BullMQ (si activé).
- IA: OpenAI (gpt-4o-mini par défaut), embeddings HF/OpenAI via `apps/web/server/vector/embeddings.ts`.
- OCR: intégrable (Vision API / Tesseract) dans `server/rag/*`.

Arborescence clés:

- `app/api/*`: endpoints REST.
- `lib/*`: logique, auth, rbac, orchestrations.
- `apps/web/server/*`: vector, bilan.
- `server/*`: modules (rag, generation, context).
- `prisma/schema.prisma`: modèle de données.

## 2. Modèle de données (Prisma)

Fichier: `prisma/schema.prisma` (extrait—voir fichier pour intégralité):

```12:120:prisma/schema.prisma
// … modèles User, Student, Bilan, Memory, KnowledgeAsset, IngestJob, etc.
```

Points clés:

- Rôles: `UserRole`: ADMIN, ASSISTANTE, COACH, PARENT, ELEVE.
- Bilans: table `bilans` avec `qcmRaw`, `pedagoRaw`, `qcmScores`, `pedagoProfile`, `synthesis`, `offers`.
- RAG: `user_documents`, `knowledge_assets` (embedding vector(1536)), `ingest_jobs`.
- Mémoire ARIA: `memories` avec `embedding vector(1536)`.
- Paiements: `payments`, `payment_records`, `credit_wallets`, `credit_packs`.

Indices et relations:

- `@@index([studentId, kind])` sur `memories`.
- `@@index([docId])` sur `knowledge_assets`.
- `@@index([docId, status])` sur `ingest_jobs`.
- `Unsupported("vector(1536)")` pour pgvector.

## 3. Workflow ARIA (Agent IA)

- Contexte: `server/context/builder.ts` (assemble recentMessages, episodic/semantic memories, planMemory, dashboardSummary). API: `GET /api/context/build`.
- RAG:
  - Ingestion: `server/rag/ingest.ts` (OCR -> nettoyage -> chunking -> embeddings -> indexation), `server/rag/ocr.ts`, `server/rag/chunker.ts`.
  - Vector search: `apps/web/server/vector/embeddings.ts`, `apps/web/server/vector/search.ts`.
  - Jobs/queue: `lib/queue.ts`, `server/rag/worker.ts`.
  - APIs: `POST /api/rag/upload`, `GET /api/rag/jobs`, `GET /api/rag/docs`.
  - UI admin: `app/(dashboard)/admin/rag/page.tsx`.
- Bilans:
  - Questionnaires JSON: `data/qcm_*`, `data/pedago_survey_commun.json`.
  - Orchestrateur: `lib/aria/orchestrator.ts` — texte → LaTeX → PDF.
  - APIs: `/api/bilan/*` (start, status, download, pdf, generate-summary-text, etc.).
  - UI: `app/bilan/[bilanId]` et composants d’envoi PDF.
- Génération PDF (LaTeX): `server/generation/generator.ts`. API: `POST /api/aria/generate-document`.

SSE ARIA:

- Endpoint: `app/api/aria/chat/route.ts` supporte JSON et `?stream=true`.

## 4. Environnements & Configuration

Variables `.env.local` (exemple dans `env.example`):

```12:78:env.example
# DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET, SMTP_*, OPENAI_API_KEY, RAG/PDF/LLM URLs …
```

Docker dev/prod:

- `docker-compose.dev.yml`: Postgres (pgvector) pour dev.

```1:22:docker-compose.dev.yml
```

- `docker-compose.yml`: Postgres, Redis, MinIO, services d’IA (embedding, RAG, PDF, LLM) et app Next.

```1:175:docker-compose.yml
```

Dockerfile (multi-stage, Prisma, user non-root):

```1:74:Dockerfile
```

Scripts utiles:

- `start-production.sh`: entrypoint Next.
- `scripts/*`: seed, outils.

## 5. Déploiement Production (VPS)

Pré-requis VPS (Ubuntu 22.04+): Docker, docker-compose, UFW, Nginx (reverse proxy), Postgres (option interne docker), Redis, MinIO (docker).

Pipeline:

1) Cloner repo sur VPS: `/opt/nexus/`.
2) Créer `.env` complet (non versionné) avec secrets réels.
3) Construire et lancer:

```bash
cd /opt/nexus
docker compose pull
docker compose build --no-cache
docker compose up -d
```

4) Migrations:

```bash
docker compose exec next_app_prod npx prisma migrate deploy
```

5) Seed si nécessaire:

```bash
docker compose exec next_app_prod npm run db:seed-prod
```

6) Nginx (exemple site):

```nginx
server {
  server_name nexusreussite.academy;
  location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; }
  client_max_body_size 50M;
}
```

7) Sécurité UFW: ouvrir 80/443, db interne réseau docker.

## 6. Rôles, ACL & Sécurité

- Rôles: ADMIN, ASSISTANTE, COACH, PARENT, ELEVE.
- Auth: NextAuth (credentials/email), options sous `lib/auth`.
- RBAC API: `lib/api/rbac.ts` via `requireRole(req, roles)`.
- Dev token (dev): `lib/auth/dev-token.ts` pour tests et E2E.
- Sécurité: logs minimisés (`lib/logger`), données sensibles non exposées, RGPD (droit à l’oubli via scripts de purge), chiffrement au transport (TLS/HTTPS), secrets en variables.

## 7. Tests & Qualité

- Unitaires (Vitest): `npm run test:unit`.
- Integration/Jest: `npm run test:coverage` (projets jest.unit + jest.integration + ui partial).
- E2E (Playwright): `npm run test:e2e` (webServer Next sur 3003 par défaut, cf `playwright.config.ts`).

Couverture sensible:

- Orchestrateur ARIA, route `/api/aria/chat`, RAG.

## 8. Endpoints principaux (exemples)

- ARIA Chat:

```http
POST /api/aria/chat             # JSON
POST /api/aria/chat?stream=true # SSE
```

- RAG:

```http
POST /api/rag/upload
GET  /api/rag/jobs
GET  /api/rag/docs
```

- Bilans:

```http
POST /api/bilan/start
GET  /api/bilans/:id/status
GET  /api/bilans/:id/download
```

- Paiements (admin/cash):

```http
GET  /api/admin/payments/records
POST /api/payments/cash/reserve
POST /api/payments/cash/confirm
GET  /api/payments/cash/pending
```

## 9. Schémas/pipelines

RAG Ingestion:

```mermaid
sequenceDiagram
  participant U as UI Admin
  participant A as API /api/rag/upload
  participant W as Worker RAG
  participant V as Vector DB
  U->>A: Upload (pdf/docx/image)
  A->>W: Job queued
  W->>W: OCR->clean->chunk
  W->>V: Embed+Index
  U->>A: GET /jobs (progress)
```

ARIA Orchestration:

```mermaid
flowchart TD
  Q[User Query] --> C[Context Builder]
  C -->|Memories| O[Orchestrator]
  O -->|LLM| L[OpenAI]
  O -->|PDF| G[Generator]
  O --> R[Response]
```

## 10. Opérations & Observabilité

- Healthcheck: `GET /api/health`.
- Logs: centralisation possible (ELK), niveaux configurables.
- Alertes: hook web/Slack (à brancher).

## 11. Bonnes pratiques sécurité prod

- Secrets hors repo (ENV), rotation.
- Principe du moindre privilège (DB roles, tokens).
- En-têtes HTTP (Nginx/Next) durcis.
- Backups DB/MinIO chiffrés.
- Minimiser surface d’attaque (ports, CORS, rate-limit `lib/rate-limit.ts`).

## 12. Annexes

- Fichiers questionnaires: `data/*`.
- Scripts seed: `scripts/*`, `prisma/seed.ts`.
- Génération PDF locale: `server/generation/*`.

---

Contact interne: équipe Nexus Réussite (CTO/Lead). Toute évolution doit préserver sécurité, intégrité des données, et performance en prod.

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

- E2E ciblés (webServer Playwright 3003):

```bash
E2E_BASE_URL=http://localhost:3003 NEXTAUTH_SECRET=dev-secret-not-for-production npx playwright test e2e/bilan.workflow.api.spec.ts e2e/bilan-volet2-flow.spec.ts --project=chromium
```

- E2E ciblés (serveur existant 3000, config sans webServer):

```bash
E2E=1 NEXT_PUBLIC_E2E=1 E2E_BASE_URL=http://localhost:3000 NEXTAUTH_SECRET=dev-secret-not-for-production npx playwright test e2e/bilan.workflow.api.spec.ts e2e/bilan-volet2-flow.spec.ts --config=playwright.noserver.config.ts --project=chromium
```

- Smoke rapide:

```bash
E2E_BASE_URL=http://localhost:3003 NEXTAUTH_SECRET=dev-secret-not-for-production npx playwright test e2e/pages-smoke.spec.ts --project=chromium
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

- Fichier `.env.local` à créer depuis `env.local.example` ou `env.example`.
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

## 13. Structure détaillée de la base de données (tables, contraintes, indexes)

Les tableaux suivants synthétisent les attributs, contraintes, clés et indexes. Pour la définition canonique, se référer à `prisma/schema.prisma`.

### Table `users`

- Clé primaire: `id (cuid)`
- Contraintes: `email UNIQUE`, `role ENUM(UserRole)`
- Indexes: (prisma crée les nécessaires sur relations)

| Colonne | Type | Contraintes |
|---|---|---|
| id | String | PK, cuid |
| email | String | UNIQUE, NOT NULL |
| password | String | NULL |
| role | UserRole | NOT NULL |
| firstName | String | NULL |
| lastName | String | NULL |
| phone | String | NULL |
| createdAt | DateTime | DEFAULT now() |
| updatedAt | DateTime | @updatedAt |

Relations: `parentProfile?`, `studentProfile?`, `student?`, `coachProfile?`, messages, payments.

### Table `students`

- PK: `id (cuid)`
- FK: `parentId -> parent_profiles.id (CASCADE)`, `userId -> users.id (CASCADE)`
- Index: implícite via relations

| Colonne | Type | Contraintes |
|---|---|---|
| id | String | PK, cuid |
| parentId | String | FK parent_profiles.id |
| userId | String | UNIQUE, FK users.id |
| grade, school, birthDate | String/Date | NULL |
| credits | Int | DEFAULT 0 |
| totalSessions | Int | DEFAULT 0 |
| completedSessions | Int | DEFAULT 0 |
| freemiumUsage | Json | NULL |
| guaranteeEligible | Boolean | DEFAULT false |
| guaranteeActivatedAt | DateTime | NULL |
| createdAt | DateTime | DEFAULT now() |
| updatedAt | DateTime | @updatedAt |

### Table `bilans` (Bilan)

- PK: `id (cuid)`
- FK: `studentId -> students.id (CASCADE)`

| Colonne | Type | Contraintes |
|---|---|---|
| id | String | PK |
| studentId | String | FK students.id |
| subject | String | NULL |
| niveau | String | NULL |
| statut | String | NULL |
| qcmRaw, pedagoRaw, qcmScores, pedagoProfile, preAnalyzedData, synthesis, offers | Json | NOT NULL (sauf preAnalyzedData) |
| pdfUrl | String | NULL |
| pdfBlob | Bytes | NULL |
| reportText, summaryText | String | NULL |
| generatedAt | DateTime | NULL |
| createdAt | DateTime | DEFAULT now() |
| updatedAt | DateTime | @updatedAt |

### Table `memories` (pgvector)

- PK: `id (cuid)`
- FK: `studentId -> students.id (CASCADE)`
- Index: `@@index([studentId, kind])`
- Colonne vectorielle: `embedding vector(1536)` (pgvector, dimension fixée à 1536)

| Colonne | Type | Contraintes |
|---|---|---|
| id | String | PK |
| studentId | String | FK |
| kind | ENUM(EPISODIC, SEMANTIC, PLAN) | NOT NULL |
| content | String | NOT NULL |
| embedding | vector(1536) | NULL (optionnel) |
| meta | Json | NULL |
| createdAt | DateTime | DEFAULT now() |

### `user_documents`, `knowledge_assets` (RAG)

- `user_documents` PK: `id`; `storageKey UNIQUE`
- `knowledge_assets` PK: `id`; FK: `docId -> user_documents.id (CASCADE)`; Index: `@@index([docId])`; `embedding vector(1536)`

| Table | Colonne | Type | Contraintes |
|---|---|---|---|
| user_documents | storageKey | String | UNIQUE |
| knowledge_assets | embedding | vector(1536) | NOT NULL |

### `ingest_jobs`

- PK: `id`; FK logique via `docId`; Index: `@@index([docId, status])`

### `payments`, `payment_records`, `credit_wallets`, `credit_tx`, `credit_packs`, `credit_usage`

- Invariants (voir section 20): cohérence solde = somme `credit_tx` par `wallet`.
- `payment_records.status` workflow: created → pending → paid|failed|cancelled.

| Table | Particularités |
|---|---|
| credit_wallets | `userId UNIQUE`, balance maintenu par `credit_tx` |
| credit_tx | FK `walletId -> credit_wallets.id` |

### Indexes vectoriels (récapitulatif)

- `memories.embedding`: `vector(1536)`
- `knowledge_assets.embedding`: `vector(1536)`

## 14. Pipeline DevOps & CI/CD

Objectifs: lint/typecheck/tests → build → migrations → image Docker → déploiement VPS.

Exemple GitHub Actions (`.github/workflows/ci.yml`):

```yaml
name: CI
on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test:unit
      - run: npm run test:coverage
      - run: npx playwright install --with-deps
      - run: npm run test:e2e || true
  docker-release:
    needs: build-test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USER }}
          password: ${{ secrets.DOCKER_PASS }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: nexusreussite/app:latest
  migrate-deploy:
    needs: docker-release
    runs-on: ubuntu-latest
    steps:
      - name: Run migrations on VPS
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/nexus
            docker compose pull
            docker compose up -d --remove-orphans
            docker compose exec -T next_app_prod npx prisma migrate deploy
```

## 15. Monitoring & Observabilité

Outils conseillés/branchables:

- Sentry (`@sentry/nextjs`) pour erreurs front/back.
- Prometheus + Grafana pour métriques (exporters nodejs, postgres, redis).
- Loki/ELK pour logs (via Pino → stdout, collectés par promtail/filebeat).
- Uptime-kuma/Healthchecks pour disponibilité.

Métriques clés:

- API: latence p50/p95, taux d’erreur 4xx/5xx, RPS.
- OpenAI: volume requêtes, coût estimé (tokens), latence.
- Redis: hit-rate, mémoire, évictions.
- Postgres: TPS, locks, taille base, temps requêtes lentes.
- RAG: temps ingestion, taux OCR, taille index, qualité embeddings.
- PDF: taux de réussite compilation, latence génération.

Alertes:

- seuil latence p95, erreur 5xx > x%, disque DB/MinIO > 80%, mémoire Redis > 80%.

## 16. Gestion des secrets & sécurité avancée

Stratégie prod:

- Secrets hors repo (Git): GitHub Actions secrets, `.env` sur VPS non versionné.
- Stockage recommandé: HashiCorp Vault, Doppler, 1Password Secrets Automation.
- Rotation: clés OpenAI/Konnect/SMTP trimestrielle, invalider anciens secrets, redéployer.
- Révocation: révoquer immédiatement les clés compromises (OpenAI/Konnect), invalider tokens sessions.
- Chiffrement at-rest: volumes Postgres/MinIO chiffrés (LUKS/Cloud KMS). TLS pour trafic externe (Nginx/Certbot).

## 17. Sauvegardes & restauration

PostgreSQL:

- Sauvegarde: `pg_dump -Fc -h host -U user -d db > backup.dump` (horaire: toutes les nuits). Rétention: 7/30/365.
- Restauration test: `pg_restore -c -d db_test backup.dump` sur instance de test, puis tests smoke DB.

MinIO:

- Sauvegarde: `mc mirror minio/prod-bucket s3/backup-bucket --overwrite` (ou snapshot volume Docker).
- Restauration: mirror inverse, vérification checksums.

Plan de test restauration:

- Provisionner environnement staging, restaurer DB + objets MinIO, rejouer migrations, lancer suite smoke E2E ciblée.

## 18. Performance & Scalabilité

- Scaling horizontal Next.js: plusieurs réplicas derrière Nginx/Traefik, sticky sessions si nécessaire pour NextAuth (ou session store partagé).
- Workers BullMQ: externaliser tâches lourdes (RAG OCR/embeddings, PDF) vers workers dédiés.
- CDN: assets `public/` via CDN (Cloudflare) et cache d’images.
- Cache Redis: résultats de recherche, fragments d’UI.
- Tests de charge: Artillery/k6 recommandés (scénarios: chat ARIA, upload RAG, endpoints bilans, paiements demo). Objectifs: p95 < 500ms pour API courantes.

## 19. Dépendances critiques & compatibilité

- Node.js: >= 20 (`package.json engines`)
- Next.js: ^14.2.3
- Prisma: ^6.14.0
- @prisma/client: ^6.14.0
- OpenAI SDK: ^5.16.0
- @sentry/nextjs: ^8.0.0
- @xenova/transformers: ^2.17.2
- LaTeX: TeXLive complet dans l’image du service PDF (voir `services/pdf_generator_service`).
- pgvector: image `pgvector/pgvector:pg16` en prod.

Matrice suggérée:

- Node 20.x + Prisma 6.14 + Next 14.2.3 + pg16 (pgvector) + OpenAI SDK 5.16 → OK.

## 20. Cohérence des flux financiers (crédits/transactions)

Invariants:

- Solde portefeuille: `credit_wallets.balance = sum(credit_tx.delta where walletId = X)`.
- Atomicité: toute écriture de transaction est dans la même transaction DB que la mise à jour de `balance` (à appliquer via service de paiement).
- Idempotence: contrainte `UNIQUE(provider, externalId)` sur `payment_records` + upsert garantissent l'absence de doublons (provider, externalId).

Exemple de test (pseudo/Jest):

```ts
import { prisma } from '@/lib/prisma';

test('wallet consistency', async () => {
  const w = await prisma.creditWallet.create({ data: { userId: 'u1' } });
  await prisma.$transaction([
    prisma.creditTx.create({ data: { walletId: w.id, delta: 10, reason: 'topup' } }),
    prisma.creditWallet.update({ where: { id: w.id }, data: { balance: { increment: 10 } } }),
  ]);
  const wallet = await prisma.creditWallet.findUnique({ where: { id: w.id } });
  const sum = await prisma.creditTx.aggregate({ _sum: { delta: true }, where: { walletId: w.id } });
  expect(wallet?.balance).toBe(sum._sum.delta || 0);
});
```

Stratégie erreurs/rollback:

- En cas d’échec créditation/paiement, rollback transaction DB (toutes écritures atomiques), journalisation `audit_logs`.

---

## A. API & Contrats (OpenAPI + RBAC)

- Spécification OpenAPI 3.1 (aperçu) — fichier recommandé: `docs/api/openapi.yaml`.

```yaml
openapi: 3.1.0
info:
  title: Nexus Réussite API
  version: 1.0.0
servers:
  - url: https://nexusreussite.academy
  - url: http://localhost:3003
components:
  securitySchemes:
    sessionAuth:
      type: http
      scheme: bearer
  schemas:
    AriaChatRequest:
      type: object
      required: [message]
      properties:
        message: { type: string, minLength: 1 }
        subject: { type: string, enum: [MATHEMATIQUES, NSI, FRANCAIS, PHILOSOPHIE, HISTOIRE_GEO, ANGLAIS, ESPAGNOL, PHYSIQUE_CHIMIE, SVT, SES] }
        stream: { type: boolean, default: false }
    AriaChatResponse:
      type: object
      properties:
        response: { type: string }
paths:
  /api/aria/chat:
    post:
      summary: Chat ARIA (JSON or SSE with stream=true)
      security: [{ sessionAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/AriaChatRequest' }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema: { $ref: '#/components/schemas/AriaChatResponse' }
        '400': { description: Invalid }
        '401': { description: Unauthorized }
  /api/rag/upload:
    post:
      summary: Upload RAG document
      security: [{ sessionAuth: [] }]
      responses:
        '200': { description: OK }
        '401': { description: Unauthorized }
```

- SSE `/api/aria/chat?stream=true` (voir `app/api/aria/chat/route.ts`):
  - Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.
  - Evénements: `event: token` avec `data: {"text": "..."}`; fin `event: done`.
  - Timeouts côté client: 30s recommandé; keep-alive: flux continu de tokens.

- Matrice d’autorisations (extrait):

| Endpoint | Méthode | Rôles autorisés | Notes |
|---|---|---|---|
| /api/admin/payments/records | GET | ADMIN, ASSISTANTE | Gestion caisse |
| /api/payments/cash/pending | GET | ADMIN, ASSISTANTE | Liste pending |
| /api/aria/chat | POST | ELEVE/PARENT/COACH/ASSISTANTE/ADMIN | Freemium gating appliqué |
| /api/rag/upload | POST | ADMIN | Ingestion corpus |

- Export Postman/Insomnia: recommander d’exporter depuis `docs/api/openapi.yaml` (import direct Postman/Insomnia).

### Fichier OpenAPI

Le fichier complet est disponible (à créer/mettre à jour au même contenu que l’aperçu ci-dessus) sous:

- `docs/api/openapi.yaml`

## B. Environnements & Variables (validation stricte)

Schéma Zod (exemple) — fichier suggéré `lib/env.ts`:

```ts
import { z } from 'zod';
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development','test','production']),
  DATABASE_URL: z.string().url(),
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  OPENAI_API_KEY: z.string().min(10),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  E2E_BASE_URL: z.string().url().optional(),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.string(),
  SMTP_SECURE: z.string(),
  SMTP_USER: z.string().email().or(z.string().min(3)),
  SMTP_PASSWORD: z.string().min(3),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});
```

Tableau variables principales (extrait):

| Nom | Description | Obligatoire | Portée | Exemple |
|---|---|---|---|---|
| DATABASE_URL | Connexion Postgres | Oui | Serveur | postgresql://... |
| NEXTAUTH_URL | Base URL NextAuth | Oui | Serveur | <https://site> |
| NEXTAUTH_SECRET | Secret NextAuth | Oui | Serveur | 64 chars |
| OPENAI_API_KEY | Clé OpenAI | Oui | Serveur | sk-... |
| OPENAI_MODEL | Modèle LLM | Non | Serveur | gpt-4o-mini |
| NEXT_PUBLIC_APP_URL | URL publique | Oui | Public | <https://site> |

Procédure rotation secrets: générer nouveaux secrets, injecter dans Vault/.env sur VPS, redéployer, invalider anciens; documenter le change dans journal d’accès.

## C. Base de données (canon + opérations)

- Schéma complet: voir annexe `docs/db/schema.prisma.md` (copie intégrale de `prisma/schema.prisma`).
- FKs et ON DELETE/UPDATE (exemples):
  - `Bilan.studentId -> Student.id (ON DELETE CASCADE)`
  - `Student.userId -> User.id (ON DELETE CASCADE)`
  - `ParentProfile.userId -> User.id (ON DELETE CASCADE)`
- Workflows d’état (exemple Mermaid — paiements records):

```mermaid
stateDiagram-v2
  [*] --> created
  created --> pending
  pending --> paid
  pending --> failed
  pending --> cancelled
```

- pgvector: métrique recommandée cosine; index: IVFFLAT (lists=100); reindex périodique en cas de drift embeddings.
- Indexing strategy (exemples):
  - Sessions: index `(coachId, scheduledDate)`, `(status, scheduledDate)` pour filtrage agenda.
  - Bilans: index `(studentId)`; EXPLAIN ANALYZE pour accès par élève.

Runbooks DB:

- Zéro-downtime: ajouter colonnes → backfill → code compat → switch → supprimer colonnes legacy.
- Rollback: conserver migration inverse; point de restauration `pg_basebackup`.
- Maintenance: `VACUUM (FULL)`, `ANALYZE`, autovacuum tuning via `autovacuum_vacuum_cost_limit`.

## D. RAG/ARIA (paramètres & isolation)

- Chunking: taille 800–1200 tokens, overlap 100–200; PDF via `mammoth`/`pdf-parse`, normalisation des formules; déduplication par `contentHash`.
- Embeddings: OpenAI `text-embedding-3-large` (ou HF `all-MiniLM-L6-v2` en dev), dimension 3072 (OpenAI) ou 384 (HF). Dans notre DB, vecteurs stockés 1536 — fixer la version choisie et migrer cohérent.
- Recherche: cosine; top-k 8–20; MMR optionnel; hybrid BM25+vector via index textuel + score vector.
- Sécurité: documents et assets scellés par `ownerId/ownerRole`; l’index vectoriel porte `docId` et vérifie l’accès au moment de la requête.
- Workers: concurrence 2–4; lots 16; timeouts 60s OCR/embedding; idempotence via `storageKey UNIQUE` (déjà en DB); reprise d’indexation par `ingest_jobs`.

## E. Production (Nginx, SSE/WebSockets, TLS)

Nginx (production-grade):

```nginx
server {
  listen 80;
  server_name nexusreussite.academy;
  return 301 https://$host$request_uri;
}
server {
  listen 443 ssl http2;
  server_name nexusreussite.academy;
  ssl_certificate /etc/letsencrypt/live/nexusreussite.academy/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/nexusreussite.academy/privkey.pem;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header Content-Security-Policy "default-src 'self' 'unsafe-inline' https: data:";
  gzip on; gzip_types text/plain application/json text/css application/javascript;
  brotli on; brotli_comp_level 5;

  location /_next/static/ { expires 30d; add_header Cache-Control "public, max-age=2592000"; }

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600;
    proxy_send_timeout 3600;
    # SSE
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;
  }
}
```

Docker resources (exemple `docker-compose.yml`):

```yaml
services:
  next-app:
    deploy:
      resources:
        limits: { cpus: '2', memory: 2G }
    restart: always
    healthcheck:
      test: ["CMD-SHELL","curl -sf http://127.0.0.1:3000/api/health || exit 1"]
```

## F. CI/CD & Runbooks

Runbook Release:

- Versioning semver, changelog généré.
- Feature flags via variables env/guards de code.
- Etapes: tests → build → release image → migrations → déploiement → smoke tests (home, /api/health, aria chat JSON, rag upload stub).

Rollback:

- `docker compose rollout undo` (si orchestrateur), sinon repasser à l’image N-1 et exécuter migration down.
- Arrêt contrôlé workers: drain des queues, arrêt progressif containers.

Promotion dev→staging→prod:

- Branches `dev`/`staging`/`main`, tags `vX.Y.Z`, approbation manuelle GitHub Actions `environment: production`.

## G. Observabilité & SLO

SLO (exemples):

- p95 latence API < 500ms (mensuel), 5xx < 0.5%.
- Jobs RAG en file < 50 en p95, délai moyen < 5 min.
- PDF succès > 98%.

Instrumentation:

- OpenTelemetry (HTTP instrumentation Next, fetch, Postgres).
- Correlation-Id: générer/propager header `X-Request-Id` dans logs Pino.

## H. Sécurité & RGPD (opérationnel)

Contrôles OWASP:

- Brute force: limiter tentatives login, captcha si échec.
- CSRF: NextAuth protège; vérifier méthodes/idempotency.
- SSRF: whitelist domaines internal services.
- Rate-limit: `lib/rate-limit.ts` par route sensible.
- Mots de passe: min 8 chars, hash bcrypt, 2FA optionnelle (TOTP) — endpoints à prévoir.

RGPD:

- Registre traitements (doc interne), cartographie PII par table: `users(email,phone)`, `students(birthDate)`, etc.
- Rétention: logs 90j, documents 1 an (configurable).
- Droit d’accès/effacement: endpoints admin internes + scripts `scripts/rgpd/*` (à créer) pour purge sélective.

## I. Sauvegardes & PRA

Objectifs:

- RPO: 1h (DB), 4h (MinIO). RTO: 2h.
- Tests mensuels restauration automatique vers staging.
- Backups chiffrés (GPG/SSE-S3) avec checksums sha256.
- Runbook PRA: responsable SRE déclenche restauration, CTO valide, QA exécute smoke tests.

## J. Performance & Scalabilité

Budgets:

- Homepage TTI < 2.5s (90p), ARIA JSON < 400ms p95, SSE token < 200ms premier token.
- Scénarios k6/Artillery: 100 RPS ARIA JSON, 10 parallèles SSE, 5 uploads RAG/min, 2 PDF/min.
- Critères: erreurs < 1%, p95 sous budgets.

Scaling plan:

- 2–4 replicas Next, 2 workers RAG, 1 service PDF, autoscaling selon CPU.

## K. Paiements & Crédits (cohérence robuste)

PSP & Webhooks:

- Idempotency-Key: utiliser `externalId` unique; rejouer webhook safe.
- Reçus: email via `nodemailer` + log `mail_logs`.

SQL de vérification solde:

```sql
SELECT w.id, w.userId, w.balance AS recorded,
       COALESCE(SUM(t.delta),0) AS computed,
       (w.balance - COALESCE(SUM(t.delta),0)) AS diff
FROM credit_wallets w
LEFT JOIN credit_tx t ON t.walletId = w.id
GROUP BY w.id, w.userId
HAVING (w.balance - COALESCE(SUM(t.delta),0)) <> 0;
```

Atomicité (pattern): utiliser `prisma.$transaction` pour `credit_tx.create` + `credit_wallet.update` et consigner `payment_records` dans la même transaction logique.

---

## L. Annexe — Schéma Prisma (intégral)

Le schéma canon est versionné dans `docs/db/schema.prisma.md` et reflète fidèlement `prisma/schema.prisma` actuel. Utiliser ce fichier comme source de vérité documentaire.

Chemin: `docs/db/schema.prisma.md`

## M. Audit automatisé de la base (pgTAP/SQL/SchemaCrawler)

- Dossier: `audit-db/`
- Scripts:
  - `audit-db/sql_checks.sql`: vérifications de cohérence (wallet vs transactions, unicité `(provider, externalId)`, orphelins sessions/coachs).
  - (Optionnel) pgTAP: ajoutez des tests `audit-db/tests/*.sql` si pgTAP est disponible.
  - (Optionnel) SchemaCrawler: export schéma en JSON/PlantUML.

Exécution locale:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f audit-db/sql_checks.sql
```

CI/CD (étape d’audit):

```yaml
- name: Audit DB
  env: { DATABASE_URL: ${{ secrets.DATABASE_URL }} }
  run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f audit-db/sql_checks.sql
```

## N. Index pgvector — création et maintenance

Exemple (IVFFLAT, 1536 dim, cosine):

```sql
CREATE EXTENSION IF NOT EXISTS vector;
-- Table: knowledge_assets.embedding (vector(1536))
CREATE INDEX IF NOT EXISTS idx_ka_embedding_ivfflat
ON knowledge_assets USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Alternative HNSW
CREATE INDEX IF NOT EXISTS idx_ka_embedding_hnsw
ON knowledge_assets USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 200);

-- Maintenance
ANALYZE knowledge_assets;
REINDEX INDEX CONCURRENTLY idx_ka_embedding_ivfflat; -- si nécessaire
```

Notes:

- Dimension officielle: 1536 (text-embedding-3-large).
- Métrique: cosine (vector_cosine_ops). L2: `vector_l2_ops`.
- Ajuster `lists` (IVFFLAT) aux cardinalités et SLA latence.

## O. RGPD — opérations (purge, portabilité, journalisation)

Scripts à ajouter (exemples):

```bash
# Purge PII expirées (cron/worker)
node scripts/rgpd/purge-expired.mjs

# Export portabilité utilisateur
node scripts/rgpd/export-user.mjs --user <USER_ID> --format json > export.json

# Journalisation des purges/exports via table `audit_logs`
```

Endpoints (privés/admin):

- `POST /api/admin/rgpd/export/{userId}` → génère JSON/CSV et trace dans `audit_logs`.
- `POST /api/admin/rgpd/purge` → purge sélective avec prévisualisation (dry-run) + log.

## P. Monitoring — exemples concrets

Prometheus alert rules (extrait):

```yaml
groups:
- name: nexus.rules
  rules:
  - alert: HighErrorRate
    expr: sum(rate(http_requests_total{status=~"5.."}[5m]))
          / sum(rate(http_requests_total[5m])) > 0.01
    for: 10m
    labels: { severity: page }
    annotations:
      summary: Error rate > 1%
  - alert: SlowAPIp95
    expr: histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) > 0.5
    for: 10m
    labels: { severity: ticket }
    annotations:
      summary: p95 > 500ms
```

Grafana dashboard (JSON export, placeholder): `monitoring/grafana/nexus-dashboard.json`

## Q. Sécurité opérationnelle — outillage & politique

Outillage automatisé:

- ZAP Baseline scan sur staging (`zap-baseline.py`).
- Snyk / OWASP Dependency-Check dans CI.

Rotation comptes admin:

- 90 jours, générateur mots de passe, journalisation dans `audit_logs`, désactivation comptes inactifs > 180 jours.

Plan réponse incident (checklist):

- Détection → Contention (révocation clés/tokens) → Remédiation → Postmortem.

## R. Tests de performance — k6

Exemple `performance/k6/aria_chat.js`:

```js
import http from 'k6/http';
import { Trend, check, sleep } from 'k6';

export const options = { vus: 50, duration: '2m' };
const p95 = new Trend('aria_p95');

export default function () {
  const res = http.post(`${__ENV.BASE_URL}/api/aria/chat`, JSON.stringify({ message: 'Test dérivée', subject: 'MATHEMATIQUES' }), { headers: { 'Content-Type': 'application/json' } });
  check(res, { 'status 200': r => r.status === 200 });
  p95.add(res.timings.duration);
  sleep(1);
}
```

Exécution:

```bash
BASE_URL=http://localhost:3003 k6 run performance/k6/aria_chat.js
```

## S. CI/CD étendu — audit DB, charge, rollback

Ajouter dans GitHub Actions:

```yaml
- name: Audit DB
  run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f audit-db/sql_checks.sql

- name: Load test (staging only)
  if: github.ref == 'refs/heads/staging'
  run: BASE_URL=$STAGING_URL k6 run performance/k6/aria_chat.js

- name: Rollback (manual)
  if: failure()
  run: |
    echo "Rolling back..."
    prisma migrate resolve --rolled-back <MIGRATION_NAME>
    # restauration DB selon PRA
```

## T. Rollback Prisma (exemple concret)

Exemple: une migration `20240901_add_column_xyz` a été déployée puis doit être rollback.

Étapes:

- Identifier le nom exact de la migration (dossier dans `prisma/migrations/`).
- Marquer la migration comme rollbackée:

```bash
prisma migrate resolve --rolled-back 20240901_add_column_xyz
```

- Optionnel: appliquer un SQL correctif manuel (si nécessaire):

```sql
ALTER TABLE my_table DROP COLUMN IF EXISTS xyz;
```

- Vérifier le drift:

```bash
prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma
```

## U. Journalisation sécurité — `audit_logs`

Schéma (voir `prisma/schema.prisma`):

- Table: `audit_logs`
- Colonnes:
  - `id` int PK autoincrement
  - `actor` text NOT NULL (ex: `system`, `admin:<id>`)
  - `action` text NOT NULL (ex: `RGPD_PURGE`, `RGPD_EXPORT`, `RAG_INGEST`)
  - `diff` jsonb NULL (payload contextuel)
  - `at` timestamptz DEFAULT now()

Insertion des logs:

- RGPD purge: `scripts/rgpd/purge-expired.mjs` écrit un log `RGPD_PURGE`.
- RGPD export: `scripts/rgpd/export-user.mjs` écrit un log `RGPD_EXPORT`.
- RAG upload: `app/api/rag/upload/route.ts` écrit un log `RAG_INGEST` avec latence et hash.

## V. PRA détaillé (DB + MinIO)

Checklist (qui/quoi/quand):

- Incident Manager (SRE): déclenche PRA, coordonne.
- DBA: restauration Postgres depuis dernier snapshot valide.
- Storage Owner: restauration objets MinIO du dernier point cohérent.
- CTO: go/no-go, communication, critères de validation.

Commandes (exemples):

DB (Postgres):

```bash
# Stoppe l’app, s’assure de la cohérence
psql "$DATABASE_URL" -c 'SELECT now();'
# Restaure depuis dump
pg_restore -d "$DATABASE_URL" backups/db/latest.dump
# Vérifie les index vectoriels
psql "$DATABASE_URL" -c 'ANALYZE knowledge_assets;'
```

MinIO (mc):

```bash
mc mirror backups/minio/ uploads/
```

Validation post-restauration:

- Health `/api/health` 200, pages principales OK.
- Requêtes critiques EXPLAIN ANALYZE sous budgets.
- Jobs RAG et génération PDF fonctionnels.

## W. Performance — scénarios supplémentaires

Scripts ajoutés:

- `performance/k6/rag_upload.js`: envoi multipart d’un PDF → `/api/rag/upload`.
- `performance/k6/bilan_pdf.js`: téléchargement PDF bilan `GET /api/bilans/{id}/download` (200/202).

Exécution:

```bash
BASE_URL=http://localhost:3003 SAMPLE_PDF=public/sample.pdf npm run perf:k6:rag
BASE_URL=http://localhost:3003 BILAN_ID=<id> npm run perf:k6:bilan
```

## X. Notifications RGPD & sécurité

Flux:

- Script RGPD → insertion `audit_logs` → notification Slack via `scripts/notify/slack-webhook.mjs` (si `SLACK_WEBHOOK_URL` présent).

Variables:

- `SLACK_WEBHOOK_URL` requis pour notifications.

Commandes:

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/... npm run rgpd:purge
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/... npm run rgpd:export -- --user <USER_ID>
```
