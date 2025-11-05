from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Integer, ForeignKey, JSON, DateTime, text, func
from sqlalchemy.dialects.postgresql import UUID, ARRAY
import uuid
from .user import Base

class Competence(Base):
    __tablename__ = "competences"
    __table_args__ = {"schema": "nexus_app"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    domaine: Mapped[str] = mapped_column(String)
    subdomain: Mapped[str] = mapped_column(String)
    label: Mapped[str] = mapped_column(String)

class StudentCompetence(Base):
    __tablename__ = "student_competences"
    __table_args__ = {"schema": "nexus_app"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("nexus_app.students.id"))
    competence_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("nexus_app.competences.id"))
    level: Mapped[int] = mapped_column(Integer)  # 0..3
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)

class Resource(Base):
    __tablename__ = "resources"
    __table_args__ = {"schema": "nexus_app"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    uri: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    type: Mapped[str] = mapped_column(String)  # PDF|Video|URL|Autre
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, server_default=text("'{}'"))
    blob_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    visibility: Mapped[str] = mapped_column(String, nullable=False, default="private")
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

class Plan(Base):
    __tablename__ = "plans"
    __table_args__ = {"schema": "nexus_app"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("nexus_app.students.id"))
    items: Mapped[dict] = mapped_column(JSON, default=dict)
