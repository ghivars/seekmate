"""Schemas for connections, moderation, notifications and admin."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field

from app.enums import (
    ConnectionStatus,
    NotificationType,
    ReportReason,
    ReportStatus,
    ReportTarget,
    UserStatus,
)
from app.schemas import Orm, PublicUser, text_field
from app.schemas_lobby import UserBrief


class ConnectionIn(BaseModel):
    user_id: uuid.UUID
    origin_course_id: uuid.UUID | None = None


class OriginCourse(Orm):
    id: uuid.UUID
    code: str
    name: str


class ConnectionOut(BaseModel):
    id: uuid.UUID
    user: PublicUser
    status: ConnectionStatus
    direction: Literal["incoming", "outgoing"]
    origin_course: OriginCourse | None
    # Shared only after both people agreed.
    email: str | None
    created_at: datetime
    accepted_at: datetime | None


class BlockIn(BaseModel):
    user_id: uuid.UUID


class ReportIn(BaseModel):
    target_type: ReportTarget
    target_id: uuid.UUID
    reason: ReportReason
    detail: Annotated[str, text_field(0, 250)] = ""


class ReportOut(BaseModel):
    id: uuid.UUID
    reporter: UserBrief
    target_type: ReportTarget
    target_id: uuid.UUID
    target_label: str | None
    # The lobby / user an admin can act on, when it still exists.
    lobby_id: uuid.UUID | None
    user_id: uuid.UUID | None
    user_status: UserStatus | None
    reason: ReportReason
    detail: str
    status: ReportStatus
    reviewed_by: uuid.UUID | None
    created_at: datetime


class ReportPatch(BaseModel):
    status: ReportStatus


class SuspendIn(BaseModel):
    suspended: bool


class NotificationOut(Orm):
    id: uuid.UUID
    type: NotificationType
    payload: dict[str, Any]
    read_at: datetime | None
    created_at: datetime


class NotificationList(BaseModel):
    items: list[NotificationOut]
    unread_count: int


class MarkReadIn(BaseModel):
    ids: list[uuid.UUID] | None = Field(default=None, max_length=100)


class UsabilityIn(BaseModel):
    session_key: Annotated[str, text_field(8, 64)]
    event: Literal["time_to_first_join", "join", "first_message"]
    elapsed_ms: int = Field(ge=0, le=86_400_000)
