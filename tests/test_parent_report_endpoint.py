from __future__ import annotations

import pytest

from app.models.report import Report
from tests.factories import (
    create_evaluation,
    create_progress_entry,
    create_session_with_booking,
    create_student,
    create_task,
)


@pytest.mark.integration
def test_parent_report_endpoint_returns_summary(client, db_session):
    student = create_student(db_session)
    create_progress_entry(db_session, student, subject="maths", score=0.5)
    create_task(db_session, student, label="Réviser probabilités", due_in_days=5)
    create_evaluation(db_session, student, subject="maths", score_20=14.0)
    create_session_with_booking(db_session, student.id, start_in_hours=24)

    response = client.get(
        "/parent/report",
        params={"student_id": str(student.id)},
        headers={"X-Role": "parent", "X-Student-Id": str(student.id)},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["student_id"] == str(student.id)
    assert payload["period"]
    assert payload["summary_md"]
    assert "progress_overall" in payload["kpis"]
    assert payload["tasks"], "Report should expose pending tasks"

    stored = db_session.execute(
        Report.__table__.select().where(Report.student_id == student.id)
    ).fetchone()
    assert stored is not None, "Report should persist in database"
