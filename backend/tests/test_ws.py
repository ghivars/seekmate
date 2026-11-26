"""WebSocket tests against a real uvicorn server running in the test event loop."""

from __future__ import annotations

import asyncio
import json
import socket
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any

import httpx
import pytest
import uvicorn
import websockets
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.main import app
from app.models import Block, Lobby, Message, Notification, User
from app.ratelimit import limiter
from app.security import create_token
from tests.factories import add_member, auth, make_lobby, make_user


@pytest.fixture(scope="module")
async def server() -> AsyncIterator[str]:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    config = uvicorn.Config(app, port=port, log_level="warning", lifespan="off")
    instance = uvicorn.Server(config)
    task = asyncio.create_task(instance.serve())
    while not instance.started:  # noqa: ASYNC110 - uvicorn exposes no event
        await asyncio.sleep(0.02)
    yield f"127.0.0.1:{port}"
    instance.should_exit = True
    await task


class Chat:
    """A connected member."""

    def __init__(self, conn: Any) -> None:
        self.conn = conn

    async def send(self, body: str, client_id: uuid.UUID | None = None) -> uuid.UUID:
        client_id = client_id or uuid.uuid4()
        await self.conn.send(
            json.dumps({"type": "message", "client_id": str(client_id), "body": body})
        )
        return client_id

    async def wait_for(self, kind: str, seconds: float = 3) -> dict[str, Any]:
        async with asyncio.timeout(seconds):
            while True:
                event: dict[str, Any] = json.loads(await self.conn.recv())
                if event["type"] == kind:
                    return event

    async def silent(self, kind: str, seconds: float = 0.4) -> bool:
        try:
            await self.wait_for(kind, seconds)
        except TimeoutError:
            return True
        return False


async def connect(server: str, lobby: Lobby, user: User, **kw: Any) -> Chat:
    token = kw.pop("token", create_token(user.id, "ws", datetime.now(UTC)))
    conn = await websockets.connect(f"ws://{server}/ws/lobbies/{lobby.id}?token={token}", **kw)
    return Chat(conn)


async def close_code(chat: Chat) -> int:
    with pytest.raises(websockets.ConnectionClosed) as info:
        async with asyncio.timeout(3):
            while True:
                await chat.conn.recv()
    assert info.value.rcvd is not None
    return info.value.rcvd.code


async def test_two_members_chat_live_and_history_persists(
    server: str, client: httpx.AsyncClient, db: AsyncSession
) -> None:
    owner, member = await make_user(db), await make_user(db)
    lobby = await make_lobby(db, owner)
    await add_member(db, lobby, member)
    a, b = await connect(server, lobby, owner), await connect(server, lobby, member)
    await b.wait_for("ready")
    client_id = await a.send("Halo <b>semua</b>")
    got = await b.wait_for("message")
    echo = await a.wait_for("message")
    assert got["message"]["body"] == "Halo <b>semua</b>"  # stored raw, rendered as text
    assert echo["message"]["client_id"] == str(client_id)
    # Persisted before broadcast.
    assert await db.get(Message, uuid.UUID(got["message"]["id"])) is not None
    res = await client.get(f"/api/v1/lobbies/{lobby.id}/messages", headers=auth(member))
    assert len(res.json()["items"]) == 1
    await a.conn.close()
    assert (await b.wait_for("presence"))["online"] is False
    await b.conn.close()


async def test_retry_with_same_client_id_is_not_duplicated(server: str, db: AsyncSession) -> None:
    owner = await make_user(db)
    lobby = await make_lobby(db, owner)
    chat = await connect(server, lobby, owner)
    client_id = await chat.send("sekali saja")
    first = await chat.wait_for("message")
    await chat.send("sekali saja", client_id)
    second = await chat.wait_for("message")
    assert first["message"]["id"] == second["message"]["id"]
    assert await db.scalar(select(func.count()).select_from(Message)) == 1
    await chat.conn.close()


async def test_auth_and_membership_are_enforced(server: str, db: AsyncSession) -> None:
    owner, guest = await make_user(db), await make_user(db)
    lobby = await make_lobby(db, owner)
    assert await close_code(await connect(server, lobby, guest)) == 4403
    assert await close_code(await connect(server, lobby, guest, token="rusak")) == 4401
    access = create_token(owner.id, "access", datetime.now(UTC))
    assert await close_code(await connect(server, lobby, owner, token=access)) == 4401
    evil = await connect(server, lobby, owner, origin="https://evil.example")
    assert await close_code(evil) == 4401


async def test_invalid_messages_return_errors_and_keep_socket_open(
    server: str, db: AsyncSession
) -> None:
    owner = await make_user(db)
    lobby = await make_lobby(db, owner)
    chat = await connect(server, lobby, owner)
    for body, code in (
        ("   ", "validation_error"),
        ("x" * 1001, "validation_error"),
        ("dasar t0l0l", "banned_words"),
    ):
        client_id = await chat.send(body)
        error = await chat.wait_for("error")
        assert (error["code"], error["client_id"]) == (code, str(client_id))
    await chat.send("normal lagi")
    assert (await chat.wait_for("message"))["message"]["body"] == "normal lagi"
    assert await db.scalar(select(func.count()).select_from(Message)) == 1
    await chat.conn.close()


async def test_message_rate_limit(
    server: str, db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "rate_limit_enabled", True)
    monkeypatch.setattr(get_settings(), "message_rate", "2/60")
    limiter.reset()
    owner = await make_user(db)
    lobby = await make_lobby(db, owner)
    chat = await connect(server, lobby, owner)
    for _ in range(3):
        await chat.send("spam")
    assert (await chat.wait_for("error"))["code"] == "rate_limited"
    await chat.conn.close()


async def test_removed_member_is_disconnected(
    server: str, client: httpx.AsyncClient, db: AsyncSession
) -> None:
    owner, member = await make_user(db), await make_user(db)
    lobby = await make_lobby(db, owner)
    await add_member(db, lobby, member)
    a, b = await connect(server, lobby, owner), await connect(server, lobby, member)
    await b.wait_for("ready")
    url = f"/api/v1/lobbies/{lobby.id}/members/{member.id}"
    await client.delete(url, headers=auth(owner))
    assert await close_code(b) == 4403
    assert (await a.wait_for("member_left"))["user_id"] == str(member.id)
    await a.conn.close()


async def test_blocked_members_do_not_receive_each_other(server: str, db: AsyncSession) -> None:
    owner, a_user, b_user = [await make_user(db) for _ in range(3)]
    lobby = await make_lobby(db, owner)
    for user in (a_user, b_user):
        await add_member(db, lobby, user)
    db.add(Block(blocker_id=a_user.id, blocked_id=b_user.id))
    await db.commit()
    a, b = await connect(server, lobby, a_user), await connect(server, lobby, b_user)
    await b.wait_for("ready")
    await a.send("dari A")
    await a.wait_for("message")
    assert await b.silent("message")
    await b.send("dari B")
    await b.wait_for("message")
    assert await a.silent("message")
    await a.conn.close()
    await b.conn.close()


async def test_expired_lobby_is_read_only(server: str, db: AsyncSession) -> None:
    owner = await make_user(db)
    lobby = await make_lobby(db, owner, status="expired")
    chat = await connect(server, lobby, owner)
    await chat.send("masih bisa?")
    assert (await chat.wait_for("error"))["code"] == "lobby_expired"
    await chat.conn.close()


async def test_only_absent_members_get_one_coalesced_notification(
    server: str, db: AsyncSession
) -> None:
    owner, watching, absent = [await make_user(db) for _ in range(3)]
    lobby = await make_lobby(db, owner)
    for user in (watching, absent):
        await add_member(db, lobby, user)
    a, b = await connect(server, lobby, owner), await connect(server, lobby, watching)
    await b.wait_for("ready")
    for _ in range(3):
        await a.send("hai")
        await a.wait_for("message")
    notes = (await db.scalars(select(Notification))).all()
    assert [(n.user_id, n.payload["count"]) for n in notes] == [(absent.id, 3)]
    assert "hai" not in json.dumps(notes[0].payload)
    await a.conn.close()
    await b.conn.close()


async def test_typing_reaches_others_only(server: str, db: AsyncSession) -> None:
    owner, member = await make_user(db), await make_user(db)
    lobby = await make_lobby(db, owner)
    await add_member(db, lobby, member)
    a, b = await connect(server, lobby, owner), await connect(server, lobby, member)
    await b.wait_for("ready")
    await a.conn.send(json.dumps({"type": "typing"}))
    assert (await b.wait_for("typing"))["user"]["id"] == str(owner.id)
    assert await a.silent("typing")
    await a.conn.close()
    await b.conn.close()
