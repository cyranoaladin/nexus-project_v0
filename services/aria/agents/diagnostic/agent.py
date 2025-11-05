from __future__ import annotations

from typing import Any, Dict


async def diagnostic_agent(ctx: Dict[str, Any]) -> Dict[str, Any]:
    """Analyse les réponses initiales pour produire un diagnostic simplifié."""

    ctx.setdefault("diagnostic", {})
    ctx["diagnostic"]["summary"] = ctx.get(
        "diagnostic_summary",
        "Lacunes en récurrence forte, points forts en fonctions.",
    )
    return ctx
