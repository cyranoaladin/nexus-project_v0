from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional, List, Literal, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import select

from sqlalchemy_models.models import Task, Student
from .deps import get_db

router = APIRouter(prefix="/dashboard/tasks", tags=["dashboard","tasks"])

class TaskCreate(BaseModel):
    student_id: uuid.UUID
    label: str
    due_at: Optional[datetime] = None
    weight: float = 1.0
    source: str = "Agent"

class TaskUpdate(BaseModel):
    label: Optional[str] = None
    due_at: Optional[datetime] = None
    weight: Optional[float] = None
    status: Optional[str] = None
    source: Optional[str] = None

class TaskOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    label: str
    due_at: Optional[datetime]
    weight: float
    status: str
    source: str
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
def list_tasks(student_id: uuid.UUID = Query(...), db: Session = Depends(get_db)):
    q = select(Task).where(Task.student_id == student_id).order_by(Task.created_at.desc())
    items = db.execute(q).scalars().all()
    return items

@router.post("", response_model=TaskOut)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)):
    exists = db.get(Student, payload.student_id)
    if not exists:
        raise HTTPException(status_code=404, detail="student not found")
    obj = Task(
        id=uuid.uuid4(),
        student_id=payload.student_id,
        label=payload.label,
        due_at=payload.due_at,
        weight=payload.weight,
        source=payload.source,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

@router.patch("/{task_id}", response_model=TaskOut)
def update_task(task_id: uuid.UUID, payload: TaskUpdate, db: Session = Depends(get_db)):
    obj = db.get(Task, task_id)
    if not obj:
        raise HTTPException(status_code=404, detail="task not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

@router.delete("/{task_id}")
def delete_task(task_id: uuid.UUID, db: Session = Depends(get_db)):
    obj = db.get(Task, task_id)
    if not obj:
        raise HTTPException(status_code=404, detail="task not found")
    db.delete(obj)
    db.commit()
    return {"status":"deleted","id": str(task_id)}

@router.post("/bulk")
def bulk_tasks(payload: TaskBulkRequest, db: Session = Depends(get_db)):
    results: List[TaskBulkResult] = []
    for idx, op in enumerate(payload.operations):
        try:
            if op.op == "create":
                data = op.data or {}
                student_id = uuid.UUID(data.get("student_id"))
                if not db.get(Student, student_id):
                    results.append(TaskBulkResult(index=idx, status="invalid", error="student_not_found"))
                    continue
                obj = Task(
                    id=uuid.uuid4(),
                    student_id=student_id,
                    label=data.get("label",""),
                    due_at=data.get("due_at"),
                    weight=data.get("weight", 1.0),
                    source=data.get("source","Agent"),
                )
                db.add(obj)
                db.flush()
                results.append(TaskBulkResult(index=idx, status="created", id=obj.id))
            elif op.op == "update":
                if not op.id:
                    results.append(TaskBulkResult(index=idx, status="invalid", error="missing id"))
                    continue
                obj = db.get(Task, op.id)
                if not obj:
                    results.append(TaskBulkResult(index=idx, status="not_found", id=op.id))
                    continue
                for field, value in (op.data or {}).items():
                    setattr(obj, field, value)
                db.add(obj)
                results.append(TaskBulkResult(index=idx, status="updated", id=obj.id))
            elif op.op == "delete":
                if not op.id:
                    results.append(TaskBulkResult(index=idx, status="invalid", error="missing id"))
                    continue
                obj = db.get(Task, op.id)
                if not obj:
                    results.append(TaskBulkResult(index=idx, status="not_found", id=op.id))
                    continue
                db.delete(obj)
                results.append(TaskBulkResult(index=idx, status="deleted", id=op.id))
            else:
                results.append(TaskBulkResult(index=idx, status="invalid", error="unknown op"))
        except Exception as e:
            results.append(TaskBulkResult(index=idx, status="invalid", error=str(e)))
    db.commit()
    return {"results":[r.model_dump() for r in results]}
