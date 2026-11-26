"""Lobby queries and state changes. Handlers commit; services only flush."""

from __future__ import annotations

import uuid
from collections import defaultdict
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import ColumnElement, and_, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.enums import LobbyStatus, LobbyVisibility, MemberRole, NotificationType
from app.errors import AppError, conflict, forbidden, not_found
from app.match import compute_match
from app.models import (
    Lobby,
    LobbyMember,
    LobbySlotAlert,
    Message,
    Semester,
    User,
    UserPlannedCourse,
    UserPreferences,
)
from app.schemas_lobby import CreatorBrief, LobbyOut, UserBrief
from app.services.blocks import blocked_ids, lobby_visible_to
from app.services.notifications import notify

ACTIVE = (LobbyStatus.open, LobbyStatus.full)


async def active_semester(db: AsyncSession) -> Semester:
    semester = await db.scalar(select(Semester).where(Semester.is_active))
    if semester is None:
        raise conflict("no_semester", "Belum ada semester aktif.")
    return semester


def is_active_member(user_id: uuid.UUID) -> ColumnElement[bool]:
    return exists().where(
        LobbyMember.lobby_id == Lobby.id,
        LobbyMember.user_id == user_id,
        LobbyMember.left_at.is_(None),
    )


def accessible_to(user_id: uuid.UUID) -> ColumnElement[bool]:
    """Public active lobbies, plus any lobby the user belongs to; blocks always win."""
    public = and_(Lobby.status.in_(ACTIVE), Lobby.visibility == LobbyVisibility.public)
    return and_(lobby_visible_to(user_id), or_(public, is_active_member(user_id)))


async def get_lobby(
    db: AsyncSession, user_id: uuid.UUID, lobby_id: uuid.UUID, lock: bool = False
) -> Lobby:
    query = select(Lobby).where(Lobby.id == lobby_id, accessible_to(user_id))
    if lock:
        query = query.with_for_update(of=Lobby).execution_options(populate_existing=True)
    lobby = await db.scalar(query)
    if lobby is None:
        raise not_found("Lobby tidak ditemukan atau sudah tidak tersedia.")
    return lobby


async def get_member(
    db: AsyncSession, lobby_id: uuid.UUID, user_id: uuid.UUID
) -> LobbyMember | None:
    member = await db.get(LobbyMember, (lobby_id, user_id), populate_existing=True)
    return member if member is not None and member.left_at is None else None


async def require_member(db: AsyncSession, lobby_id: uuid.UUID, user_id: uuid.UUID) -> LobbyMember:
    member = await get_member(db, lobby_id, user_id)
    if member is None:
        raise forbidden("Gabung dulu untuk melakukan ini.")
    return member


async def require_owner(db: AsyncSession, lobby_id: uuid.UUID, user_id: uuid.UUID) -> LobbyMember:
    member = await require_member(db, lobby_id, user_id)
    if member.role != MemberRole.owner:
        raise forbidden("Hanya pembuat lobby yang bisa melakukan ini.")
    return member


async def count_members(db: AsyncSession, lobby_id: uuid.UUID) -> int:
    query = select(func.count()).where(
        LobbyMember.lobby_id == lobby_id, LobbyMember.left_at.is_(None)
    )
    return await db.scalar(query) or 0


async def active_member_ids(db: AsyncSession, lobby_id: uuid.UUID) -> list[uuid.UUID]:
    query = select(LobbyMember.user_id).where(
        LobbyMember.lobby_id == lobby_id, LobbyMember.left_at.is_(None)
    )
    return list((await db.scalars(query)).all())


async def unread_counts(
    db: AsyncSession, user_id: uuid.UUID, hidden: set[uuid.UUID]
) -> dict[uuid.UUID, int]:
    query = (
        select(Message.lobby_id, func.count())
        .join(
            LobbyMember,
            and_(
                LobbyMember.lobby_id == Message.lobby_id,
                LobbyMember.user_id == user_id,
                LobbyMember.left_at.is_(None),
            ),
        )
        .where(
            Message.sender_id != user_id,
            Message.sender_id.not_in(hidden),
            Message.deleted_at.is_(None),
            Message.created_at > func.coalesce(LobbyMember.last_read_at, LobbyMember.joined_at),
        )
        .group_by(Message.lobby_id)
    )
    return {row[0]: row[1] for row in (await db.execute(query)).all()}


async def to_out(db: AsyncSession, user: User, lobbies: Sequence[Lobby]) -> list[LobbyOut]:
    """Decorate lobbies for one viewer using a fixed number of queries."""
    if not lobbies:
        return []
    ids = [lobby.id for lobby in lobbies]
    hidden = await blocked_ids(db, user.id)
    unread = await unread_counts(db, user.id, hidden)

    members = (
        await db.execute(
            select(LobbyMember, User.display_name)
            .join(User, User.id == LobbyMember.user_id)
            .where(LobbyMember.lobby_id.in_(ids), LobbyMember.left_at.is_(None))
            .order_by(LobbyMember.joined_at)
        )
    ).all()
    counts: dict[uuid.UUID, int] = defaultdict(int)
    previews: dict[uuid.UUID, list[UserBrief]] = defaultdict(list)
    mine: dict[uuid.UUID, LobbyMember] = {}
    for member, name in members:
        counts[member.lobby_id] += 1
        if member.user_id == user.id:
            mine[member.lobby_id] = member
        if len(previews[member.lobby_id]) < 4 and member.user_id not in hidden:
            previews[member.lobby_id].append(UserBrief(id=member.user_id, display_name=name))

    alert_query = select(LobbySlotAlert.lobby_id).where(
        LobbySlotAlert.user_id == user.id, LobbySlotAlert.lobby_id.in_(ids)
    )
    alerts = set((await db.scalars(alert_query)).all())

    prefs = await db.get(UserPreferences, user.id)
    creators = {lobby.creator_id for lobby in lobbies}
    creator_prefs = {
        p.user_id: p
        for p in await db.scalars(
            select(UserPreferences).where(UserPreferences.user_id.in_(creators))
        )
    }
    weights = get_settings().match_weights
    result = []
    for lobby in lobbies:
        member = mine.get(lobby.id)
        own = lobby.creator_id == user.id
        match = (
            compute_match(prefs, lobby, creator_prefs.get(lobby.creator_id), weights)
            if prefs is not None and not own
            else None
        )
        result.append(
            LobbyOut(
                id=lobby.id,
                course_id=lobby.course_id,
                course_code=lobby.course.code,
                course_name=lobby.course.name,
                course_credits=lobby.course.credits,
                title=lobby.title,
                description=lobby.description,
                study_goal=lobby.study_goal,
                atmosphere=lobby.atmosphere,
                preferred_time=lobby.preferred_time,
                capacity=lobby.capacity,
                member_count=counts[lobby.id],
                visibility=lobby.visibility,
                status=lobby.status,
                created_at=lobby.created_at,
                expires_at=lobby.expires_at,
                creator=CreatorBrief.model_validate(lobby.creator),
                members_preview=previews[lobby.id],
                is_member=member is not None,
                my_role=member.role if member else None,
                unread_count=unread.get(lobby.id, 0),
                last_read_at=(member.last_read_at or member.joined_at) if member else None,
                has_slot_alert=lobby.id in alerts,
                match=match,
            )
        )
    return result


async def one_out(db: AsyncSession, user: User, lobby_id: uuid.UUID) -> LobbyOut:
    query = (
        select(Lobby)
        .where(Lobby.id == lobby_id)
        .options(*LOAD)
        .execution_options(populate_existing=True)
    )
    return (await to_out(db, user, [(await db.scalars(query)).one()]))[0]


LOAD = (selectinload(Lobby.course), selectinload(Lobby.creator))


async def list_lobbies(
    db: AsyncSession, user: User, *where: ColumnElement[bool], limit: int = 200
) -> list[LobbyOut]:
    query = (
        select(Lobby)
        .where(accessible_to(user.id), *where)
        .options(*LOAD)
        .order_by(Lobby.created_at.desc(), Lobby.id)
        .limit(limit)
    )
    return await to_out(db, user, (await db.scalars(query)).all())


def sort_by_match(lobbies: list[LobbyOut]) -> list[LobbyOut]:
    """Highest match first; newest first inside a tie (input is already newest first)."""
    return sorted(lobbies, key=lambda lobby: -(lobby.match.score if lobby.match else -1))


async def ensure_planned(
    db: AsyncSession, user_id: uuid.UUID, course_id: uuid.UUID, semester_id: uuid.UUID
) -> None:
    if await db.get(UserPlannedCourse, (user_id, course_id, semester_id)) is None:
        db.add(UserPlannedCourse(user_id=user_id, course_id=course_id, semester_id=semester_id))


async def join(db: AsyncSession, user: User, lobby_id: uuid.UUID, now: datetime) -> Lobby:
    """Capacity check and insert run under a row lock on the lobby."""
    lobby = await get_lobby(db, user.id, lobby_id, lock=True)
    member = await db.get(LobbyMember, (lobby_id, user.id), populate_existing=True)
    if member is not None and member.left_at is None:
        raise conflict("already_member", "Kamu sudah ada di lobby ini.")
    if member is not None and member.removed_by_owner:
        raise forbidden("Kamu tidak bisa bergabung lagi ke lobby ini.")
    if lobby.status not in ACTIVE or lobby.visibility != LobbyVisibility.public:
        raise conflict("lobby_closed", "Lobby ini tidak menerima anggota baru.")
    count = await count_members(db, lobby_id)
    if count >= lobby.capacity:
        raise conflict("lobby_full", "Yah, lobby ini baru saja penuh.")
    if member is None:
        db.add(LobbyMember(lobby_id=lobby_id, user_id=user.id, joined_at=now, last_read_at=now))
    else:
        member.left_at = None
        member.joined_at = now
        member.last_read_at = now
        member.role = MemberRole.member
    lobby.status = LobbyStatus.full if count + 1 >= lobby.capacity else LobbyStatus.open
    alert = await db.get(LobbySlotAlert, (lobby_id, user.id))
    if alert is not None:
        await db.delete(alert)
    await ensure_planned(db, user.id, lobby.course_id, lobby.semester_id)
    await db.flush()
    return lobby


async def remove_member(
    db: AsyncSession, lobby: Lobby, member: LobbyMember, now: datetime, by_owner: bool = False
) -> None:
    """Caller must hold the lobby lock."""
    was_owner = member.role == MemberRole.owner
    member.left_at = now
    member.role = MemberRole.member
    member.removed_by_owner = by_owner
    await db.flush()
    heir_query = (
        select(LobbyMember)
        .where(LobbyMember.lobby_id == lobby.id, LobbyMember.left_at.is_(None))
        .order_by(LobbyMember.joined_at)
        .limit(1)
    )
    heir = await db.scalar(heir_query)
    if heir is None:
        if lobby.status in ACTIVE:
            lobby.status = LobbyStatus.closed
        return
    if was_owner:
        heir.role = MemberRole.owner
    if lobby.status == LobbyStatus.full:
        lobby.status = LobbyStatus.open
        await announce_slot(db, lobby, now)
    await db.flush()


async def announce_slot(db: AsyncSession, lobby: Lobby, now: datetime) -> None:
    """Tell everyone who asked, once."""
    alerts = (
        await db.scalars(select(LobbySlotAlert).where(LobbySlotAlert.lobby_id == lobby.id))
    ).all()
    for alert in alerts:
        await notify(
            db,
            alert.user_id,
            NotificationType.slot_available,
            {
                "lobby_id": str(lobby.id),
                "course_id": str(lobby.course_id),
                "lobby_title": lobby.title,
            },
            now,
        )
        await db.delete(alert)


def status_for(count: int, capacity: int) -> LobbyStatus:
    return LobbyStatus.full if count >= capacity else LobbyStatus.open


def ensure_open(lobby: Lobby) -> None:
    if lobby.status == LobbyStatus.expired:
        raise AppError(409, "lobby_expired", "Semester sudah berakhir. Lobby ini hanya-baca.")
    if lobby.status == LobbyStatus.closed:
        raise AppError(409, "lobby_closed", "Lobby ini sudah ditutup.")


async def locked_memberships(db: AsyncSession, user_id: uuid.UUID) -> Sequence[Lobby]:
    """Every lobby the user is in, row-locked in a stable order to avoid deadlocks."""
    query = (
        select(Lobby).where(is_active_member(user_id)).order_by(Lobby.id).with_for_update(of=Lobby)
    )
    return (await db.scalars(query)).all()
