from __future__ import annotations

from typing import Dict, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.agents import (
    BulkSyncRequest,
    BulkSyncResponse,
    EvaluatorBulkRequest,
    EvaluatorBulkResponse,
    EvaluatorBulkResult,
    EvaluatorGradeRequest,
    CoachSyncRequest,
    CoachSyncResponse,
    PlannerSyncRequest,
    PlannerSyncResponse,
    ReporterBulkRequest,
    ReporterBulkResponse,
)
from app.schemas.dashboard import EvaluationResponse
from app.schemas.parent import ParentReportResponse
from app.services import coach, planner
from app.services import evaluator
from app.services import evaluations as evaluations_service
from app.services import reports as reports_service
from app.services.evaluations import EvaluationNotFoundError
from app.utils.security import ActorContext, Role, ensure_access, require_role

router = APIRouter(prefix="/agents", tags=["agents"])


@router.post("/planner/sync", response_model=PlannerSyncResponse)
def sync_planner(
    payload: PlannerSyncRequest,
    actor: ActorContext = Depends(require_role(Role.COACH, Role.ADMIN)),
    db: Session = Depends(get_db),
) -> PlannerSyncResponse:
    ensure_access(actor, str(payload.student_id))
    items = planner.sync_epreuves_plan(db, payload.student_id)
    db.commit()
    return PlannerSyncResponse(student_id=payload.student_id, items=len(items))


@router.post("/coach/sync", response_model=CoachSyncResponse)
def sync_coach(
    payload: CoachSyncRequest,
    actor: ActorContext = Depends(require_role(Role.COACH, Role.ADMIN)),
    db: Session = Depends(get_db),
) -> CoachSyncResponse:
    ensure_access(actor, str(payload.student_id))
    tasks = coach.generate_tasks(db, payload.student_id)
    db.commit()
    return CoachSyncResponse(student_id=payload.student_id, tasks_created=len(tasks))


@router.post("/planner/bulk", response_model=BulkSyncResponse)
def bulk_planner(
    payload: BulkSyncRequest,
    actor: ActorContext = Depends(require_role(Role.COACH, Role.ADMIN)),
    db: Session = Depends(get_db),
) -> BulkSyncResponse:
    results: Dict[str, int] = {}
    for student_id in payload.student_ids:
        ensure_access(actor, str(student_id))
        items = planner.sync_epreuves_plan(db, student_id)
        results[str(student_id)] = len(items)
    db.commit()
    return BulkSyncResponse(counts=results)


@router.post("/coach/bulk", response_model=BulkSyncResponse)
def bulk_coach(
    payload: BulkSyncRequest,
    actor: ActorContext = Depends(require_role(Role.COACH, Role.ADMIN)),
    db: Session = Depends(get_db),
) -> BulkSyncResponse:
    results: Dict[str, int] = {}
    for student_id in payload.student_ids:
        ensure_access(actor, str(student_id))
        tasks = coach.generate_tasks(db, student_id)
        results[str(student_id)] = len(tasks)
    db.commit()
    return BulkSyncResponse(counts=results)


@router.post("/evaluator/grade", response_model=EvaluationResponse)
def evaluator_grade(
    payload: EvaluatorGradeRequest,
    actor: ActorContext = Depends(require_role(Role.COACH, Role.ADMIN)),
    db: Session = Depends(get_db),
) -> EvaluationResponse:
    try:
        evaluation = evaluations_service.get_evaluation(db, payload.evaluation_id)
    except EvaluationNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    ensure_access(actor, str(evaluation.student_id))

    feedback = [item.dict() for item in payload.feedback] if payload.feedback else None
    updated = evaluator.auto_grade(
        db,
        evaluation_id=evaluation.id,
        score_20=payload.score_20,
        feedback=feedback,
    )
    db.commit()
    db.refresh(updated)
    return EvaluationResponse(**evaluations_service.serialize_evaluation(updated))


@router.post("/evaluator/bulk", response_model=EvaluatorBulkResponse)
def evaluator_bulk(
    payload: EvaluatorBulkRequest,
    actor: ActorContext = Depends(require_role(Role.COACH, Role.ADMIN)),
    db: Session = Depends(get_db),
) -> EvaluatorBulkResponse:
    accessible_ids: List[UUID] = []
    missing_ids: List[UUID] = []

    for evaluation_id in payload.evaluation_ids:
        try:
            evaluation = evaluations_service.get_evaluation(db, evaluation_id)
        except EvaluationNotFoundError:
            missing_ids.append(evaluation_id)
            continue
        ensure_access(actor, str(evaluation.student_id))
        accessible_ids.append(evaluation_id)

    results: List[Dict] = []
    if accessible_ids:
        results.extend(
            evaluator.bulk_auto_grade(db, accessible_ids, default_score=payload.score_20)
        )

    for missing in missing_ids:
        results.append({"evaluation_id": missing, "status": "not_found", "score_20": None})

    db.commit()

    normalized = []
    for result in results:
        evaluation_id = UUID(str(result.get("evaluation_id")))
        normalized.append(
            EvaluatorBulkResult(
                evaluation_id=evaluation_id,
                status=str(result.get("status", "unknown")),
                score_20=result.get("score_20"),
            )
        )
    return EvaluatorBulkResponse(results=normalized)


@router.post("/reporter/bulk", response_model=ReporterBulkResponse)
def reporter_bulk(
    payload: ReporterBulkRequest,
    actor: ActorContext = Depends(require_role(Role.COACH, Role.ADMIN, Role.PARENT)),
    db: Session = Depends(get_db),
) -> ReporterBulkResponse:
    report_map: Dict[UUID, Dict[str, object]] = {}

    if payload.student_ids is None:
        if actor.role != Role.ADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
        report_map = reports_service.generate_reports_for_students(
            db,
            period=payload.period,
            student_ids=None,
            regenerate=payload.regenerate,
        )
    else:
        normalized_ids: List[UUID] = []
        for student_id in payload.student_ids:
            ensure_access(actor, str(student_id))
            normalized_ids.append(student_id)

        report_map = reports_service.generate_reports_for_students(
            db,
            period=payload.period,
            student_ids=normalized_ids,
            regenerate=payload.regenerate,
        )

    db.commit()

    reports: List[ParentReportResponse] = []
    for student_id in sorted(report_map.keys(), key=lambda value: str(value)):
        payload_dict = report_map[student_id]
        reports.append(ParentReportResponse.model_validate(payload_dict))

    return ReporterBulkResponse(reports=reports)
