from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from .. import security
from ..realtime import hub

router = APIRouter(tags=["realtime"])


@router.websocket("/ws")
async def realtime_socket(socket: WebSocket, token: str = Query(...)) -> None:
    user_id = security.decode_access_token(token)
    if user_id is None:
        await socket.close(code=1008)
        return

    await socket.accept()
    await hub.register(user_id, socket)
    try:
        while True:
            await socket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await hub.unregister(user_id, socket)
