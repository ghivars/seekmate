from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.config import get_settings
from app.deps import CurrentUser, Db
from app.models import Course, Lobby, UserPlannedCourse, UserPreferences
from app.ratelimit import limiter
from app.schemas import text_field
from app.services.krs import CourseFacts, KrsAnalysis, ai_rewrite, rule_based
from app.services.lobbies import ACTIVE, active_semester

router = APIRouter(prefix="/krs", tags=["krs"])


class KrsStatus(BaseModel):
    ai_enabled: bool
    model: str | None


class KrsRequest(BaseModel):
    target_credits: int | None = Field(default=None, ge=1, le=30)
    notes: Annotated[str, text_field(0, 300)] = ""


@router.get("/status")
async def krs_status(_: CurrentUser) -> KrsStatus:
    s = get_settings()
    return KrsStatus(ai_enabled=bool(s.ai_api_key), model=s.ai_model if s.ai_api_key else None)


@router.post("/analyze")
async def analyze_krs(body: KrsRequest, user: CurrentUser, db: Db) -> KrsAnalysis:
    """Analyse the user's planned courses for the active semester."""
    limiter.check(f"krs:{user.id}", get_settings().krs_rate)
    semester = await active_semester(db)
    lobbies = (
        select(Lobby.course_id, func.count().label("n"))
        .where(Lobby.semester_id == semester.id, Lobby.status.in_(ACTIVE))
        .group_by(Lobby.course_id)
        .subquery()
    )
    planners = (
        select(UserPlannedCourse.course_id, func.count().label("n"))
        .where(UserPlannedCourse.semester_id == semester.id)
        .group_by(UserPlannedCourse.course_id)
        .subquery()
    )
    rows = (
        await db.execute(
            select(Course, func.coalesce(lobbies.c.n, 0), func.coalesce(planners.c.n, 0))
            .join(UserPlannedCourse, UserPlannedCourse.course_id == Course.id)
            .outerjoin(lobbies, lobbies.c.course_id == Course.id)
            .outerjoin(planners, planners.c.course_id == Course.id)
            .where(
                UserPlannedCourse.user_id == user.id,
                UserPlannedCourse.semester_id == semester.id,
            )
            .order_by(Course.code)
        )
    ).all()
    facts = [
        CourseFacts(
            id=str(c.id),
            code=c.code,
            name=c.name,
            faculty=c.faculty_or_dept,
            credits=c.credits,
            lobby_count=lobby_n,
            planner_count=planner_n,
        )
        for c, lobby_n, planner_n in rows
    ]
    prefs = await db.get(UserPreferences, user.id)
    base = rule_based(facts, prefs, body.target_credits)
    if not facts:
        return base
    return await ai_rewrite(base, prefs, body.notes)
