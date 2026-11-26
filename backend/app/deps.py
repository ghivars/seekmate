"""Shared FastAPI dependencies."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.clock import Clock, get_clock
from app.db import get_session
from app.enums import UserRole, UserStatus
from app.errors import AppError, forbidden
from app.models import User
from app.security import decode_token

Db = Annotated[AsyncSession, Depends(get_session)]
ClockDep = Annotated[Clock, Depends(get_clock)]
_bearer = HTTPBearer(auto_error=False)


def unauthorized() -> AppError:
    return AppError(401, "unauthorized", "Sesi berakhir. Silakan masuk lagi.")


def ensure_usable(user: User) -> None:
    if user.status == UserStatus.suspended:
        raise AppError(403, "suspended", "Akunmu sedang dinonaktifkan oleh admin.")
    if user.email_verified_at is None:
        raise AppError(403, "email_not_verified", "Verifikasi email kampusmu dulu, ya.")


async def current_user(
    db: Db, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]
) -> User:
    user_id = decode_token(credentials.credentials, "access") if credentials else None
    user = await db.get(User, user_id) if user_id else None
    if user is None or user.status == UserStatus.deleted:
        raise unauthorized()
    ensure_usable(user)
    return user


CurrentUser = Annotated[User, Depends(current_user)]


async def admin_user(user: CurrentUser) -> User:
    if user.role != UserRole.admin:
        raise forbidden("Halaman ini khusus admin.")
    return user


AdminUser = Annotated[User, Depends(admin_user)]


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"
