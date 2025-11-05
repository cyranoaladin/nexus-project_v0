from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import MetaData, Table, insert

from sqlalchemy.orm import Session

from app.models.dashboard import (
    EpreuvePlan,
    EpreuveSource,
    Evaluation,
    EvaluationStatus,
    Progress,
    Task,
    TaskSource,
    TaskStatus,
)
from app.models.rag import Document
from app.models.session import Booking, Session as LearningSession, SessionKind, SessionStatus
from app.models.student import Student, StudentProfile, StudentTrack
from app.models.user import User

_metadata_cache: dict[str, Table] = {}


def _table(session: Session, name: str) -> Table:
    key = f"nexus_app.{name}"
    if key not in _metadata_cache:
        metadata = MetaData(schema="nexus_app")
        _metadata_cache[key] = Table(name, metadata, autoload_with=session.bind)
    return _metadata_cache[key]


def _as_enum(enum_cls, value):
    if value is None:
        return None
    if isinstance(value, enum_cls):
        return value
    for item in enum_cls:
        if str(value).lower() in {item.value.lower(), item.name.lower()}:
            return item
    raise ValueError(f"Unsupported value {value!r} for {enum_cls.__name__}")


def create_user(db: Session, role: str = "student") -> User:
    user = User(
        id=uuid.uuid4(),
        email=f"{uuid.uuid4()}@test.local",
        hashed_password="hashed",
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_student(
    db: Session,
    *,
    track: StudentTrack | str = StudentTrack.TERMINALE,
    profile: StudentProfile | str = StudentProfile.SCOLARISE,
    user_role: str = "student",
) -> Student:
    user = create_user(db, role=user_role)
    student = Student(
        id=uuid.uuid4(),
        user_id=user.id,
        statut="scolarise",
        niveau="terminale",
        etablissement="Lycée Test",
        lva="Anglais",
        lvb="Espagnol",
        track=_as_enum(StudentTrack, track),
        profile=_as_enum(StudentProfile, profile),
        specialities=[],
        options=[],
        llv=[],
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


def create_session_with_booking(
    db: Session,
    student_id,
    *,
    status: SessionStatus | str = SessionStatus.CONFIRME,
    start_in_hours: int = 4,
) -> LearningSession:
    session = LearningSession(
        id=uuid.uuid4(),
        student_id=student_id,
        kind=SessionKind.VISIO,
        status=_as_enum(SessionStatus, status),
        slot_start=datetime.utcnow() + timedelta(hours=start_in_hours),
        slot_end=datetime.utcnow() + timedelta(hours=start_in_hours + 1),
        coach_id=None,
        capacity=1,
        price_cents=0,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    booking = Booking(
        id=uuid.uuid4(),
        session_id=session.id,
        student_id=student_id,
        status="confirmed",
    )
    db.add(booking)
    db.commit()
    return session


def create_task(
    db: Session,
    student,
    *,
    label: str = "Task",
    status: TaskStatus | str = TaskStatus.TODO,
    due_in_days: Optional[int] = 3,
    source: TaskSource | str = TaskSource.AGENT,
    weight: float = 1.0,
) -> Task:
    due_at = None if due_in_days is None else datetime.utcnow() + timedelta(days=due_in_days)
    task = Task(
        id=uuid.uuid4(),
        student_id=student.id,
        label=label,
        status=_as_enum(TaskStatus, status),
        source=_as_enum(TaskSource, source),
        weight=weight,
        due_at=due_at,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def create_progress_entry(
    db: Session,
    student,
    *,
    subject: str = "maths",
    chapter_code: str = "ALG-01",
    competence_code: Optional[str] = "C1",
    score: float = 0.7,
) -> Progress:
    progress = Progress(
        id=uuid.uuid4(),
        student_id=student.id,
        subject=subject,
        chapter_code=chapter_code,
        competence_code=competence_code,
        score=score,
    )
    db.add(progress)
    db.commit()
    db.refresh(progress)
    return progress


def create_evaluation(
    db: Session,
    student,
    *,
    subject: str = "maths",
    score_20: Optional[float] = 15.0,
    status: EvaluationStatus | str = EvaluationStatus.CORRIGE,
) -> Evaluation:
    evaluation = Evaluation(
        id=uuid.uuid4(),
        student_id=student.id,
        subject=subject,
        generator="test-suite",
        duration_min=45,
        status=_as_enum(EvaluationStatus, status),
        score_20=score_20,
        feedback_json={},
    )
    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)
    return evaluation


def create_epreuve_plan(
    db: Session,
    student,
    *,
    code: str = "EPR-1",
    label: str = "Grand oral",
    scheduled_in_days: Optional[int] = 10,
    source: EpreuveSource | str = EpreuveSource.AGENT,
) -> EpreuvePlan:
    scheduled_at = None if scheduled_in_days is None else datetime.utcnow() + timedelta(days=scheduled_in_days)
    plan = EpreuvePlan(
        id=uuid.uuid4(),
        student_id=student.id,
        code=code,
        label=label,
        weight=1.0,
        scheduled_at=scheduled_at,
        format="oral",
        source=_as_enum(EpreuveSource, source),
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def create_document_with_chunks(
    db: Session,
    *,
    source: str = "interne",
    path: str = "documents/test.md",
    version: str = "v1",
    meta: Optional[dict] = None,
    chunks: Optional[list[dict]] = None,
) -> Document:
    document = Document(
        id=uuid.uuid4(),
        source=source,
        path=path,
        version=version,
        meta={"title": "Document test", **(meta or {})},
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    chunk_rows = chunks or [
        {
            "id": uuid.uuid4(),
            "content": "Cours de mathématiques — dérivées et limites.",
            "meta": {"subject": "maths", "modality": "text"},
        }
    ]

    chunks_table = _table(db, "chunks")
    chunks_meta_table = _table(db, "chunks_meta")

    for row in chunk_rows:
        payload = {
            "id": row.get("id", uuid.uuid4()),
            "document_id": document.id,
            "content": row.get("content", ""),
            "meta": row.get("meta") or {},
        }
        db.execute(insert(chunks_table).values(payload))
        db.execute(insert(chunks_meta_table).values(payload))

    db.commit()
    return document
