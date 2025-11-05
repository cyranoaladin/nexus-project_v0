from __future__ import annotations
from typing import Optional
from fastapi import Header, HTTPException, status

class Principal:
    def __init__(self, role: str, actor_id: Optional[str], student_id: Optional[str] = None):
        self.role = role
        self.actor_id = actor_id
        self.student_id = student_id

# NOTE: Ceci est un stub d'ACL pour l'intégration rapide.
# En production, remplacez-le par une extraction JWT (NextAuth) + mapping DB.
async def get_principal(
    x_role: str = Header("guest"),
    x_actor_id: Optional[str] = Header(None),
    x_student_id: Optional[str] = Header(None),
) -> Principal:
    role = (x_role or "guest").lower()
    if role not in {"guest", "student", "parent", "coach", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="invalid role")
    return Principal(role=role, actor_id=x_actor_id, student_id=x_student_id)

def must_be_admin_or_coach(principal: Principal):
    if principal.role not in {"admin", "coach"}:
        raise HTTPException(status_code=403, detail="forbidden")

def must_be_self_or_staff(target_student_id: str, principal: Principal):
    if principal.role in {"admin", "coach"}:
        return
    if principal.role == "student" and principal.student_id == target_student_id:
        return
    raise HTTPException(status_code=403, detail="forbidden")
