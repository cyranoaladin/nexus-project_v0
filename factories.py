import uuid
from datetime import datetime, timedelta

from sqlalchemy.orm import Session
from sqlalchemy_models.models import Student, Session as DBSession, Task

def create_student(db: Session, track="Premiere", profile="Scolarise") -> Student:
    s = Student(
        id=uuid.uuid4(),
        track=track,
        profile=profile,
        specialities=[],
        options=[],
        llv=[]
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s

def create_session(db: Session, student_id, status="Proposé"):
    se = DBSession(
        id=uuid.uuid4(),
        student_id=student_id,
        kind="Visio",
        slot_start=datetime.utcnow() + timedelta(days=1),
        slot_end=datetime.utcnow() + timedelta(days=1, hours=1),
        status=status,
        title="Séance test"
    )
    db.add(se)
    db.commit()
    db.refresh(se)
    return se

def create_task(db: Session, student_id, label="Task", status="Todo"):
    t = Task(
        id=uuid.uuid4(),
        student_id=student_id,
        label=label,
        status=status,
        weight=1.0
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t
