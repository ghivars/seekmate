from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import NotificationType
from app.models import Notification

# These collapse into one unread notification per lobby instead of one per event.
COALESCED = {NotificationType.new_message, NotificationType.lobby_expiring}


async def notify(
    db: AsyncSession,
    user_id: uuid.UUID,
    kind: NotificationType,
    payload: dict[str, Any],
    now: datetime,
) -> None:
    """Queue a notification. Payloads never contain message text."""
    if kind in COALESCED:
        existing = await db.scalar(
            select(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.type == kind,
                Notification.read_at.is_(None),
                Notification.payload["lobby_id"].astext == payload["lobby_id"],
            )
            .limit(1)
        )
        if existing is not None:
            existing.payload = {**payload, "count": existing.payload.get("count", 1) + 1}
            existing.created_at = now
            return
    db.add(
        Notification(user_id=user_id, type=kind, payload={**payload, "count": 1}, created_at=now)
    )
