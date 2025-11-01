from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Integer, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
import uuid
from .user import Base

class Exam(Base):
    __tablename__ = "exams"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type: Mapped[str] = mapped_column(String)   # eaf_francais|eaf_math|philo|grand_oral|spe_nsi|...
    coef: Mapped[int] = mapped_column(Integer)
    nature: Mapped[str] = mapped_column(String) # ecrit|ecrit_pratique
    date: Mapped[DateTime] = mapped_column(DateTime, nullable=True)
    visible_for_individuel: Mapped[bool] = mapped_column(Boolean, default=True)

class StudentExam(Base):
    __tablename__ = "student_exams"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id"))
    exam_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("exams.id"))
    status: Mapped[str] = mapped_column(String, default="planned") # planned|done|skipped
    score: Mapped[int] = mapped_column(Integer, nullable=True)
