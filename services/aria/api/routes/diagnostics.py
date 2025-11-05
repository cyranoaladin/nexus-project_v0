from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/diagnostics", tags=["diagnostics"])


@router.get("/")
async def list_diagnostics() -> dict[str, list]:
    # TODO: brancher sur Mongo
    return {"items": []}
