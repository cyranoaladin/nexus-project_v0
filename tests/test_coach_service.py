from __future__ import annotations

import pytest

from app.models.report import Event
from app.services import coach, planner
from tests.factories import create_progress_entry, create_student


@pytest.mark.integration
def test_coach_generates_tasks_and_emits_event(db_session):
	student = create_student(db_session)
	planner.sync_epreuves_plan(db_session, student.id)
	create_progress_entry(db_session, student, subject="maths", score=0.45)

	tasks = coach.generate_tasks(db_session, student.id)
	assert tasks, "Coach should generate tasks"
	labels = {task.label for task in tasks}
	assert any(label.startswith("Préparer") for label in labels)

	follow_up = coach.generate_tasks(db_session, student.id)
	assert not follow_up, "Subsequent generation runs should be idempotent when nothing changes"

	events = db_session.execute(
		Event.__table__.select().where(Event.kind == "COACH_TASKS_SYNCED")
	).all()
	assert events, "Coach service should emit an audit event"
