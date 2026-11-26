from __future__ import annotations

import httpx
import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.main import app
from app.models import Connection, LobbyMember, Notification, Report, UsabilityEvent, User
from tests.factories import add_member, add_message, auth, make_lobby, make_user

API = "/api/v1"


async def pair(db: AsyncSession) -> tuple[User, User]:
    """Two users who share a lobby owned by a third person."""
    owner, a, b = [await make_user(db) for _ in range(3)]
    lobby = await make_lobby(db, owner)
    await add_member(db, lobby, a)
    await add_member(db, lobby, b)
    return a, b


async def request(client: httpx.AsyncClient, me: User, other: User) -> httpx.Response:
    return await client.post(
        f"{API}/connections", json={"user_id": str(other.id)}, headers=auth(me)
    )


async def listing(client: httpx.AsyncClient, me: User) -> list[dict[str, object]]:
    res = await client.get(f"{API}/connections", headers=auth(me))
    data: list[dict[str, object]] = res.json()
    return data


async def test_connection_lifecycle_shares_email_only_after_consent(
    client: httpx.AsyncClient, db: AsyncSession
) -> None:
    a, b = await pair(db)
    assert (await request(client, a, b)).status_code == 201
    assert (await request(client, a, b)).status_code == 409
    incoming = (await listing(client, b))[0]
    assert (incoming["direction"], incoming["status"], incoming["email"]) == (
        "incoming",
        "pending",
        None,
    )
    url = f"{API}/connections/{incoming['id']}/accept"
    assert (await client.post(url, headers=auth(a))).status_code == 404  # requester cannot accept
    assert (await client.post(url, headers=auth(b))).status_code == 200
    assert (await listing(client, a))[0]["email"] == b.email
    kinds = (await db.scalars(select(Notification.type))).all()
    assert kinds.count("connection_request") == 2
    res = await client.delete(f"{API}/connections/{incoming['id']}", headers=auth(a))
    assert res.status_code == 200 and await listing(client, b) == []


async def test_decline_is_not_revealed(client: httpx.AsyncClient, db: AsyncSession) -> None:
    a, b = await pair(db)
    await request(client, a, b)
    cid = (await listing(client, b))[0]["id"]
    await client.post(f"{API}/connections/{cid}/decline", headers=auth(b))
    assert await listing(client, b) == []
    assert (await listing(client, a))[0]["status"] == "pending"
    assert (await request(client, a, b)).status_code == 409
    # The person who declined may change their mind.
    assert (await request(client, b, a)).status_code == 201
    assert (await listing(client, a))[0]["status"] == "accepted"


async def test_mutual_requests_connect(client: httpx.AsyncClient, db: AsyncSession) -> None:
    a, b = await pair(db)
    await request(client, a, b)
    await request(client, b, a)
    row = (await db.scalars(select(Connection))).one()
    assert row.status == "accepted" and row.user_a_id < row.user_b_id


async def test_strangers_and_self_cannot_connect(
    client: httpx.AsyncClient, db: AsyncSession
) -> None:
    a, stranger = await make_user(db), await make_user(db)
    assert (await request(client, a, stranger)).status_code == 403
    assert (await request(client, a, a)).status_code == 422


@pytest.mark.parametrize("blocker_index", [0, 1])
async def test_block_cuts_contact_in_both_directions(
    client: httpx.AsyncClient, db: AsyncSession, blocker_index: int
) -> None:
    people = await pair(db)
    blocker, blocked = people[blocker_index], people[1 - blocker_index]
    await request(client, blocker, blocked)
    res = await client.post(
        f"{API}/blocks", json={"user_id": str(blocked.id)}, headers=auth(blocker)
    )
    assert res.status_code == 201
    assert await db.scalar(select(func.count()).select_from(Connection)) == 0
    assert (await request(client, blocker, blocked)).status_code == 404
    assert (await request(client, blocked, blocker)).status_code == 404
    mine = (await client.get(f"{API}/blocks", headers=auth(blocker))).json()
    theirs = (await client.get(f"{API}/blocks", headers=auth(blocked))).json()
    assert len(mine) == 1 and theirs == []
    await client.delete(f"{API}/blocks/{blocked.id}", headers=auth(blocker))
    assert (await request(client, blocked, blocker)).status_code == 201


@pytest.mark.parametrize("owner_blocks", [True, False])
async def test_block_removes_member_from_the_owners_lobby(
    client: httpx.AsyncClient, db: AsyncSession, owner_blocks: bool
) -> None:
    owner, member = await make_user(db), await make_user(db)
    lobby = await make_lobby(db, owner, capacity=2, status="full")
    await add_member(db, lobby, member)
    blocker, blocked = (owner, member) if owner_blocks else (member, owner)
    await client.post(f"{API}/blocks", json={"user_id": str(blocked.id)}, headers=auth(blocker))
    row = await db.get(LobbyMember, (lobby.id, member.id), populate_existing=True)
    assert row is not None and row.left_at is not None
    await db.refresh(lobby)
    assert lobby.status == "open"
    mine = (await client.get(f"{API}/lobbies/mine", headers=auth(owner))).json()
    assert len(mine) == 1


async def test_report_stores_short_copy_and_dedupes(
    client: httpx.AsyncClient, db: AsyncSession
) -> None:
    owner, member = await make_user(db), await make_user(db)
    lobby = await make_lobby(db, owner)
    await add_member(db, lobby, member)
    message = await add_message(db, lobby, owner, "x" * 1000)
    body = {
        "target_type": "message",
        "target_id": str(message.id),
        "reason": "spam",
        "detail": "mengganggu",
    }
    for _ in range(2):
        res = await client.post(f"{API}/reports", json=body, headers=auth(member))
        assert res.status_code == 201
    report = (await db.scalars(select(Report))).one()
    assert len(report.detail) == 500 and "mengganggu" in report.detail
    hidden = await make_lobby(db, owner, visibility="closed")
    body = {"target_type": "lobby", "target_id": str(hidden.id), "reason": "other"}
    res = await client.post(f"{API}/reports", json=body, headers=auth(member))
    assert res.status_code == 404


async def test_every_admin_route_rejects_students(
    client: httpx.AsyncClient, db: AsyncSession
) -> None:
    student = await make_user(db)
    paths = app.openapi()["paths"]
    admin_routes = [(p, m) for p, ops in paths.items() if "/admin/" in p for m in ops]
    assert len(admin_routes) == 4
    fake = "00000000-0000-4000-8000-000000000000"
    for path, method in admin_routes:
        url = path
        for name in ("report_id", "lobby_id", "user_id"):
            url = url.replace("{" + name + "}", fake)
        body = {"status": "reviewed", "suspended": True} if method != "get" else None
        res = await client.request(method.upper(), url, json=body, headers=auth(student))
        assert res.status_code == 403, (method, path)
        assert (await client.request(method.upper(), url, json=body)).status_code == 401


async def test_admin_reviews_deactivates_and_suspends(
    client: httpx.AsyncClient, db: AsyncSession
) -> None:
    admin, owner, member = await make_user(db, role="admin"), await make_user(db), None
    member = await make_user(db)
    lobby = await make_lobby(db, owner)
    body = {"target_type": "lobby", "target_id": str(lobby.id), "reason": "inappropriate"}
    await client.post(f"{API}/reports", json=body, headers=auth(member))
    report = (await client.get(f"{API}/admin/reports", headers=auth(admin))).json()[0]
    assert report["lobby_id"] == str(lobby.id) and report["target_label"] == lobby.title
    url = f"{API}/admin/reports/{report['id']}"
    res = await client.patch(url, json={"status": "actioned"}, headers=auth(admin))
    assert res.json()["reviewed_by"] == str(admin.id)
    res = await client.get(f"{API}/admin/reports?status=open", headers=auth(admin))
    assert res.json() == []

    await client.post(f"{API}/admin/lobbies/{lobby.id}/deactivate", headers=auth(admin))
    res = await client.get(f"{API}/lobbies/{lobby.id}", headers=auth(member))
    assert res.status_code == 404
    suspend = f"{API}/admin/users/{owner.id}/suspend"
    await client.post(suspend, json={"suspended": True}, headers=auth(admin))
    res = await client.get(f"{API}/auth/me", headers=auth(owner))
    assert (res.status_code, res.json()["code"]) == (403, "suspended")
    await client.post(suspend, json={"suspended": False}, headers=auth(admin))
    assert (await client.get(f"{API}/auth/me", headers=auth(owner))).status_code == 200
    url = f"{API}/admin/users/{admin.id}/suspend"
    res = await client.post(url, json={"suspended": True}, headers=auth(admin))
    assert res.status_code == 403


async def test_notifications_list_and_mark_read(
    client: httpx.AsyncClient, db: AsyncSession
) -> None:
    owner, a, b = [await make_user(db) for _ in range(3)]
    lobby = await make_lobby(db, owner)
    for user in (a, b):
        await client.post(f"{API}/lobbies/{lobby.id}/join", json={}, headers=auth(user))
    data = (await client.get(f"{API}/notifications", headers=auth(owner))).json()
    assert data["unread_count"] == 2
    first = data["items"][0]["id"]
    other = {"ids": [first]}
    await client.post(f"{API}/notifications/read", json=other, headers=auth(a))  # not theirs
    data = (await client.get(f"{API}/notifications", headers=auth(owner))).json()
    assert data["unread_count"] == 2
    await client.post(f"{API}/notifications/read", json=other, headers=auth(owner))
    await client.post(f"{API}/notifications/read", json={}, headers=auth(owner))
    data = (await client.get(f"{API}/notifications", headers=auth(owner))).json()
    assert data["unread_count"] == 0


async def test_reading_a_lobby_clears_its_message_notification(
    client: httpx.AsyncClient, db: AsyncSession
) -> None:
    owner, member = await make_user(db), await make_user(db)
    lobby = await make_lobby(db, owner)
    url = f"{API}/lobbies/{lobby.id}"
    await client.post(f"{url}/join", json={"intro": "Halo"}, headers=auth(member))
    await client.post(f"{url}/read", headers=auth(owner))
    data = (await client.get(f"{API}/notifications", headers=auth(owner))).json()
    read = {n["type"]: n["read_at"] is not None for n in data["items"]}
    assert read == {"new_message": True, "member_joined": False}


async def test_deleting_account_leaves_lobbies(client: httpx.AsyncClient, db: AsyncSession) -> None:
    owner, member = await make_user(db), await make_user(db)
    lobby = await make_lobby(db, owner)
    await add_member(db, lobby, member)
    await client.delete(f"{API}/users/me", headers=auth(owner))
    row = await db.get(LobbyMember, (lobby.id, member.id), populate_existing=True)
    assert row is not None and row.role == "owner"


async def test_usability_events_are_anonymous_and_opt_in(
    client: httpx.AsyncClient, db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    body = {"session_key": "sesi-acak-123", "event": "join", "elapsed_ms": 1200}
    assert (await client.post(f"{API}/usability-events", json=body)).status_code == 404
    monkeypatch.setattr(get_settings(), "usability_test_mode", True)
    assert (await client.post(f"{API}/usability-events", json=body)).status_code == 201
    assert await db.scalar(select(func.count()).select_from(UsabilityEvent)) == 1
    assert "user_id" not in UsabilityEvent.__table__.columns
