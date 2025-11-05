from __future__ import annotations

import pytest

from app.models.dashboard import EvaluationStatus
from tests.factories import (
    create_evaluation,
    create_progress_entry,
    create_student,
)


@pytest.mark.integration
def test_agents_planner_coach_and_evaluator(client, db_session):
    student = create_student(db_session, user_role="coach")

    response = client.post(
        "/agents/planner/sync",
        json={"student_id": str(student.id)},
        headers={"X-Role": "coach"},
    )
    assert response.status_code == 200
    assert response.json()["items"] >= 1

    create_progress_entry(db_session, student, subject="physique", score=0.4)

    response = client.post(
        "/agents/coach/sync",
        json={"student_id": str(student.id)},
        headers={"X-Role": "coach"},
    )
    assert response.status_code == 200
    assert response.json()["tasks_created"] >= 1

    bulk_response = client.post(
        "/agents/planner/bulk",
        json={"student_ids": [str(student.id)]},
        headers={"X-Role": "coach"},
    )
    assert bulk_response.status_code == 200
    assert str(student.id) in bulk_response.json()["counts"]

    evaluation = create_evaluation(
        db_session,
        student,
        subject="physique",
        score_20=None,
        status=EvaluationStatus.PROPOSE,
    )

    eval_response = client.post(
        "/agents/evaluator/grade",
        json={"evaluation_id": str(evaluation.id), "score_20": 13.5},
        headers={"X-Role": "coach"},
    )
    assert eval_response.status_code == 200
    graded = eval_response.json()
    assert graded["status"] == "Corrigé"
    assert graded["score_20"] == 13.5

    bulk_eval = client.post(
        "/agents/evaluator/bulk",
        json={"evaluation_ids": [str(evaluation.id)]},
        headers={"X-Role": "coach"},
    )
    assert bulk_eval.status_code == 200
    assert bulk_eval.json()["results"]

    report_resp = client.post(
        "/agents/reporter/bulk",
        json={"student_ids": [str(student.id)], "regenerate": True},
        headers={"X-Role": "coach"},
    )
    assert report_resp.status_code == 200
    reports_payload = report_resp.json()["reports"]
    assert reports_payload
    first_report = reports_payload[0]
    assert first_report["student_id"] == str(student.id)
    assert first_report["summary_md"].startswith("# Synthèse pédagogique")