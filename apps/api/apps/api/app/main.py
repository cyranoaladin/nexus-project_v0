from fastapi import FastAPI
from .routers import health, onboarding, parcours, plan, evals, rag, parent, sessions

app = FastAPI(title="Nexus API", version="1.0.0")

app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(onboarding.router, prefix="/onboarding", tags=["onboarding"])
app.include_router(parcours.router, prefix="/parcours", tags=["parcours"])
app.include_router(plan.router, prefix="/plan", tags=["plan"])
app.include_router(evals.router, prefix="/eval", tags=["evaluations"])
app.include_router(rag.router, prefix="/rag", tags=["rag"])
app.include_router(parent.router, prefix="/parent", tags=["parent"])
app.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
