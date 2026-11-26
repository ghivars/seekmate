from __future__ import annotations

from fastapi import APIRouter, Response

from app.deps import ClockDep, CurrentUser, Db
from app.models import UserPreferences
from app.moderation import ensure_clean
from app.realtime import broker
from app.routers.auth import COOKIE, COOKIE_PATH
from app.schemas import MeOut, MePatch, Ok, PreferencesIn
from app.services.lobbies import get_member, locked_memberships, remove_member
from app.services.users import anonymize, load_me

router = APIRouter(prefix="/users", tags=["users"])


@router.patch("/me")
async def update_me(body: MePatch, user: CurrentUser, db: Db, clock: ClockDep) -> MeOut:
    data = body.model_dump(exclude_unset=True)
    ensure_clean(data.get("display_name"), data.get("major"), data.get("bio"))
    for field in ("display_name", "major", "bio", "is_newcomer"):
        if data.get(field) is not None:
            setattr(user, field, data[field])
    if "cohort_year" in data:
        user.cohort_year = data["cohort_year"]
    if data.get("accept_code_of_conduct") and user.code_of_conduct_at is None:
        user.code_of_conduct_at = clock.now()
    if data.get("complete_onboarding") and user.onboarded_at is None:
        user.onboarded_at = clock.now()
    await db.commit()
    return await load_me(db, user.id)


@router.put("/me/preferences")
async def put_preferences(body: PreferencesIn, user: CurrentUser, db: Db) -> MeOut:
    prefs = await db.get(UserPreferences, user.id)
    if prefs is None:
        db.add(UserPreferences(user_id=user.id, **body.model_dump()))
    else:
        for key, value in body.model_dump().items():
            setattr(prefs, key, value)
    await db.commit()
    return await load_me(db, user.id)


@router.delete("/me")
async def delete_me(user: CurrentUser, response: Response, db: Db, clock: ClockDep) -> Ok:
    now = clock.now()
    for lobby in await locked_memberships(db, user.id):
        member = await get_member(db, lobby.id, user.id)
        if member is not None:
            await remove_member(db, lobby, member, now)
    await anonymize(db, user, now)
    await db.commit()
    await broker.kick_user(user.id)
    response.delete_cookie(COOKIE, path=COOKIE_PATH)
    return Ok()
