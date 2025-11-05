import enum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Integer, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
import uuid
from .user import Base

class SessionKind(enum.Enum):
    VISIO = "Visio"
    PRESENTIEL = "Présentiel"
    STAGE = "Stage"


class SessionStatus(enum.Enum):
    PROPOSE = "Proposé"
    CONFIRME = "Confirmé"
    ANNULE = "Annulé"


class Session(Base):
    __tablename__ = "sessions"
    __table_args__ = {"schema": "nexus_app"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("nexus_app.students.id"), nullable=True)
    kind: Mapped[SessionKind] = mapped_column(
        Enum(
            SessionKind,
            name="session_kind",
            schema="nexus_app",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        server_default=SessionKind.VISIO.value,
    )
    status: Mapped[SessionStatus] = mapped_column(
        Enum(
            SessionStatus,
            name="session_status",
            schema="nexus_app",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        server_default=SessionStatus.PROPOSE.value,
    )
    slot_start: Mapped[DateTime] = mapped_column(DateTime, nullable=False)
    slot_end: Mapped[DateTime] = mapped_column(DateTime, nullable=False)
    coach_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("nexus_app.users.id"), nullable=True)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = {"schema": "nexus_app"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("nexus_app.sessions.id"))
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("nexus_app.students.id"))
    status: Mapped[str] = mapped_column(String, default="booked")
