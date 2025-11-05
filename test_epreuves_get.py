import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import delete
from sqlalchemy_models.models import EpreuvePlan
from api.routers.deps import SessionLocal
from tests.factories import create_student

@pytest.mark.integration
def test_get_epreuves(client: TestClient):
    db: Session = SessionLocal()
    try:
        st = create_student(db, track="Terminale", profile="Scolarise")
        # assure a plan exists (route /epreuves/sync creates it)
        r_sync = client.post(f"/epreuves/sync?student_id={st.id}")
        assert r_sync.status_code == 200
        r = client.get(f"/dashboard/epreuves?student_id={st.id}")
        assert r.status_code == 200
        data = r.json()
        assert data["track"] == "Terminale"
        assert data["profile"] == "Scolarise"
        assert len(data["items"]) > 0
    finally:
        db.close()
