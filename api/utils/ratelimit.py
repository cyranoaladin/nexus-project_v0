from __future__ import annotations
import time
from typing import Dict, Tuple
from fastapi import HTTPException, status

# Limiteur en mémoire (DEV seulement). Pour la prod, utiliser Redis (token bucket).
# Clé = f"{route}:{key}", Valeur = (window_start, count)
_BUCKETS: Dict[str, Tuple[float, int]] = {}

def rate_limit(key: str, limit: int, window_seconds: int) -> None:
    now = time.time()
    bucket_key = key
    window_start, count = _BUCKETS.get(bucket_key, (now, 0))
    if now - window_start > window_seconds:
        window_start, count = now, 0
    count += 1
    _BUCKETS[bucket_key] = (window_start, count)
    if count > limit:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="rate limit exceeded")
