from __future__ import annotations

import pytest

from app.models.dashboard import EpreuveSource
from app.models.report import Event
from app.services import planner
from tests.factories import create_student


@pytest.mark.integration
def test_planner_sync_generates_agent_plan(db_session):
	student = create_student(db_session)

	items = planner.sync_epreuves_plan(db_session, student.id)

	assert items, "Planner should generate at least one epreuve"
	for item in items:
		assert item.student_id == student.id
		assert item.source == EpreuveSource.AGENT

	events = db_session.execute(
		Event.__table__.select().where(Event.kind == "EPREUVES_PLAN_SYNCED")
	).all()
	assert events, "Expected planner to emit an audit event"
