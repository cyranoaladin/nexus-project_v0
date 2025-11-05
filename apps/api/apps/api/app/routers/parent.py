from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.parent import ParentReportResponse
from app.services import reports as reports_service
from app.utils.security import ActorContext, Role, ensure_access, require_role

router = APIRouter()


@router.get("/report", response_model=ParentReportResponse)
def parent_report(
    student_id: UUID = Query(..., description="Identifier of the student"),
    period: Optional[str] = Query(None, description="Reporting period, defaults to current month"),
    force_refresh: bool = Query(False, description="Regenerate the report even if cached"),
    actor: ActorContext = Depends(require_role(Role.PARENT, Role.COACH, Role.ADMIN, Role.STUDENT)),
    db: Session = Depends(get_db),
) -> ParentReportResponse:
    ensure_access(actor, str(student_id))
    payload = reports_service.upsert_parent_report(
        db,
        student_id=student_id,
        period=period,
        regenerate=force_refresh,
    )
    db.commit()
    return ParentReportResponse(**payload)
