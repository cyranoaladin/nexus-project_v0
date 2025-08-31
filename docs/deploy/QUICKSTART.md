# Deployment Quickstart (Docker Compose)

Prerequisites:

- Docker and Docker Compose v2
- Ports 3000, 5433, 8001, 8002, 8003 available locally

Steps:

1. Copy env template and adjust if needed

```bash
cp env.local.example .env.local
```

1. Build and start

```bash
make build
make up
```

1. Verify health and home

```bash
make ps
make health
```

1. (Optional) Force re-seed

```bash
make migrate
make seed
```

Notes:

- App is available at <http://localhost:3000>
- Database is Postgres on localhost:5433 (container `db` exposed)
- Internal services:
  - RAG: <http://localhost:8001>
  - PDF: <http://localhost:8002>
  - LLM: <http://localhost:8003>

Troubleshooting:

- If build fails fetching Google Fonts, it's tolerated during build (`NEXT_FONT_IGNORE_ERRORS=1`).
- Ensure `.env.local` contains `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/nexus_dev?schema=public`
