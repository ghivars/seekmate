"""Daily retention job: expire lobbies at semester end, delete them after the grace period.

Connections are never touched. Run manually with `python -m app.jobs.retention`.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from sqlalchemy import CursorResult, Text, cast, delete, exists, func, select, tuple_, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.clock import Clock, SystemClock
from app.config import get_settings
from app.db import SessionFactory, engine
from app.enums import LobbyStatus, NotificationType
from app.models import Lobby, LobbyMember, Message, Notification, RetentionLog, Semester
from app.realtime import broker
from app.services.lobbies import ACTIVE

log = logging.getLogger("uvicorn.error")
LOCK_KEY = 5_330_001  # arbitrary constant: one retention run at a time across processes


@dataclass
class RetentionResult:
    notified: int = 0
    expired: int = 0
    lobbies_deleted: int = 0
    messages_deleted: int = 0
    expired_ids: list[uuid.UUID] = field(default_factory=list)


async def run_retention(
    clock: Clock,
    sessions: async_sessionmaker[AsyncSession] = SessionFactory,
    lock_engine: AsyncEngine = engine,
) -> RetentionResult | None:
    """Idempotent. Returns None when another process holds the lock."""
    async with lock_engine.connect() as lock:
        if not await lock.scalar(select(func.pg_try_advisory_lock(LOCK_KEY))):
            return None
        try:
            return await _run(clock.now(), sessions)
        finally:
            await lock.execute(select(func.pg_advisory_unlock(LOCK_KEY)))
            await lock.commit()


async def _run(now: datetime, sessions: async_sessionmaker[AsyncSession]) -> RetentionResult:
    result = RetentionResult()
    async with sessions() as db:
        for semester in (await db.scalars(select(Semester))).all():
            notice_from = semester.ends_at - timedelta(days=get_settings().expiring_notice_days)
            if notice_from <= now < semester.ends_at:
                result.notified += await _notify_expiring(db, semester, now)
            if semester.ends_at <= now:
                await _expire(db, semester, result)
            if semester.ends_at + timedelta(days=semester.grace_days) <= now:
                await _purge(db, semester, now, result)
    for lobby_id in result.expired_ids:
        await broker.broadcast(lobby_id, {"type": "lobby_updated"})
    return result


async def _notify_expiring(db: AsyncSession, semester: Semester, now: datetime) -> int:
    already = exists().where(
        Notification.user_id == LobbyMember.user_id,
        Notification.type == NotificationType.lobby_expiring,
        Notification.payload["lobby_id"].astext == cast(Lobby.id, Text),
    )
    rows = (
        await db.execute(
            select(LobbyMember.user_id, Lobby)
            .join(Lobby, Lobby.id == LobbyMember.lobby_id)
            .where(
                Lobby.semester_id == semester.id,
                Lobby.status.in_(ACTIVE),
                LobbyMember.left_at.is_(None),
                ~already,
            )
        )
    ).all()
    for user_id, lobby in rows:
        db.add(
            Notification(
                user_id=user_id,
                type=NotificationType.lobby_expiring,
                payload={
                    "lobby_id": str(lobby.id),
                    "course_id": str(lobby.course_id),
                    "lobby_title": lobby.title,
                    "ends_at": semester.ends_at.isoformat(),
                },
                created_at=now,
            )
        )
    await db.commit()
    return len(rows)


async def _expire(db: AsyncSession, semester: Semester, result: RetentionResult) -> None:
    ids = (
        await db.scalars(
            update(Lobby)
            .where(Lobby.semester_id == semester.id, Lobby.status != LobbyStatus.expired)
            .values(status=LobbyStatus.expired)
            .returning(Lobby.id)
        )
    ).all()
    await db.commit()
    result.expired += len(ids)
    result.expired_ids.extend(ids)


async def _purge(
    db: AsyncSession, semester: Semester, now: datetime, result: RetentionResult
) -> None:
    """Delete messages, then memberships, then lobbies, committing per batch."""
    size = get_settings().retention_batch_size
    semester_id = semester.id
    lobby_ids = select(Lobby.id).where(Lobby.semester_id == semester_id)
    messages = 0
    while True:
        batch = select(Message.id).where(Message.lobby_id.in_(lobby_ids)).limit(size)
        deleted = await _delete(db, delete(Message).where(Message.id.in_(batch)))
        messages += deleted
        if deleted == 0:
            break
    while True:
        key = tuple_(LobbyMember.lobby_id, LobbyMember.user_id)
        members = (
            select(LobbyMember.lobby_id, LobbyMember.user_id)
            .where(LobbyMember.lobby_id.in_(lobby_ids))
            .limit(size)
        )
        if await _delete(db, delete(LobbyMember).where(key.in_(members))) == 0:
            break
    lobbies = 0
    while True:
        ids = (await db.scalars(lobby_ids.limit(size))).all()
        if not ids:
            break
        texts = [str(i) for i in ids]
        await db.execute(
            delete(Notification).where(Notification.payload["lobby_id"].astext.in_(texts))
        )
        lobbies += await _delete(db, delete(Lobby).where(Lobby.id.in_(ids)))
    if lobbies or messages:
        db.add(
            RetentionLog(
                semester_id=semester_id,
                lobbies_deleted=lobbies,
                messages_deleted=messages,
                ran_at=now,
            )
        )
        await db.commit()
    result.lobbies_deleted += lobbies
    result.messages_deleted += messages


async def _delete(db: AsyncSession, statement: object) -> int:
    outcome = await db.execute(
        statement,  # type: ignore[call-overload]
        execution_options={"synchronize_session": False},
    )
    await db.commit()
    return outcome.rowcount if isinstance(outcome, CursorResult) else 0


async def scheduled_run() -> None:
    try:
        result = await run_retention(SystemClock())
        log.info("Retention run: %s", result)
    except Exception:
        log.exception("Retention run failed")


async def main() -> None:
    print(await run_retention(SystemClock()))
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
