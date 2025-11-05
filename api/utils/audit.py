from __future__ import annotations
from datetime import datetime
from typing import Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy_models.models import Event

def log_event(db: Session, student_id, kind: str, payload: Optional[dict] = None) -> None:
    ev = Event(student_id=student_id, kind=kind, payload_json=payload or {}, at=datetime.utcnow())
    db.add(ev)
