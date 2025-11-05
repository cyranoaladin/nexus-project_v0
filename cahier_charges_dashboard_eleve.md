Voici un récapitulatif **structuré et exhaustif** de ce qui est déjà couvert (frontend, backend, DB, API, agents) ainsi que les **exigences d’implémentation précises** du “Dashboard Élève”. J’ajoute aussi un **complément de spécification** focalisé “Dashboard” (routes, composants, contrats d’API, tables clés, événements, tests, critères d’acceptation) afin de pouvoir avancer sans ambiguïté.

---

# 1) Ce qui est déjà cadré (et où)

* **Cohabitation Next (App Router) + FastAPI**
  – Rewrites `/pyapi/*` → `http://localhost:8000/*`, CORS côté FastAPI, scripts `npm` (dev:web, dev:api, dev:all), compose dev (db/redis/minio/api).
  – Objectif : UI et auth (Prisma/NextAuth) restent côté Next ; **toutes les tables FastAPI** vivent dans le **schéma Postgres `nexus_app`** (migrations Alembic configurées, version table dans `nexus_app`).
* **Socle API** (routers) : `health`, `onboarding` (bilan gratuit), `parcours` (épreuves), `plan`, `eval` (génération/correction), `rag`, `parent`, `sessions`.
* **Schéma de données** : entités élèves/parents, parcours, sessions, plans, évaluations, ressources (RAG), habilitations (entitlements), rapports/coachs, événements (journalisation).
* **Pipeline agents** (ARIA → multi-agents) : orchestrateur, retrieveur RAG, planificateur pédagogique, générateur d’évaluations, correcteur/lecteur de PDF, coach/synthétiseur, reporter parents.
* **Qualité & intégration** : smoke tests, ADR (coexistence), scripts npm, CI/CD modulaire (Node+Python+E2E compose – prévu).

Pour **concrétiser** le Dashboard, je détaille ci-dessous la **spécification ciblée** que vous pouvez verser telle quelle au dépôt (section 7 : tickets prêts).

---

# 2) Frontend (Next.js, App Router, npm)

## 2.1. Arborescence des routes (App Router)

```
app/
└─ (dashboard)/
   ├─ layout.tsx                 // layout général (Providers, theming, auth)
   ├─ dashboard/
   │  ├─ page.tsx                // vue synthèse : progression + agenda + tâches
   │  ├─ cours/page.tsx          // contenus/syllabus + résumés + RAG
   │  ├─ agenda/page.tsx         // sessions à venir, réservations, ICS export
   │  ├─ epreuves/page.tsx       // plan d’épreuves (Première/Terminale)
   │  ├─ evaluations/page.tsx    // banque d’évals, copies, corrections
   │  ├─ grand-oral/page.tsx     // préparation & jalons (Terminale)
   │  ├─ parcoursup/page.tsx     // checklist & échéances (Terminale)
   │  └─ ressources/page.tsx     // bibliothèque & favoris (RAG)
   └─ api/                       // (facultatif) handlers server-only si besoin
```

## 2.2. Composants UI (shadcn/ui + Tailwind)

* `components/dashboard/ProgressRadial.tsx` : % de couverture par matière / spécialité.
* `components/dashboard/KGCanvas.tsx` : graphe de connaissances (si 3D/Three.js souhaité).
* `components/dashboard/AgendaCard.tsx` : prochains cours/sessions.
* `components/dashboard/EpreuvesRoadmap.tsx` : frise des épreuves (anticipées / finales).
* `components/dashboard/TaskList.tsx` : tâches agent-driven (révisions, devoirs, rdv).
* `components/rag/DocHit.tsx`, `SearchBox.tsx` : recherche et affichage hits RAG.
* `components/eval/UploadCopy.tsx` : dépôt de copie (PDF/JPG), OCR auto, feedback.
* `components/common/RoleBadge.tsx` : badge “scolarisé / candidat libre” (affine le contenu).

**État & data-fetching** :

* **Server Components/Actions** privilégiées pour les vues agrégées.
* **Client** : React Query (optionnel) pour interactions (réservations, corrections).
* Toute data passe par `/pyapi/*` (rewrite) → **pas de CORS** en dev.

## 2.3. Sécurité (frontend)

* NextAuth continue (session côté Next).
* Appels `/pyapi` accompagnés d’un **JWT** court-vécu (minté par Next) ou d’un **header de session signé** (selon votre choix d’intégration côté FastAPI).
* **RBAC** côté UI : griser/masquer les onglets non pertinents (p.ex. “Grand Oral” si Première).

---

# 3) API FastAPI (contrats indispensables)

## 3.1. Routes “Dashboard”

* `GET /dashboard/summary?student_id=` → KPIs, progression, 7 prochains événements (agenda/sessions), 5 tâches priorisées.
* `GET /dashboard/agenda?student_id=&from=&to=` → sessions Confirmées/En attente/Proposées.
* `GET /dashboard/progression?student_id=&subject=` → granularité chapitre/compétence.
* `GET /dashboard/epreuves?student_id=` → plan personnalisé (Première/Terminale, scolarisé vs libre).
* `POST /dashboard/tasks/complete` `{task_id}` → marquer terminé (alimentation du graphe).
* **RAG** : `GET /rag/search?q=&filters=` ; `GET /rag/doc/{id}`.
* **Évaluations** :

  * `POST /eval/generate` `{subject, level, duration, constraints}` → sujet.
  * `POST /eval/grade` `{eval_id, file(s)}` → note + feedback + compétences.
* **Sessions** : `POST /sessions/book` `{type, slot, modality}` → réservation; `GET /sessions/list`.
* **Parents** : `GET /parent/report?student_id=&period=` → synthèse.

## 3.2. Extraits OpenAPI (types) — **à implémenter tel quel**

```yaml
# /dashboard/summary
200:
  application/json:
    schema:
      type: object
      properties:
        kpis:
          type: object
          properties:
            progress_overall: { type: number, format: float, minimum: 0, maximum: 1 }
            streak_days: { type: integer, minimum: 0 }
            last_eval_score: { type: number, format: float, minimum: 0, maximum: 20 }
        upcoming:
          type: array
          items:
            type: object
            properties:
              id: { type: string, format: uuid }
              at: { type: string, format: date-time }
              kind: { type: string, enum: [Visio, Présentiel, Épreuve, Rappel] }
              title: { type: string }
        tasks:
          type: array
          items:
            type: object
            properties:
              id: { type: string, format: uuid }
              label: { type: string }
              due: { type: string, format: date-time, nullable: true }
              weight: { type: number, format: float }
```

```yaml
# /dashboard/epreuves
200:
  application/json:
    schema:
      type: object
      properties:
        track: { type: string, enum: [Premiere, Terminale], example: "Terminale" }
        profile: { type: string, enum: [Scolarise, CandidatLibre] }
        items:
          type: array
          items:
            type: object
            properties:
              code: { type: string, example: "E5-GrandOral" }
              label: { type: string }
              weight: { type: number, format: float }
              scheduled_at: { type: string, format: date, nullable: true }
              format: { type: string, example: "Oral 20 min" }
```

---

# 4) Base de données (PostgreSQL, schéma `nexus_app`)

## 4.1. Tables minimales “Dashboard”

* `students (id, user_id?, track {Premiere|Terminale}, profile {Scolarise|Libre}, specialities[], options[], llv[], created_at, updated_at)`
* `progress (id, student_id, subject, chapter_code, competence_code, score [0..1], updated_at)`
* `tasks (id, student_id, label, due_at, weight, status {Todo|Done|Skipped}, source {Agent|Coach|System}, created_at)`
* `sessions (id, student_id, kind {Visio|Présentiel|Stage}, slot_start, slot_end, status {Proposé|Confirmé|Annulé}, coach_id?)`
* `evaluations (id, student_id, subject, generator, durations_min, status {Proposé|Soumis|Corrigé}, score_20?, feedback_json, created_at)`
* `epreuves_plan (id, student_id, code, label, weight, scheduled_at?, format, source {Réglement|Agent}, created_at)`
* `resources (id, title, uri, type {PDF|Video|URL}, tags[], visibility, created_at)`
* `events (id, student_id, kind, payload_json, at)`  ← **journal** (alimentation KG + analytics)
* `reports (id, student_id, period, summary_md, kpis_json, generated_at)`
* `entitlements (id, student_id, tier {Free|Plus|Pro|…}, expires_at?)`

**Index** recommandés :

* `progress (student_id, subject, updated_at)`
* `tasks (student_id, status, due_at)`
* `sessions (student_id, status, slot_start)`
* `evaluations (student_id, status, created_at)`
* `epreuves_plan (student_id, code)`
* `events (student_id, at)`

## 4.2. Vues matérialisées utiles

* `mv_dashboard_summary (student_id, progress_overall, last_eval_score, next_session_at, tasks_open_count)`

  * rafraîchie via job (cron/worker) ou à chaque événement majeur.

---

# 5) Agents (multi-agents “All-agentic” appliqués au Dashboard)

* **Orchestrateur (ARIA)** : reçoit `student_id`, lit profil/historique, choisit outils.
* **Planner** : calcule `epreuves_plan` + jalons (Première/Terminale, scolarisé/libre).
* **Coach** : génère `tasks` priorisées (méthodo, exos, rappels), s’appuie sur `progress`.
* **RAG Retriever** : propose `resources` pertinents (+ tags spécialités/options).
* **Evaluator/Grader** : fabrique évaluations (`evaluations`), corrige copies (OCR si PDF), remplit `progress`.
* **Parent Reporter** : agrège KPIs → `reports` (PDF/HTML) à fréquence définie.

**Échanges** : événements **idempotents** écrits dans `events`, ce qui rend le Dashboard **réactif** (push WS possible) et **traçable**.

---

# 6) Backend (service FastAPI)

## 6.1. Architecture

* **Routers** par domaine (déjà posés).
* **Services** : `planner_service`, `coach_service`, `rag_service`, `eval_service`, `report_service`.
* **Jobs** (Celery/RQ/Arq) : rafraîchissement vues matérialisées, génération de rapports, correction différée.
* **Stockage** : MinIO pour copies et pièces jointes ; métadonnées en DB.
* **Sécurité** : middleware JWT (issu de Next) ou session signée ; RBAC (`student/parent/coach/admin`).
* **Observabilité** : logs structurés (uvicorn), métriques (Prometheus/OpenTelemetry en option).

## 6.2. États & transitions (exemples)

* `evaluation.status`: `Proposé → Soumis → Corrigé`.
* `sessions.status`: `Proposé → Confirmé → Annulé`.
* `tasks.status`: `Todo → Done/Skipped`.
  Chaque transition émet un **event** (→ rafraîchit le Dashboard).

---

# 7) Tickets (CSV) — “Dashboard Élève”

Copiez/collez dans `tickets_dashboard.csv` :

```
Title,Description,Priority,Labels,Assignee,Sprint,Epic,Type,DueDate
DASH-001 UI Layout (App Router),"Créer app/(dashboard)/layout.tsx + Providers; intégrer theming, auth guard, Toaster.",High,frontend,,,Dashboard,Task,
DASH-002 Page Synthèse,"app/(dashboard)/dashboard/page.tsx : KPIs, next sessions, 5 tâches; skeleton loaders.",High,frontend,,,Dashboard,Task,
DASH-003 Agenda,"app/(dashboard)/agenda/page.tsx : liste sessions, filtres, export ICS; actions book/cancel.",High,frontend,,,Dashboard,Task,
DASH-004 Epreuves,"app/(dashboard)/epreuves/page.tsx : frise personnalisée (Première/Terminale, Scolarisé/Libre).",High,frontend,reglementaire,,Dashboard,Task,
DASH-005 Evaluations,"app/(dashboard)/evaluations/page.tsx : générer, déposer copie, voir corrections, feedback.",High,frontend,evals,,Dashboard,Task,
DASH-006 Grand Oral,"app/(dashboard)/grand-oral/page.tsx : jalons, entraînements, grille orale.",Medium,frontend,terminale,,Dashboard,Task,
DASH-007 Parcoursup,"app/(dashboard)/parcoursup/page.tsx : checklist, échéances, documents requis.",Medium,frontend,terminale,,Dashboard,Task,
DASH-008 RAG & Cours,"app/(dashboard)/cours/page.tsx + ressources/page.tsx : recherche RAG, cartes ressources, favoris.",High,frontend,rag,,Dashboard,Task,
DASH-009 API Summary,"GET /dashboard/summary : KPIs + upcoming + tasks (contrat OpenAPI).",High,backend,api,,Dashboard,Task,
DASH-010 API Agenda,"GET /dashboard/agenda : sessions, filtres; POST /sessions/book.",High,backend,api,,Dashboard,Task,
DASH-011 API Progression,"GET /dashboard/progression : par matière/chapitre/compétence.",High,backend,api,,Dashboard,Task,
DASH-012 API Epreuves,"GET /dashboard/epreuves : plan personnalisé.",High,backend,api,reglementaire,Dashboard,Task,
DASH-013 DB Core,"Créer tables nexus_app: students, progress, tasks, sessions, evaluations, epreuves_plan, resources, events, reports, entitlements + index.",High,db,, ,Dashboard,Task,
DASH-014 MV Summary,"Créer mv_dashboard_summary + job refresh; exposer via /dashboard/summary.",Medium,db,perf,,Dashboard,Task,
DASH-015 Agents Planner/Coach,"Implémenter planner_service et coach_service (écritures tasks/plan + events).",High,agents,, ,Dashboard,Task,
DASH-016 Agent Evaluator,"Génération et correction (OCR) + mise à jour progress/events.",High,agents,evals,,Dashboard,Task,
DASH-017 Agent Reporter Parents,"Synthèse periodique → reports; route /parent/report.",Medium,agents,parents,,Dashboard,Task,
DASH-018 Sécurité FastAPI,"JWT/Session middleware; RBAC; scopes par route.",High,backend,security,,Dashboard,Task,
DASH-019 Tests E2E,"Playwright: user flow synthèse → réserver → générer éval → déposer copie.",High,qa,e2e,,Dashboard,Task,
```

---

# 8) Critères d’acceptation (exemples concrets)

* **Synthèse Dashboard** :
  – TTFB < 500 ms (local) ; 95ᵉ percentile API `/dashboard/summary` < 200 ms (sans cold-start).
  – Affiche au moins **3 KPI** (progress_overall, last_eval_score, streak_days), **≥1 session**, **≥3 tâches**.
* **Epreuves** : la frise reflète **le bon profil** (Première/Terminale, Scolarisé/Libre), poids/format conformes.
* **Évaluations** : en 1 minute, l’élève crée un sujet, dépose une copie, obtient un feedback enregistré.
* **RAG** : recherche renvoie des hits pertinents (≥3) filtrables par matière/sujet.
* **Parents** : `GET /parent/report` renvoie un JSON cohérent avec KPIs et résumé textuel.

---

# 9) Tests & Observabilité

* **Unitaires** (FastAPI services) : planner/coach/eval/rag/report.
* **Contrats** : Schemathesis sur OpenAPI (statut ≥ 200/4xx attendus, pas de 500).
* **E2E** : Playwright (flow élève complet).
* **Logs** : uvicorn JSON + corrélation `request_id` ; métriques timing par route.

---

# 10) Sécurité, conformité, données

* **RBAC** : `student`, `parent`, `coach`, `admin`.
* **Scopes** : ex. `/parent/*` accessible à `parent` du `student_id` indiqué.
* **Traçabilité** : tous les changements significatifs émettent un `event`.
* **Vie privée** : minimiser conservation de copies brutes ; offrir purge/export (GDPR-like).

---

## Conclusion (opinion ferme)

* Le **périmètre Dashboard** est **détaillé** et **implémentable immédiatement** : l’UI (App Router, npm), l’API (contrats précis), la **DB** (tables/index + MV), et la **chaîne d’agents** sont alignés avec l'architecture (cohabitation par schéma).

Voici- modèles SQLAlchemy + Alembic (fidèles au DDL), routes FastAPI supplémentaires, client TypeScript, et seed étendu (LV3, Parcoursup, Grand Oral). Vous pouvez tout télécharger ci-dessous.

# Téléchargements

* [SQLAlchemy models](sandbox:/mnt/data/sqlalchemy_models/models.py)
* Alembic:

  * [alembic.ini](sandbox:/mnt/data/db/alembic.ini)
  * [env.py](sandbox:/mnt/data/db/alembic/env.py)
  * [001_init_core.py](sandbox:/mnt/data/db/alembic/versions/001_init_core.py)
* FastAPI (routes additionnelles) :

  * [/dashboard/tasks CRUD](sandbox:/mnt/data/api/routers/tasks.py)
  * [/sessions/{id}/cancel](sandbox:/mnt/data/api/routers/sessions.py)
  * [/epreuves/sync](sandbox:/mnt/data/api/routers/epreuves.py)
  * [deps.py (session DB)](sandbox:/mnt/data/api/routers/deps.py)
* Client TypeScript (fetch typé) :

  * [ts_client/index.ts](sandbox:/mnt/data/ts_client/index.ts)
* Seeds :

  * [seed_nexus_app_extended.sql](sandbox:/mnt/data/seed_nexus_app_extended.sql)
* Aide/README :

  * [README_DASHBOARD_DELIVERABLES.md](sandbox:/mnt/data/README_DASHBOARD_DELIVERABLES.md)

# Points techniques (rigoureux et actionnables)

## 1) ORM SQLAlchemy (parfaite correspondance au DDL)

* Schéma par défaut : `metadata = MetaData(schema="nexus_app")` + `__table_args__ = {"schema":"nexus_app"}` pour chaque table (cohérent avec votre setup Copilot).
* Enums Postgres nommés et *scopés* au schéma (`track`, `profile`, `session_kind`, `session_status`, `task_status`, `task_source`, `eval_status`).
* Index identiques à ceux du DDL (nommage, colonnes, schéma).
* Types *Postgres-native* (UUID, DOUBLE PRECISION, JSONB) via dialiect `sqlalchemy.dialects.postgresql`.

## 2) Alembic (exécute le DDL exact)

* `db/alembic/versions/001_init_core.py` applique **le DDL tel quel** via `op.execute(DDL)` : vous gardez 1:1 avec le SQL source, y compris MV, triggers, checks, etc.
* `env.py` :

  * `include_schemas=True` + `version_table_schema="nexus_app"`.
  * Création du schéma avant migration.
* **Upgrade/downgrade** propres (drop MV, triggers, tables, types dans l’ordre inverse).
* Variable d’environnement attendue : `DATABASE_URL` (ex. `postgresql+psycopg://nexus:nexus@localhost:5433/nexus`).

➡️ Commandes :

```bash
export DATABASE_URL=postgresql+psycopg://nexus:nexus@localhost:5433/nexus
alembic -c db/alembic.ini upgrade head
```

## 3) API FastAPI – routes supplémentaires

* `/dashboard/tasks` : **CRUD** complet aligné sur la table `tasks` (filtrage par `student_id`).
* `/sessions/{session_id}/cancel` : transition d’état vers `Annulé`, idempotente.
* `/epreuves/sync` : recalcul minimaliste par *track/profile* (remplace les entrées `source='Réglement'`).
* Dépendances DB prêtes (`deps.get_db()`), variables d’env via `DATABASE_URL`.
* Ces routers s’insèrent dans votre `main.py` existant :

```python
from api.routers import tasks, sessions, epreuves
app.include_router(tasks.router)
app.include_router(sessions.router)
app.include_router(epreuves.router)
```

## 4) Client TypeScript (sans dépendance externe)

* `ts_client/index.ts` : client fetch « zéro dépendance », **typé** avec les schémas du Dashboard.
* Prêt à publier en package interne (`@nexus/client`) ou à copier dans votre app Next :

```ts
import { NexusApiClient } from "@/lib/nexus-client";
const api = new NexusApiClient({ baseUrl: "/pyapi" });
const summary = await api.dashboard.summary(studentId);
```

## 5) Jeu de données (seed étendu)

* Ajout d’une **LV3** (ex. Allemand) pour un élève de **Première scolarisé**.
* **Parcoursup** (ouverture, vœux, clôture) pour des élèves de **Terminale** (événements datés 2025-12 à 2026-03, à ajuster chaque année).
* **Grand Oral** : suite de tâches jalonnées (définition questions, recherche, exposé, simulations).
* Dates d’**épreuves** plausibles (Philo, Grand Oral) et **anticipées de Français**.

➡️ Chargement :

```bash
psql "$DATABASE_URL" -f seed_nexus_app_extended.sql
```

---

## Intégration dans monorepo (rappel « coexistence Next + FastAPI »)

* **Rewrites Next** : `/pyapi/:path* -> http://localhost:8000/:path*` (déjà prévu dans vos patchs).
* **Ports Compose** : si conflit 5432/6379, optez pour l’Option B (override) que nous avons évoquée, pour éviter d’arrêter vos services locaux.
* **Scripts NPM** (déjà paramétrés d’après Copilot) :

  * `dev:api`, `dev:web`, `dev:all`, `db:migrate:py`, et votre `smoke_tests.sh`.

## Tests minimaux

* **Migrations** : `alembic upgrade head` doit créer types, tables, index, MV, trigger.
* **Routes** :

  * `GET /dashboard/tasks?student_id=...` → vide, puis `POST` et `PATCH/DELETE`.
  * `POST /sessions/{id}/cancel` sur une session existante (`status` → `Annulé`).
  * `POST /epreuves/sync?student_id=...` → charge le plan par profil.
* **Client TS** : tester `new NexusApiClient({ baseUrl: "/pyapi" })` dans une page Next avec `getServerSideProps` ou des actions server (App Router).



# Téléchargements (fichiers ajoutés/actualisés)

## API FastAPI

* Sessions (annulation unitaire + **annulation en lot**)

  * [/sessions.py](sandbox:/mnt/data/api/routers/sessions.py)
* Tasks (**CRUD** + **bulk create/update/delete**)

  * [/tasks.py](sandbox:/mnt/data/api/routers/tasks.py)
* Épreuves (synchronisation existante + **GET conforme au client TS**)

  * [/dashboard_epreuves.py](sandbox:/mnt/data/api/routers/dashboard_epreuves.py)
* **App FastAPI minimale** (pour lancer les tests)

  * [/api/app.py](sandbox:/mnt/data/api/app.py)

## Client TypeScript + Package NPM prêt

* **Client TS** mis à jour (avec `sessions.bulkCancel`, `dashboard.tasks.bulk`, `dashboard.epreuves.get`)

  * [ts_client/index.ts](sandbox:/mnt/data/ts_client/index.ts)
* **Scaffold package** (prêt à publier)

  * [ts_client/package.json](sandbox:/mnt/data/ts_client/package.json)
  * [ts_client/tsconfig.json](sandbox:/mnt/data/ts_client/tsconfig.json)
  * [ts_client/README.md](sandbox:/mnt/data/ts_client/README.md)

## Tests Pytest (DB + API), fixtures + factories

* [tests/conftest.py](sandbox:/mnt/data/tests/conftest.py)
* [tests/factories.py](sandbox:/mnt/data/tests/factories.py)
* [tests/test_tasks_bulk.py](sandbox:/mnt/data/tests/test_tasks_bulk.py)
* [tests/test_sessions_bulk.py](sandbox:/mnt/data/tests/test_sessions_bulk.py)
* [tests/test_epreuves_get.py](sandbox:/mnt/data/tests/test_epreuves_get.py)

---

# Détails d’implémentation et opinion technique

## 1) Sessions — annulation en lot

* **Route** `POST /sessions/cancel`

  * Corps : `{ "ids": UUID[] }`
  * Réponse : `{ results: [{ id, status }] }` avec statuts `cancelled | already_cancelled | not_found`.
* Idempotence respectée ; transaction unique commitée en fin de traitement.

## 2) Tasks — opérations en masse

* **Route** `POST /dashboard/tasks/bulk`

  * Corps :

    ```json
    {
      "operations": [
        { "op": "create", "data": { "student_id": "...", "label": "..." } },
        { "op": "update", "id": "...", "data": { "status": "Done" } },
        { "op": "delete", "id": "..." }
      ]
    }
    ```
  * Retour élémentaire par opération : `created | updated | deleted | not_found | invalid`, avec `index`, `id` et `error` si besoin.
* Choix de conception : **validation souple** côté API (utile pour orchestrations agentiques), et rapport détaillé par opération pour remonter les erreurs localisées.

## 3) Épreuves — GET conforme au client TS

* **Route** `GET /dashboard/epreuves?student_id=...`

  * Réponse :

    ```json
    {
      "track": "Premiere|Terminale",
      "profile": "Scolarise|CandidatLibre",
      "items": [{ "code","label","weight","scheduled_at","format" }]
    }
    ```
* Aligné sur la méthode `dashboard.epreuves.get()` du client TS.

## 4) Client TS — package npm prêt

* **Nouveaux points** :

  * `sessions.bulkCancel(ids: UUID[])`
  * `dashboard.tasks.bulk(operations: …)`
  * `dashboard.epreuves.get(student_id)`
* **Packaging** minimal (ESM, d.ts, `tsc -p .`, export `dist`).
* Mon avis : pour production, ajoutez vite un **retry** (exponentiel) et **intercepteurs auth**. Ici on reste volontairement light pour intégration rapide dans Next (App Router).

## 5) Tests Pytest — scope intégration

* **Fixtures** `TestClient` + disponibilité DB via `DATABASE_URL`.
* **Factories** : `create_student`, `create_session`, `create_task`.
* **Tests** :

  * bulk tasks (create → update/delete)
  * bulk sessions cancel
  * get épreuves (après un `POST /epreuves/sync` pour garantir un plan)
* Remarque : ces tests supposent un Postgres fonctionnel avec le schéma migré (environnement d’intégration). Ils sont rédigés pour être **exécutables** dans votre pipeline après `alembic upgrade head`.

---

# Intégration rapide

## A) API (ajout des routers)

Dans `apps/api/main.py` (ou équivalent) :

```python
from api.routers import tasks, sessions, epreuves, dashboard_epreuves

app.include_router(tasks.router)
app.include_router(sessions.router)
app.include_router(epreuves.router)
app.include_router(dashboard_epreuves.router)
```

## B) Rewrites Next.js (rappel)

`next.config.mjs` :

```js
export async function rewrites() {
  return [
    { source: "/pyapi/:path*", destination: "http://localhost:8000/:path*" },
  ];
}
```

## C) Client TS (usage)

```ts
import { NexusApiClient } from "@nexus/client";

const api = new NexusApiClient({ baseUrl: "/pyapi" });

// Bulk tasks
await api.dashboard.tasks.bulk([
  { op: "create", data: { student_id, label: "Réviser probas" } },
  { op: "create", data: { student_id, label: "Exercices suites", weight: 1.5 } },
]);

// Cancel sessions (bulk)
await api.sessions.bulkCancel([s1, s2, s3]);

// Epreuves GET
const plan = await api.dashboard.epreuves.get(student_id);
```

## D) Tests

Pré-requis : DB up + migrations

```bash
export DATABASE_URL=postgresql+psycopg://nexus:nexus@localhost:5433/nexus
alembic -c db/alembic.ini upgrade head

pytest -q tests -m integration
```

voici un « durcissement », avec des fichiers prêts à intégrer et à tester.

# Téléchargements (ajouts/mises à jour)

## Utilitaires (ACL, audit, rate limiting)

* [api/utils/security.py](sandbox:/mnt/data/api/utils/security.py) — **ACL minimal** (rôles `student`, `parent`, `coach`, `admin`) + helpers.
* [api/utils/audit.py](sandbox:/mnt/data/api/utils/audit.py) — **journalisation** d’événements (`TASK_*`, `SESSION_CANCELLED`, `EPREUVES_SYNCED`).
* [api/utils/ratelimit.py](sandbox:/mnt/data/api/utils/ratelimit.py) — **limiteur** en mémoire (DEV), prêt à remplacer par Redis.

## Routers FastAPI (mis à jour)

* Tasks (**enums stricts, ACL, audit, SAVEPOINT par op**)

  * [/api/routers/tasks.py](sandbox:/mnt/data/api/routers/tasks.py)
* Sessions (**ACL coach/admin, rate limiting, audit, SAVEPOINT en bulk**)

  * [/api/routers/sessions.py](sandbox:/mnt/data/api/routers/sessions.py)
* Épreuves (sync avec ACL + audit, **GET exposé** déjà livré)

  * [/api/routers/epreuves.py](sandbox:/mnt/data/api/routers/epreuves.py)
  * [/api/routers/dashboard_epreuves.py](sandbox:/mnt/data/api/routers/dashboard_epreuves.py)

## Migration Alembic (index partiel)

* [db/alembic/versions/002_tasks_todo_partial_index.py](sandbox:/mnt/data/db/alembic/versions/002_tasks_todo_partial_index.py) — `CREATE INDEX idx_tasks_student_todo_due ON tasks(student_id, due_at) WHERE status='Todo'`.

## Documentation delta

* [README_SECURITY_ROBUSTESSE.md](sandbox:/mnt/data/README_SECURITY_ROBUSTESSE.md) — récapitulatif des choix techniques et points d’intégration.

---

# Ce qui change concrètement

## 1) Validations Pydantic **strictes**

* `TaskStatus` (`Todo|Done|Skipped`) et `TaskSource` (`Agent|Coach|System`) sont des **Enum** fortes.
* `label` borné (1..300), `weight` borné (0..5).
* Les routes **rejettent** les valeurs hors domaine (400).

## 2) **Transactions atomiques** pour les opérations en masse

* `POST /dashboard/tasks/bulk` : transaction globale + `db.begin_nested()` ⇒ **SAVEPOINT par opération**. Une op en erreur n’annule pas les autres.
* `POST /sessions/cancel` (bulk) : idem.

## 3) **Index partiel** sur les tâches à faire

* Optimise les requêtes « tâches ouvertes par élève triées par échéance ».
* Alembic `002_*` ajoute l’index partiel `(student_id, due_at) WHERE status='Todo'`.

## 4) **Rate limiting** sur les annulations

* `POST /sessions/{id}/cancel` : **20/min** par acteur (clé : `X-Actor-Id` sinon rôle).
* `POST /sessions/cancel` (bulk) : **40/min** par acteur.
* En prod, branchez Redis (token bucket) — le stub est isolé pour un swap simple.

## 5) **ACL** + **Audit trail**

* Règles :

  * `sessions.cancel` / `epreuves.sync` → **coach/admin** obligatoires.
  * `dashboard.tasks` → **student** autorisé seulement sur **son** `student_id`, sinon **coach/admin**.
* Audit automatique :

  * `TASK_CREATED|UPDATED|DELETED`
  * `SESSION_CANCELLED`
  * `EPREUVES_SYNCED`
* Modèle minimal : extraction des rôles via headers (`X-Role`, `X-Actor-Id`, `X-Student-Id`). À relier ensuite à votre Auth (NextAuth/JWT).

---

# Intégration proposée (rapide)

1. **Inclure les routers** (si ce n’est pas déjà fait) :

```python
from api.routers import tasks, sessions, epreuves, dashboard_epreuves
app.include_router(tasks.router)
app.include_router(sessions.router)
app.include_router(epreuves.router)
app.include_router(dashboard_epreuves.router)
```

2. **Migrer la DB** :

```bash
export DATABASE_URL=postgresql+psycopg://nexus:nexus@localhost:5433/nexus
alembic -c db/alembic.ini upgrade 001_init_core
alembic -c db/alembic.ini upgrade 002_tasks_todo_partial_index
```

3. **Tester rapidement** (headers ACL) :

```bash
# Liste des tâches (élève)
curl -H 'X-Role: student' -H 'X-Student-Id: <UUID_ELEVE>' \
  'http://localhost:8000/dashboard/tasks?student_id=<UUID_ELEVE>'

# Bulk cancel (coach/admin requis)
curl -X POST -H 'Content-Type: application/json' -H 'X-Role: coach' \
  -d '{"ids":["<UUID1>","<UUID2>"]}' \
  'http://localhost:8000/sessions/cancel'
```

4. **Rate limiting** :

* Ajoutez `X-Actor-Id: <id_utilisateur>` pour isoler la limite par compte.



