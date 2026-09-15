from fastapi import APIRouter, Depends, HTTPException, status

from .. import ai, repo
from ..deps import get_current_user
from ..schemas import ChatRequest

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/chat")
async def chat(payload: ChatRequest, user: dict = Depends(get_current_user)) -> dict:
    device = await repo.get_device(payload.device_id)
    if device is None or device["user_id"] != user["id"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy thiết bị")

    answer = await ai.chat(
        device,
        payload.prompt,
        float(user.get("electric_price") or 0),
        float(user.get("water_price") or 10000),
    )
    return {"device_id": device["id"], "answer": answer}
