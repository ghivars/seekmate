"""Schemas for courses, lobbies and messages."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

from app.enums import (
    Atmosphere,
    LobbyStatus,
    LobbyVisibility,
    MemberRole,
    PreferredTime,
    StudyGoal,
)
from app.match import MatchOut
from app.schemas import Orm, PublicUser, text_field

Title = Annotated[str, text_field(3, 80)]
Description = Annotated[str, text_field(0, 500)]
Body = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]


class UserBrief(Orm):
    id: uuid.UUID
    display_name: str


class SemesterOut(Orm):
    id: uuid.UUID
    name: str
    starts_at: datetime
    ends_at: datetime
    grace_days: int


class CourseOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    faculty_or_dept: str
    credits: int
    is_sample: bool
    is_planned: bool
    lobby_count: int
    unread_count: int


class LobbyCreate(BaseModel):
    title: Title
    description: Description = ""
    study_goal: StudyGoal
    atmosphere: Atmosphere
    preferred_time: PreferredTime
    capacity: int = Field(ge=2, le=15)


class LobbyPatch(BaseModel):
    title: Title | None = None
    description: Description | None = None
    study_goal: StudyGoal | None = None
    atmosphere: Atmosphere | None = None
    preferred_time: PreferredTime | None = None
    capacity: int | None = Field(default=None, ge=2, le=15)
    visibility: LobbyVisibility | None = None


class LobbyOut(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    course_code: str
    course_name: str
    title: str
    description: str
    study_goal: StudyGoal
    atmosphere: Atmosphere
    preferred_time: PreferredTime
    capacity: int
    member_count: int
    visibility: LobbyVisibility
    status: LobbyStatus
    created_at: datetime
    expires_at: datetime
    creator: UserBrief
    members_preview: list[UserBrief]
    is_member: bool
    my_role: MemberRole | None
    unread_count: int
    last_read_at: datetime | None
    has_slot_alert: bool
    match: MatchOut | None


ConnectionState = Literal["none", "pending_out", "pending_in", "accepted"]


class MemberOut(BaseModel):
    user: PublicUser
    role: MemberRole
    online: bool
    connection: ConnectionState
    joined_at: datetime


class JoinIn(BaseModel):
    intro: Annotated[str, text_field(0, 1000)] = ""


class MessageOut(BaseModel):
    id: uuid.UUID
    lobby_id: uuid.UUID
    sender: UserBrief
    body: str
    is_intro: bool
    client_id: uuid.UUID | None
    created_at: datetime
    edited_at: datetime | None
    deleted: bool


class MessagePage(BaseModel):
    items: list[MessageOut]
    next_cursor: str | None


class MessageEdit(BaseModel):
    body: Body
