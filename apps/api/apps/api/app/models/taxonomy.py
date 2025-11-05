from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid
from .user import Base

class Speciality(Base):
    __tablename__ = "specialities"
    __table_args__ = {"schema": "nexus_app"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String, unique=True)
    label: Mapped[str] = mapped_column(String)

class StudentSpeciality(Base):
    __tablename__ = "student_specialities"
    __table_args__ = {"schema": "nexus_app"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("nexus_app.students.id"))
    speciality_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("nexus_app.specialities.id"))
    year: Mapped[str] = mapped_column(String)
    level: Mapped[str] = mapped_column(String)  # premiere|terminale

class Option(Base):
    __tablename__ = "options"
    __table_args__ = {"schema": "nexus_app"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String, unique=True)
    label: Mapped[str] = mapped_column(String)

class StudentOption(Base):
    __tablename__ = "student_options"
    __table_args__ = {"schema": "nexus_app"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("nexus_app.students.id"))
    option_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("nexus_app.options.id"))
    year: Mapped[str] = mapped_column(String)
