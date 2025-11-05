from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, JSON
from sqlalchemy.dialects.postgresql import UUID
import uuid
from .user import Base

class Document(Base):
    __tablename__ = "documents"
    __table_args__ = {"schema": "nexus_app"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source: Mapped[str] = mapped_column(String)  # interne|eduscol|manuel|autre
    path: Mapped[str] = mapped_column(String)
    version: Mapped[str] = mapped_column(String, default="v1")
    meta: Mapped[dict] = mapped_column(JSON, default=dict)

class Chunk(Base):
    __tablename__ = "chunks_meta"
    __table_args__ = {"schema": "nexus_app"}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    content: Mapped[str] = mapped_column(String)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
