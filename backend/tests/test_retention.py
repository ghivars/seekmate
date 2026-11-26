from __future__ import annotations

from datetime import UTC, datetime, timedelta

import httpx
import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clock import FakeClock
from app.config import get_settings
from app.db import engine
from app.jobs.retention import LOCK_KEY, run_retention
from app.models import (
    Base,
    Connection,
    Lobby,
    LobbyMember,
    Message,
    Notification,
    RetentionLog,
    Semester,
    User,
)
from tests.factories import add_member, add_message, auth, make_course, make_lobby, make_user

API = "/api/v1"
NOW = datetime.now(UTC).replace(microsecond=0)
ENDS = NOW + timedelta(days=30)


@pytest.fixture
async def world(db: AsyncSession) -> tuple[Lobby, User, User]:
    db.add(Semester(name="S", starts_at=NOW - timedelta(days=100), ends_at=ENDS, is_active=True))
    await db.commit()
    owner, member = await make_user(db), await make_user(db)
    lobby = await make_lobby(db, owner)
    await add_member(db, lobby, member)
    for i in range(7):
        await add_message(db, lobby, owner, f"pesan {i}", minutes=i)
    a, b = sorted([owner.id, member.id])
    db.add(
        Connection(
            user_a_id=a,
            user_b_id=b,
            requested_by=owner.id,
            status="accepted",
            origin_course_id=lobby.course_id,
        )
    )
    await db.commit()
    return lobby, owner, member


async def count(db: AsyncSession, model: type[Base]) -> int:
    return await db.scalar(select(func.count()).select_from(model)) or 0


async def test_timeline_notice_expiry_grace_and_deletion(
    client: httpx.AsyncClient,
    db: AsyncSession,
    world: tuple[Lobby, User, User],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(get_settings(), "retention_batch_size", 2)  # forces several batches
    lobby, owner, member = world
    clock = FakeClock(ENDS - timedelta(days=8))
    assert (await run_retention(clock)).notified == 0

    clock.set(ENDS - timedelta(days=7))
    assert (await run_retention(clock)).notified == 2
    clock.advance(timedelta(days=1))
    assert (await run_retention(clock)).notified == 0  # only once per member

    clock.set(ENDS)
    result = await run_retention(clock)
    assert result.expired == 1 and result.lobbies_deleted == 0
    await db.refresh(lobby)
    assert lobby.status == "expired"
    # Read-only: members can still read, nobody can write or join.
    url = f"{API}/lobbies/{lobby.id}"
    res = await client.get(f"{url}/messages", headers=auth(member))
    assert len(res.json()["items"]) == 7
    message_id = res.json()["items"][0]["id"]
    res = await client.patch(
        f"{API}/messages/{message_id}", json={"body": "x"}, headers=auth(owner)
    )
    assert res.json()["code"] == "lobby_expired"
    outsider = await make_user(db)
    assert (await client.post(f"{url}/join", json={}, headers=auth(outsider))).status_code == 404

    clock.set(ENDS + timedelta(days=14) - timedelta(seconds=1))
    assert (await run_retention(clock)).lobbies_deleted == 0
    assert await count(db, Message) == 7

    clock.set(ENDS + timedelta(days=14))
    result = await run_retention(clock)
    assert (result.lobbies_deleted, result.messages_deleted) == (1, 7)
    for model in (Message, LobbyMember, Lobby, Notification):
        assert await count(db, model) == 0
    entry = (await db.scalars(select(RetentionLog))).one()
    assert (entry.lobbies_deleted, entry.messages_deleted) == (1, 7)

    # Connections survive and stay usable.
    saved = (await client.get(f"{API}/connections", headers=auth(owner))).json()
    assert len(saved) == 1 and saved[0]["email"] == member.email
    assert saved[0]["origin_course"] is not None

    again = await run_retention(clock)
    assert again.lobbies_deleted == 0 and await count(db, RetentionLog) == 1


async def test_other_semesters_are_untouched(
    db: AsyncSession, world: tuple[Lobby, User, User]
) -> None:
    _, owner, _ = world
    later = Semester(
        name="Next", starts_at=ENDS, ends_at=ENDS + timedelta(days=150), is_active=False
    )
    db.add(later)
    await db.commit()
    course = await make_course(db)
    keep = await make_lobby(db, owner, course, semester_id=later.id)
    await add_message(db, keep, owner, "tetap ada")
    await run_retention(FakeClock(ENDS + timedelta(days=20)))
    assert (await db.scalars(select(Lobby.id))).all() == [keep.id]
    assert await count(db, Message) == 1


async def test_only_one_run_at_a_time(world: tuple[Lobby, User, User]) -> None:
    async with engine.connect() as holder:
        await holder.scalar(select(func.pg_advisory_lock(LOCK_KEY)))
        assert await run_retention(FakeClock(ENDS)) is None
        await holder.scalar(select(func.pg_advisory_unlock(LOCK_KEY)))
    assert await run_retention(FakeClock(ENDS)) is not None


async def test_cannot_create_lobby_after_semester_end(
    client: httpx.AsyncClient, db: AsyncSession, world: tuple[Lobby, User, User], clock: FakeClock
) -> None:
    lobby, owner, _ = world
    clock.set(ENDS + timedelta(days=1))
    body = {
        "title": "Telat",
        "study_goal": "exam_prep",
        "atmosphere": "chill",
        "preferred_time": "evening",
        "capacity": 4,
    }
    from app.security import create_token

    headers = {"Authorization": f"Bearer {create_token(owner.id, 'access', clock.now())}"}
    res = await client.post(f"{API}/courses/{lobby.course_id}/lobbies", json=body, headers=headers)
    assert res.json()["code"] == "semester_ended"


def test_connections_do_not_reference_lobbies() -> None:
    targets = {fk.column.table.name for fk in Connection.__table__.foreign_keys}
    assert targets == {"users", "courses"}
