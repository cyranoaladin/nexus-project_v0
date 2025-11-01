from fastapi import APIRouter, Depends
from ..db.session import get_db
router = APIRouter()

@router.post("/generate")
def generate_plan(payload: dict, db=Depends(get_db)):
    return {"plan": {"items": []}}
