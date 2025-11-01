# Import models for Alembic autogenerate if needed
from ..models.user import User
from ..models.student import Student, ParentLink
from ..models.taxonomy import Speciality, StudentSpeciality, Option, StudentOption
from ..models.exam import Exam, StudentExam
from ..models.learning import Competence, StudentCompetence, Resource, Plan
from ..models.session import Session, Booking
from ..models.report import Report, Event
from ..models.rag import Document, Chunk
from ..models.entitlement import Entitlement

from sqlalchemy.orm import declarative_base
Base = declarative_base()
