from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.rag import RagDocumentResponse, RagSearchResponse
from app.services import rag as rag_service
from app.utils.security import ActorContext, Role, require_role

router = APIRouter(tags=["rag"])


@router.get("/search", response_model=RagSearchResponse)
def rag_search(
    q: str = Query(..., min_length=2, description="Free text query"),
    filters: str | None = Query(None, description="Comma-separated metadata filters (key=value)"),
    _actor: ActorContext = Depends(require_role(Role.STUDENT, Role.PARENT, Role.COACH, Role.ADMIN, Role.ASSISTANTE)),
    db: Session = Depends(get_db),
) -> RagSearchResponse:
    try:
        results = rag_service.search(db, q, filters=filters)
    except RuntimeError as exc:
        # Gestion explicite des erreurs backend RAG
        raise HTTPException(status_code=500, detail=str(exc))
    return RagSearchResponse(q=q, filters=filters, hits=results)


@router.get("/doc/{document_id}", response_model=RagDocumentResponse)
def rag_document(
    document_id: UUID,
    _actor: ActorContext = Depends(require_role(Role.STUDENT, Role.PARENT, Role.COACH, Role.ADMIN, Role.ASSISTANTE)),
    db: Session = Depends(get_db),
) -> RagDocumentResponse:
    try:
        payload = rag_service.get_document(db, document_id)
    except rag_service.DocumentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return RagDocumentResponse(**payload)
