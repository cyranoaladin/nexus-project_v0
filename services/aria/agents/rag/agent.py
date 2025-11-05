from __future__ import annotations

from typing import Any, Dict

from tools.rag_client import rag_query


async def rag_agent(ctx: Dict[str, Any]) -> Dict[str, Any]:
    """Interroge l'index RAG pour nourrir la séance."""

    question = ctx.get("student_question", "Rappels sur le principe de récurrence")
    chapter = ctx.get("chapter", "recurrence")
    ctx["rag_docs"] = rag_query(question, top_k=5, namespace=chapter)
    return ctx
