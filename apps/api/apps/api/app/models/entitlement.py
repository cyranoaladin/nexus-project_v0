from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID
import uuid
from .user import Base

class Entitlement(Base):
    __tablename__ = "entitlements"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    plan: Mapped[str] = mapped_column(String)  # free|essentiel|premium|pro
    quotas: Mapped[dict] = mapped_column(JSON, default=dict)
    renew_at: Mapped[DateTime] = mapped_column(DateTime, nullable=True)
