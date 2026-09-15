import asyncio
import logging

from fastapi import WebSocket
from fastapi.encoders import jsonable_encoder

log = logging.getLogger("smartwatt.realtime")


class RealtimeHub:
    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def register(self, user_id: int, socket: WebSocket) -> None:
        async with self._lock:
            self._connections.setdefault(user_id, set()).add(socket)

    async def unregister(self, user_id: int, socket: WebSocket) -> None:
        async with self._lock:
            sockets = self._connections.get(user_id)
            if sockets is None:
                return
            sockets.discard(socket)
            if not sockets:
                self._connections.pop(user_id, None)

    async def send_to_user(self, user_id: int | None, message: dict) -> None:
        if user_id is None:
            return

        sockets = list(self._connections.get(user_id, ()))
        if not sockets:
            return

        payload = jsonable_encoder(message)
        for socket in sockets:
            try:
                await socket.send_json(payload)
            except Exception as error:
                log.warning("dropping dead websocket: %s", error)
                await self.unregister(user_id, socket)


hub = RealtimeHub()
