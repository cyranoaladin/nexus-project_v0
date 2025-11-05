<!-- PROJECT LOGO & BADGES -->
<p align="center">
  <img src="https://nexusreussite.academy/logo.png" alt="Nexus Réussite Logo" width="120" />
</p>

<h1 align="center">Nexus Réussite</h1>

<p align="center">
  <b>Plateforme tout-en-un de soutien scolaire, IA multi-agents, dashboard Next.js, API
- Proposer une expérience premium et sans friction pour l'élève ainsi que pour les parents, coachs et assistantes Nexus.
- Garantir qu'aucune fonctionnalité décrite dans la feuille de route ne reste théorique : tout flux documenté doit être implémenté et testable.
- Offrir une architecture modulaire capable d'orchestrer des agents IA tout en respectant les contraintes RGPD et pédagogiques de l'AEFE.

> Les documents contenus dans `feuille_route/` (cahier des charges, logique métier, design system, specs par rôle) constituent la source de vérité produit. Assurez-vous de les lire avant de contribuer.

---

## Architecture en un coup d'œil
- **Frontend** (`app/`, `components/`, `lib/`) : Next.js 14 (App Router), React 18, TypeScript 5, Tailwind CSS 4, Redux Toolkit, Radix UI, Framer Motion, NextAuth pour l'auth.
- **API métier** (`apps/api/apps/api`) : FastAPI 0.115, SQLAlchemy 2, Alembic, psycopg 3. Sert les dashboards et gère les workflows (sessions, bilans, paiements, analytics).
- **Orchestration multi-agents ARIA** (`services/aria`) : FastAPI + orchestrateur maison (graph orienté étapes) qui enchaîne diagnostic → plan → requêtes RAG → grading → notifications. Agents et outils versionnés dans le repo.
- **Base de données principale** : PostgreSQL via Prisma (`prisma/schema.prisma`).
- **RAG** : Qdrant 1.11 (vector store), Sentence Transformers (`BAAI/bge-m3`, reranker `BAAI/bge-reranker-base`), corpus Markdown versionné dans `services/aria/corpus`.
- **Infra locale** : Docker Compose (front, API, PostgreSQL, services ARIA). Production ciblée : VPS + Nginx + Certbot (`Guide_deploiement*.md`).

---

## Multi-agents ARIA en détail
- **Emplacement dans le repo** : tout le service vit dans `services/aria/`. Cela inclut l'API FastAPI (`services/aria/api`), l'orchestrateur (`services/aria/orchestrator`), les agents (`services/aria/agents`), les politiques pédagogiques (`services/aria/policies`) et les connecteurs mémoire/RAG (`services/aria/memory`, `services/aria/tools`).
- **Orchestrateur** : `orchestrator/graph.py` définit le graphe de transitions (`START → DIAG → PLAN → RAG → GRADE → END`). `orchestrator/router.py` itère sur ce graphe et invoque chaque agent asynchrone en lui passant un contexte partagé (`ctx`). Aucun appel manuel côté élève : l'orchestrateur déroule la session de bout en bout dès qu'un endpoint ARIA est invoqué.
- **Agents** :
	- `agents/diagnostic/agent.py` : prépare le profil initial et les objectifs (à enrichir avec données réelles).
	- `agents/planner/agent.py` : construit le plan de travail (slots, checkpoints) à partir du diagnostic.
	- `agents/rag_client/agent.py` : interroge Qdrant via `tools/rag_client.py` et agrège les documents pédagogiques.
	- `agents/grader/agent.py` : applique les barèmes YAML (`policies/pedagogy/*.yml`) pour scorer et générer feedback/remédiations.
	- `agents/notify/agent.py` & `tools/notify.py` : préparent les notifications vers les dashboards (email, feed interne).
	- D'autres outils (ex. `tools/latex.py`, `tools/code_runner.py`) sont branchables selon le graphe.
- **Injection dans FastAPI** : `api/deps.py` construit l'orchestrateur à partir d'un mapping `{Node: agent_callable}`. Les endpoints (`api/main.py`) utilisent `Depends(get_orchestrator)` pour reconstituer l'orchestrateur à chaque requête API.
- **Flux d'exécution** :
	1. Le frontend appelle `POST /sessions/run` (ou un endpoint spécialisé `POST /diagnostics`, `POST /plans`, `POST /grade` pour un test unitaire).
	2. `require_scopes` valide le JWT ARIA (scopes `aria.sessions:run`, `aria.diagnostics:*`, etc.).
	3. L'orchestrateur traverse le graphe. Chaque agent enrichit `ctx` (`ctx["diagnostic"]`, `ctx["plan"]`, `ctx["rag_results"]`, `ctx["correction"]`).
	4. Le résultat complet est renvoyé au frontend qui l'affiche dans le dashboard élève/coach sans intervention manuelle.
- **Abonnement ARIA** : déclenché côté backend lors des événements pédagogiques (ex. création diagnostic, demande de correction). `app/api/aria/*` expose les routes Next.js qui assurent la passerelle entre le frontend et le service ARIA (via fetch sur `http://aria-api:8088`). L'adhésion d'un élève au service s'appuie sur la table `Subscription` (Prisma) ainsi que sur les champs `student.ariaStatus`, `student.ariaSubjects` et les compteurs freemium. Quand `ariaStatus` vaut `ACTIVE` ou `FREEMIUM` avec quota disponible, le backend autorise les appels aux endpoints ARIA avec les scopes nécessaires.

---

## Workflows de navigation & pipelines agents
- **Parcours standard élève** :
	1. Inscription / Onboarding (`/dashboard/eleve/onboarding`) → collecte d'informations, consentements RGPD.
	2. Diagnostic initial → bouton "Lancer le diagnostic" déclenche `POST /api/aria/diagnostic`, qui appelle `POST /sessions/run` et récupère `ctx["diagnostic"]` + `ctx["rag_results"]`.
	3. Génération auto du plan (`ctx["plan"]`) puis affichage dans `DashboardPlan` (composants `components/dashboard/eleve/plan`).
	4. Pendant les séances, l'élève soumet ses travaux → `POST /api/aria/grade` produit la correction et les recommandations.
	5. Bilan périodique : `ctx["correction"]` et les historiques Prisma alimentent les vues `/dashboard/eleve/bilans` et `/dashboard/parent`.
- **Pipelines techniques** :
	- Frontend `app/api/aria/*.ts` → API Next.js → fetch vers ARIA (HTTP, JSON).
	- ARIA agents → Qdrant (`memory/qdrant.py`), Redis (`memory/redis_kv.py`) pour traces, Mongo (`memory/mongo.py`) pour journaux longue durée, MinIO/S3 (`memory/s3.py`) pour pièces jointes.
	- Résultats persistés par l'API principale dans PostgreSQL (tables `Diagnostics`, `StudyPlans`, `Corrections`).
- **Automatisation** : l'orchestrateur ne nécessite aucune action côté utilisateur une fois la requête initiale envoyée. Des jobs CRON (`scripts/`) peuvent relancer des sessions (ex. bilans hebdomadaires) via les tokens de service.

---

## Intégration RAG & domaines
- **Connexion actuelle** : `services/aria/scripts/ingest.py` et `tools/rag_client.py` pointent vers `QDRANT_URL` (par défaut `http://qdrant:6333`, le conteneur interne). Sur un VPS, on peut définir `QDRANT_URL=https://rag.nexusreussite.academy` si un cluster Qdrant externe est déjà déployé.
- **rag.nexusreussite.academy** :
	- Si un endpoint Qdrant public existe (hébergé ailleurs), il suffit d'exporter `QDRANT_URL` en conséquence. Aucun changement de code n'est requis car l'agent RAG utilise l'URL fournie.
	- Si le VPS dispose d'un Qdrant interne (via docker-compose), le sous-domaine peut être ignoré. L'URL interne (docker network) reste valide.
	- Recommandation audit : garder le sous-domaine si l'équipe souhaite mutualiser le RAG avec d'autres services. Sinon, documenter explicitement que le RAG tourne dans le compose ARIA.
- **Cycle d'ingestion** :
	1. Déposer les Markdown pédago dans `services/aria/corpus` (ou synchroniser depuis Google Drive).
	2. Lancer `make ingest` → embeddings `BAAI/bge-m3` → appel `client.upsert()` dans Qdrant (collection `aria_rag`).
	3. Les agents RAG interrogent la collection via vecteurs normalisés (cosine) et renvoient titres, texte, métadonnées.
- **Sécurité** : prévoir un API key Qdrant si exposé publiquement (variable `QDRANT_API_KEY` à ajouter). Actuellement non implémenté.

---

## Dashboards & rôles utilisateur
- **Rôles** (`types/enums.ts`) :
	- `ELEVE` : accès au plan personnel, bilans, messages, soumission exercices.
	- `PARENT` : suivi bilans, facturation, demandes de séances.
	- `COACH` : pilotage élèves assignés, corrections, planification séances.
	- `ASSISTANTE` : support administratif, matchings coach/élève, validation paiements.
	- `ADMIN` : supervision globale, analytics, gestion contenus.
- **Dashboards Next.js** :
	- `/dashboard/eleve` : widgets progression, plan, messages ARIA.
	- `/dashboard/parent` : suivi multi-enfants, factures, alertes.
	- `/dashboard/coach` : pipeline séances, corrections ARIA, tâches.
	- `/dashboard/assistante` : CRM interne, assignations, back-office Konnect.
	- `/dashboard/admin` : analytics (Prisma, `app/api/admin/*`), gestion utilisateurs.
- **Protection des routes** : `middleware.ts` applique un contrôle d'accès NextAuth JWT et redirige selon le rôle.
- **Comptes démo** : seeds Prisma créent `student@test.local`, `parent@test.local`, `coach@test.local`, etc. (mot de passe `password`).

---

## Données, historique & persistance
- **Prisma / PostgreSQL** :
	- `User` (avec `role`, `password hashed`, `parentProfile`, `studentProfile`, `coachProfile`).
	- `StudentProfile` : préférences, historique diagnostic.
	- `Student` : suit `ariaStatus`, les matières activées (`ariaSubjects`) et les quotas freemium ARIA.
	- `Diagnostic`, `StudyPlan`, `Session`, `Correction`, `Message`, `Payment`, `Subscription` pour tracer toute l'activité.
	- `mv_dashboard_summary` : vue matérialisée pour statistiques (refresh via script mentionné dans `apps/api/README.md`).
- **Historique élève** : chaque diagnostic/plan/correction est lié à `studentId` et versionné (timestamps). Les bilans se construisent via agrégation Prisma + `ctx["correction"]` renvoyé par ARIA.
- **Logs agents** :
	- Court terme : Redis (clé `aria:session:<id>`).
	- Long terme : Mongo (journal complet si `MONGO_URI` configuré) + MinIO pour artefacts (copies exercices, documents générés).
- **Synchronisation Drive** : non automatisée mais prévue via scripts ingestion → alignement avec `docs/` et `feuille_route/`.

---

## Navigation produit & abonnements ARIA
- **Activation ARIA** :
	- Événement "abonnement" côté parent/assistante → table `Subscription` (`ACTIVE`, `INACTIVE`).
	- Lorsqu'une souscription passe à `ACTIVE`, un hook backend active `student.ariaStatus=ACTIVE`, provisionne les matières ARIA par défaut et remet à zéro les compteurs freemium. Le dashboard élève débloque alors immédiatement les CTA ARIA.
	- Sans abonnement, l'élève peut déclencher `POST /api/aria/freemium` pour activer un essai limité en tokens/matières (`ariaStatus=FREEMIUM`).
- **Workflow hebdomadaire** :
	1. Lundi : ARIA propose un plan actualisé (CRON → `POST /sessions/run`).
	2. Pendant la semaine : l'élève soumet exercices → ARIA grade → corrections stockées + notifications.
	3. Dimanche : bilan parent/coach généré automatiquement et accessible dans les dashboards.
- **Monitoring** : prévoir tableaux de bord (ex. Grafana/Metabase) branchés sur PostgreSQL et Qdrant pour suivre le volume de sessions ARIA, latences, taux de réussite.

---

---

## Structure du dépôt (extrait)
- `app/` : routes Next.js (App Router), API routes, layout, instrumentation Sentry.
- `components/` : bibliothèque UI, formulaires, widgets du dashboard.
- `lib/` : helpers (auth NextAuth, accès Prisma, utils formatting).
- `prisma/` : schéma, seeds (`prisma/seed.ts`).
- `apps/api/` : backend FastAPI (requirements Python, infra dédiée, openapi.yaml).
- `services/aria/` : service agents (API FastAPI, orchestrateur, agents, policies, scripts ingestion, docker-compose dédié).
- `docs/` : runbooks déploiement, observabilité, sécurité, etc.
- `scripts/` : déploiement, maintenance, RGPD, cron emails.
- `feuille_route/` : référentiel produit/design/business.

---

## Mise en route rapide

### Prérequis
- Docker Desktop ou équivalent.
- Node.js 20+, npm ou pnpm.
- Python 3.11 (pour l'API FastAPI et ARIA) si lancement hors Docker.

### Initialiser l'application Next.js + API principale
```bash
cp env.example .env.local
npm install
docker compose up postgres-db -d          # optionnel : base via compose
npx prisma migrate dev
npx prisma db seed
npm run dev:all                           # lance Next.js (3000) + FastAPI (8000)
```

### Service multi-agents ARIA
```bash
cd services/aria
cp .env .env.local                        # adapter secrets avant commit
make build                                # construit l'image + deps IA
make up                                   # démarre API (8088) + Mongo/Qdrant/Redis/MinIO
make ingest                               # ingère le corpus Markdown dans Qdrant
```

> Les scripts `make` s'appuient sur `infra/docker-compose.yml`. Les variables `MONGO_URI`, `QDRANT_URL`, `REDIS_URL` et credentials MinIO doivent être définies (voir `.env`).

---

## Variables d'environnement clés
| Domaine | Variables | Description |
| --- | --- | --- |
| Base de données | `DATABASE_URL`, `SHADOW_DATABASE_URL`, `POSTGRES_*` | Connexion PostgreSQL pour Prisma et migrations.
| Auth | `NEXTAUTH_URL`, `NEXTAUTH_SECRET` | Configuration NextAuth JWT (doit faire ≥32 caractères en prod).
| IA / OpenAI | `OPENAI_API_KEY`, `OPENAI_MODEL` | Appels orchestrateur/assistants.
| Paiements | `KONNECT_API_KEY`, `KONNECT_WALLET_ID`, `KONNECT_WEBHOOK_SECRET`, `NEXT_PUBLIC_WISE_*` | Flux Konnect + virement manuel.
| Notifications | `SMTP_*` | Envoi d'emails transactionnels.
| ARIA | `ARIA_JWT_SECRET`, `ARIA_ALLOWED_AUDIENCE`, `MONGO_URI`, `QDRANT_URL`, `REDIS_URL`, `S3_*`, `EMB_MODEL`, `ARIA_FREEMIUM_SUBJECTS`, `ARIA_FREEMIUM_TOKENS`, `ARIA_FREEMIUM_DURATION_DAYS` | Auth multi-agents, stores vecteurs & artefacts, configuration freemium.
| Observabilité | `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE` | Activation Sentry (optionnel).

> Les secrets présents par défaut dans `services/aria/.env` sont destinés au développement et doivent être remplacés avant toute mise en ligne.

---

## Tests & qualité
- **Unitaires / intégration (Next.js)** : `npm test`, `npm run test:unit`, `npm run test:integration`.
- **E2E (Playwright)** : `npx playwright test --project=dashboard-rag` (voir `playwright/`).
- **API FastAPI** : scénarios dans `apps/api/tests` (Pytest via `apps/api/.venv/bin/pytest`).
- **ARIA** : tests de schéma dans `services/aria/tests/`. Ajoutez des tests d'agents avant toute évolution majeure.
- **Lint** : `npm run lint` (Next.js/ESLint), formatters Python via `ruff` (à intégrer).

CI GitHub Actions (`.github/workflows/`) : pipeline Playwright, lint/tests prévus pour la branche `main`. Compléter avec scans de sécurité (`npm audit`, Bandit) et build ARIA.

---

## Orchestration ARIA & RAG
- Graphe d'exécution : `start → diagnostic → planner → rag → grader → end` (`services/aria/orchestrator/graph.py`).
- Agents : implémentations dans `services/aria/agents/**` (diagnostic, planner, rag_client, grader, notify, latex, code_runner).
- Politiques pédagogiques : YAML sous `services/aria/policies/pedagogy/` (rubriques, remédiations). Loader dans `policies/loader.py`.
- Mémoire : connecteurs optionnels `memory/mongo.py`, `memory/qdrant.py`, `memory/redis_kv.py`, `memory/s3.py` (boto3/MinIO).
- Ingestion : `services/aria/scripts/ingest.py` découpe les Markdown (800 tokens, overlap 120) et alimente Qdrant.
- Auth : tokens porteurs de scopes `aria.*` validés via `services/aria/api/auth.py` (HS256 par défaut, audience/issuer configurables).

---

## Observabilité, sécurité & conformité
- Tracking Sentry côté frontend (opt-in via `instrumentation.ts`) et logs JSON côté API.
- Middleware NextAuth protège `/dashboard/*` et redirige selon le rôle (`ELEVE`, `PARENT`, `COACH`, `ASSISTANTE`, `ADMIN`).
- Guide sécurité et RGPD : consulter `docs/SECURITY.md`, `docs/observabilité.md`, `scripts/rgpd/delete-user-data.sh`.
- Nginx (prod) : configuration `config/nginx.conf` : HSTS, CSP, Brotli, page maintenance (`maintenance/`).
- Webhook Konnect signé HMAC (`scripts/deploy/test-konnect-webhook.sh`).

---

## Ressources complémentaires
- `README_AUDIT.md` : synthèse pour auditeurs externes (périmètre, stack, RBAC, risques, priorités).
- `docs/` : checklists déploiement, opérations VPS, instrumentation.
- `workspace-agents/` : laboratoires RAG/agents (Jupyter) lorsqu'on travaille sur l'architecture multi-agents.

Pour toute contribution, ouvrez une pull request détaillée, ajoutez les tests nécessaires et mettez à jour la documentation impactée. Construisons ensemble une plateforme dont nous serons fiers.
