from __future__ import annotations

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Query
from sqlalchemy import ColumnElement, or_, select
from sqlalchemy.orm import aliased

from app.config import get_settings
from app.deps import ClockDep, CurrentUser, Db
from app.enums import (
    Atmosphere,
    LobbyStatus,
    LobbyVisibility,
    MemberRole,
    NotificationType,
    StudyGoal,
)
from app.errors import conflict, invalid, not_found
from app.models import (
    Connection,
    Course,
    Lobby,
    LobbyMember,
    LobbySlotAlert,
    User,
    UserPlannedCourse,
)
from app.moderation import ensure_clean
from app.ratelimit import limiter
from app.realtime import broker
from app.schemas import Ok, PublicUser
from app.schemas_lobby import (
    ConnectionState,
    JoinIn,
    LobbyCreate,
    LobbyOut,
    LobbyPatch,
    MemberOut,
    MessagePage,
)
from app.services import lobbies as svc
from app.services.blocks import blocked_ids
from app.services.messages import broadcast_message, create_message, history
from app.services.notifications import notify

router = APIRouter(tags=["lobbies"])
PREVIEW_LIMIT = 20


@router.get("/courses/{course_id}/lobbies")
async def list_course_lobbies(
    course_id: uuid.UUID,
    user: CurrentUser,
    db: Db,
    study_goal: StudyGoal | None = None,
    atmosphere: Atmosphere | None = None,
    has_slot: bool = False,
    sort: Literal["match", "newest"] = "newest",
) -> list[LobbyOut]:
    semester = await svc.active_semester(db)
    where: list[ColumnElement[bool]] = [
        Lobby.course_id == course_id,
        Lobby.semester_id == semester.id,
    ]
    if study_goal:
        where.append(Lobby.study_goal == study_goal)
    if atmosphere:
        where.append(Lobby.atmosphere == atmosphere)
    if has_slot:
        where.append(Lobby.status == LobbyStatus.open)
    found = await svc.list_lobbies(db, user, *where)
    return svc.sort_by_match(found) if sort == "match" else found


@router.post("/courses/{course_id}/lobbies", status_code=201)
async def create_lobby(
    course_id: uuid.UUID, body: LobbyCreate, user: CurrentUser, db: Db, clock: ClockDep
) -> LobbyOut:
    ensure_clean(body.title, body.description)
    if await db.get(Course, course_id) is None:
        raise not_found("Mata kuliah tidak ditemukan.")
    semester = await svc.active_semester(db)
    now = clock.now()
    if semester.ends_at <= now:
        raise conflict("semester_ended", "Semester ini sudah berakhir.")
    limiter.check(f"lobby:{user.id}", get_settings().lobby_create_rate)
    lobby = Lobby(
        **body.model_dump(),
        course_id=course_id,
        semester_id=semester.id,
        creator_id=user.id,
        created_at=now,
        expires_at=semester.ends_at,
    )
    db.add(lobby)
    await db.flush()
    db.add(
        LobbyMember(
            lobby_id=lobby.id,
            user_id=user.id,
            role=MemberRole.owner,
            joined_at=now,
            last_read_at=now,
        )
    )
    await svc.ensure_planned(db, user.id, course_id, semester.id)
    await db.commit()
    return await svc.one_out(db, user, lobby.id)


@router.get("/lobbies/mine")
async def list_my_lobbies(user: CurrentUser, db: Db) -> list[LobbyOut]:
    return await svc.list_lobbies(
        db, user, svc.is_active_member(user.id), Lobby.status != LobbyStatus.closed
    )


@router.get("/lobbies/recommended")
async def list_recommended_lobbies(
    user: CurrentUser, db: Db, limit: Annotated[int, Query(ge=1, le=24)] = 6
) -> list[LobbyOut]:
    semester = await svc.active_semester(db)
    planned = select(UserPlannedCourse.course_id).where(
        UserPlannedCourse.user_id == user.id, UserPlannedCourse.semester_id == semester.id
    )
    found = await svc.list_lobbies(
        db,
        user,
        Lobby.semester_id == semester.id,
        Lobby.course_id.in_(planned),
        Lobby.status == LobbyStatus.open,
        ~svc.is_active_member(user.id),
    )
    return svc.sort_by_match(found)[:limit]


@router.get("/lobbies/discover")
async def discover_lobbies(
    user: CurrentUser,
    db: Db,
    q: Annotated[str, Query(max_length=80)] = "",
    faculty: Annotated[str, Query(max_length=120)] = "",
    has_slot: bool = False,
    sort: Literal["match", "newest", "popular"] = "match",
    limit: Annotated[int, Query(ge=1, le=60)] = 12,
) -> list[LobbyOut]:
    """Public lobbies of the active semester across all courses."""
    semester = await svc.active_semester(db)
    where: list[ColumnElement[bool]] = [
        Lobby.semester_id == semester.id,
        Lobby.status.in_(svc.ACTIVE),
        Lobby.visibility == LobbyVisibility.public,
    ]
    if has_slot:
        where.append(Lobby.status == LobbyStatus.open)
    term = q.strip().replace("%", "").replace("_", "")
    if term or faculty:
        course = select(Course.id)
        if term:
            pattern = f"%{term}%"
            course = course.where(or_(Course.name.ilike(pattern), Course.code.ilike(pattern)))
        if faculty:
            course = course.where(Course.faculty_or_dept == faculty)
        title = Lobby.title.ilike(f"%{term}%") if term else None
        in_course = Lobby.course_id.in_(course)
        where.append(or_(in_course, title) if title is not None and not faculty else in_course)
    found = await svc.list_lobbies(db, user, *where)
    if sort == "match":
        found = svc.sort_by_match(found)
    elif sort == "popular":
        found = sorted(found, key=lambda lobby: -lobby.member_count)
    return found[:limit]


@router.get("/lobbies/{lobby_id}")
async def get_lobby(lobby_id: uuid.UUID, user: CurrentUser, db: Db) -> LobbyOut:
    lobby = await svc.get_lobby(db, user.id, lobby_id)
    return await svc.one_out(db, user, lobby.id)


@router.patch("/lobbies/{lobby_id}")
async def update_lobby(
    lobby_id: uuid.UUID, body: LobbyPatch, user: CurrentUser, db: Db, clock: ClockDep
) -> LobbyOut:
    lobby = await svc.get_lobby(db, user.id, lobby_id, lock=True)
    await svc.require_owner(db, lobby_id, user.id)
    svc.ensure_open(lobby)
    data = body.model_dump(exclude_unset=True, exclude_none=True)
    ensure_clean(data.get("title"), data.get("description"))
    count = await svc.count_members(db, lobby_id)
    if data.get("capacity", count) < count:
        raise invalid("capacity", "Kapasitas tidak boleh kurang dari jumlah anggota.")
    was_full = lobby.status == LobbyStatus.full
    for key, value in data.items():
        setattr(lobby, key, value)
    lobby.status = svc.status_for(count, lobby.capacity)
    if was_full and lobby.status == LobbyStatus.open:
        await svc.announce_slot(db, lobby, clock.now())
    await db.commit()
    await broker.broadcast(lobby_id, {"type": "lobby_updated"})
    return await svc.one_out(db, user, lobby_id)


@router.post("/lobbies/{lobby_id}/close")
async def close_lobby(lobby_id: uuid.UUID, user: CurrentUser, db: Db) -> LobbyOut:
    lobby = await svc.get_lobby(db, user.id, lobby_id, lock=True)
    await svc.require_owner(db, lobby_id, user.id)
    svc.ensure_open(lobby)
    lobby.status = LobbyStatus.closed
    await db.commit()
    await broker.broadcast(lobby_id, {"type": "lobby_updated"})
    return await svc.one_out(db, user, lobby_id)


@router.post("/lobbies/{lobby_id}/join")
async def join_lobby(
    lobby_id: uuid.UUID, body: JoinIn, user: CurrentUser, db: Db, clock: ClockDep
) -> LobbyOut:
    ensure_clean(body.intro)
    now = clock.now()
    lobby = await svc.join(db, user, lobby_id, now)
    hidden = await blocked_ids(db, user.id)
    watching = broker.lobby_users(lobby_id)
    for member_id in await svc.active_member_ids(db, lobby_id):
        if member_id == user.id or member_id in hidden or member_id in watching:
            continue
        await notify(
            db,
            member_id,
            NotificationType.member_joined,
            {
                "lobby_id": str(lobby_id),
                "course_id": str(lobby.course_id),
                "lobby_title": lobby.title,
                "user_name": user.display_name,
            },
            now,
        )
    intro = (
        await create_message(db, lobby, user, body.intro, now, is_intro=True)
        if body.intro
        else None
    )
    await db.commit()
    event = {
        "type": "member_joined",
        "user": {"id": str(user.id), "display_name": user.display_name},
    }
    await broker.broadcast(lobby_id, event, exclude=hidden)
    if intro is not None:
        await broadcast_message(db, intro, user, "message")
    return await svc.one_out(db, user, lobby_id)


@router.post("/lobbies/{lobby_id}/leave")
async def leave_lobby(lobby_id: uuid.UUID, user: CurrentUser, db: Db, clock: ClockDep) -> Ok:
    lobby = await svc.get_lobby(db, user.id, lobby_id, lock=True)
    member = await svc.require_member(db, lobby_id, user.id)
    await svc.remove_member(db, lobby, member, clock.now())
    await db.commit()
    await broker.kick(lobby_id, user.id, 1000)
    await broker.broadcast(lobby_id, {"type": "member_left", "user_id": str(user.id)})
    return Ok()


@router.get("/lobbies/{lobby_id}/members")
async def list_members(lobby_id: uuid.UUID, user: CurrentUser, db: Db) -> list[MemberOut]:
    await svc.get_lobby(db, user.id, lobby_id)
    hidden = await blocked_ids(db, user.id)
    conn = aliased(Connection)
    rows = (
        await db.execute(
            select(LobbyMember, User, conn)
            .join(User, User.id == LobbyMember.user_id)
            .outerjoin(
                conn,
                or_(
                    (conn.user_a_id == user.id) & (conn.user_b_id == User.id),
                    (conn.user_b_id == user.id) & (conn.user_a_id == User.id),
                ),
            )
            .where(
                LobbyMember.lobby_id == lobby_id,
                LobbyMember.left_at.is_(None),
                LobbyMember.user_id.not_in(hidden),
            )
            .order_by(LobbyMember.role.desc(), User.display_name)
        )
    ).all()
    online = broker.online_users() | {user.id}
    return [
        MemberOut(
            user=PublicUser.model_validate(member_user),
            role=member.role,
            online=member.user_id in online,
            connection=_connection_state(connection, user.id),
            joined_at=member.joined_at,
        )
        for member, member_user, connection in rows
    ]


def _connection_state(connection: Connection | None, me: uuid.UUID) -> ConnectionState:
    if connection is None:
        return "none"
    if connection.status == "pending":
        return "pending_out" if connection.requested_by == me else "pending_in"
    if connection.status == "accepted":
        return "accepted"
    # Declined: the requester keeps seeing "pending", the decliner may start over.
    return "pending_out" if connection.requested_by == me else "none"


@router.delete("/lobbies/{lobby_id}/members/{member_id}")
async def remove_lobby_member(
    lobby_id: uuid.UUID, member_id: uuid.UUID, user: CurrentUser, db: Db, clock: ClockDep
) -> Ok:
    lobby = await svc.get_lobby(db, user.id, lobby_id, lock=True)
    await svc.require_owner(db, lobby_id, user.id)
    if member_id == user.id:
        raise invalid("self_remove", "Gunakan keluar lobby untuk dirimu sendiri.")
    member = await svc.get_member(db, lobby_id, member_id)
    if member is None:
        raise not_found("Anggota tidak ditemukan.")
    await svc.remove_member(db, lobby, member, clock.now(), by_owner=True)
    await db.commit()
    await broker.kick(lobby_id, member_id)
    await broker.broadcast(lobby_id, {"type": "member_left", "user_id": str(member_id)})
    return Ok()


@router.get("/lobbies/{lobby_id}/preview")
async def preview_messages(lobby_id: uuid.UUID, user: CurrentUser, db: Db) -> MessagePage:
    """Read-only: the last 20 messages of a public lobby, for any verified user."""
    lobby = await svc.get_lobby(db, user.id, lobby_id)
    if lobby.visibility != LobbyVisibility.public:
        await svc.require_member(db, lobby_id, user.id)
    page = await history(db, user.id, lobby_id, None, PREVIEW_LIMIT)
    return MessagePage(items=page.items, next_cursor=None)


@router.post("/lobbies/{lobby_id}/slot-alert")
async def add_slot_alert(lobby_id: uuid.UUID, user: CurrentUser, db: Db) -> Ok:
    lobby = await svc.get_lobby(db, user.id, lobby_id)
    if lobby.status != LobbyStatus.full:
        raise conflict("not_full", "Lobby ini masih punya slot. Langsung gabung saja.")
    if await db.get(LobbySlotAlert, (lobby_id, user.id)) is None:
        db.add(LobbySlotAlert(lobby_id=lobby_id, user_id=user.id))
        await db.commit()
    return Ok()


@router.delete("/lobbies/{lobby_id}/slot-alert")
async def remove_slot_alert(lobby_id: uuid.UUID, user: CurrentUser, db: Db) -> Ok:
    alert = await db.get(LobbySlotAlert, (lobby_id, user.id))
    if alert is not None:
        await db.delete(alert)
        await db.commit()
    return Ok()
