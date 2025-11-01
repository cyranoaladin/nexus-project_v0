from fastapi import APIRouter, Depends
from ..db.session import get_db
router = APIRouter()

@router.post("/bilan")
def post_bilan(payload: dict, db=Depends(get_db)):
    return {"ok": True, "profil": payload, "plan": {"horizon": 7, "items": []}}
