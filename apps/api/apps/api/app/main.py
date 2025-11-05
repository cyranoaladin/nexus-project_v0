from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import agents, dashboard, evals, health, onboarding, parent, parcours, plan, rag, sessions

app = FastAPI(title="Nexus API", version="1.0.0")

app.add_middleware(
	CORSMiddleware,
	allow_origins=["http://localhost:3000"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(onboarding.router, prefix="/onboarding", tags=["onboarding"])
app.include_router(parcours.router, prefix="/parcours", tags=["parcours"])
app.include_router(plan.router, prefix="/plan", tags=["plan"])
app.include_router(evals.router)
app.include_router(rag.router, prefix="/rag", tags=["rag"])
app.include_router(parent.router, prefix="/parent", tags=["parent"])
app.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
app.include_router(agents.router)
app.include_router(dashboard.router, tags=["dashboard"])
