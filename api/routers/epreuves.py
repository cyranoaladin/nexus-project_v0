from __future__ import annotations
import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import delete

from sqlalchemy_models.models import Student, EpreuvePlan
from .deps import get_db
from api.utils.security import get_principal, must_be_admin_or_coach, Principal
from api.utils.audit import log_event

router = APIRouter(prefix="/epreuves", tags=["epreuves"])

@router.post("/sync")
def sync_epreuves(student_id: uuid.UUID, db: Session = Depends(get_db), principal: Principal = Depends(get_principal)):
    must_be_admin_or_coach(principal)
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="student not found")

    db.execute(delete(EpreuvePlan).where(EpreuvePlan.student_id == student_id, EpreuvePlan.source == "Réglement"))

    items = []
    if student.track == "Premiere" and student.profile == "Scolarise":
        items = [
            {"code":"E1-FrancaisEcrit","label":"Français écrit (anticipée)","weight":0.2,"format":"Ecrit 4h"},
            {"code":"E2-FrancaisOral","label":"Français oral (anticipée)","weight":0.2,"format":"Oral 20 min"},
        ]
    elif student.track == "Terminale" and student.profile == "Scolarise":
        items = [
            {"code":"E3-Philo","label":"Philosophie","weight":0.1,"format":"Ecrit 4h"},
            {"code":"E5-GrandOral","label":"Grand Oral","weight":0.1,"format":"Oral 20 min"},
        ]
    else:
        items = [
            {"code":"EL-Discipline1","label":"Épreuve Discipline 1 (libre)","weight":0.3,"format":"Ecrit 3-4h"},
            {"code":"EL-Discipline2","label":"Épreuve Discipline 2 (libre)","weight":0.3,"format":"Ecrit 3-4h"},
        ]

    for it in items:
        db.add(EpreuvePlan(
            student_id=student_id,
            code=it["code"],
            label=it["label"],
            weight=it["weight"],
            scheduled_at=None,
            format=it["format"],
            source="Réglement"
        ))
    log_event(db, student_id, "EPREUVES_SYNCED", {"count": len(items)})
    db.commit()
    return {"status":"synced","count":len(items)}
