from __future__ import annotations

import os
from functools import lru_cache
from typing import TYPE_CHECKING, Any, cast

try:  # pragma: no cover - optional dependency for static analysis
    from qdrant_client import QdrantClient as _QdrantClient  # type: ignore[import]
    from qdrant_client.http import models as qm  # type: ignore[import]
except ImportError:  # pragma: no cover
    _QdrantClient = None
    qm = None  # type: ignore[assignment]

if TYPE_CHECKING:  # pragma: no cover - typing helper
    from qdrant_client import QdrantClient as QdrantClientType
else:
    QdrantClientType = Any


@lru_cache(maxsize=1)
def get_qdrant_client() -> QdrantClientType:
    url = os.getenv("QDRANT_URL", "http://localhost:6333")
    if _QdrantClient is None or qm is None:  # pragma: no cover - runtime guard
        raise RuntimeError("qdrant-client is required to access the vector store")
    return cast(QdrantClientType, _QdrantClient(url=url))
