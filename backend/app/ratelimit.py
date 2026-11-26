"""Sliding-window rate limiter. In-memory; swap the class for a Redis one to scale out."""

from __future__ import annotations

import time
from collections import defaultdict, deque

from app.config import get_settings
from app.errors import AppError


class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._last_sweep = 0.0

    def check(self, key: str, rate: str) -> None:
        """Raise 429 when `key` exceeded `rate` ("count/seconds")."""
        if not get_settings().rate_limit_enabled:
            return
        limit, seconds = (int(part) for part in rate.split("/"))
        now = time.monotonic()
        self._sweep(now)
        hits = self._hits[key]
        while hits and hits[0] <= now - seconds:
            hits.popleft()
        if len(hits) >= limit:
            retry = max(1, int(hits[0] + seconds - now) + 1)
            raise AppError(
                429,
                "rate_limited",
                f"Terlalu banyak percobaan. Coba lagi dalam {retry} detik.",
                headers={"Retry-After": str(retry)},
            )
        hits.append(now)

    def reset(self) -> None:
        self._hits.clear()

    def _sweep(self, now: float) -> None:
        """Drop idle keys so memory does not grow forever."""
        if now - self._last_sweep < 600:
            return
        self._last_sweep = now
        for key in [k for k, v in self._hits.items() if not v or v[-1] < now - 7200]:
            del self._hits[key]


limiter = RateLimiter()
