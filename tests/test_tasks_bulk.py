from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.dashboard import TaskStatus
from tests.factories import create_student, create_task


@pytest.mark.integration
def test_dashboard_task_status_and_bulk_upsert(client: TestClient, db_session: Session):
    student = create_student(db_session)
    task = create_task(db_session, student, label="Fiche méthode", status=TaskStatus.TODO)

    student_headers = {"X-Role": "student", "X-Student-Id": str(student.id)}
    status_response = client.post(
        "/dashboard/tasks/complete",
        json={"task_id": str(task.id), "status": "Done"},
        headers=student_headers,
    )
    assert status_response.status_code == 200
    body = status_response.json()
    assert body["tasks"][0]["status"] == "Done"

    payload = [
        {"id": str(task.id), "label": "Fiche méthode", "status": "Todo"},
        {"label": "Nouvelle synthèse", "status": "Todo", "weight": 1.5},
    ]
    coach_headers = {"X-Role": "coach"}
    bulk_response = client.put(
        "/dashboard/tasks",
        params={"student_id": str(student.id)},
        json=payload,
        headers=coach_headers,
    )
    assert bulk_response.status_code == 200
    body = bulk_response.json()
    assert len(body["tasks"]) == 2
    labels = {task_payload["label"] for task_payload in body["tasks"]}
    assert "Fiche méthode" in labels
    assert "Nouvelle synthèse" in labels
