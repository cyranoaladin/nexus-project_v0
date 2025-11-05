from __future__ import annotations

import os
from functools import lru_cache
from typing import Any, cast

try:  # pragma: no cover - optional dependency for static analysis
    import boto3  # type: ignore[import]
except ImportError:  # pragma: no cover
    boto3 = cast(Any, None)


@lru_cache(maxsize=1)
def get_s3_client():
    endpoint = os.getenv("S3_ENDPOINT")
    access_key = os.getenv("S3_ACCESS_KEY")
    secret_key = os.getenv("S3_SECRET_KEY")
    region = os.getenv("S3_REGION", "us-east-1")

    if boto3 is None:  # pragma: no cover - runtime guard
        raise RuntimeError("boto3 is required to interact with S3-compatible storage")

    session = boto3.session.Session()
    return session.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=region,
    )
