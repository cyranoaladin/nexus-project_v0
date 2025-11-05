from __future__ import annotations
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from sqlalchemy_models.models import Session as DBSession
from .deps import get_db
from api.utils.security import get_principal, must_be_admin_or_coach, Principal
from api.utils.audit import log_event
from api.utils.ratelimit import rate_limit

router = APIRouter(prefix="/sessions", tags=["sessions"])

class BulkCancelRequest(BaseModel):
    ids: List[uuid.UUID] = Field(..., min_items=1, description="List of session UUIDs to cancel")

@router.post("/{session_id}/cancel")
def cancel_session(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
    x_actor_id: str | None = Header(None),
):
    must_be_admin_or_coach(principal)
    # rate limit per actor (simple dev limiter): 20 cancels / 60s
    rate_limit(f"cancel:{x_actor_id or principal.role}", limit=20, window_seconds=60)

    obj = db.get(DBSession, session_id)
    if not obj:
        raise HTTPException(status_code=404, detail="session not found")
    if obj.status == "Annulé":
        return {"status":"already_cancelled", "id": str(session_id)}
    obj.status = "Annulé"
    db.add(obj)
    log_event(db, obj.student_id, "SESSION_CANCELLED", {"session_id": str(session_id), "by": principal.role})
    db.commit()
    return {"status":"cancelled", "id": str(session_id)}

@router.post("/cancel")
def bulk_cancel_sessions(
    payload: BulkCancelRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
    x_actor_id: str | None = Header(None),
):
    must_be_admin_or_coach(principal)
    rate_limit(f"cancel:{x_actor_id or principal.role}", limit=40, window_seconds=60)

    results = []
    with db.begin():
        for sid in payload.ids:
            with db.begin_nested():
                obj = db.get(DBSession, sid)
                if not obj:
                    results.append({"id": str(sid), "status": "not_found"})
                    continue
                if obj.status == "Annulé":
                    results.append({"id": str(sid), "status": "already_cancelled"})
                    continue
                obj.status = "Annulé"
                db.add(obj)
                log_event(db, obj.student_id, "SESSION_CANCELLED", {"session_id": str(sid), "by": principal.role})
                results.append({"id": str(sid), "status": "cancelled"})
    return {"results": results}
