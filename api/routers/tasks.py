from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional, List, Literal, Dict, Any
from enum import Enum

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from sqlalchemy import select

from sqlalchemy_models.models import Task, Student
from .deps import get_db
from api.utils.security import get_principal, must_be_self_or_staff, Principal
from api.utils.audit import log_event

router = APIRouter(prefix="/dashboard/tasks", tags=["dashboard","tasks"])

class TaskStatus(str, Enum):
    Todo = "Todo"
    Done = "Done"
    Skipped = "Skipped"

class TaskSource(str, Enum):
    Agent = "Agent"
    Coach = "Coach"
    System = "System"

class TaskCreate(BaseModel):
    student_id: uuid.UUID
    label: str = Field(min_length=1, max_length=300)
    due_at: Optional[datetime] = None
    weight: float = Field(default=1.0, ge=0.0, le=5.0)
    source: TaskSource = TaskSource.Agent

class TaskUpdate(BaseModel):
    label: Optional[str] = Field(default=None, min_length=1, max_length=300)
    due_at: Optional[datetime] = None
    weight: Optional[float] = Field(default=None, ge=0.0, le=5.0)
    status: Optional[TaskStatus] = None
    source: Optional[TaskSource] = None

class TaskOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    label: str
    due_at: Optional[datetime]
    weight: float
    status: TaskStatus
    source: TaskSource
    created_at: datetime
    class Config:
        from_attributes = True

class TaskBulkOp(BaseModel):
    op: Literal["create","update","delete"]
    id: Optional[uuid.UUID] = None
    data: Optional[Dict[str, Any]] = None

class TaskBulkRequest(BaseModel):
    operations: List[TaskBulkOp] = Field(..., min_items=1)

class TaskBulkResult(BaseModel):
    index: int
    status: Literal["created","updated","deleted","not_found","invalid"]
    id: Optional[uuid.UUID] = None
    error: Optional[str] = None

@router.get("", response_model=List[TaskOut])
def list_tasks(
    student_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    must_be_self_or_staff(str(student_id), principal)
    q = select(Task).where(Task.student_id == student_id).order_by(Task.created_at.desc())
    items = db.execute(q).scalars().all()
    return items

@router.post("", response_model=TaskOut)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    must_be_self_or_staff(str(payload.student_id), principal)
    exists = db.get(Student, payload.student_id)
    if not exists:
        raise HTTPException(status_code=404, detail="student not found")
    obj = Task(
        id=uuid.uuid4(),
        student_id=payload.student_id,
        label=payload.label,
        due_at=payload.due_at,
        weight=payload.weight,
        source=payload.source.value,
    )
    db.add(obj)
    log_event(db, payload.student_id, "TASK_CREATED", {"task_id": str(obj.id), "label": payload.label})
    db.commit()
    db.refresh(obj)
    return obj

@router.patch("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    obj = db.get(Task, task_id)
    if not obj:
        raise HTTPException(status_code=404, detail="task not found")
    must_be_self_or_staff(str(obj.student_id), principal)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, field, value if not isinstance(value, Enum) else value.value)
    db.add(obj)
    log_event(db, obj.student_id, "TASK_UPDATED", {"task_id": str(obj.id), "patch": payload.model_dump(exclude_unset=True)})
    db.commit()
    db.refresh(obj)
    return obj

@router.delete("/{task_id}")
def delete_task(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    obj = db.get(Task, task_id)
    if not obj:
        raise HTTPException(status_code=404, detail="task not found")
    must_be_self_or_staff(str(obj.student_id), principal)
    db.delete(obj)
    log_event(db, obj.student_id, "TASK_DELETED", {"task_id": str(task_id)})
    db.commit()
    return {"status":"deleted","id": str(task_id)}

@router.post("/bulk")
def bulk_tasks(
    payload: TaskBulkRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    results: List[TaskBulkResult] = []
    # Transaction globale + savepoint par opération
    outer = db.begin()
    try:
        for idx, op in enumerate(payload.operations):
            try:
                with db.begin_nested():  # SAVEPOINT
                    if op.op == "create":
                        data = op.data or {}
                        student_id = uuid.UUID(str(data.get("student_id")))
                        must_be_self_or_staff(str(student_id), principal)
                        if not db.get(Student, student_id):
                            results.append(TaskBulkResult(index=idx, status="invalid", error="student_not_found"))
                            continue
                        obj = Task(
                            id=uuid.uuid4(),
                            student_id=student_id,
                            label=str(data.get("label","")),
                            due_at=data.get("due_at"),
                            weight=float(data.get("weight", 1.0)),
                            source=str(data.get("source","Agent")),
                        )
                        db.add(obj)
                        db.flush()
                        log_event(db, student_id, "TASK_CREATED", {"task_id": str(obj.id)})
                        results.append(TaskBulkResult(index=idx, status="created", id=obj.id))
                    elif op.op == "update":
                        if not op.id:
                            results.append(TaskBulkResult(index=idx, status="invalid", error="missing id"))
                            continue
                        obj = db.get(Task, op.id)
                        if not obj:
                            results.append(TaskBulkResult(index=idx, status="not_found", id=op.id))
                            continue
                        must_be_self_or_staff(str(obj.student_id), principal)
                        for field, value in (op.data or {}).items():
                            setattr(obj, field, value)
                        db.add(obj)
                        log_event(db, obj.student_id, "TASK_UPDATED", {"task_id": str(obj.id)})
                        results.append(TaskBulkResult(index=idx, status="updated", id=obj.id))
                    elif op.op == "delete":
                        if not op.id:
                            results.append(TaskBulkResult(index=idx, status="invalid", error="missing id"))
                            continue
                        obj = db.get(Task, op.id)
                        if not obj:
                            results.append(TaskBulkResult(index=idx, status="not_found", id=op.id))
                            continue
                        must_be_self_or_staff(str(obj.student_id), principal)
                        db.delete(obj)
                        log_event(db, obj.student_id, "TASK_DELETED", {"task_id": str(obj.id)})
                        results.append(TaskBulkResult(index=idx, status="deleted", id=obj.id))
                    else:
                        results.append(TaskBulkResult(index=idx, status="invalid", error="unknown op"))
            except Exception as e:
                results.append(TaskBulkResult(index=idx, status="invalid", error=str(e)))
        outer.commit()
    except Exception as e:
        outer.rollback()
        raise
    return {"results":[r.model_dump() for r in results]}
