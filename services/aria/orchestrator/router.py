from __future__ import annotations

from typing import Awaitable, Callable, Mapping

from orchestrator.graph import Node, TRANSITIONS

AgentCallable = Callable[[dict], Awaitable[dict]]


class Orchestrator:
    """Orchestrateur minimal : enchaîne les agents selon le graphe défini."""

    def __init__(self, agents: Mapping[Node, AgentCallable]) -> None:
        self.agents = dict(agents)

    async def run_session(self, ctx: dict | None = None) -> dict:
        ctx = ctx or {}
        node = Node.START
        while node != Node.END:
            node = TRANSITIONS[node]
            agent = self.agents.get(node)
            if agent is None:
                raise ValueError(f"Aucun agent configuré pour le noeud {node}")
            ctx = await agent(ctx)
        return ctx
