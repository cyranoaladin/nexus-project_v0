from fastapi import APIRouter, Depends
from ..db.session import get_db
router = APIRouter()

@router.get("/report")
def parent_report(student_id: str, period: str | None = None, db=Depends(get_db)):
    return {"student_id": student_id, "period": period or "current"}
