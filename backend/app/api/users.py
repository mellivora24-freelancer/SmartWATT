from fastapi import APIRouter, Depends, HTTPException, status

from .. import repo
from ..deps import get_current_user
from ..schemas import UserUpdate
from .auth import public_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me")
async def read_me(user: dict = Depends(get_current_user)) -> dict:
    return public_user(user)


@router.put("/me")
async def update_me(
    payload: UserUpdate, user: dict = Depends(get_current_user)
) -> dict:
    fields = payload.model_dump(exclude_unset=True)

    if fields.get("phone") and fields["phone"] != user["phone"]:
        if await repo.get_user_by_phone(fields["phone"]) is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Số điện thoại đã được sử dụng"
            )

    updated = await repo.update_user(user["id"], fields)
    if updated is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Không có thay đổi nào")
    return public_user(updated)
