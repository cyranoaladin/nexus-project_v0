from __future__ import annotations

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.dashboard import Evaluation
from app.schemas.dashboard import (
    AgendaResponse,
    DashboardSummaryResponse,
    EvaluationFeedbackRequest,
    EvaluationGenerateRequest,
    EvaluationResponse,
    EpreuvesResponse,
    ProgressionResponse,
    TaskCompleteRequest,
    TaskUpdateList,
    TasksBulkResponse,
)
from app.services import dashboard as dashboard_service
from app.services import evaluations as evaluations_service
from app.utils.security import ActorContext, Role, ensure_access, require_role

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _serialize_evaluation(obj: Evaluation) -> EvaluationResponse:
    payload = evaluations_service.serialize_evaluation(obj)
    return EvaluationResponse(**payload)


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    student_id: UUID = Query(..., description="Identifier of the student"),
    actor: ActorContext = Depends(require_role(Role.STUDENT, Role.PARENT, Role.COACH, Role.ADMIN)),
    db: Session = Depends(get_db),
) -> DashboardSummaryResponse:
    try:
        student = dashboard_service.ensure_student(db, student_id)
    except ValueError as exc:  # pragma: no cover - ValueError maps to 404
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    ensure_access(actor, str(student.id))

    kpis = dashboard_service.get_dashboard_kpis(db, student.id)
    upcoming = dashboard_service.list_upcoming_sessions(db, student.id)
    tasks = dashboard_service.list_pending_tasks(db, student.id)
    backlog = dashboard_service.compute_task_backlog(db, student.id)

    return DashboardSummaryResponse(kpis=kpis, upcoming=upcoming, tasks=tasks, backlog=backlog or None)


@router.get("/agenda", response_model=AgendaResponse)
def get_agenda(
    student_id: UUID = Query(..., description="Identifier of the student"),
    from_: Optional[datetime] = Query(None, alias="from", description="Lower bound (inclusive) for agenda range"),
    to: Optional[datetime] = Query(None, description="Upper bound (inclusive) for agenda range"),
    actor: ActorContext = Depends(require_role(Role.STUDENT, Role.PARENT, Role.COACH, Role.ADMIN)),
    db: Session = Depends(get_db),
) -> AgendaResponse:
    try:
        student = dashboard_service.ensure_student(db, student_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    ensure_access(actor, str(student.id))
    items = dashboard_service.list_agenda(db, student.id)

    if from_:
        items = [item for item in items if item["start_at"] >= from_]
    if to:
        items = [item for item in items if item["start_at"] <= to]
    return AgendaResponse(items=items)


@router.get("/progression", response_model=ProgressionResponse)
def get_progression(
    student_id: UUID = Query(..., description="Identifier of the student"),
    subject: Optional[str] = Query(None, description="Optional filter for a given subject"),
    actor: ActorContext = Depends(require_role(Role.STUDENT, Role.PARENT, Role.COACH, Role.ADMIN)),
    db: Session = Depends(get_db),
) -> ProgressionResponse:
    try:
        student = dashboard_service.ensure_student(db, student_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    ensure_access(actor, str(student.id))
    entries = dashboard_service.list_progress(db, student.id)
    if subject:
        entries = [entry for entry in entries if entry["subject"].lower() == subject.lower()]
    return ProgressionResponse(entries=entries)


@router.get("/epreuves", response_model=EpreuvesResponse)
def get_epreuves(
    student_id: UUID = Query(..., description="Identifier of the student"),
    actor: ActorContext = Depends(require_role(Role.STUDENT, Role.PARENT, Role.COACH, Role.ADMIN)),
    db: Session = Depends(get_db),
) -> EpreuvesResponse:
    try:
        student = dashboard_service.ensure_student(db, student_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    ensure_access(actor, str(student.id))
    payload = dashboard_service.list_epreuves(db, student)
    return EpreuvesResponse(**payload)


@router.get("/tasks", response_model=TasksBulkResponse)
def list_tasks(
    student_id: UUID = Query(..., description="Identifier of the student"),
    actor: ActorContext = Depends(require_role(Role.STUDENT, Role.PARENT, Role.COACH, Role.ADMIN)),
    db: Session = Depends(get_db),
) -> TasksBulkResponse:
    try:
        student = dashboard_service.ensure_student(db, student_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    ensure_access(actor, str(student.id))
    tasks = dashboard_service.list_tasks(db, student.id)
    return TasksBulkResponse(tasks=tasks)


@router.post("/tasks/complete", response_model=TasksBulkResponse)
def complete_task(
    payload: TaskCompleteRequest,
    actor: ActorContext = Depends(require_role(Role.STUDENT, Role.COACH, Role.ADMIN)),
    db: Session = Depends(get_db),
) -> TasksBulkResponse:
    try:
        task = dashboard_service.get_task(db, payload.task_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    ensure_access(actor, str(task.student_id))

    try:
        updated_task = dashboard_service.update_task_status(db, task, payload.status or "Done")
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    db.commit()
    return TasksBulkResponse(tasks=[dashboard_service.serialize_task(updated_task)])


@router.put("/tasks", response_model=TasksBulkResponse)
def bulk_upsert_tasks(
    payload: TaskUpdateList,
    student_id: UUID = Query(..., description="Identifier of the student"),
    actor: ActorContext = Depends(require_role(Role.COACH, Role.ADMIN)),
    db: Session = Depends(get_db),
) -> TasksBulkResponse:
    try:
        student = dashboard_service.ensure_student(db, student_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    ensure_access(actor, str(student.id))

    try:
        updated = dashboard_service.bulk_upsert_tasks(db, student.id, [item.dict(exclude_none=True) for item in payload])
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    db.commit()
    serialized = [dashboard_service.serialize_task(task) for task in updated]
    return TasksBulkResponse(tasks=serialized)


@router.get("/evaluations", response_model=List[EvaluationResponse])
def list_evaluations_endpoint(
    student_id: UUID = Query(..., description="Identifier of the student"),
    actor: ActorContext = Depends(require_role(Role.STUDENT, Role.PARENT, Role.COACH, Role.ADMIN)),
    db: Session = Depends(get_db),
) -> List[EvaluationResponse]:
    try:
        student = dashboard_service.ensure_student(db, student_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    ensure_access(actor, str(student.id))
    evaluations = evaluations_service.list_evaluations(db, student.id)
    return [_serialize_evaluation(item) for item in evaluations]


@router.post("/evaluations/generate", response_model=EvaluationResponse)
def generate_evaluation(
    payload: EvaluationGenerateRequest,
    actor: ActorContext = Depends(require_role(Role.COACH, Role.ADMIN)),
    db: Session = Depends(get_db),
) -> EvaluationResponse:
    try:
        student = dashboard_service.ensure_student(db, payload.student_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    ensure_access(actor, str(student.id))

    try:
        evaluation = evaluations_service.generate_evaluation(
            db,
            student_id=payload.student_id,
            subject=payload.subject,
            level=payload.level,
            duration=payload.duration,
            constraints=payload.constraints,
        )
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    db.commit()
    db.refresh(evaluation)
    return _serialize_evaluation(evaluation)


@router.post("/evaluations/{evaluation_id}/feedback", response_model=EvaluationResponse)
def provide_evaluation_feedback(
    evaluation_id: UUID,
    payload: EvaluationFeedbackRequest,
    actor: ActorContext = Depends(require_role(Role.COACH, Role.ADMIN)),
    db: Session = Depends(get_db),
) -> EvaluationResponse:
    try:
        evaluation = evaluations_service.get_evaluation(db, evaluation_id)
    except evaluations_service.EvaluationNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    ensure_access(actor, str(evaluation.student_id))

    updated = evaluations_service.apply_grade(
        db,
        evaluation_id=evaluation_id,
        score_20=payload.score_20,
        feedback=[item.dict() for item in payload.feedback],
    )

    db.commit()
    db.refresh(updated)
    return _serialize_evaluation(updated)