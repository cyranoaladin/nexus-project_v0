from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, DateTime, JSON, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
import uuid
from .user import Base

class Entitlement(Base):
    __tablename__ = "entitlements"
    __table_args__ = {"schema": "nexus_app"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    plan: Mapped[str] = mapped_column(String)  # free|essentiel|premium|pro
    quotas: Mapped[dict] = mapped_column(JSON, default=dict)
    renew_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    student_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("nexus_app.students.id"), nullable=True)
    tier: Mapped[str] = mapped_column(String, nullable=False, default="Free")
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    granted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
