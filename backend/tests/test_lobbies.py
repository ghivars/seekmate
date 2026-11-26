from __future__ import annotations

import asyncio
from typing import Any

import httpx
import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.enums import MemberRole
from app.models import Block, Lobby, LobbyMember, Message, Notification, User, UserPlannedCourse
from app.ratelimit import limiter
from tests.factories import add_member, add_message, auth, make_course, make_lobby, make_user

API = "/api/v1"
BODY: dict[str, Any] = {
    "title": "Cari kelompok",
    "description": "Santai",
    "study_goal": "exam_prep",
    "atmosphere": "chill",
    "preferred_time": "evening",
    "capacity": 5,
}


async def test_create_then_second_account_finds_and_previews(
    client: httpx.AsyncClient, db: AsyncSession
) -> None:
    a, b, course = await make_user(db), await make_user(db), await make_course(db)
    res = await client.post(f"{API}/courses/{course.id}/lobbies", json=BODY, headers=auth(a))
    assert res.status_code == 201
    lobby = res.json()
    assert lobby["my_role"] == "owner" and lobby["member_count"] == 1
    assert await db.scalar(select(func.count()).select_from(UserPlannedCourse)) == 1

    listed = await client.get(f"{API}/courses/{course.id}/lobbies", headers=auth(b))
    assert [x["id"] for x in listed.json()] == [lobby["id"]]
    assert listed.json()[0]["is_member"] is False
    preview = await client.get(f"{API}/lobbies/{lobby['id']}/preview", headers=auth(b))
    assert preview.status_code == 200 and preview.json()["items"] == []


async def test_preview_is_read_only_and_limited_to_20(
    client: httpx.AsyncClient, db: AsyncSession
) -> None:
    owner, guest = await make_user(db), await make_user(db)
    lobby = await make_lobby(db, owner)
    for i in range(25):
        await add_message(db, lobby, owner, f"pesan {i}", minutes=i)
    preview = (await client.get(f"{API}/lobbies/{lobby.id}/preview", headers=auth(guest))).json()
    assert [m["body"] for m in preview["items"]] == [f"pesan {i}" for i in range(5, 25)]
    assert preview["next_cursor"] is None
    # Non-members cannot read full history, mark read, edit, delete or connect.
    base = f"{API}/lobbies/{lobby.id}"
    message_id = preview["items"][0]["id"]
    h = auth(guest)
    assert (await client.get(f"{base}/messages", headers=h)).status_code == 403
    assert (await client.post(f"{base}/read", headers=h)).status_code == 403
    edit = await client.patch(f"{API}/messages/{message_id}", json={"body": "x"}, headers=h)
    assert edit.status_code == 403
    assert (await client.delete(f"{API}/messages/{message_id}", headers=h)).status_code == 403
    assert (await client.get(f"{base}/preview")).status_code == 401


async def test_closed_visibility_is_hidden_from_non_members(
    client: httpx.AsyncClient, db: AsyncSession
) -> None:
    owner, guest = await make_user(db), await make_user(db)
    lobby = await make_lobby(db, owner, visibility="closed")
    for path in ("", "/preview", "/members"):
        res = await client.get(f"{API}/lobbies/{lobby.id}{path}", headers=auth(guest))
        assert res.status_code == 404
    res = await client.post(f"{API}/lobbies/{lobby.id}/join", json={}, headers=auth(guest))
    assert res.status_code == 404


async def test_capacity_race_20_joins_on_capacity_5(
    client: httpx.AsyncClient, db: AsyncSession
) -> None:
    owner = await make_user(db)
    lobby = await make_lobby(db, owner, capacity=5)
    users = [await make_user(db) for _ in range(20)]
    results = await asyncio.gather(
        *(
            client.post(
                f"{API}/lobbies/{lobby.id}/join", json={"intro": f"Halo {i}"}, headers=auth(u)
            )
            for i, u in enumerate(users)
        )
    )
    codes = [r.status_code for r in results]
    assert codes.count(200) == 4  # the owner already takes one of the five slots
    assert codes.count(409) == 16
    active = select(func.count()).where(
        LobbyMember.lobby_id == lobby.id, LobbyMember.left_at.is_(None)
    )
    assert await db.scalar(active) == 5
    assert await db.scalar(select(func.count()).select_from(Message)) == 4
    await db.refresh(lobby)
    assert lobby.status == "full"


async def test_same_user_cannot_join_twice_even_concurrently(
    client: httpx.AsyncClient, db: AsyncSession
) -> None:
    owner, user = await make_user(db), await make_user(db)
    lobby = await make_lobby(db, owner)
    url = f"{API}/lobbies/{lobby.id}/join"
    results = await asyncio.gather(
        *(client.post(url, json={}, headers=auth(user)) for _ in range(5))
    )
    assert sorted(r.status_code for r in results) == [200, 409, 409, 409, 409]


async def test_join_sends_intro_and_notifies_owner(
    client: httpx.AsyncClient, db: AsyncSession
) -> None:
    owner, user = await make_user(db), await make_user(db)
    lobby = await make_lobby(db, owner)
    res = await client.post(
        f"{API}/lobbies/{lobby.id}/join", json={"intro": "Halo semua"}, headers=auth(user)
    )
    assert res.json()["is_member"] is True and res.json()["member_count"] == 2
    message = (await db.scalars(select(Message))).one()
    assert message.is_intro and message.body == "Halo semua"
    kinds = set((await db.scalars(select(Notification.type))).all())
    assert kinds == {"member_joined", "new_message"}


async def test_join_with_banned_intro_is_rejected_without_joining(
    client: httpx.AsyncClient, db: AsyncSession
) -> None:
    owner, user = await make_user(db), await make_user(db)
    lobby = await make_lobby(db, owner)
    res = await client.post(
        f"{API}/lobbies/{lobby.id}/join", json={"intro": "dasar goblok"}, headers=auth(user)
    )
    assert res.json()["code"] == "banned_words"
    assert await db.get(LobbyMember, (lobby.id, user.id)) is None


async def test_leave_reopens_full_lobby_and_alerts_waiting_user(
    client: httpx.AsyncClient, db: AsyncSession
) -> None:
    owner, member, waiting = [await make_user(db) for _ in range(3)]
    lobby = await make_lobby(db, owner, capacity=2)
    join = f"{API}/lobbies/{lobby.id}/join"
    assert (await client.post(join, json={}, headers=auth(member))).json()["status"] == "full"
    full = await client.post(join, json={}, headers=auth(waiting))
    assert (full.status_code, full.json()["code"]) == (409, "lobby_full")
    alert = f"{API}/lobbies/{lobby.id}/slot-alert"
    assert (await client.post(alert, headers=auth(waiting))).status_code == 200
    await client.post(f"{API}/lobbies/{lobby.id}/leave", headers=auth(member))
    note = await db.scalar(select(Notification).where(Notification.user_id == waiting.id))
    assert note is not None and note.type == "slot_available"
    assert (await client.post(join, json={}, headers=auth(member))).status_code == 200  # rejoin


async def test_owner_leaving_hands_over_then_closes(
    client: httpx.AsyncClient, db: AsyncSession
) -> None:
    owner, member = await make_user(db), await make_user(db)
    lobby = await make_lobby(db, owner)
    await add_member(db, lobby, member)
    leave = f"{API}/lobbies/{lobby.id}/leave"
    await client.post(leave, headers=auth(owner))
    row = await db.get(LobbyMember, (lobby.id, member.id), populate_existing=True)
    assert row is not None and row.role == MemberRole.owner
    await client.post(leave, headers=auth(member))
    await db.refresh(lobby)
    assert lobby.status == "closed"


async def test_owner_can_remove_member_who_cannot_rejoin(
    client: httpx.AsyncClient, db: AsyncSession
) -> None:
    owner, member, other = [await make_user(db) for _ in range(3)]
    lobby = await make_lobby(db, owner)
    await add_member(db, lobby, member)
    await add_member(db, lobby, other)
    url = f"{API}/lobbies/{lobby.id}/members/{member.id}"
    assert (await client.delete(url, headers=auth(other))).status_code == 403
    assert (await client.delete(url, headers=auth(owner))).status_code == 200
    res = await client.post(f"{API}/lobbies/{lobby.id}/join", json={}, headers=auth(member))
    assert res.status_code == 403


async def test_update_rules(client: httpx.AsyncClient, db: AsyncSession) -> None:
    owner, member = await make_user(db), await make_user(db)
    lobby = await make_lobby(db, owner, capacity=3)
    await add_member(db, lobby, member)
    url = f"{API}/lobbies/{lobby.id}"
    res = await client.patch(url, json={"title": "Baru"}, headers=auth(member))
    assert res.status_code == 403
    res = await client.patch(url, json={"capacity": 2}, headers=auth(owner))
    assert res.json()["status"] == "full"
    res = await client.patch(url, json={"capacity": 16}, headers=auth(owner))
    assert res.status_code == 422


@pytest.mark.parametrize("patch", [{"capacity": 1}, {"capacity": 16}, {"title": "  "}])
async def test_create_validation(
    client: httpx.AsyncClient, db: AsyncSession, patch: dict[str, Any]
) -> None:
    user, course = await make_user(db), await make_course(db)
    res = await client.post(
        f"{API}/courses/{course.id}/lobbies", json=BODY | patch, headers=auth(user)
    )
    assert res.status_code == 422


async def test_blocking_hides_lobbies_in_both_directions(
    client: httpx.AsyncClient, db: AsyncSession
) -> None:
    a, b, course = await make_user(db), await make_user(db), await make_course(db)
    lobby_a = await make_lobby(db, a, course)
    lobby_b = await make_lobby(db, b, course)
    db.add(Block(blocker_id=a.id, blocked_id=b.id))
    await db.commit()

    async def visible(user: User) -> list[str]:
        res = await client.get(f"{API}/courses/{course.id}/lobbies", headers=auth(user))
        return [x["id"] for x in res.json()]

    assert await visible(a) == [str(lobby_a.id)]
    assert await visible(b) == [str(lobby_b.id)]
    for user, lobby in ((a, lobby_b), (b, lobby_a)):
        base = f"{API}/lobbies/{lobby.id}"
        assert (await client.get(base, headers=auth(user))).status_code == 404
        assert (await client.get(f"{base}/preview", headers=auth(user))).status_code == 404
        res = await client.post(f"{base}/join", json={}, headers=auth(user))
        assert res.status_code == 404


async def test_blocked_messages_are_hidden_in_shared_lobby(
    client: httpx.AsyncClient, db: AsyncSession
) -> None:
    owner, a, b = [await make_user(db) for _ in range(3)]
    lobby = await make_lobby(db, owner)
    for user in (a, b):
        await add_member(db, lobby, user)
        await add_message(db, lobby, user, f"dari {user.display_name}")
    db.add(Block(blocker_id=a.id, blocked_id=b.id))
    await db.commit()
    for user, other in ((a, b), (b, a)):
        res = await client.get(f"{API}/lobbies/{lobby.id}/messages", headers=auth(user))
        senders = {m["sender"]["id"] for m in res.json()["items"]}
        assert str(other.id) not in senders and str(user.id) in senders
        members = await client.get(f"{API}/lobbies/{lobby.id}/members", headers=auth(user))
        assert str(other.id) not in {m["user"]["id"] for m in members.json()}


async def test_history_cursor_walks_every_message_once(
    client: httpx.AsyncClient, db: AsyncSession
) -> None:
    owner = await make_user(db)
    lobby = await make_lobby(db, owner)
    for i in range(23):
        await add_message(db, lobby, owner, str(i), minutes=i // 3)  # ties on created_at
    seen: list[str] = []
    cursor: str | None = None
    while True:
        params: dict[str, Any] = {"limit": 5} | ({"cursor": cursor} if cursor else {})
        url = f"{API}/lobbies/{lobby.id}/messages"
        page = (await client.get(url, params=params, headers=auth(owner))).json()
        seen = [m["id"] for m in page["items"]] + seen
        cursor = page["next_cursor"]
        if cursor is None:
            break
    assert len(seen) == len(set(seen)) == 23
    bad = await client.get(url, params={"cursor": "???"}, headers=auth(owner))
    assert bad.status_code == 422


async def test_unread_counts_and_mark_read(client: httpx.AsyncClient, db: AsyncSession) -> None:
    owner, member = await make_user(db), await make_user(db)
    lobby = await make_lobby(db, owner)
    await add_member(db, lobby, member, minutes=-30)
    for i in range(3):
        await add_message(db, lobby, owner, "hai", minutes=-10 + i)
    mine = (await client.get(f"{API}/lobbies/mine", headers=auth(member))).json()
    assert mine[0]["unread_count"] == 3
    courses = await client.get(f"{API}/courses", params={"planned": False}, headers=auth(member))
    assert courses.json()[0]["unread_count"] == 3
    await client.post(f"{API}/lobbies/{lobby.id}/read", headers=auth(member))
    mine = (await client.get(f"{API}/lobbies/mine", headers=auth(member))).json()
    assert mine[0]["unread_count"] == 0


async def test_edit_and_delete_own_message_only(
    client: httpx.AsyncClient, db: AsyncSession
) -> None:
    owner, member = await make_user(db), await make_user(db)
    lobby = await make_lobby(db, owner)
    await add_member(db, lobby, member)
    message = await add_message(db, lobby, owner, "asli")
    url = f"{API}/messages/{message.id}"
    res = await client.patch(url, json={"body": "ubah"}, headers=auth(member))
    assert res.status_code == 403
    res = await client.patch(url, json={"body": "ubah"}, headers=auth(owner))
    assert res.json()["body"] == "ubah" and res.json()["edited_at"]
    assert (await client.delete(url, headers=auth(owner))).status_code == 200
    page = (await client.get(f"{API}/lobbies/{lobby.id}/messages", headers=auth(owner))).json()
    assert page["items"][0]["deleted"] is True and page["items"][0]["body"] == ""


async def test_filters_sorting_and_search(client: httpx.AsyncClient, db: AsyncSession) -> None:
    owner, me, course = await make_user(db), await make_user(db, prefs=True), await make_course(db)
    low = await make_lobby(
        db, owner, course, study_goal="just_connect", atmosphere="focused", preferred_time="morning"
    )
    high = await make_lobby(
        db, owner, course, study_goal="exam_prep", atmosphere="chill", preferred_time="evening"
    )
    full = await make_lobby(
        db, owner, course, study_goal="exam_prep", atmosphere="mixed", status="full", capacity=2
    )
    url = f"{API}/courses/{course.id}/lobbies"

    async def ids(**params: str) -> list[str]:
        res = await client.get(url, params=params, headers=auth(me))
        return [x["id"] for x in res.json()]

    assert (await ids(sort="match"))[0] == str(high.id)
    assert (await ids(sort="match"))[-1] == str(low.id)
    assert set(await ids(study_goal="exam_prep")) == {str(high.id), str(full.id)}
    assert await ids(atmosphere="focused") == [str(low.id)]
    assert str(full.id) not in await ids(has_slot="true")
    res = await client.get(f"{API}/courses", params={"q": course.code.lower()}, headers=auth(me))
    assert [c["id"] for c in res.json()] == [str(course.id)]


async def test_lobby_create_rate_limit(
    client: httpx.AsyncClient, db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "rate_limit_enabled", True)
    monkeypatch.setattr(get_settings(), "lobby_create_rate", "2/60")
    limiter.reset()
    user, course = await make_user(db), await make_course(db)
    url = f"{API}/courses/{course.id}/lobbies"
    codes = [(await client.post(url, json=BODY, headers=auth(user))).status_code for _ in range(3)]
    assert codes == [201, 201, 429]


async def test_lobby_belongs_to_one_course_and_active_semester(
    client: httpx.AsyncClient, db: AsyncSession
) -> None:
    user, course = await make_user(db), await make_course(db)
    await client.post(f"{API}/courses/{course.id}/lobbies", json=BODY, headers=auth(user))
    lobby = (await db.scalars(select(Lobby))).one()
    assert lobby.course_id == course.id and lobby.semester_id is not None
    assert lobby.expires_at > lobby.created_at
