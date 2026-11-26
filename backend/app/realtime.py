"""Realtime fan-out: one channel per lobby.

`Broker` is the seam. `InMemoryBroker` serves a single process; a Redis pub/sub implementation
can replace it without touching the routers.
"""

from __future__ import annotations

import asyncio
import uuid
from abc import ABC, abstractmethod
from collections import defaultdict
from collections.abc import Collection
from typing import Any, Protocol

Event = dict[str, Any]
SEND_TIMEOUT = 5.0


class Socket(Protocol):
    async def send_json(self, data: Any) -> None: ...
    async def close(self, code: int = 1000, reason: str | None = None) -> None: ...


class Broker(ABC):
    @abstractmethod
    def connect(self, lobby_id: uuid.UUID, user_id: uuid.UUID, socket: Socket) -> None: ...

    @abstractmethod
    def disconnect(self, lobby_id: uuid.UUID, user_id: uuid.UUID, socket: Socket) -> None: ...

    @abstractmethod
    async def broadcast(
        self, lobby_id: uuid.UUID, event: Event, exclude: Collection[uuid.UUID] = ()
    ) -> None: ...

    @abstractmethod
    async def kick(self, lobby_id: uuid.UUID, user_id: uuid.UUID, code: int = 4403) -> None: ...

    @abstractmethod
    async def kick_user(self, user_id: uuid.UUID, code: int = 4403) -> None: ...

    @abstractmethod
    def lobby_users(self, lobby_id: uuid.UUID) -> set[uuid.UUID]: ...

    @abstractmethod
    def online_users(self) -> set[uuid.UUID]: ...


class InMemoryBroker(Broker):
    def __init__(self) -> None:
        self._lobbies: dict[uuid.UUID, dict[uuid.UUID, set[Socket]]] = defaultdict(dict)

    def connect(self, lobby_id: uuid.UUID, user_id: uuid.UUID, socket: Socket) -> None:
        self._lobbies[lobby_id].setdefault(user_id, set()).add(socket)

    def disconnect(self, lobby_id: uuid.UUID, user_id: uuid.UUID, socket: Socket) -> None:
        users = self._lobbies.get(lobby_id)
        if users is None or user_id not in users:
            return
        users[user_id].discard(socket)
        if not users[user_id]:
            del users[user_id]
        if not users:
            del self._lobbies[lobby_id]

    async def broadcast(
        self, lobby_id: uuid.UUID, event: Event, exclude: Collection[uuid.UUID] = ()
    ) -> None:
        targets = [
            (user_id, socket)
            for user_id, sockets in self._lobbies.get(lobby_id, {}).items()
            if user_id not in exclude
            for socket in sockets
        ]
        await asyncio.gather(*(self._send(lobby_id, u, s, event) for u, s in targets))

    async def _send(
        self, lobby_id: uuid.UUID, user_id: uuid.UUID, socket: Socket, event: Event
    ) -> None:
        try:
            await asyncio.wait_for(socket.send_json(event), SEND_TIMEOUT)
        except Exception:  # a dead socket must never break delivery to the others
            self.disconnect(lobby_id, user_id, socket)

    async def kick(self, lobby_id: uuid.UUID, user_id: uuid.UUID, code: int = 4403) -> None:
        for socket in list(self._lobbies.get(lobby_id, {}).get(user_id, ())):
            self.disconnect(lobby_id, user_id, socket)
            try:
                await asyncio.wait_for(socket.close(code), SEND_TIMEOUT)
            except Exception:  # noqa: S110 - already gone
                pass

    async def kick_user(self, user_id: uuid.UUID, code: int = 4403) -> None:
        for lobby_id in [k for k, users in self._lobbies.items() if user_id in users]:
            await self.kick(lobby_id, user_id, code)

    def lobby_users(self, lobby_id: uuid.UUID) -> set[uuid.UUID]:
        return set(self._lobbies.get(lobby_id, {}))

    def online_users(self) -> set[uuid.UUID]:
        return {user for users in self._lobbies.values() for user in users}


broker: Broker = InMemoryBroker()
