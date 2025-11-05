"""Coach service generating personalized study tasks."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, Iterable, List, Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.dashboard import EpreuvePlan, Progress, Task, TaskSource, TaskStatus
from app.utils.audit import record_event


def _fetch_epreuves(session: Session, student_id: UUID) -> Sequence[EpreuvePlan]:
    stmt = (
        select(EpreuvePlan)
        .where(EpreuvePlan.student_id == student_id)
        .order_by(EpreuvePlan.scheduled_at.asc().nullslast(), EpreuvePlan.created_at.asc())
    )
    return session.scalars(stmt).all()


def _fetch_tasks(session: Session, student_id: UUID) -> Dict[str, Task]:
    stmt = select(Task).where(Task.student_id == student_id)
    return {task.label: task for task in session.scalars(stmt).all()}


def _fetch_lowest_progress(session: Session, student_id: UUID, limit: int = 3) -> List[tuple[str, float]]:
    stmt = (
        select(Progress.subject, Progress.score)
        .where(Progress.student_id == student_id)
        .order_by(Progress.score.asc())
        .limit(limit)
    )
    entries = session.execute(stmt).all()
    collapsed: Dict[str, List[float]] = {}
    for subject, score in entries:
        collapsed.setdefault(subject, []).append(score)
    averaged: List[tuple[str, float]] = []
    for subject, scores in collapsed.items():
        averaged.append((subject, sum(scores) / len(scores)))
    averaged.sort(key=lambda item: item[1])
    return averaged[:limit]


def _ensure_due(due_at: datetime | None, fallback_days: int) -> datetime:
    base = due_at or datetime.utcnow() + timedelta(days=fallback_days)
    if base < datetime.utcnow():
        return datetime.utcnow() + timedelta(days=fallback_days)
    return base


def _schedule_relative(reference: datetime | None, offset_days: int, fallback_days: int) -> datetime:
    if reference is None:
        return datetime.utcnow() + timedelta(days=fallback_days)
    target = reference - timedelta(days=offset_days)
    if target < datetime.utcnow():
        return datetime.utcnow() + timedelta(days=fallback_days)
    return target


def _upsert_task(
    session: Session,
    existing: Dict[str, Task],
    *,
    student_id: UUID,
    label: str,
    due_at: datetime,
    weight: float,
) -> tuple[Task, bool]:
    task = existing.get(label)
    if task:
        changed = False
        if task.status == TaskStatus.DONE:
            return task, False
        if task.status != TaskStatus.TODO:
            task.status = TaskStatus.TODO
            changed = True
        if task.source != TaskSource.AGENT:
            task.source = TaskSource.AGENT
            changed = True
        if due_at is not None and (
            task.due_at is None or due_at < task.due_at
        ):
            task.due_at = due_at
            changed = True
        if weight > task.weight:
            task.weight = weight
            changed = True
    else:
        task = Task(
            student_id=student_id,
            label=label,
            due_at=due_at,
            weight=weight,
            status=TaskStatus.TODO,
            source=TaskSource.AGENT,
        )
        session.add(task)
        existing[label] = task
        changed = True
    return task, changed


def generate_tasks(session: Session, student_id: UUID, *, limit_per_epreuve: int = 2) -> List[Task]:
    upcoming_epreuves = _fetch_epreuves(session, student_id)
    existing_tasks = _fetch_tasks(session, student_id)
    generated: List[Task] = []

    for plan in upcoming_epreuves:
        reference = plan.scheduled_at
        labels = [
            f"Préparer {plan.label}",
            f"Simulation pour {plan.label}",
        ][:limit_per_epreuve]
        offsets = [7, 3][:limit_per_epreuve]
        weights = [1.0, 0.8][:limit_per_epreuve]
        for label, offset, weight in zip(labels, offsets, weights):
            due_at = _schedule_relative(reference, offset, fallback_days=5)
            task, changed = _upsert_task(
                session,
                existing_tasks,
                student_id=student_id,
                label=label,
                due_at=due_at,
                weight=weight,
            )
            if changed:
                generated.append(task)

    for subject, score in _fetch_lowest_progress(session, student_id):
        label = f"Révision ciblée : {subject.capitalize()}"
        due_at = datetime.utcnow() + timedelta(days=4)
        weight = 1.0 if score < 0.5 else 0.7
        task, changed = _upsert_task(
            session,
            existing_tasks,
            student_id=student_id,
            label=label,
            due_at=_ensure_due(due_at, fallback_days=4),
            weight=weight,
        )
        if changed:
            generated.append(task)

    session.flush()
    if generated:
        record_event(
            session,
            student_id=student_id,
            kind="COACH_TASKS_SYNCED",
            payload={"count": len({task.id for task in generated})},
        )
    return generated


def bulk_generate(session: Session, student_ids: Iterable[UUID]) -> Dict[UUID, int]:
    results: Dict[UUID, int] = {}
    for student_id in student_ids:
        tasks = generate_tasks(session, student_id)
        results[student_id] = len(tasks)
    return results
