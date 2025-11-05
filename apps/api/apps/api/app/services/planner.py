"""Planner service to orchestrate personalized exam plans."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, Iterable, List, Tuple
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.dashboard import EpreuvePlan, EpreuveSource
from app.models.student import Student, StudentProfile, StudentTrack
from app.utils.audit import record_event

_PLAN_LIBRARY: Dict[Tuple[StudentTrack, StudentProfile], List[dict]] = {
    (StudentTrack.PREMIERE, StudentProfile.SCOLARISE): [
        {
            "code": "FR-ECRIT",
            "label": "Écrit de français",
            "format": "Écrit 4h",
            "weight": 1.0,
            "days_until": 220,
        },
        {
            "code": "FR-ORAL",
            "label": "Oral de français",
            "format": "Oral 20 min",
            "weight": 1.0,
            "days_until": 240,
        },
    ],
    (StudentTrack.PREMIERE, StudentProfile.LIBRE): [
        {
            "code": "FR-ECRIT-LIBRE",
            "label": "Écrit de français (candidat libre)",
            "format": "Écrit 4h",
            "weight": 1.0,
            "days_until": 210,
        },
        {
            "code": "FR-ORAL-LIBRE",
            "label": "Oral de français (candidat libre)",
            "format": "Oral 20 min",
            "weight": 1.0,
            "days_until": 230,
        },
    ],
    (StudentTrack.TERMINALE, StudentProfile.SCOLARISE): [
        {
            "code": "PHILO",
            "label": "Philosophie",
            "format": "Écrit 4h",
            "weight": 1.0,
            "days_until": 190,
        },
        {
            "code": "GRAND_ORAL",
            "label": "Grand oral",
            "format": "Oral 20 min",
            "weight": 1.0,
            "days_until": 200,
        },
        {
            "code": "SPECIALITE-1",
            "label": "Épreuve de spécialité 1",
            "format": "Écrit 4h",
            "weight": 1.5,
            "days_until": 150,
        },
        {
            "code": "SPECIALITE-2",
            "label": "Épreuve de spécialité 2",
            "format": "Écrit 4h",
            "weight": 1.5,
            "days_until": 155,
        },
    ],
    (StudentTrack.TERMINALE, StudentProfile.LIBRE): [
        {
            "code": "PHILO-LIBRE",
            "label": "Philosophie (candidat libre)",
            "format": "Écrit 4h",
            "weight": 1.0,
            "days_until": 200,
        },
        {
            "code": "GRAND_ORAL-LIBRE",
            "label": "Grand oral (candidat libre)",
            "format": "Oral 20 min",
            "weight": 1.0,
            "days_until": 210,
        },
    ],
}

_DEFAULT_PLAN = [
    {
        "code": "SUIVI_ORAL",
        "label": "Oral de suivi",
        "format": "Oral 30 min",
        "weight": 1.0,
        "days_until": 60,
    }
]


def _ensure_student(session: Session, student_id: UUID) -> Student:
    student = session.get(Student, student_id)
    if student:
        return student

    student = session.execute(select(Student).where(Student.dashboard_student_id == student_id)).scalar_one_or_none()
    if not student:
        raise ValueError("Student not found")
    return student


def _resolve_template(student: Student) -> List[dict]:
    key = (student.track, student.profile)
    if key in _PLAN_LIBRARY:
        return _PLAN_LIBRARY[key]
    for fallback_key, template in _PLAN_LIBRARY.items():
        if fallback_key[0] == student.track:
            return template
    return _DEFAULT_PLAN


def _normalize_schedule(days_until: int | None) -> datetime | None:
    if days_until is None:
        return None
    return datetime.utcnow() + timedelta(days=max(days_until, 0))


def sync_epreuves_plan(session: Session, student_id: UUID) -> List[EpreuvePlan]:
    student = _ensure_student(session, student_id)
    template = _resolve_template(student)

    existing_stmt = select(EpreuvePlan).where(EpreuvePlan.student_id == student.id)
    existing = {item.code: item for item in session.scalars(existing_stmt).all()}

    synced_items: List[EpreuvePlan] = []
    seen_codes: set[str] = set()

    for entry in template:
        code = entry["code"]
        seen_codes.add(code)
        scheduled_at = _normalize_schedule(entry.get("days_until"))
        if code in existing:
            plan_item = existing[code]
            plan_item.label = entry.get("label", plan_item.label)
            plan_item.format = entry.get("format", plan_item.format)
            plan_item.weight = entry.get("weight", plan_item.weight)
            plan_item.scheduled_at = scheduled_at
            plan_item.source = EpreuveSource.AGENT
        else:
            plan_item = EpreuvePlan(
                student_id=student.id,
                code=code,
                label=entry.get("label", code.title()),
                format=entry.get("format", "Épreuve"),
                weight=entry.get("weight", 1.0),
                scheduled_at=scheduled_at,
                source=EpreuveSource.AGENT,
            )
            session.add(plan_item)
        synced_items.append(plan_item)

    for code, plan_item in existing.items():
        if plan_item.source == EpreuveSource.AGENT and code not in seen_codes:
            session.delete(plan_item)

    session.flush()
    record_event(
        session,
        student_id=student.id,
        kind="EPREUVES_PLAN_SYNCED",
        payload={"count": len(synced_items)},
    )
    return synced_items


def bulk_sync(session: Session, student_ids: Iterable[UUID]) -> Dict[UUID, int]:
    results: Dict[UUID, int] = {}
    for student_id in student_ids:
        items = sync_epreuves_plan(session, student_id)
        results[student_id] = len(items)
    return results
