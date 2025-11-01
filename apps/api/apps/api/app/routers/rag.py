from fastapi import APIRouter, Depends
from ..db.session import get_db
router = APIRouter()

@router.get("/search")
def rag_search(q: str, filters: str | None = None, db=Depends(get_db)):
    return {"q": q, "filters": filters, "hits": []}
