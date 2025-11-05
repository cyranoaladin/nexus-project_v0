from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

ROOT = Path(__file__).resolve().parents[1]
API_SRC = ROOT / "apps/api/apps/api"
if str(API_SRC) not in sys.path:  # ensure FastAPI app is importable
    sys.path.insert(0, str(API_SRC))

from app.core.config import settings
from app.db.session import SessionLocal
from app.main import app

DATABASE_URL = settings.DATABASE_URL


@pytest.fixture(scope="session")
def db_available():
    if not DATABASE_URL:
        pytest.skip("DATABASE_URL not configured for API tests")
    try:
        engine = create_engine(DATABASE_URL, future=True)
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        engine.dispose()
        return True
    except Exception as exc:  # pragma: no cover - infrastructure guard
        pytest.skip(f"Database unavailable: {exc}")


@pytest.fixture(scope="session")
def client(db_available):
    return TestClient(app)


@pytest.fixture
def db_session(db_available):
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
