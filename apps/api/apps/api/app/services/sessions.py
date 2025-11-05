from __future__ import annotations

from datetime import datetime, timedelta
from typing import Iterable, List
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.session import Booking, Session as SessionModel, SessionKind, SessionStatus
from app.models.student import Student
from app.utils.audit import record_event


class SessionNotFoundError(ValueError):
    pass


def _coerce_enum(enum_cls, value):
    if value is None:
        return None
    if isinstance(value, enum_cls):
        return value
    value_str = str(value).strip()
    for item in enum_cls:
        if value_str.lower() in {item.value.lower(), item.name.lower()}:
            return item
    raise ValueError(f"Invalid {enum_cls.__name__}: {value}")


def ensure_student(session: Session, student_id: UUID) -> Student:
    student = session.get(Student, student_id)
    if student:
        return student

    student = session.execute(select(Student).where(Student.dashboard_student_id == student_id)).scalar_one_or_none()
    if not student:
        raise ValueError("Student not found")
    return student


def book_session(
    session: Session,
    *,
    student_id: UUID,
    kind: SessionKind | str,
    slot_start: datetime,
    slot_end: datetime | None = None,
    coach_id: UUID | None = None,
    capacity: int = 1,
    price_cents: int = 0,
) -> SessionModel:
    ensure_student(session, student_id)
    kind_enum = _coerce_enum(SessionKind, kind) or SessionKind.VISIO
    slot_end = slot_end or (slot_start + timedelta(hours=1))
    session_obj = SessionModel(
        student_id=student_id,
        kind=kind_enum,
        status=SessionStatus.PROPOSE,
        slot_start=slot_start,
        slot_end=slot_end,
        coach_id=coach_id,
        capacity=capacity,
        price_cents=price_cents,
    )
    session.add(session_obj)
    session.flush()

    booking = Booking(
        session_id=session_obj.id,
        student_id=student_id,
        status="booked",
    )
    session.add(booking)
    record_event(
        session,
        student_id=student_id,
        kind="SESSION_BOOKED",
        payload={
            "session_id": str(session_obj.id),
            "slot_start": slot_start.isoformat(),
            "kind": kind_enum.value,
        },
    )
    session.flush()
    return session_obj


def list_sessions(session: Session, student_id: UUID) -> List[dict]:
    ensure_student(session, student_id)
    query = (
        select(SessionModel, Booking)
        .join(Booking, Booking.session_id == SessionModel.id)
        .where(Booking.student_id == student_id)
        .order_by(SessionModel.slot_start.asc())
    )
    rows = session.execute(query).all()
    items: List[dict] = []
    for sess, booking in rows:
        items.append(
            {
                "id": str(sess.id),
                "kind": sess.kind.value if isinstance(sess.kind, SessionKind) else sess.kind,
                "status": sess.status.value if isinstance(sess.status, SessionStatus) else sess.status,
                "slot_start": sess.slot_start,
                "slot_end": sess.slot_end,
                "coach_id": str(sess.coach_id) if sess.coach_id else None,
                "booking_status": booking.status,
                "capacity": sess.capacity,
                "price_cents": sess.price_cents,
            }
        )
    return items


def cancel_session(session: Session, session_id: UUID) -> tuple[SessionModel, bool]:
    obj = session.get(SessionModel, session_id)
    if not obj:
        raise SessionNotFoundError("Session not found")
    if obj.status == SessionStatus.ANNULE:
        return obj, False
    obj.status = SessionStatus.ANNULE
    session.flush()

    if obj.student_id:
        record_event(
            session,
            student_id=obj.student_id,
            kind="SESSION_CANCELLED",
            payload={"session_id": str(obj.id)},
        )
    return obj, True


def bulk_cancel_sessions(session: Session, session_ids: Iterable[UUID]) -> List[dict]:
    results: List[dict] = []
    for session_id in session_ids:
        try:
            with session.begin_nested():
                _, changed = cancel_session(session, session_id)
                status = "cancelled" if changed else "already_cancelled"
        except SessionNotFoundError:
            status = "not_found"
        results.append({"id": str(session_id), "status": status})
    session.flush()
    return results
