import enum
from typing import Optional

from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, ForeignKey, Enum, DateTime, func, text
from sqlalchemy.dialects.postgresql import UUID, ARRAY
import uuid

from .user import Base

class StudentTrack(enum.Enum):
    PREMIERE = "Premiere"
    TERMINALE = "Terminale"


class StudentProfile(enum.Enum):
    SCOLARISE = "Scolarise"
    LIBRE = "CandidatLibre"


class Student(Base):
    __tablename__ = "students"
    __table_args__ = {"schema": "nexus_app"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("nexus_app.users.id"), nullable=False, unique=True)
    statut: Mapped[str] = mapped_column(String)  # scolarise | individuel
    niveau: Mapped[str] = mapped_column(String)  # premiere | terminale
    etablissement: Mapped[str] = mapped_column(String, nullable=True)
    lva: Mapped[str] = mapped_column(String, nullable=True)
    lvb: Mapped[str] = mapped_column(String, nullable=True)
    track: Mapped[StudentTrack] = mapped_column(
        Enum(
            StudentTrack,
            name="student_track",
            schema="nexus_app",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        server_default=StudentTrack.TERMINALE.value,
    )
    profile: Mapped[StudentProfile] = mapped_column(
        Enum(
            StudentProfile,
            name="student_profile",
            schema="nexus_app",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        server_default=StudentProfile.SCOLARISE.value,
    )
    dashboard_student_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        unique=True,
        nullable=True,
    )
    specialities: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, server_default=text("'{}'::text[]")
    )
    options: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, server_default=text("'{}'::text[]")
    )
    llv: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, server_default=text("'{}'::text[]"))
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

class ParentLink(Base):
    __tablename__ = "parent_links"
    __table_args__ = {"schema": "nexus_app"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("nexus_app.users.id"))
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("nexus_app.students.id"))
    permissions: Mapped[str] = mapped_column(String, default="read")
