# 1) Stratégie d’intégration — décision argumentée (recommandée)

**Objectif :** conserver **Next.js** (UI, éventuels endpoints BFF légers) et ajouter **FastAPI** comme **service applicatif** (agents, RAG, OCR-Grader, planification, épreuves, Parcoursup/Grand Oral) tout en partageant **PostgreSQL**.

**Recommandation ferme : « Coexistence progressive, isolation par schéma »**

* **Next.js** continue d’utiliser **Prisma/NextAuth** dans le schéma Postgres `public` (statut actuel).
* **FastAPI** gère **ses propres tables** dans un **schéma Postgres dédié `nexus_app`** (et la table `chunks` vectorisée en `public`, ou aussi dans `nexus_app` si vous préférez tout isoler).
* **pgvector** : extension créée au niveau cluster (ok), index IVFFlat sur la table `chunks`.
* **CORS/Proxys** : Next.js -> reverse proxy interne vers `api:8000` pour éviter CORS en dev/prod.
* **CI/CD** : pipelines séparés Node/Python + un job E2E `docker-compose` qui teste tout.

**Pourquoi ?**

* Évite de casser votre **auth** et vos **migrations Prisma**.
* Permet d’itérer **rapide et sûr** côté Python sans risque de collisions de tables.
* Possibilité de convergence plus tard (migration Users), sans bloquer le delivery.

---

# 2) Cartographie de l’existant (checklist Copilot)

1. **Next.js/Node** : relever `app/`, `components/`, `pages/api/` (le cas échéant), `prisma/schema.prisma`, `next-auth`, scripts `package.json`.
2. **Dépendances** : noter Prisma/NextAuth/DB url, `.env`.
3. **Migrations Prisma** : dossier `prisma/migrations`.
4. **CI actuelle** : `.github/workflows/*`.
5. **Docker** (si existant) : `Dockerfile`, `docker-compose.*`.

**Point d’attention :** si vous avez déjà un dossier `apps/api` côté Node, **ne pas écraser** ; le Python sera précisément **`apps/api`** (côté Python), et vos routes Next restent **`/pages/api`** ou **`app/api`**.

---

# 3) Import Git — méthode fiable (subtree depuis notre bundle)

> Vous avez les artefacts fournis : `nexus_repo.bundle` et `nexus_repo_git.zip`.

### A. Créer une branche d’intégration

```bash
git checkout -b feat/py-api-integration
```

### B. Préparer un clone local du bundle API (source du subtree)

```bash
mkdir -p /tmp/nexus-api
git clone /chemin/vers/nexus_repo.bundle /tmp/nexus-api
cd /tmp/nexus-api
git branch -M main
git log --oneline   # pour voir le commit initial
```

### C. Dans VOTRE monorepo Next.js : intégrer en **subtree** sous `apps/api`

```bash
cd /chemin/vers/votre/monorepo
git remote add nexus-api-local /tmp/nexus-api
# Ajout en subtree (historique conservé, squash possible si vous préférez)
git subtree add --prefix apps/api nexus-api-local main --squash
```

> Avantage : vous gardez **votre historique** Netx.js et l’API Python est intégrée proprement avec un commit clair.

---

# 4) Arborescence cible (monorepo)

```
.
├─ app/ ... ou src/ ... (Next.js)
├─ prisma/ (Prisma + NextAuth)
├─ apps/
│  └─ api/                # (importé) FastAPI + SQLAlchemy + Alembic
│     ├─ app/
│     ├─ db/
│     ├─ ...
├─ infra/
│  └─ docker/
│     └─ Dockerfile.api   # image FastAPI
├─ docker-compose.yml     # (fusion voir section 7)
├─ .github/workflows/     # (jobs node + python + e2e)
└─ ...
```

---

# 5) Isolation par schéma Postgres (`nexus_app`)

### A. Créer le schéma et adapter Alembic

**Option simple :** ajouter au tout début de la migration `001_init_core.py` :

```python
op.execute("CREATE SCHEMA IF NOT EXISTS nexus_app;")
op.execute("SET search_path TO nexus_app, public;")
```

Puis, pour **toutes les tables gérées par SQLAlchemy**, ajoutez dans les modèles `__table_args__ = {"schema": "nexus_app"}`. Exemple (modèle `User`) :

```python
# apps/api/app/models/user.py
class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "nexus_app"}
    ...
```

**Important :**

* L’extension `pgvector` reste **globale** (ok).
* Si vous laissez `chunks` en `public` (recommandé au départ), conservez tel quel l’`op.execute` qui crée la table `chunks` dans `public`.
* Sinon, déplacez `chunks` dans `nexus_app` en ajoutant `SET search_path` ou en nommant la table `nexus_app.chunks` dans la SQL brute.

### B. Adapter `env.py` Alembic pour le schéma

Ajoutez dans `db/migrations/env.py` :

```python
from alembic import context
# ...
def run_migrations_online():
    # ...
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        version_table_schema="nexus_app",      # pour stocker l’état Alembic
        include_schemas=True,                  # si vous avez besoin de multi-schémas
        # compare_type=True,                   # utile si vous ferez autogenerate
    )
```

### C. Prisma et NextAuth

* **Ne changez rien** côté Prisma, laissez-le en **`public`**.
* Les tables `nexus_app.*` n’entreront pas en collision avec `public.*`.
* Pivots futurs (si vous unifiez Users) possibles via **view** ou **migration dédiée**.

---

# 6) Configuration & `.env` (unifiés)

Créez un `.env.example` **à la racine** (et gardez le vôtre côté Next) :

```dotenv
# Base de données partagée
DATABASE_URL=postgresql+psycopg://nexus:nexus@localhost:5432/nexus

# FastAPI
JWT_SECRET=change-me
COOKIE_SECRET=change-me
REDIS_URL=redis://localhost:6379/0
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=password
VECTOR_BACKEND=pgvector

# Next.js (existant)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=change-me
# etc.
```

> En **docker-compose**, ces valeurs seront sur le réseau interne (db:5432, redis:6379, minio:9000).

---

# 7) Docker Compose — exécution simultanée (dev)

**Fusionnez** le `docker-compose.yml` existant avec celui du scaffold (ou partez de ce modèle si vous n’en avez pas) :

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
      test: ["CMD-SHELL", "pg_isready -U nexus"]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7
    ports: ["6379:6379"]

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: admin
      MINIO_ROOT_PASSWORD: password
    ports: ["9000:9000", "9001:9001"]

  api:
    build:
      context: .
      dockerfile: infra/docker/Dockerfile.api
    env_file: .env
    environment:
      DATABASE_URL: postgresql+psycopg://nexus:nexus@db:5432/nexus
      REDIS_URL: redis://redis:6379/0
      MINIO_ENDPOINT: http://minio:9000
    depends_on:
      - db
    ports: ["8000:8000"]

  web:
    build:
      context: .
      dockerfile: Dockerfile # si vous avez un Dockerfile Next
    env_file: .env
    environment:
      # NEXTAUTH_URL, etc.
    depends_on:
      - api
    ports: ["3000:3000"]
    # command: "pnpm dev" ou "npm run dev"
```

---

# 8) Dev local (hors Docker) — scripts pratiques

Dans votre **`package.json`** (racine), ajoutez des scripts :

```json
{
  "scripts": {
    "dev:web": "next dev -p 3000",
    "dev:api": "uvicorn apps.api.app.main:app --reload --port 8000",
    "dev:all": "concurrently -k -n WEB,API \"npm run dev:web\" \"npm run dev:api\"",
    "db:migrate:py": "alembic -c db/alembic.ini upgrade head"
  }
}
```

Dans **FastAPI**, ajoutez **CORS** minimal pour le dev (`apps/api/app/main.py`) :

```python
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Dans **Next**, pour éviter CORS en dev, ajoutez une **rewrite** (fichier `next.config.js`) :

```js
module.exports = {
  async rewrites() {
    return [
      {
        source: "/pyapi/:path*",
        destination: "http://localhost:8000/:path*"
      }
    ]
  }
}
```

> Ainsi, côté UI vous appelez `/pyapi/rag/search?q=...` au lieu d’appeler `:8000` en dur.

---

# 9) Synchronisation des migrations et des schémas

* **Étape 1 — Postgres prêt** : `docker compose up -d db`
* **Étape 2 — Schéma Alembic** : `npm run db:migrate:py`
* **Étape 3 — Prisma (si nécessaire)** : continuez à utiliser vos migrations Prisma habituelles pour `public`.
* **Étape 4 — Sanity check** : psql → `\dn` (schémas) et `\dt nexus_app.*` (tables FastAPI) + `\dt public.*` (Prisma).

**Collisions évitées** par le schéma `nexus_app`.
Si vous souhaitez plus tard **unifier `users`** : on écrira une migration SQL contrôlée (et un adaptateur NextAuth custom) — à planifier, pas requis au MVP.

---

# 10) Smoke tests (prêts à l’emploi)

Après `npm run dev:all` :

```bash
# Santé API
curl -s http://localhost:8000/health/ | jq .

# Bilan gratuit (profil)
curl -s -X POST http://localhost:8000/onboarding/bilan \
  -H "Content-Type: application/json" \
  -d '{"statut":"scolarise","niveau":"premiere","specialites":["maths","nsi"]}' | jq .

# Épreuves personnalisées
curl -s "http://localhost:8000/parcours/epreuves?student_id=00000000-0000-0000-0000-000000000000" | jq .
```

Côté Next : consommer via `/pyapi/...` (rewrite).

---

# 11) CI/CD (GitHub Actions)

### Node + Python + E2E (schéma succinct)

* **job `node_ci`** : setup Node, install deps, `next build`, unit tests.
* **job `python_ci`** : setup Python, `pip install -r apps/api/requirements.txt`, flake8/ruff, pytest.
* **job `e2e_compose`** : `docker compose up -d db api web`, run Playwright contre `web:3000` (chemin happy : Onboarding→Plan).
* Caches : `actions/setup-node@v4` + `actions/setup-python@v5` + `pip cache` + `pnpm/npm` si utilisé.

---

# 12) ADR & Documentation transitoire

### ADR-0001 — Coexistence Next.js (public) + FastAPI (nexus_app)

* **Contexte :** UI Next.js avec NextAuth/Prisma déjà en place.
* **Décision :** nouvelles fonctionnalités (agents/RAG/Parcoursup/Grand Oral) implémentées dans **FastAPI** ; tables dans **`nexus_app`** ; NextAuth/Prisma restent en **`public`**.
* **Conséquences :**

  * Pas de collision de noms.
  * Migrations indépendantes (Alembic vs Prisma).
  * Proxy interne pour appels UI → API.
  * Migration Users possible ultérieurement.

### README (extrait d’exploitation)

* Démarrer DB → `docker compose up -d db`
* Migrer Alembic → `npm run db:migrate:py`
* Dev → `npm run dev:all`
* URL → Web `http://localhost:3000`, API `http://localhost:8000` (ou `/pyapi`)

---

# 13) Tickets d’intégration (compléments, CSV copiable)

Copiez-collez ce CSV dans un fichier `tickets_integration.csv` pour Linear/Jira :

```
Title,Description,Priority,Labels,Assignee,Sprint,Epic,Type,DueDate
INT-001 Subtree import FastAPI,"Importer apps/api via git subtree (depuis nexus_repo.bundle), commit 'chore: scaffold nexus (initial)'.",High,infra,,,INT,Task,
INT-002 Schéma Postgres nexus_app,"Créer schéma nexus_app et adapter 001_init_core.py (SET search_path), __table_args__={'schema':'nexus_app'} sur modèles SQLAlchemy.",High,db,,,INT,Task,
INT-003 CORS et rewrites Next,"Ajouter CORSMiddleware (localhost:3000) et rewrite Next '/pyapi/*' -> 'http://localhost:8000/*'.",Medium,api,,,INT,Task,
INT-004 Docker Compose fusion,"Fusionner docker-compose pour db/redis/minio/api/web avec healthchecks et depends_on.",Medium,infra,,,INT,Task,
INT-005 Scripts npm dev,"Ajouter scripts dev:web/dev:api/dev:all et db:migrate:py dans package.json.",Medium,dx,,,INT,Task,
INT-006 Alembic version table schema,"Configurer version_table_schema='nexus_app' dans Alembic env.py.",Medium,db,,,INT,Task,
INT-007 Prisma coexistence audit,"Vérifier schéma public Prisma/NextAuth et confirmer absence de collisions avec nexus_app.*.",Medium,db,,,INT,Task,
INT-008 Smoke tests API,"Écrire script bash smoke_tests.sh appelant /health, /onboarding/bilan, /parcours/epreuves.",Low,qa,,,INT,Task,
INT-009 CI Node/Python,"Ajouter workflows GitHub actions node_ci et python_ci + caches.",Medium,ci,,,INT,Task,
INT-010 CI E2E compose,"Job docker-compose e2e avec Playwright contre web:3000, vérifier parcours Onboarding→Plan.",Medium,ci,,,INT,Task,
INT-011 Observabilité dev,"Brancher logs structurés uvicorn + niveau debug, vérifier traces Next.js.",Low,obs,,,INT,Task,
INT-012 Documentation ADR,"Rédiger ADR-0001 Coexistence Next/FastAPI + README exploitation.",Medium,docs,,,INT,Task,
```

---

# 14) Points de vigilance (risques & parade)

* **Collision tables `users`** : évitée par `nexus_app`. Si convergence plus tard, prévoir une **migration unique** (Downtime planifié).
* **CORS** : utilisez les **rewrites** Next pour éviter l’origine croisée en dev, et un **reverse proxy** (nginx/traefik) en prod.
* **RAG embeddings dimension** : par défaut 1536 ; si vous choisissez un modèle différent, **modifier la migration** (colonne `VECTOR(d)`) avant le premier `upgrade`.
* **Secrets** : ne commitez pas vos `.env`. Envisagez `doppler`, `1password`, ou `sops+age`.

---

# 15) Opinion technique (claire)

* **Ne remplacez pas Prisma/NextAuth** au MVP. La cohabitation **isolée par schéma** est **robuste et réversible**.
* **Subtree** > submodule pour ce cas (moins de friction dev).
* **Compose E2E** doit être **vert** avant toute montée de version de schéma. Faites-en un **gate CI** obligatoire.

---

# 16) Mini‐résumé exécutable  (to-do immédiat)

1. `git checkout -b feat/py-api-integration`
2. `git clone nexus_repo.bundle /tmp/nexus-api && git subtree add --prefix apps/api /tmp/nexus-api main --squash`
3. Ajouter `__table_args__={"schema":"nexus_app"}` dans tous les modèles SQLAlchemy + `CREATE SCHEMA` & `SET search_path` dans `001_init_core.py`.
4. `db/migrations/env.py` → `version_table_schema="nexus_app"`.
5. `docker-compose.yml` fusion (db/redis/minio/api/web).
6. `next.config.js` rewrites `/pyapi/:path*` → `http://localhost:8000/:path*`.
7. `main.py` FastAPI → `CORSMiddleware` (localhost:3000).
8. `.env.example` commun (voir section 6).
9. `alembic -c db/alembic.ini upgrade head` puis `npm run dev:all`.
10. Exécuter les **smoke tests**.

