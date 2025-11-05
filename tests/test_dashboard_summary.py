from __future__ import annotations

import pytest

from app.models.dashboard import TaskStatus  # type: ignore[import]
from tests.factories import create_student, create_task


@pytest.mark.integration
def test_dashboard_summary_backlog_buckets(client, db_session):
    student = create_student(db_session)

    overdue = create_task(db_session, student, label="Rendu n°1", due_in_days=-3)
    week_a = create_task(db_session, student, label="Révision DS", due_in_days=2)
    week_b = create_task(db_session, student, label="Plan lecture", due_in_days=5)
    month = create_task(db_session, student, label="Synthèse orale", due_in_days=18)
    future = create_task(db_session, student, label="Projet long", due_in_days=45)
    undated = create_task(db_session, student, label="Notes libres", due_in_days=None)
    done_task = create_task(db_session, student, label="Déjà fini", status=TaskStatus.DONE, due_in_days=1)

    response = client.get(
        "/dashboard/summary",
        params={"student_id": str(student.id)},
        headers={
            "X-Role": "student",
            "X-Actor-Id": str(student.user_id),
            "X-Student-Id": str(student.id),
        },
    )

    assert response.status_code == 200
    payload = response.json()

    backlog = payload.get("backlog")
    assert backlog, "Backlog should be present when TODO tasks exist"

    labels = [bucket["label"] for bucket in backlog]
    assert labels == ["En retard", "Cette semaine", "Ce mois-ci", "À venir", "Sans échéance"]

    bucket_tasks = {bucket["label"]: bucket["tasks"] for bucket in backlog}

    assert {task["id"] for task in bucket_tasks["En retard"]} == {str(overdue.id)}
    assert [task["id"] for task in bucket_tasks["Cette semaine"]] == [str(week_a.id), str(week_b.id)]
    assert {task["id"] for task in bucket_tasks["Ce mois-ci"]} == {str(month.id)}
    assert {task["id"] for task in bucket_tasks["À venir"]} == {str(future.id)}
    assert {task["id"] for task in bucket_tasks["Sans échéance"]} == {str(undated.id)}

    summary_tasks = payload.get("tasks", [])
    assert len(summary_tasks) <= 6
    all_summary_ids = {task["id"] for task in summary_tasks}
    expected_ids = {str(obj.id) for obj in (overdue, week_a, week_b, month, future, undated)}
    assert expected_ids.issubset(all_summary_ids)

    backlog_task_ids = {task["id"] for bucket in backlog for task in bucket["tasks"]}
    assert str(done_task.id) not in backlog_task_ids
    assert str(done_task.id) not in all_summary_ids
