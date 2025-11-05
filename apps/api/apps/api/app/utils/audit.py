from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.report import Event


def record_event(
    session: Session,
    *,
    student_id: UUID,
    kind: str,
    payload: Optional[dict[str, Any]] = None,
    occurred_at: Optional[datetime] = None,
) -> None:
    """Append an audit event for the supplied student."""
    event = Event(
        student_id=student_id,
        kind=kind,
        payload=payload or {},
        occurred_at=occurred_at or datetime.utcnow(),
    )
    session.add(event)
