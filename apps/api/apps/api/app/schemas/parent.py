from __future__ import annotations

from datetime import datetime
from typing import List
from uuid import UUID

from pydantic import BaseModel

from app.schemas.dashboard import KPIResponse, ProgressEntry, TaskItem, UpcomingItem


class ParentReportResponse(BaseModel):
    student_id: UUID
    period: str
    generated_at: datetime
    summary_md: str
    kpis: KPIResponse
    upcoming: List[UpcomingItem]
    tasks: List[TaskItem]
    progress: List[ProgressEntry]

    class Config:
        orm_mode = True
