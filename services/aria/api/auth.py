from __future__ import annotations

import os
from functools import lru_cache
from typing import Any, Iterable, List, cast

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
try:  # pragma: no cover - optional dependency during type checking
    from jose import JWTError, jwt  # type: ignore[import]
except ImportError:  # pragma: no cover
    JWTError = cast(Any, Exception)
    jwt = cast(Any, None)

from . import models


_http_bearer = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def _get_secret() -> str:
    secret = os.getenv("ARIA_JWT_SECRET")
    if not secret:
        raise RuntimeError("ARIA_JWT_SECRET is not set")
    return secret


def _get_algorithm() -> str:
    return os.getenv("ARIA_AUTH_ALGORITHM", "HS256")


def _get_audience() -> str | None:
    return os.getenv("ARIA_ALLOWED_AUDIENCE")


def _get_issuer() -> str | None:
    return os.getenv("ARIA_ALLOWED_ISSUER")


def _normalize_scopes(scopes: object) -> List[str]:
    if scopes is None:
        return []
    if isinstance(scopes, str):
        if not scopes.strip():
            return []
        return [scope.strip() for scope in scopes.split()]  # space separated
    if isinstance(scopes, Iterable):
        return [str(scope) for scope in scopes]
    return []


async def get_current_context(
    credentials: HTTPAuthorizationCredentials | None = Depends(_http_bearer),
) -> models.AuthContext:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    secret = _get_secret()
    algorithm = _get_algorithm()
    audience = _get_audience()
    issuer = _get_issuer()

    if jwt is None:  # pragma: no cover - runtime guard
        raise RuntimeError("python-jose is required to validate ARIA tokens")

    try:
        payload = jwt.decode(
            credentials.credentials,
            secret,
            algorithms=[algorithm],
            audience=audience,
            issuer=issuer,
        )
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    sub = payload.get("sub")
    role = payload.get("role")
    if not sub or not role:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing subject or role")

    scopes = _normalize_scopes(payload.get("scopes"))

    return models.AuthContext(
        sub=str(sub),
        role=str(role),
        scopes=scopes,
        tenant=payload.get("tenant"),
        classroom=payload.get("classroom"),
    )


def require_scopes(required_scopes: Iterable[str]):
    required = [scope for scope in required_scopes]

    async def dependency(context: models.AuthContext = Depends(get_current_context)) -> models.AuthContext:
        missing = [scope for scope in required if scope not in context.scopes]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"missing_scopes": missing},
            )
        return context

    return dependency
