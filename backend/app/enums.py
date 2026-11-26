from __future__ import annotations

from enum import StrEnum


class UserRole(StrEnum):
    student = "student"
    admin = "admin"


class UserStatus(StrEnum):
    active = "active"
    suspended = "suspended"
    deleted = "deleted"


class StudyGoal(StrEnum):
    assignment_group = "assignment_group"
    exam_prep = "exam_prep"
    concept_discussion = "concept_discussion"
    just_connect = "just_connect"


class Atmosphere(StrEnum):
    chill = "chill"
    focused = "focused"
    mixed = "mixed"


class PreferredTime(StrEnum):
    morning = "morning"
    afternoon = "afternoon"
    evening = "evening"
    flexible = "flexible"


class CommunicationStyle(StrEnum):
    chat_active = "chat_active"
    chat_light = "chat_light"
    meetup_ready = "meetup_ready"


class Language(StrEnum):
    id = "id"
    en = "en"
    mixed = "mixed"


class LobbyVisibility(StrEnum):
    public = "public"
    closed = "closed"


class LobbyStatus(StrEnum):
    open = "open"
    full = "full"
    closed = "closed"
    expired = "expired"


class MemberRole(StrEnum):
    owner = "owner"
    member = "member"


class ConnectionStatus(StrEnum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"


class ReportTarget(StrEnum):
    message = "message"
    lobby = "lobby"
    user = "user"


class ReportReason(StrEnum):
    harassment = "harassment"
    spam = "spam"
    inappropriate = "inappropriate"
    other = "other"


class ReportStatus(StrEnum):
    open = "open"
    reviewed = "reviewed"
    actioned = "actioned"
    dismissed = "dismissed"


class NotificationType(StrEnum):
    new_message = "new_message"
    member_joined = "member_joined"
    connection_request = "connection_request"
    lobby_expiring = "lobby_expiring"
    slot_available = "slot_available"  # addition: full-lobby slot alerts
