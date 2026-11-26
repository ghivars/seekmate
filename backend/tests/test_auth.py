from __future__ import annotations

import re
from collections.abc import Iterator

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.mailer import get_mailer
from app.main import app
from app.models import Connection, User
from app.ratelimit import limiter
from tests.factories import auth, make_user

API = "/api/v1"
CREDS = {"email": "Budi@kampus.ac.id", "password": "kata-sandi-aman", "display_name": "Budi"}


class FakeMailer:
    def __init__(self) -> None:
        self.sent: list[tuple[str, str, str]] = []

    async def send(self, to: str, subject: str, body: str) -> None:
        self.sent.append((to, subject, body))


@pytest.fixture
def mail() -> Iterator[FakeMailer]:
    fake = FakeMailer()
    app.dependency_overrides[get_mailer] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_mailer)


def token_from(mail: FakeMailer) -> str:
    match = re.search(r"token=(\S+)", mail.sent[-1][2])
    assert match
    return match.group(1)


async def test_register_verify_login_preferences(
    client: httpx.AsyncClient, mail: FakeMailer, db: AsyncSession
) -> None:
    assert (await client.post(f"{API}/auth/register", json=CREDS)).status_code == 202
    login = {"email": "budi@kampus.ac.id", "password": CREDS["password"]}
    blocked = await client.post(f"{API}/auth/login", json=login)
    assert (blocked.status_code, blocked.json()["code"]) == (403, "email_not_verified")

    verify = await client.post(f"{API}/auth/verify-email", json={"token": token_from(mail)})
    assert verify.status_code == 200
    res = await client.post(f"{API}/auth/login", json=login)
    assert res.status_code == 200
    cookie = res.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie

    headers = {"Authorization": f"Bearer {res.json()['access_token']}"}
    me = (await client.get(f"{API}/auth/me", headers=headers)).json()
    assert me["preferences"] is None
    prefs = {
        "study_goal": "exam_prep",
        "atmosphere": "chill",
        "preferred_time": "evening",
        "communication_style": "chat_light",
        "language": "id",
    }
    saved = await client.put(f"{API}/users/me/preferences", json=prefs, headers=headers)
    assert saved.json()["preferences"] == prefs
    stored = await db.scalar(select(User.password_hash))
    assert stored and stored.startswith("$argon2")


async def test_session_survives_refresh_and_rotation_detects_theft(
    client: httpx.AsyncClient, db: AsyncSession, clock: object
) -> None:
    user = await make_user(db)
    await client.post(f"{API}/auth/login", json={"email": user.email, "password": "password-uji"})
    first = client.cookies["seekmate_refresh"]
    assert (await client.post(f"{API}/auth/refresh")).status_code == 200
    second = client.cookies["seekmate_refresh"]
    assert first != second
    clock.advance_seconds(60)  # type: ignore[attr-defined]
    client.cookies.clear()
    stolen = await client.post(
        f"{API}/auth/refresh", headers={"Cookie": f"seekmate_refresh={first}"}
    )
    assert stolen.status_code == 401
    victim = await client.post(
        f"{API}/auth/refresh", headers={"Cookie": f"seekmate_refresh={second}"}
    )
    assert victim.status_code == 401  # the whole family is revoked


async def test_parallel_tabs_can_refresh_within_grace(
    client: httpx.AsyncClient, db: AsyncSession
) -> None:
    user = await make_user(db)
    await client.post(f"{API}/auth/login", json={"email": user.email, "password": "password-uji"})
    cookie = {"Cookie": f"seekmate_refresh={client.cookies['seekmate_refresh']}"}
    client.cookies.clear()
    for _ in range(2):
        assert (await client.post(f"{API}/auth/refresh", headers=cookie)).status_code == 200
        client.cookies.clear()


async def test_logout_revokes_session(client: httpx.AsyncClient, db: AsyncSession) -> None:
    user = await make_user(db)
    await client.post(f"{API}/auth/login", json={"email": user.email, "password": "password-uji"})
    cookie = {"Cookie": f"seekmate_refresh={client.cookies['seekmate_refresh']}"}
    await client.post(f"{API}/auth/logout")
    client.cookies.clear()
    assert (await client.post(f"{API}/auth/refresh", headers=cookie)).status_code == 401


async def test_register_rejects_other_domains_and_never_leaks_accounts(
    client: httpx.AsyncClient, mail: FakeMailer, db: AsyncSession
) -> None:
    bad = await client.post(f"{API}/auth/register", json={**CREDS, "email": "a@gmail.com"})
    assert (bad.status_code, bad.json()["code"]) == (422, "email_domain")
    user = await make_user(db)
    again = await client.post(f"{API}/auth/register", json={**CREDS, "email": user.email})
    assert (again.status_code, again.json()) == (202, {"ok": True})
    assert "token=" not in mail.sent[-1][2]


async def test_pending_account_password_cannot_be_replaced(
    client: httpx.AsyncClient, mail: FakeMailer
) -> None:
    await client.post(f"{API}/auth/register", json=CREDS)
    await client.post(f"{API}/auth/register", json={**CREDS, "password": "sandi-penyerang"})
    await client.post(f"{API}/auth/verify-email", json={"token": token_from(mail)})
    body = {"email": CREDS["email"], "password": "sandi-penyerang"}
    assert (await client.post(f"{API}/auth/login", json=body)).status_code == 401


async def test_token_types_are_not_interchangeable(
    client: httpx.AsyncClient, db: AsyncSession
) -> None:
    user = await make_user(db)
    ws = (await client.post(f"{API}/auth/ws-token", headers=auth(user))).json()["token"]
    res = await client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {ws}"})
    assert res.status_code == 401


async def test_login_rate_limit(client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "rate_limit_enabled", True)
    monkeypatch.setattr(get_settings(), "login_rate", "3/60")
    limiter.reset()
    body = {"email": "x@kampus.ac.id", "password": "salah-terus"}
    codes = [(await client.post(f"{API}/auth/login", json=body)).status_code for _ in range(4)]
    assert codes == [401, 401, 401, 429]


async def test_profile_validation_and_banned_words(
    client: httpx.AsyncClient, db: AsyncSession
) -> None:
    user = await make_user(db)
    res = await client.patch(f"{API}/users/me", json={"bio": "x" * 201}, headers=auth(user))
    assert res.status_code == 422
    res = await client.patch(f"{API}/users/me", json={"bio": "dasar G0BLOOOK"}, headers=auth(user))
    assert res.json()["code"] == "banned_words"
    res = await client.patch(
        f"{API}/users/me",
        json={"major": "Fisika", "cohort_year": 2026, "accept_code_of_conduct": True},
        headers=auth(user),
    )
    assert res.json()["major"] == "Fisika" and res.json()["code_of_conduct_at"]


async def test_delete_me_anonymizes(client: httpx.AsyncClient, db: AsyncSession) -> None:
    user, other = await make_user(db), await make_user(db)
    a, b = sorted([user.id, other.id])
    db.add(Connection(user_a_id=a, user_b_id=b, requested_by=user.id, status="accepted"))
    await db.commit()
    assert (await client.delete(f"{API}/users/me", headers=auth(user))).status_code == 200
    assert (await client.get(f"{API}/auth/me", headers=auth(user))).status_code == 401
    await db.refresh(user)
    assert user.display_name == "Pengguna dihapus" and "kampus" not in user.email
    assert await db.scalar(select(Connection.id)) is None


async def test_account_login_limit_ignores_the_ip(
    client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "rate_limit_enabled", True)
    monkeypatch.setattr(get_settings(), "login_email_rate", "3/60")
    limiter.reset()
    ips = iter(["10.0.0.1", "10.0.0.2", "10.0.0.3", "10.0.0.4"])
    monkeypatch.setattr("app.routers.auth.client_ip", lambda _: next(ips))
    body = {"email": "x@kampus.ac.id", "password": "salah-terus"}
    codes = [(await client.post(f"{API}/auth/login", json=body)).status_code for _ in range(4)]
    assert codes == [401, 401, 401, 429]
