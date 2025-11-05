from ..api import models
from ..policies.loader import get_scheme


def test_diagnostic_report_schema():
    report = models.DiagnosticReport(
        student_id="stu-1",
        chapter="recurrence",
        items=[],
        summary="RAS",
    )
    assert report.student_id == "stu-1"


def test_study_plan_schema():
    plan = models.StudyPlan(
        student_id="stu-1",
        horizon="week",
        slots=[],
        checkpoints=[],
        spaced_repetition=[],
    )
    assert plan.horizon == "week"


def test_pedagogy_scheme():
    scheme = get_scheme("bac_maths_gen")
    assert scheme["exercises"], "Expected exercises in grading scheme"
