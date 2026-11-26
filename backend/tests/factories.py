from __future__ import annotations

import itertools
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Course, Lobby, LobbyMember, Message, Semester, User, UserPreferences
from app.security import create_token, hash_password

_counter = itertools.count(1)
PASSWORD_HASH = hash_password("password-uji")


async def make_user(db: AsyncSession, prefs: bool = False, **kw: Any) -> User:
    n = next(_counter)
    user = User(
        email=f"user{n}@kampus.ac.id",
        password_hash=PASSWORD_HASH,
        display_name=kw.pop("display_name", f"User {n}"),
        email_verified_at=datetime.now(UTC),
        **kw,
    )
    if prefs:
        user.preferences = UserPreferences(
            study_goal="exam_prep",
            atmosphere="chill",
            preferred_time="evening",
            communication_style="chat_active",
            language="id",
        )
    db.add(user)
    await db.commit()
    return user


def auth(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_token(user.id, 'access', datetime.now(UTC))}"}


async def make_semester(db: AsyncSession, **kw: Any) -> Semester:
    existing = await db.scalar(select(Semester).where(Semester.is_active))
    if existing is not None:
        return existing
    now = datetime.now(UTC)
    semester = Semester(
        name="Uji",
        starts_at=kw.get("starts_at", now - timedelta(days=10)),
        ends_at=kw.get("ends_at", now + timedelta(days=100)),
        is_active=True,
    )
    db.add(semester)
    await db.commit()
    return semester


async def make_course(db: AsyncSession, **kw: Any) -> Course:
    await make_semester(db)
    n = next(_counter)
    course = Course(code=f"UJI{n}", name=f"Mata Kuliah {n}", credits=3, is_sample=True, **kw)
    db.add(course)
    await db.commit()
    return course


async def make_lobby(
    db: AsyncSession, owner: User, course: Course | None = None, **kw: Any
) -> Lobby:
    semester = await make_semester(db)
    course = course or await make_course(db)
    now = datetime.now(UTC)
    values: dict[str, Any] = {
        "title": f"Lobby {next(_counter)}",
        "study_goal": "exam_prep",
        "atmosphere": "chill",
        "preferred_time": "evening",
        "capacity": 5,
        "created_at": now - timedelta(hours=1),
        "expires_at": semester.ends_at,
        "semester_id": semester.id,
    }
    lobby = Lobby(course_id=course.id, creator_id=owner.id, **(values | kw))
    db.add(lobby)
    await db.flush()
    db.add(LobbyMember(lobby_id=lobby.id, user_id=owner.id, role="owner", joined_at=now))
    await db.commit()
    return lobby


async def add_member(db: AsyncSession, lobby: Lobby, user: User, minutes: float = 0) -> LobbyMember:
    joined = datetime.now(UTC) + timedelta(minutes=minutes)
    member = LobbyMember(lobby_id=lobby.id, user_id=user.id, joined_at=joined)
    db.add(member)
    await db.commit()
    return member


async def add_message(
    db: AsyncSession, lobby: Lobby, sender: User, body: str, minutes: float = 0
) -> Message:
    message = Message(
        lobby_id=lobby.id,
        sender_id=sender.id,
        body=body,
        created_at=datetime.now(UTC) + timedelta(minutes=minutes),
    )
    db.add(message)
    await db.commit()
    return message
