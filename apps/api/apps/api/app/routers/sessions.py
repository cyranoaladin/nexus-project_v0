from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services import sessions as sessions_service
from app.utils.ratelimit import rate_limit
from app.utils.security import ActorContext, Role, ensure_access, require_role

router = APIRouter(prefix="/sessions", tags=["sessions"])


class SessionResponse(BaseModel):
    id: UUID
    student_id: UUID
    kind: str
    status: str
    slot_start: datetime
    slot_end: datetime
    coach_id: Optional[UUID]
    capacity: int
    price_cents: int
    booking_status: Optional[str] = None


class SessionListResponse(BaseModel):
    items: List[SessionResponse]


class SessionBookRequest(BaseModel):
    student_id: UUID
    kind: str = Field(..., description="Session modality (Visio|Présentiel|Stage)")
    slot_start: datetime
    slot_end: Optional[datetime] = None
    coach_id: Optional[UUID] = None
    capacity: int = Field(1, ge=1, le=10)
    price_cents: int = Field(0, ge=0)


class SessionCancelBulkRequest(BaseModel):
    ids: List[UUID] = Field(..., min_length=1, max_length=25)


def _serialize_session(obj, *, booking_status: Optional[str] = None) -> SessionResponse:
    return SessionResponse(
        id=obj.id,
        student_id=obj.student_id,
        kind=obj.kind.value if hasattr(obj.kind, "value") else str(obj.kind),
        status=obj.status.value if hasattr(obj.status, "value") else str(obj.status),
        slot_start=obj.slot_start,
        slot_end=obj.slot_end,
        coach_id=obj.coach_id,
        capacity=obj.capacity,
        price_cents=obj.price_cents,
        booking_status=booking_status,
    )


@router.post("/book", response_model=SessionResponse)
def book_session(
    payload: SessionBookRequest,
    actor: ActorContext = Depends(require_role(Role.STUDENT, Role.COACH, Role.ADMIN)),
    db: Session = Depends(get_db),
) -> SessionResponse:
    ensure_access(actor, str(payload.student_id))
    rate_limit(f"sessions:book:{actor.actor_id or actor.role}", limit=20, window_seconds=60)

    try:
        session_obj = sessions_service.book_session(
            db,
            student_id=payload.student_id,
            kind=payload.kind,
            slot_start=payload.slot_start,
            slot_end=payload.slot_end,
            coach_id=payload.coach_id,
            capacity=payload.capacity,
            price_cents=payload.price_cents,
        )
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    db.commit()
    db.refresh(session_obj)
    return _serialize_session(session_obj, booking_status="booked")


@router.get("/list", response_model=SessionListResponse)
def list_sessions(
    student_id: UUID,
    actor: ActorContext = Depends(require_role(Role.STUDENT, Role.PARENT, Role.COACH, Role.ADMIN)),
    db: Session = Depends(get_db),
) -> SessionListResponse:
    ensure_access(actor, str(student_id))
    try:
        items = sessions_service.list_sessions(db, student_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    serialized = [
        SessionResponse(
            id=UUID(item["id"]),
            student_id=student_id,
            kind=item["kind"],
            status=item["status"],
            slot_start=item["slot_start"],
            slot_end=item["slot_end"],
            coach_id=UUID(item["coach_id"]) if item.get("coach_id") else None,
            capacity=item.get("capacity", 1),
            price_cents=item.get("price_cents", 0),
            booking_status=item.get("booking_status"),
        )
        for item in items
    ]
    return SessionListResponse(items=serialized)


@router.post("/{session_id}/cancel")
def cancel_session(
    session_id: UUID,
    actor: ActorContext = Depends(require_role(Role.COACH, Role.ADMIN)),
    db: Session = Depends(get_db),
):
    rate_limit(f"sessions:cancel:{actor.actor_id or actor.role}", limit=20, window_seconds=60)
    try:
        session_obj, changed = sessions_service.cancel_session(db, session_id)
    except sessions_service.SessionNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    db.commit()
    return {
        "id": str(session_obj.id),
        "status": "cancelled" if changed else "already_cancelled",
    }


@router.post("/cancel")
def bulk_cancel_sessions(
    payload: SessionCancelBulkRequest,
    actor: ActorContext = Depends(require_role(Role.COACH, Role.ADMIN)),
    db: Session = Depends(get_db),
):
    rate_limit(f"sessions:bulk_cancel:{actor.actor_id or actor.role}", limit=40, window_seconds=60)
    results = sessions_service.bulk_cancel_sessions(db, payload.ids)
    db.commit()
    return {"results": results}
