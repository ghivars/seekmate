from __future__ import annotations

import base64
import uuid
from datetime import datetime

from sqlalchemy import select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.enums import NotificationType
from app.errors import invalid
from app.models import Lobby, Message, User
from app.moderation import ensure_clean
from app.realtime import broker
from app.schemas_lobby import MessageOut, MessagePage, UserBrief
from app.services.blocks import blocked_ids
from app.services.lobbies import active_member_ids
from app.services.notifications import notify


def message_out(message: Message, sender: User) -> MessageOut:
    deleted = message.deleted_at is not None
    return MessageOut(
        id=message.id,
        lobby_id=message.lobby_id,
        sender=UserBrief.model_validate(sender),
        body="" if deleted else message.body,
        is_intro=message.is_intro,
        client_id=message.client_id,
        created_at=message.created_at,
        edited_at=message.edited_at,
        deleted=deleted,
    )


def encode_cursor(message: Message) -> str:
    raw = f"{message.created_at.isoformat()}|{message.id}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    try:
        stamp, message_id = base64.urlsafe_b64decode(cursor.encode()).decode().split("|")
        return datetime.fromisoformat(stamp), uuid.UUID(message_id)
    except ValueError as error:
        raise invalid("bad_cursor", "Kursor tidak valid.") from error


async def history(
    db: AsyncSession, user_id: uuid.UUID, lobby_id: uuid.UUID, cursor: str | None, limit: int
) -> MessagePage:
    """Newest page first; items inside a page are oldest to newest."""
    hidden = await blocked_ids(db, user_id)
    query = (
        select(Message)
        .where(Message.lobby_id == lobby_id, Message.sender_id.not_in(hidden))
        .options(selectinload(Message.sender))
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(limit + 1)
    )
    if cursor:
        query = query.where(tuple_(Message.created_at, Message.id) < decode_cursor(cursor))
    rows = list((await db.scalars(query)).all())
    more = len(rows) > limit
    rows = rows[:limit]
    return MessagePage(
        items=[message_out(m, m.sender) for m in reversed(rows)],
        next_cursor=encode_cursor(rows[-1]) if more and rows else None,
    )


async def create_message(
    db: AsyncSession,
    lobby: Lobby,
    sender: User,
    body: str,
    now: datetime,
    *,
    client_id: uuid.UUID | None = None,
    is_intro: bool = False,
) -> Message:
    """Persist a message and queue notifications for members who are not watching the lobby."""
    ensure_clean(body)
    message = Message(
        lobby_id=lobby.id,
        sender_id=sender.id,
        body=body,
        is_intro=is_intro,
        client_id=client_id,
        created_at=now,
    )
    db.add(message)
    await db.flush()
    hidden = await blocked_ids(db, sender.id)
    watching = broker.lobby_users(lobby.id)
    for user_id in await active_member_ids(db, lobby.id):
        if user_id == sender.id or user_id in watching or user_id in hidden:
            continue
        await notify(
            db,
            user_id,
            NotificationType.new_message,
            {
                "lobby_id": str(lobby.id),
                "course_id": str(lobby.course_id),
                "lobby_title": lobby.title,
            },
            now,
        )
    return message


async def broadcast_message(db: AsyncSession, message: Message, sender: User, kind: str) -> None:
    """Only call after commit: messages are persisted before anyone sees them."""
    event = {"type": kind, "message": message_out(message, sender).model_dump(mode="json")}
    await broker.broadcast(message.lobby_id, event, exclude=await blocked_ids(db, sender.id))
