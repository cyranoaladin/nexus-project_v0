from __future__ import annotations

import os
from typing import Any, Dict, List

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "aria_rag")


def rag_query(query: str, top_k: int = 5, namespace: str | None = None) -> List[Dict[str, Any]]:
    """Placeholder RAG : à remplacer par l'appel Qdrant + reranker."""

    # TODO: intégrer QdrantClient + embeddings BGE-M3
    return [
        {
            "score": 0.62,
            "snippet": "Principe de récurrence : initialisation, hérédité, conclusion.",
            "meta": {"namespace": namespace or "default", "source": "demo"},
        }
        for _ in range(min(top_k, 2))
    ]
