from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import update

from app.config import get_settings
from app.deps import ClockDep, CurrentUser, Db
from app.enums import NotificationType
from app.errors import forbidden, not_found
from app.models import Message, Notification
from app.moderation import ensure_clean
from app.ratelimit import limiter
from app.realtime import broker
from app.schemas import Ok
from app.schemas_lobby import MessageEdit, MessageOut, MessagePage
from app.services import lobbies as svc
from app.services.messages import broadcast_message, history, message_out

router = APIRouter(tags=["messages"])


@router.get("/lobbies/{lobby_id}/messages")
async def list_messages(
    lobby_id: uuid.UUID,
    user: CurrentUser,
    db: Db,
    cursor: Annotated[str | None, Query(max_length=200)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> MessagePage:
    await svc.get_lobby(db, user.id, lobby_id)
    await svc.require_member(db, lobby_id, user.id)
    return await history(db, user.id, lobby_id, cursor, limit)


@router.post("/lobbies/{lobby_id}/read")
async def mark_lobby_read(lobby_id: uuid.UUID, user: CurrentUser, db: Db, clock: ClockDep) -> Ok:
    member = await svc.require_member(db, lobby_id, user.id)
    now = clock.now()
    member.last_read_at = now
    await db.execute(
        update(Notification)
        .where(
            Notification.user_id == user.id,
            Notification.type == NotificationType.new_message,
            Notification.payload["lobby_id"].astext == str(lobby_id),
            Notification.read_at.is_(None),
        )
        .values(read_at=now)
    )
    await db.commit()
    return Ok()


async def _own_message(message_id: uuid.UUID, user: CurrentUser, db: Db) -> Message:
    message = await db.get(Message, message_id)
    if message is None or message.deleted_at is not None:
        raise not_found("Pesan tidak ditemukan.")
    lobby = await svc.get_lobby(db, user.id, message.lobby_id)
    await svc.require_member(db, lobby.id, user.id)
    if message.sender_id != user.id:
        raise forbidden("Kamu hanya bisa mengubah pesanmu sendiri.")
    svc.ensure_open(lobby)
    return message


@router.patch("/messages/{message_id}")
async def edit_message(
    message_id: uuid.UUID, body: MessageEdit, user: CurrentUser, db: Db, clock: ClockDep
) -> MessageOut:
    limiter.check(f"message:{user.id}", get_settings().message_rate)
    message = await _own_message(message_id, user, db)
    ensure_clean(body.body)
    message.body = body.body
    message.edited_at = clock.now()
    await db.commit()
    await broadcast_message(db, message, user, "message_updated")
    return message_out(message, user)


@router.delete("/messages/{message_id}")
async def delete_message(message_id: uuid.UUID, user: CurrentUser, db: Db, clock: ClockDep) -> Ok:
    message = await _own_message(message_id, user, db)
    message.deleted_at = clock.now()
    await db.commit()
    await broker.broadcast(
        message.lobby_id, {"type": "message_deleted", "message_id": str(message.id)}
    )
    return Ok()
