from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from . import repo, security

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Thiếu token xác thực")
    user_id = security.decode_access_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token không hợp lệ hoặc đã hết hạn")
    user = await repo.get_user(user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Không tìm thấy người dùng")
    return user


async def get_owned_device(
    device_id: int, user: dict = Depends(get_current_user)
) -> dict:
    device = await repo.get_device(device_id)
    if device is None or device["user_id"] != user["id"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy thiết bị")
    return device
