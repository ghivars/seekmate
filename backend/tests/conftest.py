from __future__ import annotations

import os

os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+asyncpg://seekmate@127.0.0.1:55432/seekmate_test"
)
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["SCHEDULER_ENABLED"] = "false"
os.environ["ALLOWED_EMAIL_DOMAINS"] = "kampus.ac.id"

from collections.abc import AsyncIterator, Iterator
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from alembic import command
from app.clock import FakeClock, get_clock
from app.db import Base, SessionFactory, engine
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def migrated() -> None:
    """The suite runs against the real migrations, not create_all."""
    config = Config("alembic.ini")
    command.downgrade(config, "base")
    command.upgrade(config, "head")


@pytest.fixture(autouse=True)
async def clean(migrated: None) -> AsyncIterator[None]:
    yield
    tables = ", ".join(t.name for t in Base.metadata.sorted_tables)
    async with engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE {tables} CASCADE"))


@pytest.fixture
async def db() -> AsyncIterator[AsyncSession]:
    async with SessionFactory() as session:
        yield session


@pytest.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


class TestClock(FakeClock):
    def advance_seconds(self, seconds: float) -> None:
        self.advance(timedelta(seconds=seconds))


@pytest.fixture
def clock() -> Iterator[TestClock]:
    """Replaces the application clock for one test."""
    fake = TestClock(datetime.now(UTC))
    app.dependency_overrides[get_clock] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_clock)
