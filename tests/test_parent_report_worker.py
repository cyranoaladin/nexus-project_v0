from __future__ import annotations

import pytest

from app.models.report import Report
from app.jobs.parent_report_worker import run_once
from app.services.reports import generate_reports_for_students
from tests.factories import (
    create_evaluation,
    create_progress_entry,
    create_session_with_booking,
    create_student,
    create_task,
)


@pytest.mark.integration
def test_parent_report_worker_generates_reports(db_session):
    student = create_student(db_session)
    create_progress_entry(db_session, student, subject="physique", score=0.6)
    create_task(db_session, student, label="Réviser ondes", due_in_days=2)
    create_evaluation(db_session, student, subject="physique", score_20=13.5)
    create_session_with_booking(db_session, student.id, start_in_hours=12)

    results = run_once(student_ids=[student.id], regenerate=True)

    assert student.id in results
    payload = results[student.id]
    summary_md = payload.get("summary_md")
    assert isinstance(summary_md, str)
    assert summary_md.startswith("# Synthèse pédagogique")
    tasks = payload.get("tasks")
    assert isinstance(tasks, list) and tasks, "Worker should surface pending tasks"

    db_session.expire_all()
    stored = db_session.execute(
        Report.__table__.select().where(Report.student_id == student.id)
    ).fetchone()
    assert stored is not None


@pytest.mark.integration
def test_generate_reports_for_all_students(db_session):
    student_a = create_student(db_session)
    student_b = create_student(db_session)
    create_task(db_session, student_a, label="Réviser maths", due_in_days=1)
    create_progress_entry(db_session, student_b, subject="svt", score=0.8)

    results = generate_reports_for_students(db_session)

    assert {student_a.id, student_b.id}.issubset(results.keys())
    assert all("summary_md" in payload for payload in results.values())