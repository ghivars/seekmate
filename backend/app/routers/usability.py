"""Anonymous usability-test events (off by default). No user id is ever stored."""

from __future__ import annotations

from fastapi import APIRouter, Request

from app.config import get_settings
from app.deps import ClockDep, Db, client_ip
from app.errors import not_found
from app.models import UsabilityEvent
from app.ratelimit import limiter
from app.schemas import Ok
from app.schemas_social import UsabilityIn

router = APIRouter(prefix="/usability-events", tags=["usability"])


@router.post("", status_code=201)
async def log_usability_event(body: UsabilityIn, request: Request, db: Db, clock: ClockDep) -> Ok:
    if not get_settings().usability_test_mode:
        raise not_found()
    limiter.check(f"usability:{client_ip(request)}", get_settings().generic_write_rate)
    db.add(UsabilityEvent(**body.model_dump(), created_at=clock.now()))
    await db.commit()
    return Ok()
