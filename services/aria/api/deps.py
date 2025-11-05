from __future__ import annotations

from functools import lru_cache

from ..agents.diagnostic.agent import diagnostic_agent
from ..agents.grader.agent import grader_agent
from ..agents.planner.agent import planner_agent
from ..agents.rag.agent import rag_agent
from ..orchestrator.graph import Node
from ..orchestrator.router import Orchestrator


@lru_cache(maxsize=1)
def get_orchestrator() -> Orchestrator:
    agents = {
        Node.DIAG: diagnostic_agent,
        Node.PLAN: planner_agent,
        Node.RAG: rag_agent,
        Node.GRADE: grader_agent,
    }
    return Orchestrator(agents)
