"""Outgoing mail. The dev implementation logs to the console."""

from __future__ import annotations

import logging
from typing import Protocol

from app.config import get_settings

log = logging.getLogger("uvicorn.error")


class Mailer(Protocol):
    async def send(self, to: str, subject: str, body: str) -> None: ...


class ConsoleMailer:
    async def send(self, to: str, subject: str, body: str) -> None:
        if get_settings().environment == "production":
            log.error("No production mailer configured; a message was not sent.")
            return
        log.info("\n--- EMAIL (dev) ---\nTo: %s\nSubject: %s\n\n%s\n---", to, subject, body)


mailer: Mailer = ConsoleMailer()


def get_mailer() -> Mailer:
    return mailer
