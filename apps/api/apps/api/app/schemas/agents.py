from __future__ import annotations

from typing import Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.parent import ParentReportResponse


class PlannerSyncRequest(BaseModel):
    student_id: UUID


class PlannerSyncResponse(BaseModel):
    student_id: UUID
    items: int = Field(..., ge=0)


class CoachSyncRequest(BaseModel):
    student_id: UUID


class CoachSyncResponse(BaseModel):
    student_id: UUID
    tasks_created: int = Field(..., ge=0)


class BulkSyncRequest(BaseModel):
    student_ids: List[UUID]


class BulkSyncResponse(BaseModel):
    counts: Dict[str, int]


class EvaluatorFeedbackItem(BaseModel):
    step: str
    comment: str


class EvaluatorGradeRequest(BaseModel):
    evaluation_id: UUID
    score_20: Optional[float] = Field(None, ge=0, le=20)
    feedback: Optional[List[EvaluatorFeedbackItem]] = None


class EvaluatorBulkRequest(BaseModel):
    evaluation_ids: List[UUID]
    score_20: Optional[float] = Field(None, ge=0, le=20)


class EvaluatorBulkResult(BaseModel):
    evaluation_id: UUID
    status: str
    score_20: Optional[float] = None


class EvaluatorBulkResponse(BaseModel):
    results: List[EvaluatorBulkResult]


class ReporterBulkRequest(BaseModel):
    student_ids: Optional[List[UUID]] = None
    period: Optional[str] = None
    regenerate: bool = False


class ReporterBulkResponse(BaseModel):
    reports: List[ParentReportResponse]
