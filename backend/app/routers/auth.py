from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Request, Response
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.deps import ClockDep, CurrentUser, Db, client_ip, ensure_usable, unauthorized
from app.enums import UserStatus
from app.errors import AppError, invalid
from app.mailer import Mailer, get_mailer
from app.models import RefreshToken, User
from app.moderation import ensure_clean
from app.ratelimit import limiter
from app.schemas import EmailIn, LoginIn, MeOut, Ok, RegisterIn, TokenOut, VerifyIn, WsTokenOut
from app.security import (
    DUMMY_HASH,
    create_token,
    decode_token,
    hash_password,
    hash_token,
    new_refresh_token,
    verify_password,
)
from app.services.users import load_me

router = APIRouter(prefix="/auth", tags=["auth"])
COOKIE = "seekmate_refresh"
COOKIE_PATH = "/api/v1/auth"
# Two tabs may refresh at the same instant; only later reuse is treated as theft.
REUSE_GRACE = timedelta(seconds=10)
MailerDep = Annotated[Mailer, Depends(get_mailer)]
RefreshCookie = Annotated[str | None, Cookie(alias=COOKIE)]


def _set_cookie(response: Response, token: str) -> None:
    s = get_settings()
    response.set_cookie(
        COOKIE,
        token,
        max_age=s.refresh_token_days * 86400,
        path=COOKIE_PATH,
        httponly=True,
        secure=s.cookie_secure,
        samesite="lax",
    )


def _token_out(user_id: uuid.UUID, now: datetime) -> TokenOut:
    return TokenOut(
        access_token=create_token(user_id, "access", now),
        expires_in=get_settings().access_token_minutes * 60,
    )


def _issue_refresh(
    db: AsyncSession, user_id: uuid.UUID, now: datetime, family: uuid.UUID | None = None
) -> str:
    token = new_refresh_token()
    db.add(
        RefreshToken(
            user_id=user_id,
            family_id=family or uuid.uuid4(),
            token_hash=hash_token(token),
            expires_at=now + timedelta(days=get_settings().refresh_token_days),
            created_at=now,
        )
    )
    return token


async def _send_verification(mailer: Mailer, user: User, now: datetime) -> None:
    token = create_token(user.id, "verify", now)
    link = f"{get_settings().frontend_url}/verifikasi?token={token}"
    await mailer.send(
        user.email,
        "Verifikasi email SeekMate",
        f"Halo {user.display_name},\n\nKlik tautan ini untuk mengaktifkan akunmu:\n{link}",
    )


@router.post("/register", status_code=202)
async def register(
    body: RegisterIn, request: Request, db: Db, clock: ClockDep, mailer: MailerDep
) -> Ok:
    """Always 202: the response never reveals whether an address is registered."""
    s = get_settings()
    limiter.check(f"register:{client_ip(request)}", s.register_rate)
    email = body.email.lower()
    if email.rsplit("@", 1)[1] not in s.email_domains:
        raise invalid("email_domain", "Gunakan email kampusmu yang terdaftar, ya.")
    ensure_clean(body.display_name)
    password_hash = hash_password(body.password)
    existing = await db.scalar(select(User).where(User.email == email))
    if existing is None:
        user = User(email=email, password_hash=password_hash, display_name=body.display_name)
        db.add(user)
        try:
            await db.commit()
        except IntegrityError:  # concurrent registration of the same address
            await db.rollback()
            return Ok()
        await _send_verification(mailer, user, clock.now())
    elif existing.email_verified_at is None:
        # Never overwrite the stored password: that would let someone who does not own the
        # mailbox choose the password of a pending account.
        await _send_verification(mailer, existing, clock.now())
    else:
        await mailer.send(
            email,
            "Kamu sudah punya akun SeekMate",
            f"Emailmu sudah terdaftar. Masuk di {s.frontend_url}/masuk",
        )
    return Ok()


@router.post("/resend-verification", status_code=202)
async def resend_verification(
    body: EmailIn, request: Request, db: Db, clock: ClockDep, mailer: MailerDep
) -> Ok:
    limiter.check(f"resend:{client_ip(request)}", get_settings().register_rate)
    user = await db.scalar(select(User).where(User.email == body.email.lower()))
    if user is not None and user.email_verified_at is None and user.status == UserStatus.active:
        await _send_verification(mailer, user, clock.now())
    return Ok()


@router.post("/verify-email")
async def verify_email(body: VerifyIn, db: Db, clock: ClockDep) -> Ok:
    user_id = decode_token(body.token, "verify")
    user = await db.get(User, user_id) if user_id else None
    if user is None or user.status != UserStatus.active:
        raise invalid("bad_token", "Tautan verifikasi tidak valid atau sudah kedaluwarsa.")
    if user.email_verified_at is None:
        user.email_verified_at = clock.now()
        await db.commit()
    return Ok()


@router.post("/login")
async def login(
    body: LoginIn, request: Request, response: Response, db: Db, clock: ClockDep
) -> TokenOut:
    email = body.email.lower()
    limiter.check(f"login:{client_ip(request)}:{email}", get_settings().login_rate)
    limiter.check(f"login-account:{email}", get_settings().login_email_rate)
    user = await db.scalar(select(User).where(User.email == email))
    ok = verify_password(body.password, user.password_hash if user else DUMMY_HASH)
    if user is None or not ok or user.status == UserStatus.deleted:
        raise AppError(401, "bad_credentials", "Email atau kata sandi salah.")
    ensure_usable(user)
    now = clock.now()
    _set_cookie(response, _issue_refresh(db, user.id, now))
    await db.commit()
    return _token_out(user.id, now)


async def _family_alive(db: AsyncSession, family: uuid.UUID) -> bool:
    query = select(RefreshToken.id).where(
        RefreshToken.family_id == family, RefreshToken.revoked_at.is_(None)
    )
    return await db.scalar(query.limit(1)) is not None


async def _revoke_family(db: AsyncSession, family: uuid.UUID, now: datetime) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )


@router.post("/refresh")
async def refresh(
    response: Response, db: Db, clock: ClockDep, cookie: RefreshCookie = None
) -> TokenOut:
    now = clock.now()
    if not cookie:
        raise unauthorized()
    row = await db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(cookie)).with_for_update()
    )
    if row is None or row.expires_at <= now:
        raise unauthorized()
    if row.revoked_at is not None and now - row.revoked_at > REUSE_GRACE:
        await _revoke_family(db, row.family_id, now)
        await db.commit()
        raise unauthorized()
    user = await db.get(User, row.user_id)
    if user is None or user.status != UserStatus.active:
        raise unauthorized()
    if row.revoked_at is None:
        row.revoked_at = now
    elif not await _family_alive(db, row.family_id):
        # Inside the grace window, but the family was revoked by logout: no resurrection.
        raise unauthorized()
    _set_cookie(response, _issue_refresh(db, user.id, now, row.family_id))
    await db.commit()
    return _token_out(user.id, now)


@router.post("/logout")
async def logout(response: Response, db: Db, clock: ClockDep, cookie: RefreshCookie = None) -> Ok:
    if cookie:
        row = await db.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == hash_token(cookie))
        )
        if row is not None:
            await _revoke_family(db, row.family_id, clock.now())
            await db.commit()
    response.delete_cookie(COOKIE, path=COOKIE_PATH)
    return Ok()


@router.get("/me")
async def get_me(user: CurrentUser, db: Db) -> MeOut:
    return await load_me(db, user.id)


@router.post("/ws-token")
async def create_ws_token(user: CurrentUser, clock: ClockDep) -> WsTokenOut:
    """Short-lived token for the WebSocket query string (keeps access tokens out of logs)."""
    return WsTokenOut(
        token=create_token(user.id, "ws", clock.now()),
        expires_in=get_settings().ws_token_seconds,
    )
