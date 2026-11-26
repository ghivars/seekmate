"""Blocks and reports."""

from __future__ import annotations

import uuid

from fastapi import APIRouter
from sqlalchemy import delete, select

from app.clock import Clock
from app.config import get_settings
from app.deps import ClockDep, CurrentUser, Db
from app.enums import MemberRole, ReportStatus, ReportTarget
from app.errors import invalid, not_found
from app.models import Block, Connection, Lobby, LobbyMember, Message, Report, User
from app.ratelimit import limiter
from app.realtime import broker
from app.schemas import Ok, PublicUser
from app.schemas_social import BlockIn, ReportIn
from app.services import lobbies as svc

router = APIRouter(tags=["moderation"])
DETAIL_MAX = 500


async def _leave_owned(db: Db, owner: uuid.UUID, other: uuid.UUID, clock: Clock) -> list[uuid.UUID]:
    """Remove `other` from every lobby `owner` currently owns."""
    theirs = select(LobbyMember.lobby_id).where(
        LobbyMember.user_id == owner,
        LobbyMember.role == MemberRole.owner,
        LobbyMember.left_at.is_(None),
    )
    query = (
        select(Lobby)
        .join(LobbyMember, LobbyMember.lobby_id == Lobby.id)
        .where(Lobby.id.in_(theirs), LobbyMember.user_id == other, LobbyMember.left_at.is_(None))
        .order_by(Lobby.id)
        .with_for_update(of=Lobby)
    )
    left = []
    for lobby in (await db.scalars(query)).all():
        member = await svc.get_member(db, lobby.id, other)
        if member is not None:
            await svc.remove_member(db, lobby, member, clock.now())
            left.append(lobby.id)
    return left


@router.get("/blocks")
async def list_blocks(user: CurrentUser, db: Db) -> list[PublicUser]:
    query = (
        select(User)
        .join(Block, Block.blocked_id == User.id)
        .where(Block.blocker_id == user.id)
        .order_by(Block.created_at.desc())
    )
    return [PublicUser.model_validate(u) for u in await db.scalars(query)]


@router.post("/blocks", status_code=201)
async def block_user(body: BlockIn, user: CurrentUser, db: Db, clock: ClockDep) -> Ok:
    limiter.check(f"block:{user.id}", get_settings().generic_write_rate)
    if body.user_id == user.id:
        raise invalid("self_block", "Kamu tidak bisa memblokir diri sendiri.")
    if await db.get(User, body.user_id) is None:
        raise not_found("Pengguna tidak ditemukan.")
    if await db.get(Block, (user.id, body.user_id)) is None:
        db.add(Block(blocker_id=user.id, blocked_id=body.user_id))
    a, b = sorted([user.id, body.user_id])
    await db.execute(delete(Connection).where(Connection.user_a_id == a, Connection.user_b_id == b))
    kicked = [(i, body.user_id) for i in await _leave_owned(db, user.id, body.user_id, clock)]
    kicked += [(i, user.id) for i in await _leave_owned(db, body.user_id, user.id, clock)]
    await db.commit()
    for lobby_id, user_id in kicked:
        await broker.kick(lobby_id, user_id)
        await broker.broadcast(lobby_id, {"type": "member_left", "user_id": str(user_id)})
    return Ok()


@router.delete("/blocks/{user_id}")
async def unblock_user(user_id: uuid.UUID, user: CurrentUser, db: Db) -> Ok:
    row = await db.get(Block, (user.id, user_id))
    if row is not None:
        await db.delete(row)
        await db.commit()
    return Ok()


async def _evidence(body: ReportIn, user: User, db: Db) -> str:
    """Check access to the target and return a short copy of what is being reported."""
    if body.target_type == ReportTarget.message:
        message = await db.get(Message, body.target_id)
        if message is None:
            raise not_found("Pesan tidak ditemukan.")
        await svc.get_lobby(db, user.id, message.lobby_id)
        return message.body
    if body.target_type == ReportTarget.lobby:
        lobby = await svc.get_lobby(db, user.id, body.target_id)
        return f"{lobby.title} / {lobby.description}"
    target = await db.get(User, body.target_id)
    if target is None or target.id == user.id:
        raise not_found("Pengguna tidak ditemukan.")
    return f"{target.display_name} / {target.bio}"


@router.post("/reports", status_code=201)
async def create_report(body: ReportIn, user: CurrentUser, db: Db, clock: ClockDep) -> Ok:
    limiter.check(f"report:{user.id}", get_settings().generic_write_rate)
    copy = await _evidence(body, user, db)
    duplicate = await db.scalar(
        select(Report.id).where(
            Report.reporter_id == user.id,
            Report.target_type == body.target_type,
            Report.target_id == body.target_id,
            Report.status == ReportStatus.open,
        )
    )
    if duplicate is None:
        note = f"Catatan: {body.detail}\n" if body.detail else ""
        detail = f"{note}Isi: {copy}"[:DETAIL_MAX]
        db.add(
            Report(
                reporter_id=user.id,
                target_type=body.target_type,
                target_id=body.target_id,
                reason=body.reason,
                detail=detail,
                created_at=clock.now(),
            )
        )
        await db.commit()
    return Ok()
