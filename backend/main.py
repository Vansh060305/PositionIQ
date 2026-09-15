"""
FastAPI application entry point.

PHASE 1 GOAL: prove the container boots, config loads, and the app responds.
Routers (auth, positions, health, etc.) get included here starting Phase 3.
"""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from core.config import settings
from core.logging_config import configure_logging
from core.database import get_db
from core.dependencies import require_role
from models.user import User, UserRole
from routes import auth, positions, market, health, decisions, portfolio, ws, alerts, notifications, simulator, payments, navigator, pulse, assistant
from services.background_tasks import broadcast_loop, digest_loop

configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Starts both periodic background loops alongside the app, and cancels
    # them cleanly on shutdown instead of leaving them dangling
    broadcast_task = asyncio.create_task(broadcast_loop())
    digest_task = asyncio.create_task(digest_loop())
    yield
    broadcast_task.cancel()
    digest_task.cancel()


app = FastAPI(title=settings.app_name, lifespan=lifespan)

# Without this, the browser blocks every request from the frontend
# (different port = different origin) before it even reaches a route.
# Vite serves on localhost/127.0.0.1/[::1] and picks a free port (5173+),
# so the local-dev allow-list covers the common host/port combinations.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://[::1]:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://[::1]:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://[::1]:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(positions.router)
app.include_router(market.router)
app.include_router(health.router)
app.include_router(decisions.router)
app.include_router(portfolio.router)
app.include_router(ws.router)
app.include_router(alerts.router)
app.include_router(notifications.router)
app.include_router(simulator.router)
app.include_router(payments.router)
app.include_router(navigator.router)
app.include_router(pulse.router)
app.include_router(assistant.router)


@app.get("/ping")
def ping():
    return {"status": "ok", "service": settings.app_name}


@app.get("/db-check")
def db_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"database": "connected"}


@app.get("/admin-check")
def admin_check(current_user: User = Depends(require_role(UserRole.ADMIN))):
    return {"message": f"Welcome, admin {current_user.email}"}
