from __future__ import annotations

import json
from typing import Any

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.models import User, UserPlannedCourse
from app.services import krs
from tests.factories import auth, make_course, make_lobby, make_semester, make_user

API = "/api/v1"
CREDS = {"email": "Ani@student.ui.ac.id", "password": "kata-sandi-aman", "display_name": "Ani"}


@pytest.fixture
def no_verification(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "email_verification", False)
    monkeypatch.setattr(get_settings(), "allowed_email_domains", "ac.id")


async def test_signup_without_verification_signs_in(
    client: httpx.AsyncClient, db: AsyncSession, no_verification: None
) -> None:
    res = await client.post(f"{API}/auth/register", json=CREDS)
    data = res.json()
    assert data["signed_in"] is True and "seekmate_refresh" in client.cookies
    me = await client.get(
        f"{API}/auth/me", headers={"Authorization": f"Bearer {data['access_token']}"}
    )
    assert me.json()["email"] == "ani@student.ui.ac.id"
    again = await client.post(f"{API}/auth/register", json={**CREDS, "password": "x" * 12})
    assert (again.status_code, again.json()["code"]) == (409, "email_taken")
    user = (await db.scalars(select(User))).one()
    assert user.email_verified_at is not None


async def test_signup_still_checks_the_domain(
    client: httpx.AsyncClient, no_verification: None
) -> None:
    for email in ("a@gmail.com", "a@fakeac.id", "a@ac.id.evil.com"):
        res = await client.post(f"{API}/auth/register", json={**CREDS, "email": email})
        assert res.status_code == 422, email


def test_domain_suffix_matching() -> None:
    s = Settings(allowed_email_domains="ac.id,kampus.example")
    assert s.email_allowed("a@ui.ac.id") and s.email_allowed("a@kampus.example")
    assert not s.email_allowed("a@xac.id") and not s.email_allowed("a@kampus.example.org")


async def test_verification_mode_is_unchanged(client: httpx.AsyncClient) -> None:
    res = await client.post(f"{API}/auth/register", json={**CREDS, "email": "b@kampus.ac.id"})
    assert (res.status_code, res.json()["signed_in"]) == (202, False)


async def test_catalog_counts_planners_and_discover_spans_courses(
    client: httpx.AsyncClient, db: AsyncSession
) -> None:
    semester = await make_semester(db)
    owner, me = await make_user(db), await make_user(db, prefs=True)
    a = await make_course(db, faculty_or_dept="Informatika")
    b = await make_course(db, faculty_or_dept="Teknik")
    for user in (owner, me):
        db.add(UserPlannedCourse(user_id=user.id, course_id=a.id, semester_id=semester.id))
    await db.commit()
    la = await make_lobby(db, owner, a, title="Rekursi")
    lb = await make_lobby(db, owner, b, title="Statika")
    await make_lobby(db, owner, b, visibility="closed")
    courses = (await client.get(f"{API}/courses", headers=auth(me))).json()
    assert {c["code"]: c["planner_count"] for c in courses} == {a.code: 2, b.code: 0}

    async def ids(**params: str) -> set[str]:
        res = await client.get(f"{API}/lobbies/discover", params=params, headers=auth(me))
        return {x["id"] for x in res.json()}

    assert await ids() == {str(la.id), str(lb.id)}
    assert await ids(faculty="Teknik") == {str(lb.id)}
    assert await ids(q="rekur") == {str(la.id)}
    assert await ids(q=b.code.lower()) == {str(lb.id)}
    first = (await client.get(f"{API}/lobbies/discover", headers=auth(me))).json()[0]
    assert first["course_credits"] == 3 and "major" in first["creator"]


async def test_krs_rules_without_ai(client: httpx.AsyncClient, db: AsyncSession) -> None:
    semester = await make_semester(db)
    me, owner = await make_user(db, prefs=True), await make_user(db)
    heavy = [await make_course(db, credits=4) for _ in range(6)]
    for course in heavy:
        db.add(UserPlannedCourse(user_id=me.id, course_id=course.id, semester_id=semester.id))
    await db.commit()
    await make_lobby(db, owner, heavy[0])
    status = (await client.get(f"{API}/krs/status", headers=auth(me))).json()
    assert status == {"ai_enabled": False, "model": None}
    res = await client.post(f"{API}/krs/analyze", json={"target_credits": 20}, headers=auth(me))
    data = res.json()
    assert (data["source"], data["total_credits"], data["load"]) == ("rules", 24, "berat")
    assert any("Kelebihan 4 SKS" in s for s in data["suggestions"])
    assert data["courses"][0]["lobby_count"] == 1
    assert "dosen wali" in data["disclaimer"]


async def test_krs_empty_plan(client: httpx.AsyncClient, db: AsyncSession) -> None:
    await make_semester(db)
    me = await make_user(db)
    data = (await client.post(f"{API}/krs/analyze", json={}, headers=auth(me))).json()
    assert data["total_credits"] == 0 and data["warnings"]


class FakeAi:
    def __init__(self, reply: Any, status: int = 200) -> None:
        self.reply, self.status = reply, status
        self.sent: Any = None

    def install(self, monkeypatch: pytest.MonkeyPatch) -> None:
        fake = self

        def handler(request: httpx.Request) -> httpx.Response:
            fake.sent = json.loads(request.content)
            content = fake.reply if isinstance(fake.reply, str) else json.dumps(fake.reply)
            body = {"choices": [{"message": {"content": content}}]}
            return httpx.Response(fake.status, json=body)

        real = httpx.AsyncClient
        monkeypatch.setattr(
            krs.httpx,
            "AsyncClient",
            lambda **kw: real(transport=httpx.MockTransport(handler), **kw),
        )
        monkeypatch.setattr(get_settings(), "ai_api_key", "test-key")


async def plan(db: AsyncSession) -> User:
    semester = await make_semester(db)
    me = await make_user(db, prefs=True, display_name="Rahasia Banget")
    course = await make_course(db, credits=3)
    db.add(UserPlannedCourse(user_id=me.id, course_id=course.id, semester_id=semester.id))
    await db.commit()
    return me


async def test_krs_uses_ai_without_sending_personal_data(
    client: httpx.AsyncClient, db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    me = await plan(db)
    ai = FakeAi({"summary": "Ringkasan AI", "suggestions": ["Saran AI"], "tips": {}})
    ai.install(monkeypatch)
    data = (await client.post(f"{API}/krs/analyze", json={}, headers=auth(me))).json()
    assert (data["source"], data["summary"], data["suggestions"]) == (
        "ai",
        "Ringkasan AI",
        ["Saran AI"],
    )
    sent = json.dumps(ai.sent)
    assert "Rahasia" not in sent and me.email not in sent


@pytest.mark.parametrize(("reply", "status"), [("bukan json", 200), ({"x": 1}, 200), ({}, 500)])
async def test_krs_falls_back_to_rules_when_ai_fails(
    client: httpx.AsyncClient,
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
    reply: Any,
    status: int,
) -> None:
    me = await plan(db)
    FakeAi(reply, status).install(monkeypatch)
    data = (await client.post(f"{API}/krs/analyze", json={}, headers=auth(me))).json()
    assert data["source"] == "rules" and data["total_credits"] == 3
