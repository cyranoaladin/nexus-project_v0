from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy import String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid
from .user import Base

class Student(Base):
    __tablename__ = "students"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True)
    statut: Mapped[str] = mapped_column(String)  # scolarise | individuel
    niveau: Mapped[str] = mapped_column(String)  # premiere | terminale
    etablissement: Mapped[str] = mapped_column(String, nullable=True)
    lva: Mapped[str] = mapped_column(String, nullable=True)
    lvb: Mapped[str] = mapped_column(String, nullable=True)

class ParentLink(Base):
    __tablename__ = "parent_links"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id"))
    permissions: Mapped[str] = mapped_column(String, default="read")
