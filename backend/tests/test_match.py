from __future__ import annotations

from typing import Any

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.match import compute_match
from app.models import Lobby, UserPreferences
from tests.factories import auth, make_lobby, make_user

BASE = {
    "study_goal": "exam_prep",
    "atmosphere": "chill",
    "preferred_time": "evening",
    "communication_style": "chat_active",
    "language": "id",
}


def score(mine: dict[str, str], lobby: dict[str, str], creator: dict[str, str] | None) -> Any:
    fields = ("study_goal", "atmosphere", "preferred_time")
    return compute_match(
        UserPreferences(**(BASE | mine)),
        Lobby(**{k: (BASE | lobby)[k] for k in fields}),
        UserPreferences(**(BASE | creator)) if creator is not None else None,
        get_settings().match_weights,
    )


@pytest.mark.parametrize(
    ("mine", "lobby", "creator", "expected"),
    [
        ({}, {}, {}, 100),
        ({}, {"study_goal": "just_connect"}, {}, 65),
        ({}, {"atmosphere": "focused"}, {}, 75),
        ({}, {"atmosphere": "mixed"}, {}, 88),  # 87.5 rounds half to even
        ({"atmosphere": "mixed"}, {"atmosphere": "focused"}, {}, 88),
        ({}, {"preferred_time": "morning"}, {}, 80),
        ({}, {"preferred_time": "flexible"}, {}, 90),
        ({"preferred_time": "flexible"}, {"preferred_time": "morning"}, {}, 90),
        ({}, {}, {"communication_style": "chat_light"}, 95),
        ({}, {}, {"communication_style": "meetup_ready"}, 90),
        ({"communication_style": "meetup_ready"}, {}, {"communication_style": "chat_light"}, 95),
        ({}, {}, {"language": "en"}, 90),
        ({}, {}, {"language": "mixed"}, 95),
        ({}, {}, None, 80),
        (
            {},
            {"study_goal": "just_connect", "atmosphere": "focused", "preferred_time": "morning"},
            {"communication_style": "meetup_ready", "language": "en"},
            0,
        ),
    ],
)
def test_rules(
    mine: dict[str, str], lobby: dict[str, str], creator: dict[str, str] | None, expected: int
) -> None:
    assert score(mine, lobby, creator).score == expected


def test_breakdown_adds_up_and_carries_disclaimer() -> None:
    match = score({}, {"atmosphere": "mixed"}, {"language": "en"})
    assert [d.key for d in match.dimensions] == list(get_settings().match_weights)
    assert sum(d.points for d in match.dimensions) == pytest.approx(77.5)
    assert match.disclaimer == (
        "Berdasarkan preferensi belajar, bukan jaminan jadwal kelas yang sama."
    )


def test_weights_must_sum_to_one() -> None:
    with pytest.raises(ValueError, match="weights"):
        Settings(weight_language=0.5)


async def test_score_hidden_without_preferences(
    client: httpx.AsyncClient, db: AsyncSession
) -> None:
    owner = await make_user(db, prefs=True)
    lobby = await make_lobby(db, owner)
    plain, filled = await make_user(db), await make_user(db, prefs=True)
    url = f"/api/v1/lobbies/{lobby.id}"
    assert (await client.get(url, headers=auth(plain))).json()["match"] is None
    assert (await client.get(url, headers=auth(filled))).json()["match"]["score"] == 100
    # Scoring your own lobby against yourself would be meaningless.
    assert (await client.get(url, headers=auth(owner))).json()["match"] is None
