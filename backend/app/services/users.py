from __future__ import annotations

import secrets
import uuid
from datetime import datetime

from sqlalchemy import delete, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.enums import UserStatus
from app.models import (
    Connection,
    LobbySlotAlert,
    Notification,
    RefreshToken,
    User,
    UserPlannedCourse,
    UserPreferences,
)
from app.schemas import MeOut
from app.security import hash_password


async def load_me(db: AsyncSession, user_id: uuid.UUID) -> MeOut:
    user = (
        await db.scalars(
            select(User)
            .where(User.id == user_id)
            .options(selectinload(User.preferences))
            .execution_options(populate_existing=True)
        )
    ).one()
    return MeOut.model_validate(user)


async def anonymize(db: AsyncSession, user: User, now: datetime) -> None:
    """Delete personal data but keep the row so other people's chat history stays coherent."""
    user.email = f"deleted-{user.id}@deleted.invalid"
    user.password_hash = hash_password(secrets.token_urlsafe(32))
    user.display_name = "Pengguna dihapus"
    user.major = ""
    user.cohort_year = None
    user.bio = ""
    user.is_newcomer = False
    user.status = UserStatus.deleted
    for model in (UserPreferences, UserPlannedCourse, Notification, LobbySlotAlert):
        await db.execute(delete(model).where(model.user_id == user.id))
    await db.execute(
        delete(Connection).where(
            or_(Connection.user_a_id == user.id, Connection.user_b_id == user.id)
        )
    )
    await db.execute(
        update(RefreshToken).where(RefreshToken.user_id == user.id).values(revoked_at=now)
    )
