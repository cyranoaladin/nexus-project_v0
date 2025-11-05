from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/plans", tags=["plans"])


@router.get("/")
async def list_plans() -> dict[str, list]:
    # TODO: brancher sur Mongo
    return {"items": []}
