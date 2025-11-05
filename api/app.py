from __future__ import annotations
from fastapi import FastAPI
from api.routers import tasks, sessions, epreuves, dashboard_epreuves

app = FastAPI(title="Nexus API (Test App)")
app.include_router(tasks.router)
app.include_router(sessions.router)
app.include_router(epreuves.router)
app.include_router(dashboard_epreuves.router)

@app.get("/health/")
def health():
    return {"status":"ok"}
