from __future__ import annotations

from datetime import datetime, timedelta
from typing import Iterable, Optional, List, Dict
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.dashboard import (
    DashboardSummarySnapshot,
    EpreuvePlan,
    Evaluation,
    EvaluationStatus,
    Progress,
    Task,
    TaskSource,
    TaskStatus,
)
from app.models.session import Booking, Session as SessionModel, SessionStatus
from app.models.student import Student
from app.utils.audit import record_event


DASHBOARD_SUMMARY_REFRESH_EVENT = "DASHBOARD_SUMMARY_REFRESH_REQUESTED"


def _get_summary_snapshot(session: Session, student_id: UUID) -> Optional[DashboardSummarySnapshot]:
    statement = select(DashboardSummarySnapshot).where(DashboardSummarySnapshot.student_id == student_id)
    return session.execute(statement).scalar_one_or_none()


def _request_dashboard_refresh(session: Session, student_id: UUID, *, reason: str) -> None:
    record_event(
        session,
        student_id=student_id,
        kind=DASHBOARD_SUMMARY_REFRESH_EVENT,
        payload={"reason": reason},
    )


def ensure_student(session: Session, student_id: UUID) -> Student:
    student = session.execute(select(Student).where(Student.id == student_id)).scalar_one_or_none()
    if student:
        return student

    student = session.execute(select(Student).where(Student.dashboard_student_id == student_id)).scalar_one_or_none()
    if not student:
        raise ValueError("Student not found")
    return student


def _coerce_enum(enum_cls, value):
    if value is None:
        return None
    if isinstance(value, enum_cls):
        return value
    value_str = str(value).strip()
    for item in enum_cls:
        if value_str.lower() in {item.value.lower(), item.name.lower()}:
            return item
    raise ValueError(f"Invalid {enum_cls.__name__}")


def get_dashboard_kpis(session: Session, student_id: UUID) -> dict[str, Optional[float]]:
    snapshot = _get_summary_snapshot(session, student_id)

    if snapshot:
        last_eval_score = snapshot.last_eval_score
        progress_overall = float(snapshot.progress_overall or 0.0)
    else:
        last_eval_query = (
            select(Evaluation.score_20)
            .where(Evaluation.student_id == student_id, Evaluation.status == EvaluationStatus.CORRIGE)
            .order_by(Evaluation.created_at.desc())
            .limit(1)
        )
        last_eval_score = session.execute(last_eval_query).scalar_one_or_none()
        avg_progress_query = select(func.coalesce(func.avg(Progress.score), 0.0)).where(Progress.student_id == student_id)
        progress_overall = float(session.execute(avg_progress_query).scalar_one())

    streak_query = (
        select(func.count())
        .where(
            Progress.student_id == student_id,
            Progress.updated_at >= datetime.utcnow() - timedelta(days=30),
        )
    )
    contributions = session.execute(streak_query).scalar_one()
    streak_days = int(contributions or 0)

    return {
        "progress_overall": progress_overall,
        "streak_days": streak_days,
        "last_eval_score": last_eval_score,
    }


def _enum_value(enum_member):
    if enum_member is None:
        return None
    return enum_member.value if hasattr(enum_member, "value") else str(enum_member)


def list_upcoming_sessions(session: Session, student_id: UUID, limit: int = 4) -> list[dict]:
    query = (
        select(SessionModel, Booking)
        .join(Booking, Booking.session_id == SessionModel.id)
        .where(
            Booking.student_id == student_id,
            SessionModel.status.in_([SessionStatus.CONFIRME, SessionStatus.PROPOSE]),
            SessionModel.slot_start >= datetime.utcnow() - timedelta(hours=2),
        )
        .order_by(SessionModel.slot_start.asc())
        .limit(limit)
    )
    rows = session.execute(query)
    items: list[dict] = []
    for learning_session, booking in rows.all():
        items.append(
            {
                "id": str(learning_session.id),
                "at": learning_session.slot_start,
                "kind": _enum_value(learning_session.kind) or "Visio",
                "title": _enum_value(learning_session.kind) or "Session",
                "status": _enum_value(learning_session.status),
                "location": None,
            }
        )
    return items


def list_pending_tasks(session: Session, student_id: UUID, limit: int = 6) -> list[dict]:
    query = (
        select(Task)
        .where(
            Task.student_id == student_id,
            Task.status.in_([TaskStatus.TODO, TaskStatus.SKIPPED]),
        )
        .order_by(Task.due_at.asc().nullslast())
        .limit(limit)
    )
    rows = session.execute(query)
    return [serialize_task(task) for task in rows.scalars().all()]


def list_tasks(session: Session, student_id: UUID) -> list[dict]:
    query = (
        select(Task)
        .where(Task.student_id == student_id)
        .order_by(Task.due_at.asc().nullslast(), Task.created_at.desc())
    )
    rows = session.execute(query)
    return [serialize_task(task) for task in rows.scalars().all()]


def compute_task_backlog(session: Session, student_id: UUID, limit: int = 12) -> List[Dict[str, List[dict]]]:
    query = (
        select(Task)
        .where(Task.student_id == student_id, Task.status == TaskStatus.TODO)
        .order_by(Task.due_at.asc().nullslast(), Task.created_at.desc())
    )
    tasks = session.execute(query).scalars().all()

    if not tasks:
        return []

    now = datetime.utcnow()
    week_horizon = now + timedelta(days=7)
    month_horizon = now + timedelta(days=30)

    buckets: Dict[str, List[dict]] = {
        "En retard": [],
        "Cette semaine": [],
        "Ce mois-ci": [],
        "À venir": [],
        "Sans échéance": [],
    }

    for task in tasks:
        serialized = serialize_task(task)
        due_at = serialized.get("due_at")
        target = "Sans échéance"
        if isinstance(due_at, datetime):
            if due_at < now:
                target = "En retard"
            elif due_at <= week_horizon:
                target = "Cette semaine"
            elif due_at <= month_horizon:
                target = "Ce mois-ci"
            else:
                target = "À venir"
        buckets[target].append(serialized)

    ordered_labels = ["En retard", "Cette semaine", "Ce mois-ci", "À venir", "Sans échéance"]
    result: List[Dict[str, List[dict]]] = []
    for label in ordered_labels:
        items = buckets[label][:limit]
        if items:
            result.append({"label": label, "tasks": items})
    return result


def serialize_task(task: Task) -> dict:
    return {
        "id": str(task.id),
        "label": task.label,
        "status": _enum_value(task.status) or TaskStatus.TODO.value,
        "due_at": task.due_at,
        "weight": task.weight,
        "source": _enum_value(task.source),
    }


def list_agenda(session: Session, student_id: UUID) -> list[dict]:
    query = (
        select(SessionModel, Booking)
        .join(Booking, Booking.session_id == SessionModel.id)
        .where(Booking.student_id == student_id)
        .order_by(SessionModel.slot_start.asc())
    )
    rows = session.execute(query)
    agenda: list[dict] = []
    for learning_session, booking in rows.all():
        agenda.append(
            {
                "id": str(learning_session.id),
                "title": _enum_value(learning_session.kind) or "Session",
                "kind": _enum_value(learning_session.kind) or "Visio",
                "start_at": learning_session.slot_start,
                "end_at": learning_session.slot_end,
                "status": _enum_value(learning_session.status) or SessionStatus.PROPOSE.value,
                "location": None,
            }
        )
    return agenda


def list_progress(session: Session, student_id: UUID, limit: int = 100) -> list[dict]:
    query = (
        select(Progress)
        .where(Progress.student_id == student_id)
        .order_by(Progress.updated_at.desc())
        .limit(limit)
    )
    rows = session.execute(query)
    return [
        {
            "subject": row.subject,
            "chapter_code": row.chapter_code,
            "competence_code": row.competence_code,
            "score": row.score,
            "updated_at": row.updated_at,
        }
        for row in rows.scalars().all()
    ]


def list_epreuves(session: Session, student: Student) -> dict:
    query = (
        select(EpreuvePlan)
        .where(EpreuvePlan.student_id == student.id)
        .order_by(EpreuvePlan.scheduled_at.asc().nullslast())
    )
    rows = session.execute(query)
    items = [
        {
            "id": str(row.id),
            "code": row.code,
            "label": row.label,
            "weight": row.weight,
            "scheduled_at": row.scheduled_at,
            "format": row.format,
            "source": _enum_value(row.source) or "Agent",
        }
        for row in rows.scalars().all()
    ]
    return {
        "track": _enum_value(student.track) or "Terminale",
        "profile": _enum_value(student.profile) or "Scolarise",
        "items": items,
    }


def get_task(session: Session, task_id: UUID) -> Task:
    query = select(Task).where(Task.id == task_id)
    result = session.execute(query)
    task = result.scalar_one_or_none()
    if not task:
        raise ValueError("Task not found")
    return task


def update_task_status(session: Session, task: Task, status: TaskStatus | str) -> Task:
    previous = task.status
    task.status = _coerce_enum(TaskStatus, status)
    session.flush()
    if previous != task.status:
        record_event(
            session,
            student_id=task.student_id,
            kind="TASK_STATUS_UPDATED",
            payload={"task_id": str(task.id), "status": task.status.value},
        )
        _request_dashboard_refresh(session, task.student_id, reason="task_status_updated")
    return task


def bulk_upsert_tasks(
    session: Session,
    student_id: UUID,
    payload: Iterable[dict],
) -> list[Task]:
    updated: list[Task] = []
    should_refresh = False
    for item in payload:
        task_id = item.get("id")
        task: Optional[Task] = None
        if task_id:
            result = session.execute(select(Task).where(Task.id == task_id, Task.student_id == student_id))
            task = result.scalar_one_or_none()
        created = False
        if not task:
            task = Task(student_id=student_id)
            session.add(task)
            created = True
            should_refresh = True
        previous_status = task.status
        task.label = item.get("label", task.label)
        if "status" in item:
            coerced_status = _coerce_enum(TaskStatus, item.get("status"))
            if coerced_status is not None:
                task.status = coerced_status
                if coerced_status != previous_status:
                    should_refresh = True
        if "weight" in item and item["weight"] is not None:
            task.weight = item["weight"]
        if "due_at" in item:
            task.due_at = item["due_at"]
            should_refresh = True
        if "source" in item:
            coerced_source = _coerce_enum(TaskSource, item.get("source"))
            if coerced_source is not None:
                task.source = coerced_source
        if created:
            record_event(
                session,
                student_id=student_id,
                kind="TASK_CREATED",
                payload={"task_id": str(task.id)},
            )
        if previous_status != task.status:
            should_refresh = True
            record_event(
                session,
                student_id=student_id,
                kind="TASK_STATUS_UPDATED",
                payload={
                    "task_id": str(task.id),
                    "status": task.status.value if task.status else None,
                },
            )
        updated.append(task)
    session.flush()
    if should_refresh:
        _request_dashboard_refresh(session, student_id, reason="tasks_bulk_upserted")
    return updated