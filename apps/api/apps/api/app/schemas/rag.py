from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class RagHit(BaseModel):
    document_id: UUID = Field(..., description="Identifier of the source document")
    chunk_id: UUID = Field(..., description="Identifier of the matching chunk")
    title: str = Field(..., description="Best-effort title for the result")
    snippet: str = Field(..., description="Highlighted extract illustrating the match")
    score: float = Field(..., ge=0.0, le=1.0, description="Relevance score between 0 and 1")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Document and chunk metadata")


class RagSearchResponse(BaseModel):
    q: str
    filters: Optional[str] = None
    hits: list[RagHit]


class RagDocumentChunk(BaseModel):
    id: UUID
    content: str
    meta: dict[str, Any] = Field(default_factory=dict)


class RagDocumentResponse(BaseModel):
    id: UUID
    source: str
    path: Optional[str] = None
    version: str
    meta: dict[str, Any] = Field(default_factory=dict)
    chunks: list[RagDocumentChunk]
