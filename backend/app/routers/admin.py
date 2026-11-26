from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select, update

from app.deps import AdminUser, ClockDep, Db, admin_user
from app.enums import LobbyStatus, ReportStatus, ReportTarget, UserRole, UserStatus
from app.errors import forbidden, not_found
from app.models import Lobby, Message, RefreshToken, Report, User
from app.realtime import broker
from app.schemas import Ok
from app.schemas_lobby import UserBrief
from app.schemas_social import ReportOut, ReportPatch, SuspendIn

# The dependency guards every route, so a new endpoint cannot forget the check.
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(admin_user)])


async def _report_out(db: Db, report: Report, reporter: User) -> ReportOut:
    lobby: Lobby | None = None
    person: User | None = None
    label: str | None = None
    if report.target_type == ReportTarget.message:
        message = await db.get(Message, report.target_id)
        if message is not None:
            lobby = await db.get(Lobby, message.lobby_id)
            person = await db.get(User, message.sender_id)
            label = f"Pesan dari {person.display_name}" if person else "Pesan"
    elif report.target_type == ReportTarget.lobby:
        lobby = await db.get(Lobby, report.target_id)
        if lobby is not None:
            person = await db.get(User, lobby.creator_id)
            label = lobby.title
    else:
        person = await db.get(User, report.target_id)
        label = person.display_name if person else None
    return ReportOut(
        id=report.id,
        reporter=UserBrief.model_validate(reporter),
        target_type=report.target_type,
        target_id=report.target_id,
        target_label=label,
        lobby_id=lobby.id if lobby and lobby.status != LobbyStatus.closed else None,
        user_id=person.id if person else None,
        user_status=person.status if person else None,
        reason=report.reason,
        detail=report.detail,
        status=report.status,
        reviewed_by=report.reviewed_by,
        created_at=report.created_at,
    )


@router.get("/reports")
async def list_reports(db: Db, status: ReportStatus | None = None) -> list[ReportOut]:
    query = (
        select(Report, User)
        .join(User, User.id == Report.reporter_id)
        .order_by(Report.created_at.desc())
        .limit(100)
    )
    if status:
        query = query.where(Report.status == status)
    return [await _report_out(db, row[0], row[1]) for row in (await db.execute(query)).all()]


@router.patch("/reports/{report_id}")
async def update_report(
    report_id: uuid.UUID, body: ReportPatch, admin: AdminUser, db: Db
) -> ReportOut:
    report = await db.get(Report, report_id)
    if report is None:
        raise not_found("Laporan tidak ditemukan.")
    report.status = body.status
    report.reviewed_by = admin.id if body.status != ReportStatus.open else None
    await db.commit()
    reporter = await db.get(User, report.reporter_id)
    if reporter is None:
        raise not_found("Pelapor tidak ditemukan.")
    return await _report_out(db, report, reporter)


@router.post("/lobbies/{lobby_id}/deactivate")
async def deactivate_lobby(lobby_id: uuid.UUID, db: Db) -> Ok:
    lobby = await db.get(Lobby, lobby_id, with_for_update=True)
    if lobby is None:
        raise not_found("Lobby tidak ditemukan.")
    if lobby.status != LobbyStatus.expired:
        lobby.status = LobbyStatus.closed
    await db.commit()
    await broker.broadcast(lobby_id, {"type": "lobby_updated"})
    return Ok()


@router.post("/users/{user_id}/suspend")
async def suspend_user(
    user_id: uuid.UUID, body: SuspendIn, admin: AdminUser, db: Db, clock: ClockDep
) -> Ok:
    target = await db.get(User, user_id)
    if target is None or target.status == UserStatus.deleted:
        raise not_found("Pengguna tidak ditemukan.")
    if target.role == UserRole.admin:
        raise forbidden("Akun admin tidak bisa dinonaktifkan dari sini.")
    target.status = UserStatus.suspended if body.suspended else UserStatus.active
    if body.suspended:
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=clock.now())
        )
    await db.commit()
    if body.suspended:
        await broker.kick_user(user_id)
    return Ok()
