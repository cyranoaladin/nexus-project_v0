from __future__ import annotations
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import select

from sqlalchemy_models.models import Student, EpreuvePlan
from .deps import get_db
from api.security import get_current_principal, assert_can_access_student, Principal

router = APIRouter(prefix="/dashboard", tags=["dashboard","epreuves"])

class EpreuveItem(BaseModel):
    code: str
    label: str
    weight: float
    scheduled_at: Optional[str] = None
    format: str

class EpreuvesResponse(BaseModel):
    track: str
    profile: str
    items: List[EpreuveItem]

@router.get("/epreuves", response_model=EpreuvesResponse)
def get_epreuves(student_id: uuid.UUID = Query(...), db: Session = Depends(get_db), principal: Principal = Depends(get_current_principal)):
    st = db.get(Student, student_id)
    if not st:
        raise HTTPException(status_code=404, detail="student not found")
    assert_can_access_student(principal, st.actor_uuid)
    q = select(EpreuvePlan).where(EpreuvePlan.student_id == student_id).order_by(EpreuvePlan.code.asc())
    items = db.execute(q).scalars().all()
    resp_items = [
        EpreuveItem(
            code=it.code,
            label=it.label,
            weight=it.weight,
            scheduled_at=it.scheduled_at.isoformat() if getattr(it, "scheduled_at", None) else None,
            format=it.format,
        )
        for it in items
    ]
    return EpreuvesResponse(track=st.track, profile=st.profile, items=resp_items)
