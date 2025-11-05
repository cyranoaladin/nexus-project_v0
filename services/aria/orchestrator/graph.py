from __future__ import annotations

from enum import Enum


class Node(str, Enum):
    START = "start"
    DIAG = "diagnostic"
    PLAN = "planner"
    RAG = "rag"
    GRADE = "grader"
    END = "end"


TRANSITIONS: dict[Node, Node] = {
    Node.START: Node.DIAG,
    Node.DIAG: Node.PLAN,
    Node.PLAN: Node.RAG,
    Node.RAG: Node.GRADE,
    Node.GRADE: Node.END,
}
