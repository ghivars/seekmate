"""Database models. Keep in sync with alembic/versions."""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app import enums
from app.db import Base


def enum_col(enum: type[StrEnum]) -> Enum:
    """VARCHAR + CHECK constraint (easier to migrate than native PG enums)."""
    return Enum(
        enum,
        native_enum=False,
        length=24,
        create_constraint=True,
        name=f"{enum.__name__.lower()}_valid",
        values_callable=lambda e: [m.value for m in e],
    )


def pk() -> Any:
    return mapped_column(
        primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )


def fk(target: str, ondelete: str = "CASCADE", **kw: Any) -> Any:
    return mapped_column(ForeignKey(target, ondelete=ondelete), **kw)


def created() -> Any:
    return mapped_column(DateTime(timezone=True), server_default=func.now())


def ts(**kw: Any) -> Any:
    return mapped_column(DateTime(timezone=True), **kw)


def flag() -> Any:
    return mapped_column(Boolean, default=False, server_default=text("false"))


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = pk()
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(40))
    major: Mapped[str] = mapped_column(String(80), default="", server_default="")
    cohort_year: Mapped[int | None] = mapped_column(SmallInteger)
    bio: Mapped[str] = mapped_column(String(200), default="", server_default="")
    is_newcomer: Mapped[bool] = flag()
    role: Mapped[enums.UserRole] = mapped_column(
        enum_col(enums.UserRole), default=enums.UserRole.student, server_default="student"
    )
    status: Mapped[enums.UserStatus] = mapped_column(
        enum_col(enums.UserStatus), default=enums.UserStatus.active, server_default="active"
    )
    email_verified_at: Mapped[datetime | None] = ts()
    # Additions to the spec: needed by the onboarding flow.
    code_of_conduct_at: Mapped[datetime | None] = ts()
    onboarded_at: Mapped[datetime | None] = ts()
    created_at: Mapped[datetime] = created()

    preferences: Mapped[UserPreferences | None] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )


class UserPreferences(Base):
    __tablename__ = "user_preferences"

    user_id: Mapped[uuid.UUID] = fk("users.id", primary_key=True)
    study_goal: Mapped[enums.StudyGoal] = mapped_column(enum_col(enums.StudyGoal))
    atmosphere: Mapped[enums.Atmosphere] = mapped_column(enum_col(enums.Atmosphere))
    preferred_time: Mapped[enums.PreferredTime] = mapped_column(enum_col(enums.PreferredTime))
    communication_style: Mapped[enums.CommunicationStyle] = mapped_column(
        enum_col(enums.CommunicationStyle)
    )
    language: Mapped[enums.Language] = mapped_column(enum_col(enums.Language))
    updated_at: Mapped[datetime] = ts(server_default=func.now(), onupdate=func.now())

    user: Mapped[User] = relationship(back_populates="preferences")


class RefreshToken(Base):
    """Support table: rotating refresh tokens, stored hashed."""

    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = pk()
    user_id: Mapped[uuid.UUID] = fk("users.id", index=True)
    family_id: Mapped[uuid.UUID] = mapped_column(index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = ts()
    revoked_at: Mapped[datetime | None] = ts()
    created_at: Mapped[datetime] = created()


class Semester(Base):
    __tablename__ = "semesters"
    __table_args__ = (
        Index("uq_semesters_one_active", "is_active", unique=True, postgresql_where="is_active"),
        CheckConstraint("ends_at > starts_at", name="dates"),
    )

    id: Mapped[uuid.UUID] = pk()
    name: Mapped[str] = mapped_column(String(80))
    starts_at: Mapped[datetime] = ts()
    ends_at: Mapped[datetime] = ts()
    grace_days: Mapped[int] = mapped_column(Integer, default=14, server_default="14")
    is_active: Mapped[bool] = flag()


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[uuid.UUID] = pk()
    code: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    faculty_or_dept: Mapped[str] = mapped_column(String(120), default="")
    credits: Mapped[int] = mapped_column(SmallInteger, default=3)
    is_sample: Mapped[bool] = flag()


class UserPlannedCourse(Base):
    __tablename__ = "user_planned_courses"

    user_id: Mapped[uuid.UUID] = fk("users.id", primary_key=True)
    course_id: Mapped[uuid.UUID] = fk("courses.id", primary_key=True)
    semester_id: Mapped[uuid.UUID] = fk("semesters.id", primary_key=True)
    created_at: Mapped[datetime] = created()


class Lobby(Base):
    __tablename__ = "lobbies"
    __table_args__ = (
        CheckConstraint("capacity BETWEEN 2 AND 15", name="capacity_range"),
        Index("ix_lobbies_course_semester_status", "course_id", "semester_id", "status"),
        Index("ix_lobbies_semester_status", "semester_id", "status"),
    )

    id: Mapped[uuid.UUID] = pk()
    course_id: Mapped[uuid.UUID] = fk("courses.id", ondelete="RESTRICT")
    semester_id: Mapped[uuid.UUID] = fk("semesters.id", ondelete="RESTRICT")
    creator_id: Mapped[uuid.UUID] = fk("users.id", ondelete="RESTRICT", index=True)
    title: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(String(500), default="", server_default="")
    study_goal: Mapped[enums.StudyGoal] = mapped_column(enum_col(enums.StudyGoal))
    atmosphere: Mapped[enums.Atmosphere] = mapped_column(enum_col(enums.Atmosphere))
    preferred_time: Mapped[enums.PreferredTime] = mapped_column(enum_col(enums.PreferredTime))
    capacity: Mapped[int] = mapped_column(SmallInteger)
    visibility: Mapped[enums.LobbyVisibility] = mapped_column(
        enum_col(enums.LobbyVisibility),
        default=enums.LobbyVisibility.public,
        server_default="public",
    )
    status: Mapped[enums.LobbyStatus] = mapped_column(
        enum_col(enums.LobbyStatus), default=enums.LobbyStatus.open, server_default="open"
    )
    created_at: Mapped[datetime] = created()
    expires_at: Mapped[datetime] = ts()

    course: Mapped[Course] = relationship()
    semester: Mapped[Semester] = relationship()
    creator: Mapped[User] = relationship()


class LobbyMember(Base):
    __tablename__ = "lobby_members"
    __table_args__ = (Index("ix_lobby_members_user_id", "user_id"),)

    lobby_id: Mapped[uuid.UUID] = fk("lobbies.id", primary_key=True)
    user_id: Mapped[uuid.UUID] = fk("users.id", primary_key=True)
    role: Mapped[enums.MemberRole] = mapped_column(
        enum_col(enums.MemberRole), default=enums.MemberRole.member, server_default="member"
    )
    joined_at: Mapped[datetime] = created()
    left_at: Mapped[datetime | None] = ts()
    last_read_at: Mapped[datetime | None] = ts()  # addition: unread markers
    removed_by_owner: Mapped[bool] = flag()  # addition: removed members cannot rejoin

    user: Mapped[User] = relationship()


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        Index("ix_messages_lobby_id_created_at", "lobby_id", "created_at"),
        # Makes client retries idempotent.
        UniqueConstraint("lobby_id", "sender_id", "client_id", name="uq_messages_client"),
    )

    id: Mapped[uuid.UUID] = pk()
    lobby_id: Mapped[uuid.UUID] = fk("lobbies.id")
    sender_id: Mapped[uuid.UUID] = fk("users.id", ondelete="RESTRICT")
    body: Mapped[str] = mapped_column(String(1000))
    is_intro: Mapped[bool] = flag()
    client_id: Mapped[uuid.UUID | None] = mapped_column()
    created_at: Mapped[datetime] = ts(server_default=func.clock_timestamp())
    edited_at: Mapped[datetime | None] = ts()
    deleted_at: Mapped[datetime | None] = ts()

    sender: Mapped[User] = relationship()


class LobbySlotAlert(Base):
    """Support table: users who asked to be told when a full lobby frees a slot."""

    __tablename__ = "lobby_slot_alerts"

    lobby_id: Mapped[uuid.UUID] = fk("lobbies.id", primary_key=True)
    user_id: Mapped[uuid.UUID] = fk("users.id", primary_key=True)
    created_at: Mapped[datetime] = created()


class Connection(Base):
    """Saved contact. Intentionally has no reference to lobbies (survives retention)."""

    __tablename__ = "connections"
    __table_args__ = (
        UniqueConstraint("user_a_id", "user_b_id", name="uq_connections_pair"),
        CheckConstraint("user_a_id < user_b_id", name="ordered_pair"),
        Index("ix_connections_user_b_id", "user_b_id"),
    )

    id: Mapped[uuid.UUID] = pk()
    user_a_id: Mapped[uuid.UUID] = fk("users.id")
    user_b_id: Mapped[uuid.UUID] = fk("users.id")
    origin_course_id: Mapped[uuid.UUID | None] = fk("courses.id", ondelete="SET NULL")
    status: Mapped[enums.ConnectionStatus] = mapped_column(
        enum_col(enums.ConnectionStatus),
        default=enums.ConnectionStatus.pending,
        server_default="pending",
    )
    requested_by: Mapped[uuid.UUID] = fk("users.id")
    created_at: Mapped[datetime] = created()
    accepted_at: Mapped[datetime | None] = ts()


class Report(Base):
    __tablename__ = "reports"
    __table_args__ = (Index("ix_reports_status_created_at", "status", "created_at"),)

    id: Mapped[uuid.UUID] = pk()
    reporter_id: Mapped[uuid.UUID] = fk("users.id")
    target_type: Mapped[enums.ReportTarget] = mapped_column(enum_col(enums.ReportTarget))
    target_id: Mapped[uuid.UUID] = mapped_column()  # no FK: retention may delete the target
    reason: Mapped[enums.ReportReason] = mapped_column(enum_col(enums.ReportReason))
    detail: Mapped[str] = mapped_column(String(500), default="", server_default="")
    status: Mapped[enums.ReportStatus] = mapped_column(
        enum_col(enums.ReportStatus), default=enums.ReportStatus.open, server_default="open"
    )
    reviewed_by: Mapped[uuid.UUID | None] = fk("users.id", ondelete="SET NULL")
    created_at: Mapped[datetime] = created()


class Block(Base):
    __tablename__ = "blocks"
    __table_args__ = (
        CheckConstraint("blocker_id <> blocked_id", name="not_self"),
        Index("ix_blocks_blocked_id", "blocked_id"),
    )

    blocker_id: Mapped[uuid.UUID] = fk("users.id", primary_key=True)
    blocked_id: Mapped[uuid.UUID] = fk("users.id", primary_key=True)
    created_at: Mapped[datetime] = created()


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user_id_created_at", "user_id", "created_at"),
        Index("ix_notifications_lobby", text("(payload->>'lobby_id')")),
    )

    id: Mapped[uuid.UUID] = pk()
    user_id: Mapped[uuid.UUID] = fk("users.id")
    type: Mapped[enums.NotificationType] = mapped_column(enum_col(enums.NotificationType))
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    read_at: Mapped[datetime | None] = ts()
    created_at: Mapped[datetime] = created()


class RetentionLog(Base):
    __tablename__ = "retention_log"

    id: Mapped[uuid.UUID] = pk()
    semester_id: Mapped[uuid.UUID] = fk("semesters.id")
    lobbies_deleted: Mapped[int] = mapped_column(Integer, default=0)
    messages_deleted: Mapped[int] = mapped_column(Integer, default=0)
    ran_at: Mapped[datetime] = created()


class UsabilityEvent(Base):
    """Anonymous usability-test events. Never linked to a user id."""

    __tablename__ = "usability_events"

    id: Mapped[uuid.UUID] = pk()
    session_key: Mapped[str] = mapped_column(String(64), index=True)
    event: Mapped[str] = mapped_column(String(40))
    elapsed_ms: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = created()
