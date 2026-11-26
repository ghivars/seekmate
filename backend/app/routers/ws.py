"""WebSocket chat. Every message is persisted before it is broadcast."""

from __future__ import annotations

import uuid
from typing import Any, Literal

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.clock import get_clock
from app.config import get_settings
from app.db import SessionFactory
from app.deps import ensure_usable
from app.enums import UserStatus
from app.errors import AppError
from app.models import Message, User
from app.ratelimit import limiter
from app.realtime import broker
from app.schemas_lobby import Body
from app.security import decode_token
from app.services import lobbies as svc
from app.services.blocks import blocked_ids
from app.services.messages import broadcast_message, create_message, message_out

router = APIRouter()
UNAUTHORIZED, FORBIDDEN = 4401, 4403


class ClientMessage(BaseModel):
    type: Literal["message"]
    client_id: uuid.UUID
    body: Body


async def _load_user(db: Any, user_id: uuid.UUID) -> User:
    user = await db.get(User, user_id)
    if user is None or user.status == UserStatus.deleted:
        raise AppError(401, "unauthorized", "Sesi berakhir.")
    ensure_usable(user)
    return user


def _origin_allowed(ws: WebSocket) -> bool:
    origin = ws.headers.get("origin")
    return origin is None or origin.lower() in get_settings().cors_origin_list


@router.websocket("/ws/lobbies/{lobby_id}")
async def lobby_socket(ws: WebSocket, lobby_id: uuid.UUID, token: str = "") -> None:
    await ws.accept()
    user_id = decode_token(token, "ws")
    if user_id is None or not _origin_allowed(ws):
        await ws.close(UNAUTHORIZED)
        return
    try:
        async with SessionFactory() as db:
            user = await _load_user(db, user_id)
            await svc.get_lobby(db, user_id, lobby_id)
            await svc.require_member(db, lobby_id, user_id)
            name = user.display_name
    except AppError as error:
        await ws.close(UNAUTHORIZED if error.status == 401 else FORBIDDEN)
        return

    broker.connect(lobby_id, user_id, ws)
    try:
        await ws.send_json({"type": "ready"})
        await _presence(lobby_id, user_id, True)
        while True:
            data = await ws.receive_json()
            if not isinstance(data, dict):
                continue
            if data.get("type") == "ping":
                await ws.send_json({"type": "pong"})
            elif data.get("type") == "typing":
                await _typing(lobby_id, user_id, name)
            else:
                await _handle_message(ws, lobby_id, user_id, data)
    except (WebSocketDisconnect, RuntimeError, ValueError, KeyError):
        # Client went away, was kicked, or sent something that is not JSON text.
        pass
    finally:
        broker.disconnect(lobby_id, user_id, ws)
        if user_id not in broker.lobby_users(lobby_id):
            await _presence(lobby_id, user_id, False)


async def _presence(lobby_id: uuid.UUID, user_id: uuid.UUID, online: bool) -> None:
    async with SessionFactory() as db:
        hidden = await blocked_ids(db, user_id)
    event = {"type": "presence", "user_id": str(user_id), "online": online}
    await broker.broadcast(lobby_id, event, exclude=hidden)


async def _typing(lobby_id: uuid.UUID, user_id: uuid.UUID, name: str) -> None:
    async with SessionFactory() as db:
        if await svc.get_member(db, lobby_id, user_id) is None:
            return
        hidden = await blocked_ids(db, user_id)
    event = {"type": "typing", "user": {"id": str(user_id), "display_name": name}}
    await broker.broadcast(lobby_id, event, exclude={*hidden, user_id})


async def _handle_message(
    ws: WebSocket, lobby_id: uuid.UUID, user_id: uuid.UUID, data: dict[str, Any]
) -> None:
    client_id = data.get("client_id")
    try:
        body = ClientMessage.model_validate(data)
        limiter.check(f"message:{user_id}", get_settings().message_rate)
        async with SessionFactory() as db:
            user = await _load_user(db, user_id)
            lobby = await svc.get_lobby(db, user_id, lobby_id)
            await svc.require_member(db, lobby_id, user_id)
            svc.ensure_open(lobby)
            try:
                message = await create_message(
                    db, lobby, user, body.body, get_clock().now(), client_id=body.client_id
                )
                await db.commit()
            except IntegrityError:
                # A retry of a message that was already stored: acknowledge, do not duplicate.
                await db.rollback()
                await _ack_existing(ws, lobby_id, user_id, body.client_id)
                return
            await broadcast_message(db, message, user, "message")
    except ValidationError:
        await _error(ws, client_id, "validation_error", "Pesan kosong atau terlalu panjang.")
    except AppError as error:
        await _error(ws, client_id, error.code, error.message)


async def _ack_existing(
    ws: WebSocket, lobby_id: uuid.UUID, user_id: uuid.UUID, client_id: uuid.UUID
) -> None:
    async with SessionFactory() as db:
        user = await _load_user(db, user_id)
        message = await db.scalar(
            select(Message).where(
                Message.lobby_id == lobby_id,
                Message.sender_id == user_id,
                Message.client_id == client_id,
            )
        )
        if message is not None:
            out = message_out(message, user).model_dump(mode="json")
            await ws.send_json({"type": "message", "message": out})


async def _error(ws: WebSocket, client_id: object, code: str, message: str) -> None:
    await ws.send_json({"type": "error", "client_id": client_id, "code": code, "message": message})
