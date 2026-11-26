from __future__ import annotations

from datetime import UTC, datetime

import httpx
import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models import Course, Lobby, Message, User
from app.seed import seed


async def test_health(client: httpx.AsyncClient) -> None:
    res = await client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "database": "ok"}


async def test_seed_is_idempotent_and_labelled(db: AsyncSession) -> None:
    now = datetime.now(UTC)
    await seed(db, now)
    first = await db.scalar(select(func.count(Message.id)))
    await seed(db, now)
    assert await db.scalar(select(func.count(Message.id))) == first
    assert await db.scalar(select(func.count(Course.id)).where(~Course.is_sample)) == 0
    names = (await db.scalars(select(User.display_name))).all()
    titles = (await db.scalars(select(Lobby.title))).all()
    assert names and all("(demo)" in n for n in names)
    assert titles and all(t.startswith("Demo") for t in titles)


async def test_capacity_check_constraint(db: AsyncSession) -> None:
    await seed(db, datetime.now(UTC))
    lobby = (await db.scalars(select(Lobby).limit(1))).one()
    lobby.capacity = 16
    with pytest.raises(IntegrityError):
        await db.flush()
    await db.rollback()


def test_production_requires_real_secret() -> None:
    with pytest.raises(ValueError, match="SECRET_KEY"):
        Settings(environment="production", cookie_secure=True)
