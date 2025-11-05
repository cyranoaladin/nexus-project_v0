from __future__ import annotations

from datetime import datetime
import json
from typing import Any, Optional, Sequence, Dict, List
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.dashboard import Evaluation, EvaluationStatus
from app.models.student import Student
from app.utils.audit import record_event


class EvaluationNotFoundError(ValueError):
    pass


def ensure_student(session: Session, student_id: UUID) -> Student:
    student = session.get(Student, student_id)
    if student:
        return student

    student = session.execute(select(Student).where(Student.dashboard_student_id == student_id)).scalar_one_or_none()
    if not student:
        raise ValueError("Student not found")
    return student


def list_evaluations(session: Session, student_id: UUID) -> List[Evaluation]:
    ensure_student(session, student_id)
    query = select(Evaluation).where(Evaluation.student_id == student_id).order_by(Evaluation.created_at.desc())
    return list(session.scalars(query).all())


def generate_evaluation(
    session: Session,
    *,
    student_id: UUID,
    subject: str,
    level: str,
    duration: int,
    constraints: Optional[dict[str, Any]] = None,
) -> Evaluation:
    ensure_student(session, student_id)
    metadata = {
        "level": level,
        "constraints": json.dumps(constraints or {}),
        "generated_at": datetime.utcnow().isoformat(),
    }
    evaluation = Evaluation(
        student_id=student_id,
        subject=subject,
        generator="dashboard-agent",
        duration_min=duration,
        status=EvaluationStatus.PROPOSE,
        feedback_json={"meta": metadata, "history": []},
    )
    session.add(evaluation)
    session.flush()
    record_event(
        session,
        student_id=student_id,
        kind="EVAL_GENERATED",
        payload={"evaluation_id": str(evaluation.id), "subject": subject},
    )
    return evaluation


def get_evaluation(session: Session, evaluation_id: UUID) -> Evaluation:
    query = select(Evaluation).where(Evaluation.id == evaluation_id)
    result = session.execute(query).scalar_one_or_none()
    if not result:
        raise EvaluationNotFoundError("Evaluation not found")
    return result


def record_submission(
    session: Session,
    *,
    evaluation_id: UUID,
    files: Sequence[dict[str, Any]],
    submitted_by: str,
) -> Evaluation:
    evaluation = get_evaluation(session, evaluation_id)
    current = evaluation.feedback_json or {}
    submissions = current.get("submissions", [])
    submissions.append(
        {
            "submitted_at": datetime.utcnow().isoformat(),
            "submitted_by": submitted_by,
            "files": list(files),
        }
    )
    evaluation.status = EvaluationStatus.SOUMIS
    evaluation.feedback_json = {**current, "submissions": submissions}
    session.flush()
    record_event(
        session,
        student_id=evaluation.student_id,
        kind="EVAL_SUBMITTED",
        payload={
            "evaluation_id": str(evaluation.id),
            "files": [f.get("name") for f in files],
            "submitted_by": submitted_by,
        },
    )
    return evaluation


def apply_grade(
    session: Session,
    *,
    evaluation_id: UUID,
    score_20: float,
    feedback: list[dict[str, Any]],
) -> Evaluation:
    evaluation = get_evaluation(session, evaluation_id)
    current = evaluation.feedback_json or {}
    meta = current.get("meta", {})
    history = current.get("history", [])
    submissions = current.get("submissions", [])
    history.append({"graded_at": datetime.utcnow().isoformat(), "score_20": score_20})

    evaluation.status = EvaluationStatus.CORRIGE
    evaluation.score_20 = score_20
    evaluation.feedback_json = {
        "meta": meta,
        "history": history,
        "items": feedback,
        "submissions": submissions,
    }
    session.flush()
    record_event(
        session,
        student_id=evaluation.student_id,
        kind="EVAL_GRADED",
        payload={"evaluation_id": str(evaluation.id), "score_20": score_20},
    )
    return evaluation


def serialize_evaluation(evaluation: Evaluation) -> Dict[str, Any]:
    payload = evaluation.feedback_json or {}
    meta = payload.get("meta", {})
    feedback_items = payload.get("items") or None
    submissions = payload.get("submissions") or None
    history = payload.get("history") or None

    normalized_meta: Dict[str, str] = {}
    for key, value in meta.items():
        if isinstance(value, (dict, list)):
            normalized_meta[key] = json.dumps(value)
        else:
            normalized_meta[key] = str(value)

    return {
        "id": evaluation.id,
        "student_id": evaluation.student_id,
        "subject": evaluation.subject,
        "status": evaluation.status.value if hasattr(evaluation.status, "value") else str(evaluation.status),
        "duration_min": evaluation.duration_min,
        "score_20": evaluation.score_20,
        "created_at": evaluation.created_at,
        "metadata": normalized_meta,
        "feedback": feedback_items,
        "submissions": submissions,
        "history": history,
    }
