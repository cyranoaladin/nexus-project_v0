from fastapi import APIRouter, Depends
from ..db.session import get_db
router = APIRouter()

@router.post("/generate")
def generate_eval(payload: dict, db=Depends(get_db)):
    return {"subject": payload.get("subject", "NSI"), "duration": 120}

@router.post("/grade")
def grade_eval(payload: dict, db=Depends(get_db)):
    return {"score": None, "feedback": []}
