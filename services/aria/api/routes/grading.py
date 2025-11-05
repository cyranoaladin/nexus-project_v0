from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/grading", tags=["grading"])


@router.get("/ping")
async def grading_ping() -> dict[str, str]:
    return {"status": "ready"}
