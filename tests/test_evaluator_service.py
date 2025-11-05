from __future__ import annotations

import pytest

from app.models.dashboard import EvaluationStatus
from app.services import evaluator
from tests.factories import create_evaluation, create_student


@pytest.mark.integration
def test_evaluator_auto_grade_updates_score_and_status(db_session):
    student = create_student(db_session)
    evaluation = create_evaluation(
        db_session,
        student,
        subject="maths",
        score_20=None,
        status=EvaluationStatus.PROPOSE,
    )

    updated = evaluator.auto_grade(db_session, evaluation_id=evaluation.id, score_20=15.0)
    db_session.commit()

    assert updated.status == EvaluationStatus.CORRIGE
    assert updated.score_20 == 15.0
