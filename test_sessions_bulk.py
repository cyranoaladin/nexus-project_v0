import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from api.routers.deps import SessionLocal
from tests.factories import create_student, create_session

@pytest.mark.integration
def test_sessions_bulk_cancel(client: TestClient):
    db: Session = SessionLocal()
    try:
        st = create_student(db)
        s1 = create_session(db, st.id, status="Confirmé")
        s2 = create_session(db, st.id, status="Confirmé")
        r = client.post("/sessions/cancel", json={"ids":[str(s1.id), str(s2.id)]})
        assert r.status_code == 200
        body = r.json()
        statuses = sorted([x["status"] for x in body["results"]])
        assert statuses == ["cancelled","cancelled"]
    finally:
        db.close()
