import os
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from api.routers.deps import SessionLocal
from tests.factories import create_student, create_task

@pytest.mark.integration
def test_tasks_bulk_flow(client: TestClient):
    # preliminary DB session (direct write)
    db: Session = SessionLocal()
    try:
        student = create_student(db)
        # bulk create 2 tasks
        payload = {
            "operations": [
                {"op": "create", "data": {"student_id": str(student.id), "label":"L1"}},
                {"op": "create", "data": {"student_id": str(student.id), "label":"L2", "weight": 1.5}},
            ]
        }
        r = client.post("/dashboard/tasks/bulk", json=payload)
        assert r.status_code == 200, r.text
        results = r.json()["results"]
        ids = [res["id"] for res in results if res["status"] == "created"]
        assert len(ids) == 2

        # bulk update first, delete second
        payload2 = {
            "operations": [
                {"op": "update", "id": ids[0], "data": {"status": "Done"}},
                {"op": "delete", "id": ids[1]}
            ]
        }
        r2 = client.post("/dashboard/tasks/bulk", json=payload2)
        assert r2.status_code == 200
        rs2 = r2.json()["results"]
        assert rs2[0]["status"] == "updated"
        assert rs2[1]["status"] == "deleted"
    finally:
        db.close()
