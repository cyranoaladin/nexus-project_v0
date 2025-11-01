from fastapi import APIRouter, Depends
from ..db.session import get_db
router = APIRouter()

@router.post("/book")
def book_session(payload: dict, db=Depends(get_db)):
    return {"booking": {"status": "booked"}}
