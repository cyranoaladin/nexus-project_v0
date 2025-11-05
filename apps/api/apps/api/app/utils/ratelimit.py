from __future__ import annotations

import time
from typing import Dict, Tuple

from fastapi import HTTPException, status

_BUCKETS: Dict[str, Tuple[float, int]] = {}


def rate_limit(key: str, limit: int, window_seconds: int) -> None:
    """Simple in-memory rate limiter (development use only)."""
    now = time.time()
    window_start, count = _BUCKETS.get(key, (now, 0))
    if now - window_start > window_seconds:
        window_start, count = now, 0
    count += 1
    _BUCKETS[key] = (window_start, count)
    if count > limit:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="rate limit exceeded")
