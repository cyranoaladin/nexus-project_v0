from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.rag import Document

logger = logging.getLogger(__name__)


class DocumentNotFoundError(RuntimeError):
    """Raised when a RAG document cannot be located."""


_SEARCH_SQL = text(
    """
WITH query AS (
    SELECT websearch_to_tsquery('french', :query) AS tsq
)
SELECT
    c.id AS chunk_id,
    c.document_id,
    d.source,
    d.path,
    d.version,
    d.meta AS document_meta,
    c.meta AS chunk_meta,
    ts_rank_cd(to_tsvector('french', coalesce(c.content, '')), query.tsq) AS score,
    ts_headline('french', coalesce(c.content, ''), query.tsq,
        'MaxFragments=2, MinWords=5, MaxWords=25') AS snippet,
    substring(coalesce(c.content, '') for 320) AS preview
FROM query, nexus_app.chunks AS c
JOIN nexus_app.documents AS d ON d.id = c.document_id
WHERE query.tsq @@ to_tsvector('french', coalesce(c.content, ''))
ORDER BY score DESC
LIMIT :limit;
"""
)


_FALLBACK_SQL = text(
    """
SELECT
    c.id AS chunk_id,
    c.document_id,
    d.source,
    d.path,
    d.version,
    d.meta AS document_meta,
    c.meta AS chunk_meta,
    0.25 AS score,
    NULL AS snippet,
    substring(coalesce(c.content, '') for 320) AS preview
FROM nexus_app.chunks AS c
JOIN nexus_app.documents AS d ON d.id = c.document_id
WHERE coalesce(c.content, '') ILIKE :pattern
ORDER BY char_length(coalesce(c.content, '')) DESC
LIMIT :limit;
"""
)


def _prepare_filters(raw_filters: Optional[str]) -> Dict[str, str]:
    if not raw_filters:
        return {}
    cleaned = raw_filters.replace(";", ",")
    result: Dict[str, str] = {}
    for part in cleaned.split(","):
        if not part:
            continue
        if "=" not in part:
            continue
        key, value = part.split("=", 1)
        key = key.strip()
        value = value.strip()
        if key and value:
            result[key.lower()] = value
    return result


def _match_filters(metadata: Dict[str, Any], filters: Dict[str, str]) -> bool:
    if not filters:
        return True
    document_meta = metadata.get("document") or {}
    chunk_meta = metadata.get("chunk") or {}

    def _lookup(key: str) -> Optional[str]:
        value = None
        if key in document_meta:
            value = document_meta[key]
        elif key in chunk_meta:
            value = chunk_meta[key]
        elif key in metadata:
            value = metadata[key]
        return None if value is None else str(value)

    for key, expected in filters.items():
        candidate = _lookup(key)
        if candidate is None:
            return False
        if candidate.lower() != expected.lower():
            return False
    return True


def _coerce_score(value: Any) -> float:
    try:
        score = float(value or 0.0)
    except (TypeError, ValueError):
        score = 0.0
    return max(0.0, min(score, 1.0))


def search(
    session: Session,
    query: str,
    *,
    filters: Optional[str] = None,
    limit: int = 8,
) -> List[Dict[str, Any]]:
    import traceback
    sanitized = query.strip()
    if not sanitized:
        return []

    parsed_filters = _prepare_filters(filters)
    fetch_limit = max(limit * 3, limit) if parsed_filters else limit
    try:
        rows = session.execute(_SEARCH_SQL, {"query": sanitized, "limit": fetch_limit}).mappings().all()
    except Exception as exc:
        logger.error(f"RAG search SQL error: {exc}\n{traceback.format_exc()}")
        raise RuntimeError("Erreur de connexion ou de schéma RAG: vérifiez la base et les tables nexus_app.chunks/documents.")

    if not rows:
        try:
            fallback_pattern = f"%{sanitized.split()[0]}%"
            rows = session.execute(_FALLBACK_SQL, {"pattern": fallback_pattern, "limit": fetch_limit}).mappings().all()
        except Exception as exc:
            logger.error(f"RAG fallback SQL error: {exc}\n{traceback.format_exc()}")
            raise RuntimeError("Erreur de fallback RAG: vérifiez la base et les tables nexus_app.chunks/documents.")

    hits: List[Dict[str, Any]] = []
    for row in rows:
        document_meta = row.get("document_meta") or {}
        chunk_meta = row.get("chunk_meta") or {}
        metadata = {
            "document": document_meta,
            "chunk": chunk_meta,
            "source": row.get("source"),
            "path": row.get("path"),
            "version": row.get("version"),
        }

        # Surface common attributes at top-level for convenience
        if "title" in document_meta:
            metadata.setdefault("title", document_meta.get("title"))
        if "subject" in document_meta:
            metadata.setdefault("subject", document_meta.get("subject"))
        if "subject" in chunk_meta:
            metadata.setdefault("subject", chunk_meta.get("subject"))
        if "modality" in chunk_meta:
            metadata.setdefault("modality", chunk_meta.get("modality"))

        if parsed_filters and not _match_filters(metadata, parsed_filters):
            continue

        snippet = row.get("snippet") or row.get("preview") or ""
        title = document_meta.get("title") or document_meta.get("name") or row.get("path") or "Document"

        hit = {
            "document_id": row["document_id"],
            "chunk_id": row["chunk_id"],
            "title": title,
            "snippet": snippet,
            "score": _coerce_score(row.get("score")),
            "metadata": metadata,
        }
        hits.append(hit)
        if len(hits) >= limit:
            break

    return hits


def get_document(session: Session, document_id: UUID, *, chunk_limit: int = 25) -> Dict[str, Any]:
    document = session.get(Document, document_id)
    if not document:
        raise DocumentNotFoundError("Document not found")

    chunks_rows = session.execute(
        text(
            """
SELECT id, content, meta
FROM nexus_app.chunks
WHERE document_id = :document_id
ORDER BY id
LIMIT :limit;
"""
        ),
        {"document_id": document_id, "limit": chunk_limit},
    ).mappings()

    chunks = [
        {
            "id": row["id"],
            "content": row.get("content") or "",
            "meta": row.get("meta") or {},
        }
        for row in chunks_rows
    ]

    return {
        "id": document.id,
        "source": document.source,
        "path": document.path,
        "version": document.version,
        "meta": document.meta or {},
        "chunks": chunks,
    }
