"""Basic banned-words filter (case, accent and simple leetspeak insensitive)."""

from __future__ import annotations

import re
import unicodedata

from app.config import get_settings
from app.errors import invalid

_LEET = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a"})


def _normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.lower()).translate(_LEET)
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def _squeeze(token: str) -> str:
    """Collapse stretched letters ("goblooook") before comparing."""
    return re.sub(r"(.)\1+", r"\1", token)


def contains_banned_word(text: str) -> bool:
    tokens = {_squeeze(t) for t in re.findall(r"[a-z]+", _normalize(text))}
    banned = {_squeeze(_normalize(w)) for w in get_settings().banned_word_list}
    return not tokens.isdisjoint(banned)


def ensure_clean(*texts: str | None) -> None:
    if any(t and contains_banned_word(t) for t in texts):
        raise invalid("banned_words", "Ada kata yang tidak sesuai kode etik. Coba ubah kalimatnya.")
