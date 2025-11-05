from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.dashboard import TaskStatus
from app.models.session import SessionStatus
from tests.factories import (
    create_epreuve_plan,
    create_evaluation,
    create_progress_entry,
    create_session_with_booking,
    create_student,
    create_task,
)


@pytest.mark.integration
def test_dashboard_summary_and_related_endpoints(client: TestClient, db_session: Session):
    student = create_student(db_session)
    create_session_with_booking(db_session, student.id, status=SessionStatus.CONFIRME)
    create_task(db_session, student, label="Revoir chapitre 1", status=TaskStatus.TODO)
    create_task(db_session, student, label="Chapitre terminé", status=TaskStatus.DONE)
    create_progress_entry(db_session, student, score=0.8)
    create_evaluation(db_session, student, score_20=16.0)
    create_epreuve_plan(db_session, student)

    headers = {"X-Role": "student", "X-Student-Id": str(student.id)}

    summary_response = client.get(
        "/dashboard/summary",
        params={"student_id": str(student.id)},
        headers=headers,
    )
    assert summary_response.status_code == 200
    summary = summary_response.json()
    assert summary["kpis"]["last_eval_score"] == pytest.approx(16.0)
    assert summary["kpis"]["streak_days"] >= 1
    assert any(item["label"] == "Revoir chapitre 1" for item in summary["tasks"])
    assert summary["upcoming"], "Expected at least one upcoming session"

    agenda_response = client.get(
        "/dashboard/agenda",
        params={"student_id": str(student.id)},
        headers=headers,
    )
    assert agenda_response.status_code == 200
    assert agenda_response.json()["items"], "Agenda should list bookings"

    progression_response = client.get(
        "/dashboard/progression",
        params={"student_id": str(student.id)},
        headers=headers,
    )
    assert progression_response.status_code == 200
    assert progression_response.json()["entries"], "Progression should expose progress entries"

    epreuves_response = client.get(
        "/dashboard/epreuves",
        params={"student_id": str(student.id)},
        headers=headers,
    )
    assert epreuves_response.status_code == 200
    assert epreuves_response.json()["items"], "Epreuves should expose planned exams"
