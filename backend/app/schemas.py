"""Request/response models shared by the routers."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints

from app.enums import (
    Atmosphere,
    CommunicationStyle,
    Language,
    PreferredTime,
    StudyGoal,
    UserRole,
)


def text_field(minimum: int, maximum: int) -> StringConstraints:
    return StringConstraints(strip_whitespace=True, min_length=minimum, max_length=maximum)


DisplayName = Annotated[str, text_field(2, 40)]
Password = Annotated[str, StringConstraints(min_length=10, max_length=128)]


class Orm(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Ok(BaseModel):
    ok: bool = True


class RegisterIn(BaseModel):
    email: EmailStr
    password: Password
    display_name: DisplayName


class EmailIn(BaseModel):
    email: EmailStr


class VerifyIn(BaseModel):
    token: str = Field(max_length=2000)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"  # noqa: S105
    expires_in: int


class RegisterOut(BaseModel):
    """`signed_in` is true when email verification is switched off."""

    signed_in: bool
    access_token: str | None = None
    expires_in: int | None = None


class WsTokenOut(BaseModel):
    token: str
    expires_in: int


class PreferencesIn(Orm):
    study_goal: StudyGoal
    atmosphere: Atmosphere
    preferred_time: PreferredTime
    communication_style: CommunicationStyle
    language: Language


class MeOut(Orm):
    id: uuid.UUID
    email: str
    display_name: str
    major: str
    cohort_year: int | None
    bio: str
    is_newcomer: bool
    role: UserRole
    code_of_conduct_at: datetime | None
    onboarded_at: datetime | None
    created_at: datetime
    preferences: PreferencesIn | None


class MePatch(BaseModel):
    display_name: DisplayName | None = None
    major: Annotated[str, text_field(0, 80)] | None = None
    cohort_year: int | None = Field(default=None, ge=1990, le=2100)
    bio: Annotated[str, text_field(0, 200)] | None = None
    is_newcomer: bool | None = None
    accept_code_of_conduct: bool | None = None
    complete_onboarding: bool | None = None


class PublicUser(Orm):
    """What other students can see. Never includes the email address."""

    id: uuid.UUID
    display_name: str
    major: str
    cohort_year: int | None
    bio: str
    is_newcomer: bool
