from __future__ import annotations

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class DiagnosticItem(BaseModel):
    skill: str = Field(..., description="Nom de la compétence évaluée")
    level: Literal["weak", "medium", "strong"] = Field(..., description="Niveau estimé")
    evidence: str = Field(..., description="Élément justifiant le diagnostic")


class DiagnosticReport(BaseModel):
    student_id: str
    chapter: str
    items: List[DiagnosticItem]
    summary: str = Field(..., description="Résumé actionnable du diagnostic")


class StudySlot(BaseModel):
    day: str = Field(..., description="Jour ou libellé du créneau")
    objectives: List[str] = Field(default_factory=list)
    duration_min: int = Field(..., ge=5, description="Durée en minutes")


class StudyPlan(BaseModel):
    student_id: str
    horizon: Literal["week", "8_weeks"]
    slots: List[StudySlot]
    checkpoints: List[str] = Field(default_factory=list)
    spaced_repetition: List[str] = Field(default_factory=list)


class Exercise(BaseModel):
    id: str
    difficulty: Literal["easy", "medium", "hard"]
    tags: List[str] = Field(default_factory=list)
    latex_src: str = Field(..., description="Contenu LaTeX de l'exercice")
    pdf_uri: Optional[str] = Field(default=None, description="Lien vers la version PDF")


class ExerciseSet(BaseModel):
    student_id: str
    chapter: str
    exercises: List[Exercise]


class RubricItem(BaseModel):
    criterion: str
    points: float = Field(..., ge=0)
    feedback: str


class Correction(BaseModel):
    exercise_id: str
    score: float
    rubric: List[RubricItem]
    next_steps: List[str] = Field(default_factory=list)
    max_score: Optional[float] = Field(default=None)


class ProgressKPI(BaseModel):
    student_id: str
    date: str
    mastery_by_skill: Dict[str, float] = Field(default_factory=dict)
    time_on_task_min: int = Field(..., ge=0)
    streak_days: int = Field(..., ge=0)


class AuthContext(BaseModel):
    sub: str
    role: str
    scopes: List[str] = Field(default_factory=list)
    tenant: Optional[str] = None
    classroom: Optional[str] = None
