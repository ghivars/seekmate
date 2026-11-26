"""Transparent preference match. Never implies identical class schedules."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from app.enums import Atmosphere, CommunicationStyle, Language, PreferredTime
from app.models import Lobby, UserPreferences

DISCLAIMER = "Berdasarkan preferensi belajar, bukan jaminan jadwal kelas yang sama."
Dimension = Literal["study_goal", "atmosphere", "preferred_time", "communication_style", "language"]
# Order defines adjacency.
STYLE_ORDER = [
    CommunicationStyle.chat_active,
    CommunicationStyle.chat_light,
    CommunicationStyle.meetup_ready,
]


class MatchDimension(BaseModel):
    key: Dimension
    weight: float
    similarity: float
    points: float
    lobby_value: str | None
    your_value: str


class MatchOut(BaseModel):
    score: int
    dimensions: list[MatchDimension]
    disclaimer: str = DISCLAIMER


def _same(a: object, b: object) -> float:
    return 1.0 if a == b else 0.0


def _same_or_wildcard(a: object, b: object, wildcard: object) -> float:
    if a == b:
        return 1.0
    return 0.5 if wildcard in (a, b) else 0.0


def _adjacent(a: CommunicationStyle, b: CommunicationStyle) -> float:
    distance = abs(STYLE_ORDER.index(a) - STYLE_ORDER.index(b))
    return {0: 1.0, 1: 0.5}.get(distance, 0.0)


def compute_match(
    mine: UserPreferences,
    lobby: Lobby,
    creator: UserPreferences | None,
    weights: dict[str, float],
) -> MatchOut:
    """First three dimensions come from the lobby, the last two from its creator's profile.

    A creator without preferences contributes 0 for those two, so unknowns never inflate a score.
    """
    rows: list[tuple[Dimension, float, str | None, str]] = [
        ("study_goal", _same(mine.study_goal, lobby.study_goal), lobby.study_goal, mine.study_goal),
        (
            "atmosphere",
            _same_or_wildcard(mine.atmosphere, lobby.atmosphere, Atmosphere.mixed),
            lobby.atmosphere,
            mine.atmosphere,
        ),
        (
            "preferred_time",
            _same_or_wildcard(mine.preferred_time, lobby.preferred_time, PreferredTime.flexible),
            lobby.preferred_time,
            mine.preferred_time,
        ),
        (
            "communication_style",
            _adjacent(mine.communication_style, creator.communication_style) if creator else 0.0,
            creator.communication_style if creator else None,
            mine.communication_style,
        ),
        (
            "language",
            _same_or_wildcard(mine.language, creator.language, Language.mixed) if creator else 0.0,
            creator.language if creator else None,
            mine.language,
        ),
    ]
    dimensions = [
        MatchDimension(
            key=key,
            weight=weights[key],
            similarity=similarity,
            points=round(weights[key] * similarity * 100, 2),
            lobby_value=theirs,
            your_value=yours,
        )
        for key, similarity, theirs, yours in rows
    ]
    return MatchOut(score=round(sum(d.points for d in dimensions)), dimensions=dimensions)
