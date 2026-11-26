from __future__ import annotations

import uuid

from sqlalchemy import ColumnElement, CompoundSelect, and_, exists, or_, select, union
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import MemberRole
from app.models import Block, Lobby, LobbyMember


def blocked_select(user_id: uuid.UUID) -> CompoundSelect[tuple[uuid.UUID]]:
    """Ids hidden from `user_id`, in both directions."""
    return union(
        select(Block.blocked_id).where(Block.blocker_id == user_id),
        select(Block.blocker_id).where(Block.blocked_id == user_id),
    )


async def blocked_ids(db: AsyncSession, user_id: uuid.UUID) -> set[uuid.UUID]:
    return set((await db.scalars(blocked_select(user_id))).all())


async def is_blocked(db: AsyncSession, a: uuid.UUID, b: uuid.UUID) -> bool:
    query = select(Block.blocker_id).where(
        or_(
            and_(Block.blocker_id == a, Block.blocked_id == b),
            and_(Block.blocker_id == b, Block.blocked_id == a),
        )
    )
    return await db.scalar(query.limit(1)) is not None


def lobby_visible_to(user_id: uuid.UUID) -> ColumnElement[bool]:
    """Hide lobbies created or currently owned by someone in a block relation."""
    blocked = blocked_select(user_id).subquery()
    owned = exists().where(
        LobbyMember.lobby_id == Lobby.id,
        LobbyMember.role == MemberRole.owner,
        LobbyMember.left_at.is_(None),
        LobbyMember.user_id.in_(select(blocked.c[0])),
    )
    return and_(Lobby.creator_id.not_in(select(blocked.c[0])), ~owned)
