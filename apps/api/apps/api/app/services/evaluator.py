"""Evaluator agent service for automated grading flows."""

from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.dashboard import Evaluation, EvaluationStatus
from app.utils.audit import record_event

from . import evaluations as evaluations_service
from .evaluations import EvaluationNotFoundError

_DEFAULT_FEEDBACK = [
    {"step": "structure", "comment": "Structurer davantage l'introduction et la conclusion."},
    {"step": "precision", "comment": "Illustrer avec un exemple concret."},
]


def _compute_score(base_score: Optional[float]) -> float:
    if base_score is None:
        return 12.0
    return max(0.0, min(20.0, base_score))


def auto_grade(
    session: Session,
    *,
    evaluation_id: UUID,
    score_20: Optional[float] = None,
    feedback: Optional[List[Dict[str, Any]]] = None,
) -> Evaluation:
    evaluation = evaluations_service.get_evaluation(session, evaluation_id)
    if evaluation.status == EvaluationStatus.CORRIGE:
        return evaluation

    normalized_score = _compute_score(score_20)
    applied_feedback = feedback if feedback else _DEFAULT_FEEDBACK

    updated = evaluations_service.apply_grade(
        session,
        evaluation_id=evaluation_id,
        score_20=normalized_score,
        feedback=applied_feedback,
    )

    record_event(
        session,
        student_id=updated.student_id,
        kind="EVAL_AUTO_GRADED",
        payload={
            "evaluation_id": str(updated.id),
            "score_20": normalized_score,
        },
    )

    return updated


def bulk_auto_grade(
    session: Session,
    evaluation_ids: Iterable[UUID],
    *,
    default_score: Optional[float] = None,
) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    for evaluation_id in evaluation_ids:
        try:
            with session.begin_nested():
                updated = auto_grade(
                    session,
                    evaluation_id=evaluation_id,
                    score_20=default_score,
                )
                results.append({
                    "evaluation_id": updated.id,
                    "status": "graded",
                    "score_20": updated.score_20,
                })
        except EvaluationNotFoundError:
            results.append({
                "evaluation_id": evaluation_id,
                "status": "not_found",
                "score_20": None,
            })
    session.flush()
    return results
