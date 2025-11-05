from __future__ import annotations

import os
from functools import lru_cache
from typing import TYPE_CHECKING, Any, cast

try:  # pragma: no cover - optional dependency for static analysis
    import redis as _redis  # type: ignore[import]
except ImportError:  # pragma: no cover
    _redis = None  # type: ignore[assignment]

if TYPE_CHECKING:  # pragma: no cover - typing helper
    import redis
    from redis import Redis as RedisClient
else:
    RedisClient = Any


@lru_cache(maxsize=1)
def get_redis_client() -> RedisClient:
    url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    if _redis is None:  # pragma: no cover - runtime guard
        raise RuntimeError("redis-py is required to connect to Redis")
    return cast(RedisClient, _redis.Redis.from_url(url))
