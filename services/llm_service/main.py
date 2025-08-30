# services/llm_service/main.py
# FastAPI app exposing a chat endpoint for ARIA's LLM service.
# Supports mock mode (no OpenAI key) and provides health/metrics routes.

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Any, Optional, List, Dict
from prometheus_fastapi_instrumentator import Instrumentator
import os
import json
import logging

# The test suite patches this symbol path: main.openai.chat.completions.create
# So we import the top-level openai module and call openai.chat.completions.create(...)
import openai  # type: ignore

logger = logging.getLogger("llm_service")
logging.basicConfig(level=os.environ.get("LOGLEVEL", "INFO"))

# Environment configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if OPENAI_API_KEY:
    try:
        # Older openai packages use openai.api_key
        setattr(openai, "api_key", OPENAI_API_KEY)
    except Exception:  # pragma: no cover
        pass

LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")
LLM_MOCK_MODE = os.getenv("LLM_MOCK_MODE", "0").lower() in ("1", "true", "yes")
LLM_AMPLIFY = os.getenv("LLM_AMPLIFY", "0").lower() in ("1", "true", "yes")

app = FastAPI(title="ARIA LLM Service", version="0.1.0")

# Expose Prometheus metrics at /metrics
Instrumentator().instrument(app).expose(app)


class ChatRequest(BaseModel):
    contexte_eleve: Any
    requete_actuelle: str
    requete_type: str
    system_prompt: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    contenu_latex: Optional[str] = None
    mock: Optional[bool] = None


@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok"}


def build_system_prompt(contexte_eleve: Any, requete_type: str, custom: Optional[str]) -> str:
    # Persona and rules; MUST include key phrases asserted by tests
    persona = (
        "Tu es ARIA, un coach pédagogique bienveillant et structuré (coach pédagogique).\n"
        "Ta mission: expliquer clairement, guider l'élève pas à pas et fournir des méthodes.\n"
    )

    # Include student context JSON directly to satisfy tests (keys and titles must appear)
    contexte_json = json.dumps(contexte_eleve, ensure_ascii=False, indent=2)

    amplification = (
        "Réponds avec une structure claire (titres, listes) et des exemples.\n"
        if LLM_AMPLIFY
        else ""
    )

    pdf_hint = (
        "Si la requête est une génération de PDF, structure le contenu pour être facilement convertible en LaTeX."
        if requete_type.upper().startswith("PDF")
        else ""
    )

    base = (
        f"{persona}\n"
        f"Contexte élève JSON:\n{contexte_json}\n"
        f"Consignes: {amplification}{pdf_hint}\n"
    )

    if custom and custom.strip():
        base += f"Instructions additionnelles:\n{custom.strip()}\n"

    return base


async def call_openai(messages: List[Dict[str, str]], model: str) -> str:
    try:
        # Tests patch main.openai.chat.completions.create
        resp = openai.chat.completions.create(  # type: ignore[attr-defined]
            model=model,
            messages=messages,
            temperature=0.7,
            max_tokens=1200,
        )
        # Expecting the v1-style response with .choices[0].message.content
        content = getattr(resp.choices[0].message, "content", None)
        if isinstance(content, str):
            return content
        # Fallbacks for various SDK shapes
        if isinstance(resp.choices[0], dict):
            return resp.choices[0].get("message", {}).get("content", "")
        return ""
    except Exception as e:
        logger.exception("OpenAI call failed: %s", e)
        raise HTTPException(status_code=502, detail="LLM upstream error")


def build_mock_response(req: ChatRequest) -> str:
    # Deterministic mock response; short but structured for tests/dev
    subject = req.requete_actuelle.strip()[:80]
    return (
        f"Réponse (fake local) pour: {subject}\n\n"
        "# Objectifs\n- Comprendre la notion\n- Appliquer des méthodes pas à pas\n\n"
        "## Explications\nVoici une explication synthétique avec exemples.\n\n"
        "## Exercices corrigés (3)\n1) Enoncé A ...\nCorrection A ...\n2) Enoncé B ...\nCorrection B ...\n3) Enoncé C ...\nCorrection C ...\n"
    )


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    # Decide mode: mock if explicitly requested or if no API key
    use_mock = LLM_MOCK_MODE or not bool(OPENAI_API_KEY)

    system_prompt = build_system_prompt(req.contexte_eleve, req.requete_type, req.system_prompt)

    if use_mock:
        text = build_mock_response(req)
        return ChatResponse(response=text, mock=True)

    messages: List[Dict[str, str]] = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": req.requete_actuelle},
    ]

    text = await call_openai(messages, LLM_MODEL)
    return ChatResponse(response=text)


# Optional local run
if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
