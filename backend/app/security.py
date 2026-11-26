"""Password hashing and signed tokens."""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import Argon2Error

from app.config import get_settings

TokenType = Literal["access", "ws", "verify"]
ALGORITHM = "HS256"
_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (Argon2Error, ValueError):
        return False


# Verified against when the account does not exist, to keep login timing uniform.
DUMMY_HASH = hash_password(secrets.token_hex(8))


def create_token(user_id: uuid.UUID, kind: TokenType, now: datetime) -> str:
    s = get_settings()
    ttl = {
        "access": timedelta(minutes=s.access_token_minutes),
        "ws": timedelta(seconds=s.ws_token_seconds),
        "verify": timedelta(hours=s.verify_token_hours),
    }[kind]
    claims = {"sub": str(user_id), "typ": kind, "iat": now, "exp": now + ttl}
    return jwt.encode(claims, s.secret_key, ALGORITHM)


def decode_token(token: str, kind: TokenType) -> uuid.UUID | None:
    try:
        claims = jwt.decode(
            token,
            get_settings().secret_key,
            algorithms=[ALGORITHM],
            options={"require": ["sub", "exp", "typ"], "verify_iat": False},
        )
        return uuid.UUID(claims["sub"]) if claims["typ"] == kind else None
    except (jwt.PyJWTError, ValueError):
        return None


def new_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
