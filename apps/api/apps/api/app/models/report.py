from __future__ import annotations

from datetime import datetime
import uuid

from sqlalchemy import DateTime, ForeignKey, JSON, String, func
from sqlalchemy.dialects.postgresql import UUID

from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column

from .user import Base

class Report(Base):
    __tablename__ = "reports"
    __table_args__ = {"schema": "nexus_app"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("nexus_app.students.id"))
    period: Mapped[str] = mapped_column(String)  # e.g., 2025-11
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    summary_md: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    kpis_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

class Event(Base):
    __tablename__ = "events"
    __table_args__ = {"schema": "nexus_app"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("nexus_app.students.id"))
    kind: Mapped[str] = mapped_column(String)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    occurred_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
