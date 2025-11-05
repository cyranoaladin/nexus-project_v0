from __future__ import annotations

import hashlib
import json
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.dashboard import EvaluationGenerateRequest, EvaluationResponse
from app.services import evaluations as evaluations_service
from app.services import dashboard as dashboard_service
from app.utils.ratelimit import rate_limit
from app.utils.security import ActorContext, Role, ensure_access, require_role

router = APIRouter(prefix="/eval", tags=["evaluations"])

ALLOWED_UPLOAD_TYPES = {"application/pdf", "image/png", "image/jpeg"}
MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024


def _serialize_evaluation(model) -> EvaluationResponse:
    return EvaluationResponse(**evaluations_service.serialize_evaluation(model))


@router.post("/generate", response_model=EvaluationResponse)
def generate_eval(
    payload: EvaluationGenerateRequest,
    actor: ActorContext = Depends(require_role(Role.COACH, Role.ADMIN)),
    db: Session = Depends(get_db),
) -> EvaluationResponse:
    try:
        student = dashboard_service.ensure_student(db, payload.student_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    ensure_access(actor, str(student.id))
    rate_limit(f"eval:generate:{actor.actor_id or actor.role}", limit=10, window_seconds=60)

    evaluation = evaluations_service.generate_evaluation(
        db,
        student_id=payload.student_id,
        subject=payload.subject,
        level=payload.level,
        duration=payload.duration,
        constraints=payload.constraints,
    )
    db.commit()
    db.refresh(evaluation)
    return _serialize_evaluation(evaluation)


async def _digest_upload(file: UploadFile) -> dict:
    if file.content_type not in ALLOWED_UPLOAD_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formats autorisés : PDF, PNG, JPEG",
        )
    hasher = hashlib.sha256()
    size = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        size += len(chunk)
        if size > MAX_UPLOAD_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Fichier trop volumineux (10 Mo max)",
            )
        hasher.update(chunk)
    await file.seek(0)
    return {
        "name": file.filename,
        "content_type": file.content_type,
        "size_bytes": size,
        "sha256": hasher.hexdigest(),
    }


@router.post("/grade", response_model=EvaluationResponse)
async def grade_eval(
    evaluation_id: UUID = Form(..., description="Identifier of the evaluation"),
    score_20: Optional[float] = Form(None, description="Optional manual score on 20"),
    feedback: Optional[str] = Form(
        None, description="Optional JSON array of feedback items [{\"step\":...,\"comment\":...}]"
    ),
    files: Optional[List[UploadFile]] = File(None, description="Copies or supporting documents"),
    actor: ActorContext = Depends(require_role(Role.STUDENT, Role.COACH, Role.ADMIN)),
    db: Session = Depends(get_db),
) -> EvaluationResponse:
    try:
        evaluation = evaluations_service.get_evaluation(db, evaluation_id)
    except evaluations_service.EvaluationNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    ensure_access(actor, str(evaluation.student_id))
    rate_limit(f"eval:grade:{actor.actor_id or actor.role}", limit=20, window_seconds=120)

    files_meta: List[dict] = []
    if files:
        if len(files) > 5:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Too many files (max 5)")
        for upload in files:
            files_meta.append(await _digest_upload(upload))

    submitted_by = actor.role.value
    if files_meta:
        evaluations_service.record_submission(
            db,
            evaluation_id=evaluation_id,
            files=files_meta,
            submitted_by=submitted_by,
        )

    feedback_items: Optional[List[dict]] = None
    if feedback:
        try:
            parsed = json.loads(feedback)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid feedback JSON") from exc
        if not isinstance(parsed, list):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Feedback must be a list")
        feedback_items = []
        for item in parsed:
            if not isinstance(item, dict) or "step" not in item or "comment" not in item:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid feedback item format")
            feedback_items.append({"step": str(item["step"]), "comment": str(item["comment"])})

    updated = evaluation
    if score_20 is not None:
        updated = evaluations_service.apply_grade(
            db,
            evaluation_id=evaluation_id,
            score_20=float(score_20),
            feedback=feedback_items or [],
        )

    db.commit()
    db.refresh(updated)
    return _serialize_evaluation(updated)
