from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import aliased

from app.config import get_settings
from app.deps import ClockDep, CurrentUser, Db
from app.enums import ConnectionStatus, NotificationType, UserStatus
from app.errors import conflict, forbidden, invalid, not_found
from app.models import Connection, Course, LobbyMember, User
from app.ratelimit import limiter
from app.schemas import Ok, PublicUser
from app.schemas_social import ConnectionIn, ConnectionOut, OriginCourse
from app.services.blocks import blocked_ids, is_blocked
from app.services.notifications import notify

router = APIRouter(prefix="/connections", tags=["connections"])


def _pair(a: uuid.UUID, b: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
    return (a, b) if a < b else (b, a)


async def _shared_a_lobby(db: Db, a: uuid.UUID, b: uuid.UUID) -> bool:
    other = aliased(LobbyMember)
    query = (
        select(LobbyMember.lobby_id)
        .join(other, other.lobby_id == LobbyMember.lobby_id)
        .where(LobbyMember.user_id == a, other.user_id == b)
        .limit(1)
    )
    return await db.scalar(query) is not None


@router.get("")
async def list_connections(user: CurrentUser, db: Db) -> list[ConnectionOut]:
    other = aliased(User)
    rows = (
        await db.execute(
            select(Connection, other, Course)
            .join(
                other,
                or_(
                    (Connection.user_a_id == user.id) & (other.id == Connection.user_b_id),
                    (Connection.user_b_id == user.id) & (other.id == Connection.user_a_id),
                ),
            )
            .outerjoin(Course, Course.id == Connection.origin_course_id)
            .where(other.id.not_in(await blocked_ids(db, user.id)))
            .order_by(Connection.created_at.desc())
        )
    ).all()
    result = []
    for connection, person, course in rows:
        outgoing = connection.requested_by == user.id
        status = connection.status
        if status == ConnectionStatus.declined:
            if not outgoing:
                continue
            status = ConnectionStatus.pending  # a decline is never revealed to the requester
        accepted = status == ConnectionStatus.accepted
        result.append(
            ConnectionOut(
                id=connection.id,
                user=PublicUser.model_validate(person),
                status=status,
                direction="outgoing" if outgoing else "incoming",
                origin_course=OriginCourse.model_validate(course) if course else None,
                email=person.email if accepted and person.status == UserStatus.active else None,
                created_at=connection.created_at,
                accepted_at=connection.accepted_at,
            )
        )
    return result


@router.post("", status_code=201)
async def request_connection(body: ConnectionIn, user: CurrentUser, db: Db, clock: ClockDep) -> Ok:
    limiter.check(f"connection:{user.id}", get_settings().generic_write_rate)
    if body.user_id == user.id:
        raise invalid("self_connection", "Kamu tidak bisa terhubung dengan diri sendiri.")
    target = await db.get(User, body.user_id)
    if (
        target is None
        or target.status != UserStatus.active
        or await is_blocked(db, user.id, body.user_id)
    ):
        raise not_found("Pengguna tidak ditemukan.")
    if not await _shared_a_lobby(db, user.id, target.id):
        raise forbidden("Kamu bisa mengajukan koneksi ke teman satu lobby.")
    now = clock.now()
    a, b = _pair(user.id, target.id)
    existing = await db.scalar(
        select(Connection)
        .where(Connection.user_a_id == a, Connection.user_b_id == b)
        .with_for_update()
    )
    if existing is not None:
        if existing.status == ConnectionStatus.accepted:
            raise conflict("already_connected", "Kalian sudah terhubung.")
        if existing.requested_by == user.id:
            raise conflict("already_requested", "Permintaanmu sudah terkirim.")
        # The other side already asked (or was declined by us): this means yes.
        await _accept(db, existing, user, now)
        await db.commit()
        return Ok()
    course = await db.get(Course, body.origin_course_id) if body.origin_course_id else None
    connection = Connection(
        user_a_id=a,
        user_b_id=b,
        requested_by=user.id,
        origin_course_id=course.id if course else None,
        created_at=now,
    )
    db.add(connection)
    try:
        await db.flush()
    except IntegrityError as error:
        raise conflict("already_requested", "Permintaan koneksi sudah ada.") from error
    await notify(
        db,
        target.id,
        NotificationType.connection_request,
        {"connection_id": str(connection.id), "user_name": user.display_name, "state": "pending"},
        now,
    )
    await db.commit()
    return Ok()


async def _accept(db: Db, connection: Connection, user: User, now: datetime) -> None:
    connection.status = ConnectionStatus.accepted
    connection.accepted_at = now
    await notify(
        db,
        connection.requested_by,
        NotificationType.connection_request,
        {"connection_id": str(connection.id), "user_name": user.display_name, "state": "accepted"},
        now,
    )


async def _incoming(connection_id: uuid.UUID, user: User, db: Db) -> Connection:
    """A pending request addressed to this user."""
    connection = await db.scalar(
        select(Connection).where(Connection.id == connection_id).with_for_update()
    )
    if (
        connection is None
        or user.id not in (connection.user_a_id, connection.user_b_id)
        or connection.requested_by == user.id
        or connection.status != ConnectionStatus.pending
        or await is_blocked(db, connection.user_a_id, connection.user_b_id)
    ):
        raise not_found("Permintaan koneksi tidak ditemukan.")
    return connection


@router.post("/{connection_id}/accept")
async def accept_connection(
    connection_id: uuid.UUID, user: CurrentUser, db: Db, clock: ClockDep
) -> Ok:
    await _accept(db, await _incoming(connection_id, user, db), user, clock.now())
    await db.commit()
    return Ok()


@router.post("/{connection_id}/decline")
async def decline_connection(connection_id: uuid.UUID, user: CurrentUser, db: Db) -> Ok:
    connection = await _incoming(connection_id, user, db)
    connection.status = ConnectionStatus.declined
    await db.commit()
    return Ok()


@router.delete("/{connection_id}")
async def delete_connection(connection_id: uuid.UUID, user: CurrentUser, db: Db) -> Ok:
    connection = await db.get(Connection, connection_id)
    if (
        connection is None
        or user.id not in (connection.user_a_id, connection.user_b_id)
        or connection.status != ConnectionStatus.accepted
    ):
        raise not_found("Koneksi tidak ditemukan.")
    await db.delete(connection)
    await db.commit()
    return Ok()
