# Nexus Réussite — Pack de cadrage & enablement développeurs (v1.0)

> **But** : fournir à l’équipe toutes les aides, indications, ressources et livrables structurants pour réaliser l’extension de Nexus Réussite (multi‑agents, RAG local, freemium, dashboards Élève/Parent, candidats libres, Parcoursup & Grand Oral), avec CI/CD et E2E robustes.

---

## 0) Sommaire
1. Vue d’ensemble & objectifs
2. Architecture cible & organisation du mono‑repo
3. Standards d’ingénierie (code, revues, branches, conventions)
4. Environnements, secrets & déploiement local (docker-compose)
5. Schéma de données (PostgreSQL + pgvector) & migrations Alembic
6. RBAC & matrice des permissions
7. Contrat d’API (extraits OpenAPI — REST/GraphQL)
8. Orchestration **multi‑agents** (patron “all‑agentic”), contrats & messages
9. **RAG local** : ingestion, indexation, retrieval, évaluation
10. UX & Frontend (Next.js/React) : navigation, composants, états
11. Freemium, offres & gating technique
12. Évaluations & corrections (OCR → feedback critérié)
13. Tests : unitaires, intégration, E2E (Playwright), seeds
14. CI/CD (GitHub Actions), artefacts & qualité
15. Observabilité (logs, traces, métriques) & SLOs
16. Sécurité, RGPD & DPIA (modèle)
17. Plan de lotissement (Sprints) & **tickets prêts‑à‑créer** (Linear/Jira)
18. Risques & plans de mitigation
19. Annexes : snippets (YAML, SQL, TS/Python), checklists, modèles

---

## 1) Vue d’ensemble & objectifs
- Passer d’ARIA mono‑agent à une **architecture multi‑agents** : Supervisor + Specialist Agents (Onboarding, Curriculum‑Planner, Assessment‑Maker, OCR‑Grader, Parcoursup‑Advisor, Oral‑Coach, Scheduler, Parent‑Reporter).
- Offrir un **bilan gratuit** (obligatoire) pour créer un **profil persistant** exploité par les agents + **RAG local** (contenus internes/Eduscol/etc.).
- Déployer des **dashboards** : Élève (1re/Tle), **Candidat libre**, **Parent**, Coach, Admin.
- Gérer **Parcoursup** (jalons/actionnables) et **Grand Oral** (entraînements, grille critériée).
- Industrialiser la **qualité** : pipelines CI/CD, E2E, observabilité, conformité RGPD.

**KPIs** (MVP) : activation bilan ≥ 70 %, conversion Free→Paid ≥ 12 %, complétion jalons Parcoursup ≥ 80 %, NPS ≥ 45.

---

## 2) Architecture cible & organisation du mono‑repo
```
nexus/
  apps/
    web/             # Next.js (App Router, TS, shadcn/ui)
    api/             # FastAPI (Python 3.11), REST/GraphQL, OpenAPI
    workers/         # Jobs (OCR, ingestion RAG, emails, rapports)
  packages/
    core/            # Types Zod/TS, schémas, utils communs
    ui/              # Design system (Tailwind + shadcn/ui)
    agents/          # Orchestration, prompts, tools, policies, evals
    rag/             # Pipelines d’ingestion/index/retrieval
  infra/
    docker/          # Dockerfiles, devcontainers
    k8s/             # Charts Helm/Manifests (V2)
    gha/             # Workflows GitHub Actions
  db/
    migrations/      # Alembic (SQLAlchemy) & seeds
```
**Principes** : séparation claire apps/packages, types partagés, bus d’événements (Redis/NATS), index vectoriel (pgvector ou Qdrant), stockage blob (S3/MinIO).

---

## 3) Standards d’ingénierie
- **Branches** : `main` (protégée), `develop`, feature branches `feat/*`, `fix/*`, `chore/*`.
- **Commits** Conventional : `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`.
- **Revues** : 1 approbation minimale + status checks verts (lint, unit, e2e smoke).
- **Qualité** : ESLint + Prettier (web), ruff + black (api), mypy optionnel.
- **Sécurité** : Dependabot activé, scans SAST (CodeQL) & secret scanning.

---

## 4) Environnements & déploiement local (docker‑compose)
**Fichiers** : `.env.example` (racine + apps), `docker-compose.yml` de dev.

**Variables minimales** :
- DB : `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`.
- RAG : `VECTOR_BACKEND` (pgvector|qdrant), chemins d’ingestion.
- Bus : `REDIS_URL` ou `NATS_URL`.
- Auth : `JWT_SECRET`, `COOKIE_SECRET`.
- OCR : `TESSDATA_PREFIX`.
- Emails : `SMTP_*`.

**Snippet** (extrait) :
```yaml
version: "3.9"
services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: nexus
      POSTGRES_PASSWORD: nexus
      POSTGRES_DB: nexus
    ports: ["5432:5432"]
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "nexus"]
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: admin
      MINIO_ROOT_PASSWORD: password
    ports: ["9000:9000", "9001:9001"]
  redis:
    image: redis:7
    ports: ["6379:6379"]
  api:
    build: ./apps/api
    env_file: ./.env
    depends_on: [db]
    ports: ["8000:8000"]
  web:
    build: ./apps/web
    env_file: ./.env
    depends_on: [api]
    ports: ["3000:3000"]
  workers:
    build: ./apps/workers
    env_file: ./.env
    depends_on: [api, db, redis]
```

---

## 5) Schéma de données & migrations (PostgreSQL + pgvector)
**Tables clés** (extrait) :
- `users`(id, role: student|parent|coach|admin, email, hashed_password, locale, created_at)
- `students`(user_id FK, statut: scolarise|individuel, niveau: premiere|terminale, etab?, lva, lvb)
- `specialities`(id, code, label)
- `student_specialities`(student_id FK, speciality_id FK, year, level)
- `options` / `student_options`
- `exams`(id, type, coef, nature: ecrit|ecrit_pratique, date?, visible_for_individuel bool)
- `student_exams`(student_id, exam_id, status: planned|done|skipped, score?)
- `competences`(id, domaine, subdomain, label)
- `student_competences`(student_id, competence_id, level smallint, evidence jsonb)
- `resources`(id, type: cours|resume|exo|video, tags[], blob_url, meta jsonb)
- `plans`(id, student_id, items jsonb)
- `sessions`(id, type: visio|presentiel, coach_id, starts_at, duration, capacity, price_cents)
- `bookings`(session_id, student_id, status)
- `reports`(id, student_id, period, payload jsonb)
- `parent_links`(parent_id, student_id, permissions)
- `events`(id, student_id, kind, payload jsonb, created_at)
- `documents`(id, source, path, version, meta)
- `chunks`(id, document_id, content, embedding vector(1536), meta)

**Migrations Alembic** :
```sql
-- 001_enable_pgvector.sql
CREATE EXTENSION IF NOT EXISTS vector;

-- 002_core_tables.sql
CREATE TABLE users (
  id UUID PRIMARY KEY, email TEXT UNIQUE NOT NULL, hashed_password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','parent','coach','admin')),
  locale TEXT DEFAULT 'fr-FR', created_at TIMESTAMP NOT NULL DEFAULT now()
);
-- … autres tables …

-- 030_rag.sql
CREATE TABLE documents (
  id UUID PRIMARY KEY, source TEXT, path TEXT, version TEXT, meta JSONB
);
CREATE TABLE chunks (
  id UUID PRIMARY KEY, document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT, embedding VECTOR(1536), meta JSONB
);
CREATE INDEX idx_chunks_embedding ON chunks USING ivfflat (embedding vector_l2_ops);
```

---

## 6) RBAC & matrice des permissions (extrait)
| Ressource | Élève | Parent | Coach | Admin |
|---|---|---|---|---|
| Profil élève | R/W (self) | R (enfant) | R/W (élèves affectés) | R/W (tous) |
| Plans révision | R/W (self) | R | R/W (affectés) | R/W |
| Évaluations | R/W (self) | R | R/W (affectés) | R/W |
| Rapports | R (self) | R | R/W (affectés) | R/W |
| Sessions | R/W (réservation) | R | R/W (création) | R/W |
| Admin (pricing, contenus) | – | – | – | R/W |
**Implémentation** : policy-as-code (OPA/Cedar) ou middleware FastAPI + décorateurs @requires(role|scope).

---

## 7) Contrat d’API (extraits OpenAPI)
```yaml
openapi: 3.1.0
info: { title: Nexus API, version: 1.0.0 }
paths:
  /onboarding/bilan:
    post:
      summary: Enregistre le bilan gratuit et met à jour le profil
      requestBody: { $ref: '#/components/schemas/BilanInput' }
      responses:
        '200': { $ref: '#/components/schemas/ProfilEleve' }
  /parcours/epreuves:
    get:
      summary: Liste des épreuves personnalisées
      parameters:
        - in: query; name: student_id; required: true; schema: { type: string }
      responses:
        '200': { description: OK }
  /rag/search:
    get:
      parameters:
        - in: query; name: q; schema: { type: string }
        - in: query; name: filters; schema: { type: string }
      responses: { '200': { description: OK } }
```

---

## 8) Multi‑agents : design, contrats & messages
**Topologie (MVP)** :
- **Supervisor** : reçoit un objectif (ex. « produire plan de révision 14 j »), planifie, route, agrège.
- **Agents Spécialistes** : Onboarding‑Agent, Curriculum‑Planner, Assessment‑Maker, OCR‑Grader, Parcoursup‑Advisor, Oral‑Coach, Scheduler, Parent‑Reporter.
- **Blackboard** : état partagé (profil, calendrier, compétences, historiques).
- **Event Bus** : Redis Streams/NATS.

**Contrat d’agent (Python)** :
```python
class AgentRequest(TypedDict):
  goal: str
  context: dict
  student_id: str
class AgentResponse(TypedDict):
  ok: bool
  data: dict
  citations: list[str]
  warnings: list[str]

class BaseAgent(Protocol):
  name: str
  def handle(self, req: AgentRequest) -> AgentResponse: ...
```

**Topics d’événements (NATS)** :
- `student.bilan.completed`, `plan.generated`, `exam.graded`, `parcoursup.deadline.near`, `oral.session.recorded`.

**Politiques** :
- RAG prioritaire, refus gracieux si pas de source fiable.
- Rate‑limit par user/agent, logs signés (audit).

---

## 9) RAG local : ingestion → indexation → retrieval → génération
**Pipeline** :
1) **Ingestion** : PDF/Doc/MD → extraction (pymupdf/pdfminer) → normalisation → chunking sémantique (400–800 tokens, overlap 10–20 %).
2) **Embeddings** : bge‑m3 / mxbai‑large (configurable) → stockage `chunks(embedding)`.
3) **Index** : pgvector (IVFFLAT) ou Qdrant ; hybrid BM25+vector + reranking (e5/flashrank).
4) **Retrieval** : filtres (matière, niveau, spécialité, statut scolarisé/individuel).
5) **Génération** : citations obligatoires + passages.
6) **Évaluation** : Faithfulness, Answer Correctness, Context Recall (jeu « golden »).

**CLI** :
```bash
# Ingestion d’un dossier
python -m packages.rag.cli ingest ./corpus/NSI --source "interne" --tags NSI
# Recherche locale
python -m packages.rag.cli search --q "Récurrence et invariants" --filters "matiere:NSI"
```

---

## 10) UX & Frontend (Next.js)
**Navigation (onglets Élève)** :
- **Parcours & Épreuves** | **Révisions** | **Parcoursup** (Tle) | **Grand Oral** (Tle) | **Évaluations** | **Ressources** | **Agenda**

**États** :
- **Scolarisé** vs **Individuel** : masquage des pratiques si non prévues, remplacement CC par évaluations ponctuelles.
- **Niveau** (1re/Tle) : affichage EAF (Français/Maths), EDS, Philosophie, Grand Oral, Parcoursup.

**Composants clés** :
- `ExamCalendar`, `PlanBoard`, `RagSearch`, `OralCoach`, `ParcoursupChecklist`, `FreeTierWall`, `ParentSnapshot`.

---

## 11) Freemium & gating technique
- **Free** : bilan, calendrier épreuves, plan 7 jours, 1 oral blanc démo (5 min), rapport parent de bienvenue.
- **Essentiel/Premium/Pro** : paliers de quantité (plans illimités, corrections/mois, oraux illimités, sessions groupe, priorité coach).

**Implémentation** :
- Table `entitlements(user_id, plan, quotas jsonb, renew_at)` ; middleware gating (ex. `requiresEntitlement('oral.coach', 1)`), compteurs journaux.

---

## 12) Évaluations & corrections (OCR)
- **Upload** PDF/scan → OCR (Tesseract + layout) → mapping barème → feedback critérié → stockage `reports`.
- **Formats** : rubric JSON (critères, points, exemples) ; export PDF pour parents.

---

## 13) Tests
- **Unit** : web (vitest), api (pytest), agents (doctests + golden prompts).
- **Intégration** : API + DB + RAG (moteurs en mémoire ou conteneurs de test).
- **E2E** : Playwright (scénarios clés : onboarding, bilan, plan, réservation, rapport parent).
- **Seeds** : `db/seeds/*` (1 élève 1re scolarisé, 1 élève Tle individuel, jeux RAG minimaux).

---

## 14) CI/CD (GitHub Actions)
**Workflows** :
- `ci.yml` : lint, unit, build.
- `e2e.yml` : spin up stack (db/minio/redis/api/web) + Playwright headless, artefacts (vidéo/trace).
- `deploy.yml` : build images → GHCR → déploiement (Swarm/K8s V2).

**Gates** : tous verts pour merge `main`.

---

## 15) Observabilité & SLOs
- **Logs** : JSON structuré (pydantic logging), corrélation `trace_id`.
- **Metrics** : Prometheus (API p95 < 250 ms sur endpoints lecture, E2E succès > 98 %).
- **Traces** : OpenTelemetry (agents + RAG + API) → Jaeger/Tempo.
- **Alertes** : erreurs 5xx, temps réponse, quota OCR saturé, index RAG désynchronisé.

---

## 16) Sécurité, RGPD & DPIA (modèle)
- **PII** chiffrées (pgcrypto/fernet), rotation, « need‑to‑know ».
- **Consentement** : profilage pédagogique, copies, partage parent → journalisé.
- **DSR** : export/effacement (endpoint + job asynchrone).
- **Registre** des traitements & **DPIA** (modèle fourni en annexe).

---

## 17) Plan de lotissement & tickets (prêts à coller dans Linear/Jira)

### Sprint 1 — Onboarding & Bilan
- **EPIC**: ONB‑01 Onboarding & Bilan gratuit
  - US‑ONB‑001: Formulaire Onboarding (statut/niveau/EDS/options/LV) → POST `/onboarding/bilan` **AC**: profil créé, validations field‑level
  - US‑ONB‑002: Seed DB (élève 1re scolarisé, Tle individuel) **AC**: scripts seeds idempotents
  - US‑ONB‑003: Plan 7 jours (Curriculum‑Planner v0) **AC**: JSON plan avec 7 items, filtres profil
  - US‑ONB‑004: UI état **individuel** (masquage pratiques) **AC**: tests E2E

### Sprint 2 — Parcours & Révisions, RAG minimal
- **EPIC**: CUR‑01 Parcours & Plan
  - US‑CUR‑101: Calendrier épreuves perso **AC**: coeffs visibles, jalons triés
  - US‑CUR‑102: RAG minimal (ingestion + search) **AC**: citations renvoyées
  - US‑CUR‑103: Plan pondéré 14 jours **AC**: pondération coef×deadline×fragilités

### Sprint 3 — Parcoursup & Grand Oral
- **EPIC**: ORI‑01 Parcoursup
  - US‑ORI‑201: Checklist jalons + notifications **AC**: to‑dos datées, E2E
- **EPIC**: ORA‑01 Grand Oral
  - US‑ORA‑251: Entraînement 5/20 min + grille **AC**: export PDF rapport

### Sprint 4 — OCR‑Grader, Sessions & Paiements, Rapports Parent
- **EPIC**: EVA‑01 OCR‑Grader v1
  - US‑EVA‑301: Upload PDF → feedback critérié **AC**: rubric JSON, score
- **EPIC**: SESS‑01 Réservations
  - US‑SESS‑351: Booking visio/présentiel **AC**: quota freemium appliqué
- **EPIC**: PAR‑01 Rapport Parent mensuel **AC**: HTML + PDF stocké, email émis

**Definition of Done (DoD)** : unit tests verts, E2E clé, logs propres, docs mise à jour, RBAC vérifié.

---

## 18) Risques & mitigation
- **Données pédagogiques hétérogènes** → pipeline d’ingestion canonique + normalisation + versioning.
- **Hallucinations** → RAG strict + refus gracieux + tests faithfulness.
- **Complexité multi‑agents** → MVP 4 agents, instrumentation, ADRs.
- **Surcharge support** → FAQ génératives + macros coachs + limites quotas.
- **RGPD** → DPIA, registres, DSR automatisés.

---

## 19) Annexes — Snippets & modèles

### 19.1. Alembic (enable pgvector)
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 19.2. FastAPI — squelette route bilan
```python
@router.post("/onboarding/bilan")
async def post_bilan(input: BilanInput, user=Depends(auth)):
    profil = upsert_profil(user.id, input)
    plan = curriculum_planner.generate(profil, horizon_days=7)
    return {"profil": profil, "plan": plan}
```

### 19.3. Playwright — E2E onboarding (extrait)
```ts
test('onboarding creates profile and shows 7-day plan', async ({ page }) => {
  await page.goto('/onboarding');
  await page.selectOption('#statut', 'scolarise');
  await page.selectOption('#niveau', 'premiere');
  await page.click('text=Continuer');
  await expect(page.getByText('Votre plan 7 jours')).toBeVisible();
});
```

### 19.4. Event schema (NATS)
```json
{
  "event": "plan.generated",
  "student_id": "uuid",
  "payload": { "items": [ {"title": "TD Intégrales", "due": "2025-11-08"} ] },
  "ts": "2025-11-01T18:00:00Z"
}
```

### 19.5. Prompt template (Curriculum‑Planner)
```
SYSTEM: Tu es un planificateur pédagogique du Bac (1re/Tle). Utilise UNIQUEMENT le contexte cité.
USER CONTEXT: {profil_json}
RETRIEVED CONTEXT: {citations}
TASK: Propose un plan sur {horizon} jours pondéré par coefficients et échéances.
POLICY: Si une info manque, proposer une hypothèse et la marquer « à confirmer ».
```

### 19.6. DPIA — plan (tête de chapitre)
1. Description des traitements  
2. Analyse de nécessité & proportionnalité  
3. Risques pour les droits & libertés  
4. Mesures (techniques & orga)  
5. Avis DPO & décisions

---

## Checklists livraison
- [ ] RBAC complet et tests d’accès
- [ ] Seeds min. (élève 1re scolarisé, Tle individuel)
- [ ] RAG ingest + search + citations
- [ ] Plan 7/14 jours généré et persistant
- [ ] UI Candidat libre (masquage pratiques, évaluations ponctuelles)
- [ ] Parcoursup checklists + notifications
- [ ] Grand Oral (timer + grille + export PDF)
- [ ] OCR‑Grader V1 opérationnel
- [ ] Parent report mensuel
- [ ] CI/CD verts (unit + e2e), artefacts vidéo/trace
- [ ] Observabilité (traces agents, métriques API)
- [ ] DPIA rédigée, consentements journalisés
```


---

# Annexe — Délivrables techniques ajoutés (v1.1)

## A. Schémas DB détaillés (SQLAlchemy) & migrations Alembic
- **Modèles** : `apps/api/app/models/*.py` (users, students, specialities, student_specialities, options, student_options, exams, student_exams, competences, student_competences, resources, plans, sessions, bookings, reports, events, entitlements, documents, chunks_meta).
- **Migration initiale** : `db/migrations/versions/001_init_core.py` (création des tables + `CREATE EXTENSION vector;` + table `chunks` avec `VECTOR(1536)` et index `ivfflat`).
- **Connexion SQLAlchemy** : `apps/api/app/db/session.py` (via `DATABASE_URL`).

## B. OpenAPI exhaustif (MVP)
- **Fichier** : `openapi.yaml` (racine). Couvre `health`, `onboarding/bilan`, `parcours/epreuves`, `plan/generate`, `eval/generate`, `eval/grade`, `rag/search`, `parent/report`, `sessions/book`.
- **Routers** squelettes : `apps/api/app/routers/*.py` (points d’entrée prêts à compléter).

## C. Scaffold de dépôt (prêt à pousser)
- **Arborescence** : voir `tree.txt` à la racine.
- **Docker** : `infra/docker/Dockerfile.api`, `docker-compose.yml` (Postgres+pgvector, MinIO, Redis, API FastAPI).
- **Démarrage** : README.md (venv, install, migration `alembic upgrade head`, run `uvicorn`).

## D. Tickets Linear/Jira (CSV)
- **Fichier** : `tickets_linear_jira.csv` (prêt à l’import). Colonnes : Title, Description, Priority, Labels, Assignee, Sprint, Epic, Type, DueDate.
- **Sprints** : S1 (Onboarding & Plan), S2 (Parcours & RAG minimal), S3 (Parcoursup & Grand Oral), S4 (OCR‑Grader, Sessions, Rapport Parent), plus QA/CI/RGPD.

> Remarque : ce pack s’aligne sur le cadrage précédent. Toute extension (ex. `parcoursup_jalons`, `oral_sessions`) doit faire l’objet d’une **ADR** et d’une migration versionnée.

