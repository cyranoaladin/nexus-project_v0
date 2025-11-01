# Nexus Réussite — Scaffold (MVP extension)
Backend **FastAPI** + **SQLAlchemy** + **Alembic**, **OpenAPI**, **Docker**, tickets CSV.

## Quick start
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r apps/api/requirements.txt
export DATABASE_URL="postgresql+psycopg://nexus:nexus@localhost:5432/nexus"
alembic -c db/alembic.ini upgrade head
uvicorn apps.api.app.main:app --reload
```
