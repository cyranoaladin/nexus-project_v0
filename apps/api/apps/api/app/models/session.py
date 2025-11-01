from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid
from .user import Base

class Session(Base):
    __tablename__ = "sessions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type: Mapped[str] = mapped_column(String)  # visio|presentiel
    coach_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    starts_at: Mapped[DateTime] = mapped_column(DateTime)
    duration: Mapped[int] = mapped_column(Integer)  # minutes
    capacity: Mapped[int] = mapped_column(Integer, default=1)
    price_cents: Mapped[int] = mapped_column(Integer, default=0)

class Booking(Base):
    __tablename__ = "bookings"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sessions.id"))
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id"))
    status: Mapped[str] = mapped_column(String, default="booked")
