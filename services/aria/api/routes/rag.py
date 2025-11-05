from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/rag", tags=["rag"])


@router.get("/ping")
async def rag_ping() -> dict[str, str]:
    return {"status": "ready"}
