from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, DateTime, JSON, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
import uuid
from .user import Base

class Report(Base):
    __tablename__ = "reports"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id"))
    period: Mapped[str] = mapped_column(String)  # e.g., 2025-11
    payload: Mapped[dict] = mapped_column(JSON, default=dict)

class Event(Base):
    __tablename__ = "events"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id"))
    kind: Mapped[str] = mapped_column(String)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
