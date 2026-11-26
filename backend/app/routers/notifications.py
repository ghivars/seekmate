from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import func, select, update

from app.deps import ClockDep, CurrentUser, Db
from app.models import Notification
from app.schemas import Ok
from app.schemas_social import MarkReadIn, NotificationList, NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(user: CurrentUser, db: Db) -> NotificationList:
    query = (
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    unread = select(func.count()).where(
        Notification.user_id == user.id, Notification.read_at.is_(None)
    )
    return NotificationList(
        items=[NotificationOut.model_validate(n) for n in await db.scalars(query)],
        unread_count=await db.scalar(unread) or 0,
    )


@router.post("/read")
async def mark_notifications_read(
    body: MarkReadIn, user: CurrentUser, db: Db, clock: ClockDep
) -> Ok:
    """Mark the given notifications as read; all of them when `ids` is omitted."""
    query = update(Notification).where(
        Notification.user_id == user.id, Notification.read_at.is_(None)
    )
    if body.ids is not None:
        query = query.where(Notification.id.in_(body.ids))
    await db.execute(query.values(read_at=clock.now()))
    await db.commit()
    return Ok()
