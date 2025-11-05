from __future__ import annotations
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from sqlalchemy_models.models import Session as DBSession
from .deps import get_db

router = APIRouter(prefix="/sessions", tags=["sessions"])

class BulkCancelRequest(BaseModel):
    ids: List[uuid.UUID] = Field(..., min_items=1, description="List of session UUIDs to cancel")

@router.post("/{session_id}/cancel")
def cancel_session(session_id: uuid.UUID, db: Session = Depends(get_db)):
    obj = db.get(DBSession, session_id)
    if not obj:
        raise HTTPException(status_code=404, detail="session not found")
    if obj.status == "Annulé":
        return {"status":"already_cancelled", "id": str(session_id)}
    obj.status = "Annulé"
    db.add(obj)
    db.commit()
    return {"status":"cancelled", "id": str(session_id)}

@router.post("/cancel")
def bulk_cancel_sessions(payload: BulkCancelRequest, db: Session = Depends(get_db)):
    results = []
    for sid in payload.ids:
        obj = db.get(DBSession, sid)
        if not obj:
            results.append({"id": str(sid), "status": "not_found"})
            continue
        if obj.status == "Annulé":
            results.append({"id": str(sid), "status": "already_cancelled"})
            continue
        obj.status = "Annulé"
        db.add(obj)
        results.append({"id": str(sid), "status": "cancelled"})
    db.commit()
    return {"results": results}
