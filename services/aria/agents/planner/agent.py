from __future__ import annotations

from typing import Any, Dict


async def planner_agent(ctx: Dict[str, Any]) -> Dict[str, Any]:
    """Construit un plan hebdomadaire minimal basé sur le diagnostic."""

    ctx.setdefault("plan", {})
    ctx["plan"]["horizon"] = "week"
    ctx["plan"]["slots"] = [
        {"day": "Lundi", "objectives": ["Revoir la récurrence"], "duration_min": 60},
        {"day": "Mercredi", "objectives": ["Exercices guidés"], "duration_min": 45},
    ]
    return ctx
