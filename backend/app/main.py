"""FastAPI application factory."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import engine, get_session
from app.errors import install_error_handlers
from app.jobs.retention import scheduled_run
from app.routers import (
    admin,
    auth,
    connections,
    courses,
    lobbies,
    messages,
    moderation,
    notifications,
    usability,
    users,
    ws,
)


class Health(BaseModel):
    status: str
    database: str


def operation_id(route: APIRoute) -> str:
    """Stable, readable operation ids for the generated TypeScript client."""
    return route.name


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    scheduler = AsyncIOScheduler(timezone="UTC")
    if settings.scheduler_enabled:
        trigger = CronTrigger(hour=settings.retention_hour_utc, timezone="UTC")
        scheduler.add_job(scheduled_run, trigger, max_instances=1, coalesce=True)
        # Catch up on anything missed while the server was down.
        scheduler.add_job(scheduled_run, "date")
        scheduler.start()
    yield
    if scheduler.running:
        scheduler.shutdown(wait=False)
    await engine.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="SeekMate API",
        version="0.1.0",
        openapi_url="/api/v1/openapi.json",
        docs_url="/api/v1/docs",
        lifespan=lifespan,
        generate_unique_id_function=operation_id,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )
    install_error_handlers(app)
    modules = (
        auth,
        users,
        courses,
        lobbies,
        messages,
        connections,
        moderation,
        notifications,
        admin,
        usability,
    )
    for module in modules:
        app.include_router(module.router, prefix="/api/v1")
    app.include_router(ws.router)

    @app.get("/health", tags=["health"])
    async def health(session: AsyncSession = Depends(get_session)) -> Health:
        await session.execute(text("SELECT 1"))
        return Health(status="ok", database="ok")

    return app


app = create_app()
