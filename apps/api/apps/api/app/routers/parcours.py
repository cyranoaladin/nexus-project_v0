from fastapi import APIRouter, Depends
from ..db.session import get_db
router = APIRouter()

@router.get("/epreuves")
def list_epreuves(student_id: str, db=Depends(get_db)):
    return {"student_id": student_id, "epreuves": []}
