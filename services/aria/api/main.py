from __future__ import annotations

from typing import Any, Dict

from fastapi import Depends, FastAPI

from . import models
from .auth import require_scopes
from .deps import get_orchestrator
from .routes import diagnostics, grading, plans, rag
from ..orchestrator.router import Orchestrator

app = FastAPI(title="ARIA API", version="0.1.0")

app.include_router(
    diagnostics.router,
    dependencies=[Depends(require_scopes(["aria.diagnostics:read"]))],
)
app.include_router(
    plans.router,
    dependencies=[Depends(require_scopes(["aria.plans:read"]))],
)
app.include_router(
    rag.router,
    dependencies=[Depends(require_scopes(["aria.rag:read"]))],
)
app.include_router(
    grading.router,
    dependencies=[Depends(require_scopes(["aria.grade:read"]))],
)


@app.get("/health")
def health_check() -> dict[str, bool]:
    return {"ok": True}


@app.post("/sessions/run")
async def run_session(
    payload: Dict[str, Any],
    orchestrator: Orchestrator = Depends(get_orchestrator),
    auth_context: models.AuthContext = Depends(require_scopes(["aria.sessions:run"])),
) -> Dict[str, Any]:
    ctx = {**payload, "auth": auth_context.model_dump()}
    ctx = await orchestrator.run_session(ctx)
    return ctx


@app.post("/diagnostics", response_model=models.DiagnosticReport)
async def create_diagnostic(
    auth_context: models.AuthContext = Depends(require_scopes(["aria.diagnostics:write"])),
) -> models.DiagnosticReport:
    # TODO: implémentation complète
    return models.DiagnosticReport(
        student_id="demo",
        chapter="recurrence",
        items=[],
        summary="Diagnostic placeholder",
    )


@app.post("/plans", response_model=models.StudyPlan)
async def create_plan(
    auth_context: models.AuthContext = Depends(require_scopes(["aria.plans:write"])),
) -> models.StudyPlan:
    # TODO: implémentation complète
    return models.StudyPlan(
        student_id="demo",
        horizon="week",
        slots=[],
        checkpoints=[],
        spaced_repetition=[],
    )


@app.post("/grade", response_model=models.Correction)
async def grade(
    auth_context: models.AuthContext = Depends(require_scopes(["aria.grade:write"])),
) -> models.Correction:
    # TODO: implémentation complète
    return models.Correction(
        exercise_id="demo",
        score=0.0,
        rubric=[],
        next_steps=[],
    )
