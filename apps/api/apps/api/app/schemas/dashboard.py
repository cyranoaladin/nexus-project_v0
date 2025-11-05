from __future__ import annotations

from datetime import datetime
from typing import Iterable, List, Literal, Optional, Dict
from uuid import UUID

from pydantic import BaseModel, Field, RootModel


class KPIResponse(BaseModel):
    progress_overall: float = Field(..., ge=0, le=1, description="Average progress score across competences")
    streak_days: int = Field(..., ge=0, description="Number of recent days with recorded progress")
    last_eval_score: Optional[float] = Field(None, description="Latest evaluation score on 20")


class UpcomingItem(BaseModel):
    id: UUID
    at: datetime
    kind: Literal["Visio", "Présentiel", "Stage", "Épreuve", "Rappel"]
    title: str
    status: Optional[str] = Field(None, description="Session status if applicable")
    location: Optional[str] = None


class TaskItem(BaseModel):
    id: UUID
    label: str
    status: Literal["Todo", "Done", "Skipped"]
    due_at: Optional[datetime]
    weight: float
    source: Optional[Literal["Agent", "Coach", "System"]]


class TaskBucket(BaseModel):
    label: str
    tasks: List[TaskItem]


class DashboardSummaryResponse(BaseModel):
    kpis: KPIResponse
    upcoming: List[UpcomingItem]
    tasks: List[TaskItem]
    backlog: Optional[List[TaskBucket]] = None


class AgendaItem(BaseModel):
    id: UUID
    title: str
    kind: Literal["Visio", "Présentiel", "Stage"]
    start_at: datetime
    end_at: datetime
    status: Literal["Proposé", "Confirmé", "Annulé"]
    location: Optional[str] = None


class AgendaResponse(BaseModel):
    items: List[AgendaItem]


class ProgressEntry(BaseModel):
    subject: str
    chapter_code: str
    competence_code: Optional[str]
    score: float
    updated_at: datetime


class ProgressionResponse(BaseModel):
    entries: List[ProgressEntry]


class EpreuveItem(BaseModel):
    id: UUID
    code: str
    label: str
    weight: float
    scheduled_at: Optional[datetime]
    format: str
    source: str


class EpreuvesResponse(BaseModel):
    track: Literal["Premiere", "Terminale"]
    profile: Literal["Scolarise", "CandidatLibre"]
    items: List[EpreuveItem]


class TaskCompleteRequest(BaseModel):
    task_id: UUID
    status: Optional[Literal["Todo", "Done", "Skipped"]] = Field(
        "Done", description="New status for the task; defaults to 'Done'"
    )


class TaskUpsert(BaseModel):
    id: Optional[UUID] = None
    label: str
    status: Optional[Literal["Todo", "Done", "Skipped"]] = None
    due_at: Optional[datetime] = None
    weight: Optional[float] = None
    source: Optional[Literal["Agent", "Coach", "System"]] = None


class TaskUpdateList(RootModel[List[TaskUpsert]]):
    def __iter__(self) -> Iterable[TaskUpsert]:
        return iter(self.root)

    def __len__(self) -> int:  # pragma: no cover - delegation helper
        return len(self.root)


class TasksBulkResponse(BaseModel):
    tasks: List[TaskItem]


class EvaluationFeedbackItem(BaseModel):
    step: str
    comment: str


class EvaluationHistoryEntry(BaseModel):
    graded_at: datetime
    score_20: float = Field(..., ge=0, le=20)


class EvaluationSubmissionFile(BaseModel):
    name: str
    content_type: Optional[str]
    size_bytes: int = Field(..., ge=0)
    sha256: str


class EvaluationSubmission(BaseModel):
    submitted_at: datetime
    submitted_by: Literal["student", "coach", "admin"]
    files: List[EvaluationSubmissionFile]


class EvaluationResponse(BaseModel):
    id: UUID
    student_id: UUID
    subject: str
    status: Literal["Proposé", "Soumis", "Corrigé"]
    duration_min: int
    score_20: Optional[float]
    created_at: datetime
    metadata: Dict[str, str] = Field(default_factory=dict)
    feedback: Optional[List[EvaluationFeedbackItem]] = None
    submissions: Optional[List[EvaluationSubmission]] = None
    history: Optional[List[EvaluationHistoryEntry]] = None


class EvaluationGenerateRequest(BaseModel):
    student_id: UUID
    subject: str
    level: str
    duration: int = Field(45, ge=10, le=240)
    constraints: Dict[str, str] = Field(default_factory=dict)


class EvaluationFeedbackRequest(BaseModel):
    score_20: float = Field(..., ge=0, le=20)
    feedback: List[EvaluationFeedbackItem] = Field(default_factory=list)