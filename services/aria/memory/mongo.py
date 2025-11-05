from __future__ import annotations

import os
from functools import lru_cache

from typing import TYPE_CHECKING, Any, cast

try:  # pragma: no cover - optional dependency for static analysis
    from pymongo import MongoClient as _MongoClient  # type: ignore[import]
except ImportError:  # pragma: no cover
    _MongoClient = None

if TYPE_CHECKING:  # pragma: no cover - typing helper
    from pymongo import MongoClient as MongoClientType
else:
    MongoClientType = Any


@lru_cache(maxsize=1)
def get_mongo_client() -> MongoClientType:
    uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/aria")
    if _MongoClient is None:  # pragma: no cover - runtime guard
        raise RuntimeError("pymongo is required to connect to MongoDB")
    return cast(MongoClientType, _MongoClient(uri))
