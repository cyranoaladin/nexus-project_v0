from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Integer, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
import uuid
from .user import Base

class Competence(Base):
    __tablename__ = "competences"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    domaine: Mapped[str] = mapped_column(String)
    subdomain: Mapped[str] = mapped_column(String)
    label: Mapped[str] = mapped_column(String)

class StudentCompetence(Base):
    __tablename__ = "student_competences"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id"))
    competence_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("competences.id"))
    level: Mapped[int] = mapped_column(Integer)  # 0..3
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)

class Resource(Base):
    __tablename__ = "resources"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type: Mapped[str] = mapped_column(String)  # cours|resume|exo|video
    tags: Mapped[str] = mapped_column(String)  # csv tags
    blob_url: Mapped[str] = mapped_column(String)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)

class Plan(Base):
    __tablename__ = "plans"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id"))
    items: Mapped[dict] = mapped_column(JSON, default=dict)
