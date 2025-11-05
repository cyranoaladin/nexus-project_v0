import enum
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, DateTime, Enum, ForeignKey, Float, Integer, JSON, func, text
from sqlalchemy.dialects.postgresql import UUID
from .user import Base


class TaskStatus(enum.Enum):
    TODO = "Todo"
    DONE = "Done"
    SKIPPED = "Skipped"


class TaskSource(enum.Enum):
    AGENT = "Agent"
    COACH = "Coach"
    SYSTEM = "System"


class EvaluationStatus(enum.Enum):
    PROPOSE = "Proposé"
    SOUMIS = "Soumis"
    CORRIGE = "Corrigé"


class Progress(Base):
    __tablename__ = "progress"
    __table_args__ = {"schema": "nexus_app"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("nexus_app.students.id"), nullable=False)
    subject: Mapped[str] = mapped_column(String, nullable=False)
    chapter_code: Mapped[str] = mapped_column(String, nullable=False)
    competence_code: Mapped[str] = mapped_column(String, nullable=True)
    score: Mapped[float] = mapped_column(Float, nullable=False, server_default=text("0"))
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = {"schema": "nexus_app"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("nexus_app.students.id"), nullable=False)
    label: Mapped[str] = mapped_column(String(300), nullable=False)
    due_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    weight: Mapped[float] = mapped_column(Float, nullable=False, server_default=text("1"))
    status: Mapped[TaskStatus] = mapped_column(
        Enum(
            TaskStatus,
            name="task_status",
            schema="nexus_app",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        server_default=TaskStatus.TODO.value,
    )
    source: Mapped[TaskSource] = mapped_column(
        Enum(
            TaskSource,
            name="task_source",
            schema="nexus_app",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        server_default=TaskSource.AGENT.value,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())


class Evaluation(Base):
    __tablename__ = "evaluations"
    __table_args__ = {"schema": "nexus_app"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("nexus_app.students.id"), nullable=False)
    subject: Mapped[str] = mapped_column(String, nullable=False)
    generator: Mapped[str] = mapped_column(String, nullable=False)
    duration_min: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[EvaluationStatus] = mapped_column(
        Enum(
            EvaluationStatus,
            name="evaluation_status",
            schema="nexus_app",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        server_default=EvaluationStatus.PROPOSE.value,
    )
    score_20: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    feedback_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())


class EpreuveSource(enum.Enum):
    REGLEMENT = "Réglement"
    AGENT = "Agent"


class EpreuvePlan(Base):
    __tablename__ = "epreuves_plan"
    __table_args__ = {"schema": "nexus_app"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("nexus_app.students.id"), nullable=False)
    code: Mapped[str] = mapped_column(String, nullable=False)
    label: Mapped[str] = mapped_column(String, nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    format: Mapped[str] = mapped_column(String, nullable=False)
    source: Mapped[EpreuveSource] = mapped_column(
        Enum(
            EpreuveSource,
            name="epreuve_source",
            schema="nexus_app",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        server_default=EpreuveSource.AGENT.value,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())


class DashboardSummarySnapshot(Base):
    __tablename__ = "mv_dashboard_summary"
    __table_args__ = {"schema": "nexus_app"}

    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    progress_overall: Mapped[float] = mapped_column(Float, nullable=False, server_default=text("0"))
    last_eval_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    next_session_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    tasks_open_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
