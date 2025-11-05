from __future__ import annotations

import enum
from dataclasses import dataclass
from typing import Callable, Iterable, Optional

from fastapi import Depends, Header, HTTPException, status


class Role(str, enum.Enum):
    STUDENT = "student"
    PARENT = "parent"
    COACH = "coach"
    ADMIN = "admin"
    ASSISTANTE = "assistante"


@dataclass
class ActorContext:
    role: Role
    actor_id: Optional[str]
    student_id: Optional[str]


def _normalize_role(raw: Optional[str]) -> Role:
    if not raw:
        return Role.STUDENT
    lowered = raw.strip().lower()
    for role in Role:
        if lowered == role.value:
            return role
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown role header")


async def get_actor(
    x_role: Optional[str] = Header(None, alias="X-Role"),
    x_actor_id: Optional[str] = Header(None, alias="X-Actor-Id"),
    x_student_id: Optional[str] = Header(None, alias="X-Student-Id"),
) -> ActorContext:
    role = _normalize_role(x_role)
    return ActorContext(role=role, actor_id=x_actor_id, student_id=x_student_id)


def require_role(*allowed: Role) -> Callable[[ActorContext], ActorContext]:
    if not allowed:
        allowed = (Role.STUDENT, Role.COACH, Role.ADMIN, Role.PARENT)

    async def dependency(actor: ActorContext = Depends(get_actor)) -> ActorContext:
        if actor.role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return actor

    return dependency


def enforce_student_scope(actor: ActorContext, requested_student_id: str) -> None:
    if actor.role == Role.STUDENT:
        if not actor.student_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student scope missing")
        if actor.student_id != requested_student_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student scope mismatch")


def ensure_access(actor: ActorContext, requested_student_id: str) -> None:
    if actor.role in {Role.ADMIN, Role.COACH}:
        return
    if actor.role == Role.PARENT:
        if not actor.student_id or actor.student_id != requested_student_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Parent scope mismatch")
        return
    enforce_student_scope(actor, requested_student_id)